/**
 * A single obstacle: a matched pair of pipes (one hanging from the ceiling, one
 * rising from the ground) separated by a fixed vertical gap. The world scrolls
 * these leftward past the stationary bird.
 */
import {
  GROUND_Y,
  PIPE_GAP,
  PIPE_SPEED,
  PIPE_WIDTH,
} from './constants';
import type { Rect } from './bird';
import { PIPE_SPRITE_INSET, type SpriteSheet } from './sprites';

export class Pipe {
  /** Left edge of the pipe body. */
  x: number;
  /** Vertical centre of the gap. */
  readonly gapCenter: number;
  /** Whether the bird has already cleared this pipe (for scoring once). */
  passed = false;

  constructor(x: number, gapCenter: number) {
    this.x = x;
    this.gapCenter = gapCenter;
  }

  update(dt: number): void {
    this.x -= PIPE_SPEED * dt;
  }

  get rightEdge(): number {
    return this.x + PIPE_WIDTH;
  }

  get gapTop(): number {
    return this.gapCenter - PIPE_GAP / 2;
  }

  get gapBottom(): number {
    return this.gapCenter + PIPE_GAP / 2;
  }

  isOffscreen(): boolean {
    return this.rightEdge < 0;
  }

  /** Collision rectangles for the top and bottom pipe bodies. */
  getRects(): [Rect, Rect] {
    const top: Rect = {
      x: this.x,
      y: 0,
      width: PIPE_WIDTH,
      height: this.gapTop,
    };
    const bottom: Rect = {
      x: this.x,
      y: this.gapBottom,
      width: PIPE_WIDTH,
      height: GROUND_Y - this.gapBottom,
    };
    return [top, bottom];
  }

  draw(ctx: CanvasRenderingContext2D, sprites: SpriteSheet): void {
    const drawX = Math.round(this.x - PIPE_SPRITE_INSET);
    const spriteH = sprites.pipeTop.height;

    // Top pipe: sprite bottom aligns with the top of the gap.
    ctx.drawImage(sprites.pipeTop, drawX, Math.round(this.gapTop - spriteH));
    // Bottom pipe: sprite top aligns with the bottom of the gap.
    ctx.drawImage(sprites.pipeBottom, drawX, Math.round(this.gapBottom));
  }
}
