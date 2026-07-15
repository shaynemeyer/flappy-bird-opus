/**
 * Programmatic sprite generation. Rather than shipping copyrighted image
 * assets, every visual element is drawn onto an offscreen canvas at the game's
 * native (low) resolution using the original colour palette. The main renderer
 * blits these with image smoothing disabled so they scale up into crisp,
 * chunky pixel art.
 */
import {
  BASE_WIDTH,
  BIRD_HEIGHT,
  BIRD_WIDTH,
  COLORS,
  GROUND_HEIGHT,
  GROUND_Y,
  PIPE_CAP_HEIGHT,
  PIPE_CAP_OVERHANG,
  PIPE_WIDTH,
} from './constants';

export interface SpriteSheet {
  /** Static parallax background (sky, clouds, city, bushes). */
  background: HTMLCanvasElement;
  /** Seamlessly tiling ground strip. */
  ground: HTMLCanvasElement;
  /** The three wing-flap frames of the bird. */
  birdFrames: [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement];
  /** A single, tall pipe body with the cap at its top (the "top" pipe, flipped for the bottom). */
  pipeTop: HTMLCanvasElement;
  pipeBottom: HTMLCanvasElement;
}

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------
function createCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to acquire 2D canvas context for sprite generation.');
  }
  return { canvas, ctx };
}

function ellipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rotation = 0,
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rotation, 0, Math.PI * 2);
}

// ---------------------------------------------------------------------------
// Bird
// ---------------------------------------------------------------------------
type WingFrame = 0 | 1 | 2;

