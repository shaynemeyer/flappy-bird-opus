/**
 * The game controller: owns the canvas, the delta-time loop, input handling,
 * the finite state machine (ready → playing → gameover), collision, scoring and
 * all rendering (world, HUD and overlays).
 */
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  BEST_SCORE_STORAGE_KEY,
  BIRD_HEIGHT,
  BIRD_WIDTH,
  BIRD_X,
  COLORS,
  FIRST_PIPE_X,
  FLASH_DURATION,
  FRAME_MS,
  GROUND_Y,
  MAX_DT,
  MEDAL_THRESHOLDS,
  PIPE_GAP_MAX_CENTER,
  PIPE_GAP_MIN_CENTER,
  PIPE_SPACING,
  PIPE_SPEED,
  PIPE_WIDTH,
  RESTART_COOLDOWN,
  type GameState,
  type MedalTier,
} from './constants';
import { Bird, type Rect } from './bird';
import { Pipe } from './pipe';
import { createSprites, drawPixelNumber, measureNumberWidth, type SpriteSheet } from './sprites';
import { Sound } from './sound';

interface TextOptions {
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  fill?: string;
  outline?: string;
  lineWidth?: number;
  weight?: string;
  alpha?: number;
}

const FONT_STACK = `'Arial Rounded MT Bold', 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif`;

