/**
 * The player-controlled bird. Its horizontal position is fixed; the world
 * scrolls past it. Vertical motion is a simple gravity + impulse model, and the
 * sprite's tilt is derived from the current velocity for that signature
 * "flap-up, nose-dive" feel.
 */
import {
  BIRD_HEIGHT,
  BIRD_HITBOX_INSET_X,
  BIRD_HITBOX_INSET_Y,
  BIRD_MAX_ANGLE,
  BIRD_MIN_ANGLE,
  BIRD_ROTATION_LERP,
  BIRD_ROTATION_VELOCITY,
  BIRD_START_Y,
  BIRD_WIDTH,
  BIRD_X,
  FLAP_VELOCITY,
  GRAVITY,
  IDLE_BOB_AMPLITUDE,
  IDLE_BOB_SPEED,
  MAX_FALL_SPEED,
  WING_ANIM_INTERVAL,
  WING_FREEZE_VELOCITY,
} from './constants';
import type { SpriteSheet } from './sprites';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Ping-pong wing sequence: up → level → down → level. */
const WING_SEQUENCE: ReadonlyArray<0 | 1 | 2> = [0, 1, 2, 1];

export class Bird {
  /** Top-left Y of the sprite bounding box (X is fixed at BIRD_X). */
  y = BIRD_START_Y;
  velocity = 0;
  rotation = 0;

  private wingIndex = 0;
  private wingTimer = 0;
  /** Accumulates elapsed frames for the ready-screen idle bob. */
  private bobPhase = 0;

  reset(): void {
    this.y = BIRD_START_Y;
    this.velocity = 0;
    this.rotation = 0;
    this.wingIndex = 0;
    this.wingTimer = 0;
    this.bobPhase = 0;
  }

  /** Apply an upward impulse. */
  flap(): void {
    this.velocity = FLAP_VELOCITY;
    // Snap the nose up immediately for a responsive feel.
    this.rotation = BIRD_MIN_ANGLE;
    this.wingIndex = 0;
    this.wingTimer = 0;
  }

  /** Physics update while the game is actively being played. */
  update(dt: number): void {
    this.velocity = Math.min(this.velocity + GRAVITY * dt, MAX_FALL_SPEED);
    this.y += this.velocity * dt;

    // Derive target tilt from velocity.
    let target: number;
    if (this.velocity < 0) {
      target = BIRD_MIN_ANGLE;
    } else {
      const t = Math.min(1, this.velocity / BIRD_ROTATION_VELOCITY);
      target = BIRD_MIN_ANGLE + (BIRD_MAX_ANGLE - BIRD_MIN_ANGLE) * t;
    }
    // Smoothly rotate toward the target (framerate-independent).
    const lerp = 1 - Math.pow(1 - BIRD_ROTATION_LERP, dt);
    this.rotation += (target - this.rotation) * lerp;

    this.animateWings(dt, this.velocity < WING_FREEZE_VELOCITY);
  }

  /** Gentle bob used on the "get ready" screen. */
  updateIdle(dt: number): void {
    this.bobPhase += IDLE_BOB_SPEED * dt;
    this.y = BIRD_START_Y + Math.sin(this.bobPhase) * IDLE_BOB_AMPLITUDE;
    this.velocity = 0;
    this.rotation = 0;
    this.animateWings(dt, true);
  }

  /** Continue falling after death, but stop flapping the wings. */
  updateDead(dt: number): void {
    this.velocity = Math.min(this.velocity + GRAVITY * dt, MAX_FALL_SPEED);
    this.y += this.velocity * dt;
    const lerp = 1 - Math.pow(1 - BIRD_ROTATION_LERP, dt);
    this.rotation += (BIRD_MAX_ANGLE - this.rotation) * lerp;
  }

  private animateWings(dt: number, active: boolean): void {
    if (!active) return;
    this.wingTimer += dt;
    if (this.wingTimer >= WING_ANIM_INTERVAL) {
      this.wingTimer -= WING_ANIM_INTERVAL;
      this.wingIndex = (this.wingIndex + 1) % WING_SEQUENCE.length;
    }
  }

  /** Axis-aligned collision box, inset slightly for a forgiving feel. */
  getHitbox(): Rect {
    return {
      x: BIRD_X + BIRD_HITBOX_INSET_X,
      y: this.y + BIRD_HITBOX_INSET_Y,
      width: BIRD_WIDTH - BIRD_HITBOX_INSET_X * 2,
      height: BIRD_HEIGHT - BIRD_HITBOX_INSET_Y * 2,
    };
  }

  get centerY(): number {
    return this.y + BIRD_HEIGHT / 2;
  }

  draw(ctx: CanvasRenderingContext2D, sprites: SpriteSheet): void {
    const frame = sprites.birdFrames[WING_SEQUENCE[this.wingIndex]];
    ctx.save();
    ctx.translate(BIRD_X + BIRD_WIDTH / 2, this.y + BIRD_HEIGHT / 2);
    ctx.rotate(this.rotation);
    ctx.drawImage(frame, -BIRD_WIDTH / 2, -BIRD_HEIGHT / 2);
    ctx.restore();
  }
}