function drawBird(ctx: CanvasRenderingContext2D, frame: WingFrame): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const outline = COLORS.birdOutline;

  // --- Tail feathers (behind the body) ---
  ctx.fillStyle = COLORS.birdBodyShade;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(6, 9);
  ctx.lineTo(1, 7.5);
  ctx.lineTo(4, 12);
  ctx.lineTo(1, 15);
  ctx.lineTo(7, 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // --- Body ---
  ctx.lineWidth = 2;
  ctx.fillStyle = COLORS.birdBody;
  ctx.strokeStyle = outline;
  ellipse(ctx, 16, 12, 14, 9.5);
  ctx.fill();
  ctx.stroke();

  // Lower belly highlight.
  ctx.save();
  ctx.clip();
  ctx.fillStyle = COLORS.birdBelly;
  ellipse(ctx, 15, 18, 11, 7);
  ctx.fill();
  // Upper-back shading.
  ctx.fillStyle = COLORS.birdBodyShade;
  ellipse(ctx, 10, 7, 9, 4.5);
  ctx.fill();
  ctx.restore();

  // --- Wing (near side, on top of the body) ---
  drawWing(ctx, frame, outline);

  // --- Eye ---
  ctx.fillStyle = COLORS.eyeWhite;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.6;
  ellipse(ctx, 23.5, 8.5, 4.6, 4.8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.pupil;
  ellipse(ctx, 25, 8.6, 2.1, 2.4);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ellipse(ctx, 24.1, 7.6, 0.9, 0.9);
  ctx.fill();

  // --- Beak ---
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.6;
  // Upper beak.
  ctx.fillStyle = COLORS.beak;
  ctx.beginPath();
  ctx.moveTo(25, 11.2);
  ctx.lineTo(32.5, 11.6);
  ctx.quadraticCurveTo(34, 12.6, 32.5, 13.8);
  ctx.lineTo(25, 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Lower beak.
  ctx.fillStyle = COLORS.beakShade;
  ctx.beginPath();
  ctx.moveTo(25, 15);
  ctx.lineTo(31, 15);
  ctx.quadraticCurveTo(32, 16.2, 30.5, 17.4);
  ctx.lineTo(25, 17.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawWing(ctx: CanvasRenderingContext2D, frame: WingFrame, outline: string): void {
  ctx.save();
  // Frame-specific pivot & angle produce the up / level / down flap poses.
  const poses: Record<WingFrame, { y: number; angle: number }> = {
    0: { y: 8.5, angle: -0.55 },
    1: { y: 13, angle: 0 },
    2: { y: 17, angle: 0.55 },
  };
  const pose = poses[frame];
  ctx.translate(12, pose.y);
  ctx.rotate(pose.angle);

  ctx.fillStyle = COLORS.birdWing;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.6;
  ellipse(ctx, 0, 0, 7, 4.6);
  ctx.fill();
  ctx.stroke();

  // Under-wing shading.
  ctx.save();
  ctx.clip();
  ctx.fillStyle = COLORS.birdWingShade;
  ellipse(ctx, 0, 2.4, 7, 3);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function buildBirdFrames(): [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement] {
  const frames = [0, 1, 2].map((f) => {
    const { canvas, ctx } = createCanvas(BIRD_WIDTH, BIRD_HEIGHT);
    drawBird(ctx, f as WingFrame);
    return canvas;
  });
  return frames as [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement];
}

// ---------------------------------------------------------------------------
// Pipes
// ---------------------------------------------------------------------------
/**
 * Horizontal offset between the pipe canvas's left edge and the pipe body's
 * left edge. The canvas is widened by the cap overhang on both sides so the
 * wider lip is never clipped; callers draw the sprite at `x - PIPE_SPRITE_INSET`.
 */
export const PIPE_SPRITE_INSET = PIPE_CAP_OVERHANG;

/**
 * Builds one full-height pipe canvas. `capAtBottom` positions the decorative
 * lip: the "top" pipe hangs from the ceiling with its cap at the bottom, and
 * the "bottom" pipe rises from below with its cap at the top. We draw the cap
 * at the appropriate end so both read correctly without runtime flipping.
 */
function buildPipe(capAtBottom: boolean): HTMLCanvasElement {
  const height = GROUND_Y; // tall enough for any placement; we slice as needed.
  const canvasW = PIPE_WIDTH + PIPE_CAP_OVERHANG * 2;
  const { canvas, ctx } = createCanvas(canvasW, height);

  const bodyX = PIPE_CAP_OVERHANG;
  const bodyW = PIPE_WIDTH;

  // Body gradient: bright highlight on the left, deep shade on the right.
  const grad = ctx.createLinearGradient(bodyX, 0, bodyX + bodyW, 0);
  grad.addColorStop(0.0, COLORS.pipeShade);
  grad.addColorStop(0.12, COLORS.pipeHighlight);
  grad.addColorStop(0.38, COLORS.pipeBody);
  grad.addColorStop(0.75, COLORS.pipeBody);
  grad.addColorStop(1.0, COLORS.pipeDeep);

  ctx.fillStyle = grad;
  ctx.fillRect(bodyX, 0, bodyW, height);

  // Body outline (left & right edges).
  ctx.strokeStyle = COLORS.pipeOutline;
  ctx.lineWidth = 2;
  ctx.strokeRect(bodyX + 1, -2, bodyW - 2, height + 4);

  // Cap (the wider lip at the mouth of the pipe).
  const capX = 0;
  const capW = canvasW;
  const capY = capAtBottom ? height - PIPE_CAP_HEIGHT : 0;

  const capGrad = ctx.createLinearGradient(capX, 0, capX + capW, 0);
  capGrad.addColorStop(0.0, COLORS.pipeShade);
  capGrad.addColorStop(0.12, COLORS.pipeHighlight);
  capGrad.addColorStop(0.4, COLORS.pipeBody);
  capGrad.addColorStop(0.78, COLORS.pipeBody);
  capGrad.addColorStop(1.0, COLORS.pipeDeep);

  ctx.fillStyle = capGrad;
  ctx.fillRect(capX, capY, capW, PIPE_CAP_HEIGHT);
  ctx.strokeStyle = COLORS.pipeOutline;
  ctx.lineWidth = 2;
  ctx.strokeRect(capX + 1, capY + 1, capW - 2, PIPE_CAP_HEIGHT - 2);

  return canvas;
}

// ---------------------------------------------------------------------------
// Background (sky + clouds + city + bushes)
// ---------------------------------------------------------------------------
function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = COLORS.cloudShade;
  ellipse(ctx, 0, 3, 26, 12);
  ctx.fill();
  ctx.fillStyle = COLORS.cloud;
  ellipse(ctx, -12, 2, 12, 9);
  ctx.fill();
  ellipse(ctx, 0, -3, 15, 12);
  ctx.fill();
  ellipse(ctx, 13, 1, 13, 10);
  ctx.fill();
  ellipse(ctx, 2, 5, 24, 8);
  ctx.fill();
  ctx.restore();
}

function drawCity(ctx: CanvasRenderingContext2D, width: number, baseY: number): void {
  // A repeating pattern of 12 blocks spans the full width so it tiles cleanly.
  const heights = [18, 27, 14, 31, 21, 24, 16, 29, 22, 18, 26, 20];
  const blockW = width / heights.length;
  for (let i = 0; i < heights.length; i++) {
    const h = heights[i];
    const x = i * blockW;
    ctx.fillStyle = i % 2 === 0 ? COLORS.cityLight : COLORS.cityDark;
    ctx.fillRect(Math.round(x), baseY - h, Math.ceil(blockW) + 1, h + 40);
    // Simple windows.
    ctx.fillStyle = i % 2 === 0 ? COLORS.cityDark : COLORS.cityLight;
    for (let wy = baseY - h + 4; wy < baseY - 2; wy += 6) {
      for (let wx = x + 3; wx < x + blockW - 3; wx += 6) {
        ctx.fillRect(Math.round(wx), Math.round(wy), 2, 3);
      }
    }
  }
}

function drawBushes(ctx: CanvasRenderingContext2D, width: number, baseY: number): void {
  // Solid base band.
  ctx.fillStyle = COLORS.bushMid;
  ctx.fillRect(0, baseY, width, GROUND_Y - baseY + 4);

  // Rounded bumps along the top edge (period divides width for seamless tiling).
  const period = 16;
  for (let x = 0; x <= width; x += period) {
    const r = x % (period * 2) === 0 ? 11 : 8;
    ctx.fillStyle = COLORS.bushMid;
    ellipse(ctx, x, baseY, r, r * 0.8);
    ctx.fill();
    // Highlight on the upper-left of each bump.
    ctx.fillStyle = COLORS.bushLight;
    ellipse(ctx, x - r * 0.3, baseY - r * 0.35, r * 0.5, r * 0.4);
    ctx.fill();
  }
  // Darker shadow line where bushes meet the ground.
  ctx.fillStyle = COLORS.bushDark;
  ctx.fillRect(0, GROUND_Y - 3, width, 3);
}

function buildBackground(): HTMLCanvasElement {
  const width = BASE_WIDTH;
  const height = GROUND_Y;
  const { canvas, ctx } = createCanvas(width, height);

  // Sky gradient.
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, COLORS.skyTop);
  sky.addColorStop(1, COLORS.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Clouds (drawn at, and wrapped around, the edges so the layer can tile).
  const clouds = [
    { x: 44, y: 76, s: 1.0 },
    { x: 150, y: 50, s: 0.8 },
    { x: 232, y: 88, s: 1.15 },
    { x: 300, y: 64, s: 0.7 },
  ];
  for (const c of clouds) {
    drawCloud(ctx, c.x, c.y, c.s);
    drawCloud(ctx, c.x - width, c.y, c.s);
    drawCloud(ctx, c.x + width, c.y, c.s);
  }

  // City skyline sitting just behind the bushes.
  drawCity(ctx, width, height - 40);

  // Bush row along the very bottom of the sky layer.
  drawBushes(ctx, width, height - 22);

  return canvas;
}

// ---------------------------------------------------------------------------
// Ground (seamlessly tiling)
// ---------------------------------------------------------------------------
function buildGround(): HTMLCanvasElement {
  const width = BASE_WIDTH; // 288 is divisible by the 24px stripe period → tiles.
  const height = GROUND_HEIGHT;
  const { canvas, ctx } = createCanvas(width, height);

  const grassBottom = 12;

  // Grass band.
  ctx.fillStyle = COLORS.groundGrassMid;
  ctx.fillRect(0, 0, width, grassBottom);
  ctx.fillStyle = COLORS.groundGrassTop;
  ctx.fillRect(0, 0, width, 3);
  // Little grass tufts.
  ctx.fillStyle = COLORS.groundGrassLine;
  for (let x = 0; x < width; x += 8) {
    ctx.fillRect(x, grassBottom - 4, 3, 4);
  }
  ctx.fillRect(0, grassBottom - 1, width, 1);

  // Dirt band with diagonal stripes.
  const dirtTop = grassBottom;
  const dirtBottom = height - 4;
  ctx.fillStyle = COLORS.groundDirt;
  ctx.fillRect(0, dirtTop, width, dirtBottom - dirtTop);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, dirtTop, width, dirtBottom - dirtTop);
  ctx.clip();
  ctx.strokeStyle = COLORS.groundDirtStripe;
  ctx.lineWidth = 9;
  const period = 24;
  const bandH = dirtBottom - dirtTop;
  for (let x = -bandH; x < width + bandH; x += period) {
    ctx.beginPath();
    ctx.moveTo(x, dirtTop);
    ctx.lineTo(x + bandH, dirtBottom);
    ctx.stroke();
  }
  ctx.restore();

  // Light line under the grass and dark line at the very bottom.
  ctx.fillStyle = COLORS.panelInner;
  ctx.fillRect(0, dirtTop, width, 2);
  ctx.fillStyle = COLORS.groundDirtLine;
  ctx.fillRect(0, dirtBottom, width, height - dirtBottom);

  return canvas;
}

// ---------------------------------------------------------------------------
// Pixel-font number renderer (for the big in-game score and panel scores)
// ---------------------------------------------------------------------------
const DIGIT_FONT: Record<string, readonly string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
};

const DIGIT_COLS = 3;
const DIGIT_ROWS = 5;

export interface NumberStyle {
  pixel: number;
  fill: string;
  outline: string;
  /** Gap between digits, in "pixels" (multiplied by `pixel`). */
  spacing?: number;
}

export function measureNumberWidth(value: number, style: NumberStyle): number {
  const text = Math.max(0, Math.floor(value)).toString();
  const spacing = style.spacing ?? 1;
  return text.length * DIGIT_COLS * style.pixel + (text.length - 1) * spacing * style.pixel;
}

/**
 * Draws an integer as chunky, outlined pixel digits centred horizontally on
 * `centerX`, with its top at `topY`.
 */
export function drawPixelNumber(
  ctx: CanvasRenderingContext2D,
  value: number,
  centerX: number,
  topY: number,
  style: NumberStyle,
): void {
  const text = Math.max(0, Math.floor(value)).toString();
  const { pixel, fill, outline } = style;
  const spacing = style.spacing ?? 1;
  const totalWidth = measureNumberWidth(value, style);
  let cursorX = Math.round(centerX - totalWidth / 2);
  const baseY = Math.round(topY);
  const t = Math.max(1, Math.round(pixel * 0.34)); // outline thickness

  // Pass 1: outline (drawn behind every "on" pixel of every digit).
  ctx.fillStyle = outline;
  for (const ch of text) {
    const glyph = DIGIT_FONT[ch];
    if (glyph) {
      for (let row = 0; row < DIGIT_ROWS; row++) {
        for (let col = 0; col < DIGIT_COLS; col++) {
          if (glyph[row][col] === '1') {
            ctx.fillRect(cursorX + col * pixel - t, baseY + row * pixel - t, pixel + 2 * t, pixel + 2 * t);
          }
        }
      }
    }
    cursorX += DIGIT_COLS * pixel + spacing * pixel;
  }

  // Pass 2: fill.
  cursorX = Math.round(centerX - totalWidth / 2);
  ctx.fillStyle = fill;
  for (const ch of text) {
    const glyph = DIGIT_FONT[ch];
    if (glyph) {
      for (let row = 0; row < DIGIT_ROWS; row++) {
        for (let col = 0; col < DIGIT_COLS; col++) {
          if (glyph[row][col] === '1') {
            ctx.fillRect(cursorX + col * pixel, baseY + row * pixel, pixel, pixel);
          }
        }
      }
    }
    cursorX += DIGIT_COLS * pixel + spacing * pixel;
  }
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------
export function createSprites(): SpriteSheet {
  return {
    background: buildBackground(),
    ground: buildGround(),
    birdFrames: buildBirdFrames(),
    pipeTop: buildPipe(true),
    pipeBottom: buildPipe(false),
  };
}