function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly sprites: SpriteSheet;
  private readonly sound = new Sound();

  private readonly bird = new Bird();
  private pipes: Pipe[] = [];

  private state: GameState = 'ready';
  private score = 0;
  private best = 0;
  private newBest = false;

  private groundOffset = 0;
  private lastTime = 0;
  private deathTime = 0;
  private flashTime = -Infinity;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is not available.');
    }
    this.ctx = ctx;
    this.sprites = createSprites();
    this.best = this.loadBest();

    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);

    // Input: pointer covers mouse + touch + pen.
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('keydown', this.onKeyDown);
    // Stop the space bar / arrows from scrolling the page.
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') e.preventDefault();
    });

    this.toReady();
    requestAnimationFrame(this.loop);
  }

  // -------------------------------------------------------------------------
  // Responsive scaling — keep the logical 288x512 world, scale to the viewport.
  // -------------------------------------------------------------------------
  private resize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const zoom = Math.max(1, Math.min(vw / BASE_WIDTH, vh / BASE_HEIGHT));

    this.canvas.style.width = `${BASE_WIDTH * zoom}px`;
    this.canvas.style.height = `${BASE_HEIGHT * zoom}px`;
    this.canvas.width = Math.round(BASE_WIDTH * zoom * dpr);
    this.canvas.height = Math.round(BASE_HEIGHT * zoom * dpr);

    // Draw in logical coordinates; the transform handles the scale-up.
    this.ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  };

  // -------------------------------------------------------------------------
  // State transitions
  // -------------------------------------------------------------------------
  private toReady(): void {
    this.state = 'ready';
    this.bird.reset();
    this.pipes = [];
    this.score = 0;
    this.newBest = false;
  }

  private startGame(): void {
    this.state = 'playing';
    this.bird.reset();
    this.pipes = [];
    this.score = 0;
    this.newBest = false;
    this.spawnPipe(FIRST_PIPE_X);
    this.bird.flap();
    this.sound.flap();
  }

  private die(): void {
    if (this.state !== 'playing') return;
    this.state = 'gameover';
    this.deathTime = performance.now();
    this.flashTime = this.deathTime;
    this.sound.hit();
    this.sound.die();
    if (this.score > this.best) {
      this.best = this.score;
      this.newBest = true;
      this.saveBest(this.best);
    }
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------
  private onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.sound.resume();
    this.handleTap();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      if (e.repeat) return; // treat auto-repeat as a single tap
      this.sound.resume();
      this.handleTap();
    } else if (e.code === 'Enter' && this.state === 'gameover') {
      e.preventDefault();
      this.handleTap();
    }
  };

  private handleTap(): void {
    switch (this.state) {
      case 'ready':
        this.startGame();
        break;
      case 'playing':
        this.bird.flap();
        this.sound.flap();
        break;
      case 'gameover':
        if (performance.now() - this.deathTime >= RESTART_COOLDOWN) {
          this.toReady();
        }
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Pipe management
  // -------------------------------------------------------------------------
  private spawnPipe(x: number): void {
    const range = PIPE_GAP_MAX_CENTER - PIPE_GAP_MIN_CENTER;
    const gapCenter = PIPE_GAP_MIN_CENTER + Math.random() * range;
    this.pipes.push(new Pipe(x, gapCenter));
  }

  private trySpawnPipe(): void {
    const last = this.pipes[this.pipes.length - 1];
    if (!last) {
      this.spawnPipe(FIRST_PIPE_X);
    } else if (last.x <= BASE_WIDTH - PIPE_SPACING) {
      this.spawnPipe(last.x + PIPE_SPACING);
    }
  }

  // -------------------------------------------------------------------------
  // Loop
  // -------------------------------------------------------------------------
  private loop = (time: number): void => {
    if (!this.lastTime) this.lastTime = time;
    const dt = Math.min((time - this.lastTime) / FRAME_MS, MAX_DT);
    this.lastTime = time;

    this.update(dt);
    this.render(time);

    requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    // The ground scrolls in every state except after death.
    if (this.state !== 'gameover') {
      const w = this.sprites.ground.width;
      this.groundOffset = (this.groundOffset + PIPE_SPEED * dt) % w;
    }

    if (this.state === 'ready') {
      this.bird.updateIdle(dt);
      return;
    }

    if (this.state === 'gameover') {
      // Bird keeps falling until it rests on the ground.
      this.bird.updateDead(dt);
      const maxY = GROUND_Y - BIRD_HEIGHT;
      if (this.bird.y > maxY) {
        this.bird.y = maxY;
        this.bird.velocity = 0;
      }
      return;
    }

    // --- Playing ---
    this.bird.update(dt);

    for (const pipe of this.pipes) pipe.update(dt);
    while (this.pipes.length && this.pipes[0].isOffscreen()) {
      this.pipes.shift();
    }
    this.trySpawnPipe();

    // Scoring: count a pipe once the bird's centre passes the pipe's centre.
    const birdCenterX = BIRD_X + BIRD_WIDTH / 2;
    for (const pipe of this.pipes) {
      if (!pipe.passed && pipe.x + PIPE_WIDTH / 2 < birdCenterX) {
        pipe.passed = true;
        this.score += 1;
        this.sound.score();
      }
    }

    // Collisions.
    const hitbox = this.bird.getHitbox();
    if (hitbox.y + hitbox.height >= GROUND_Y) {
      this.bird.y = GROUND_Y - BIRD_HEIGHT; // rest on the ground
      this.die();
      return;
    }
    for (const pipe of this.pipes) {
      const [top, bottom] = pipe.getRects();
      if (rectsIntersect(hitbox, top) || rectsIntersect(hitbox, bottom)) {
        this.die();
        return;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------
  private render(time: number): void {
    const ctx = this.ctx;

    // World: sky background.
    ctx.drawImage(this.sprites.background, 0, 0);

    // Pipes (only exist while playing / dying).
    for (const pipe of this.pipes) pipe.draw(ctx, this.sprites);

    // Scrolling ground.
    this.drawGround();

    // Bird.
    this.bird.draw(ctx, this.sprites);

    // Hit flash.
    this.drawFlash(time);

    // HUD / overlays.
    if (this.state === 'playing') {
      this.drawBigScore();
    } else if (this.state === 'ready') {
      this.drawReadyOverlay(time);
    } else {
      this.drawGameOverOverlay(time);
    }
  }

  private drawGround(): void {
    const ctx = this.ctx;
    const g = this.sprites.ground;
    const w = g.width;
    const off = Math.floor(this.groundOffset);
    ctx.drawImage(g, -off, GROUND_Y);
    ctx.drawImage(g, -off + w, GROUND_Y);
    // In case the viewport is wider in logical terms than one extra tile.
    if (-off + w < BASE_WIDTH) {
      ctx.drawImage(g, -off + w * 2, GROUND_Y);
    }
  }

  private drawFlash(time: number): void {
    const elapsed = time - this.flashTime;
    if (elapsed < 0 || elapsed >= FLASH_DURATION) return;
    const alpha = (1 - elapsed / FLASH_DURATION) * 0.85;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    ctx.restore();
  }

  private drawBigScore(): void {
    drawPixelNumber(this.ctx, this.score, BASE_WIDTH / 2, 44, {
      pixel: 7,
      fill: COLORS.textLight,
      outline: COLORS.textOutline,
      spacing: 1,
    });
  }

  private drawReadyOverlay(time: number): void {
    const cx = BASE_WIDTH / 2;
    this.text('FLAPPY BIRD', cx, 92, 30, { fill: COLORS.birdBody, lineWidth: 6 });
    this.text('GET READY', cx, 140, 17, {});

    // Best score reminder.
    this.text(`BEST  ${this.best}`, cx, GROUND_Y - 96, 11, { fill: COLORS.panelInner });

    // Pulsing instruction near the base.
    const pulse = 0.55 + 0.45 * Math.sin(time / 260);
    this.drawArrowHint(cx, GROUND_Y - 62, pulse);
    this.text('TAP · SPACE · CLICK', cx, GROUND_Y - 30, 12, { alpha: pulse });
    this.text('to flap', cx, GROUND_Y - 14, 10, { alpha: pulse, fill: COLORS.panelInner });
  }

  private drawArrowHint(cx: number, cy: number, alpha: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS.textLight;
    ctx.strokeStyle = COLORS.textOutline;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 9);
    ctx.lineTo(cx + 9, cy + 2);
    ctx.lineTo(cx + 4, cy + 2);
    ctx.lineTo(cx + 4, cy + 9);
    ctx.lineTo(cx - 4, cy + 9);
    ctx.lineTo(cx - 4, cy + 2);
    ctx.lineTo(cx - 9, cy + 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawGameOverOverlay(time: number): void {
    const cx = BASE_WIDTH / 2;
    this.text('GAME OVER', cx, 128, 30, { fill: COLORS.birdBodyShade, lineWidth: 6 });

    // Scoreboard panel.
    const panelW = 210;
    const panelH = 116;
    const panelX = Math.round((BASE_WIDTH - panelW) / 2);
    const panelY = 168;
    this.drawPanel(panelX, panelY, panelW, panelH);

    // Medal on the left.
    const medalCx = panelX + 46;
    const medalCy = panelY + panelH / 2 + 2;
    this.drawMedal(medalCx, medalCy, 26, this.getMedal(this.score));

    // Score + best on the right, right-aligned.
    const rightX = panelX + panelW - 20;
    this.text('SCORE', rightX, panelY + 20, 11, {
      align: 'right',
      fill: COLORS.panelBorder,
      outline: COLORS.panelInner,
      lineWidth: 2,
    });
    this.drawRightNumber(this.score, rightX, panelY + 28, 5);

    this.text('BEST', rightX, panelY + 66, 11, {
      align: 'right',
      fill: COLORS.panelBorder,
      outline: COLORS.panelInner,
      lineWidth: 2,
    });
    this.drawRightNumber(this.best, rightX, panelY + 74, 5);

    // "NEW" badge when a record was set.
    if (this.newBest) {
      this.drawNewBadge(rightX - 62, panelY + 70);
    }

    // Pulsing restart prompt.
    const ready = performance.now() - this.deathTime >= RESTART_COOLDOWN;
    if (ready) {
      const pulse = 0.55 + 0.45 * Math.sin(time / 260);
      this.text('TAP to play again', cx, panelY + panelH + 34, 13, { alpha: pulse });
    }
  }

  private drawRightNumber(value: number, rightX: number, topY: number, pixel: number): void {
    const style = { pixel, fill: COLORS.textLight, outline: COLORS.textOutline, spacing: 1 };
    const width = measureNumberWidth(value, style);
    drawPixelNumber(this.ctx, value, rightX - width / 2, topY, style);
  }

  private drawPanel(x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx;
    const r = 8;
    // Outer border.
    ctx.fillStyle = COLORS.panelBorder;
    this.roundRect(x - 2, y - 2, w + 4, h + 4, r + 2);
    ctx.fill();
    // Panel face.
    ctx.fillStyle = COLORS.panel;
    this.roundRect(x, y, w, h, r);
    ctx.fill();
    // Inner highlight edge.
    ctx.strokeStyle = COLORS.panelInner;
    ctx.lineWidth = 2;
    this.roundRect(x + 4, y + 4, w - 8, h - 8, r - 2);
    ctx.stroke();
  }

  private drawMedal(cx: number, cy: number, r: number, tier: MedalTier): void {
    const ctx = this.ctx;
    if (tier === 'none') {
      // Empty socket.
      ctx.fillStyle = 'rgba(84,64,47,0.25)';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const colorMap: Record<Exclude<MedalTier, 'none'>, string> = {
      bronze: COLORS.medalBronze,
      silver: COLORS.medalSilver,
      gold: COLORS.medalGold,
      platinum: COLORS.medalPlatinum,
    };
    const color = colorMap[tier];

    // Outer rim.
    ctx.fillStyle = COLORS.panelBorder;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // Disc.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Inner ring.
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 7, 0, Math.PI * 2);
    ctx.stroke();
    // Highlight glint.
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.32, cy - r * 0.32, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    // Star in the centre.
    this.drawStar(cx, cy, 5, r * 0.42, r * 0.18, 'rgba(255,255,255,0.85)');
  }

  private drawStar(
    cx: number,
    cy: number,
    points: number,
    outer: number,
    inner: number,
    fill: string,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = (Math.PI / points) * i - Math.PI / 2;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawNewBadge(x: number, y: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#e8482b';
    this.roundRect(x, y, 34, 15, 3);
    ctx.fill();
    ctx.restore();
    this.text('NEW', x + 17, y + 8, 9, {
      baseline: 'middle',
      fill: '#ffffff',
      outline: '#8f2a17',
      lineWidth: 2,
    });
  }

  // -------------------------------------------------------------------------
  // Small drawing / util helpers
  // -------------------------------------------------------------------------
  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx;
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  private text(value: string, x: number, y: number, size: number, opts: TextOptions): void {
    const ctx = this.ctx;
    const {
      align = 'center',
      baseline = 'alphabetic',
      fill = COLORS.textLight,
      outline = COLORS.textOutline,
      lineWidth = Math.max(2, size * 0.16),
      weight = '800',
      alpha = 1,
    } = opts;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${weight} ${size}px ${FONT_STACK}`;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = outline;
    ctx.strokeText(value, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(value, x, y);
    ctx.restore();
  }

  private getMedal(score: number): MedalTier {
    for (const { tier, score: threshold } of MEDAL_THRESHOLDS) {
      if (score >= threshold) return tier;
    }
    return 'none';
  }

  private loadBest(): number {
    try {
      const raw = localStorage.getItem(BEST_SCORE_STORAGE_KEY);
      const n = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch {
      return 0;
    }
  }

  private saveBest(value: number): void {
    try {
      localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(value));
    } catch {
      /* storage unavailable — ignore */
    }
  }
}
