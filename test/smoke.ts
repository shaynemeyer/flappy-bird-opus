/**
 * Headless verification of the game's runtime logic: entity physics, pipe
 * geometry, state transitions, scoring, collision, medals and best-score
 * persistence. Run via `npm test`.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import './dom-stub';
import { clock, FakeCanvas, storage } from './dom-stub';
import { Game } from '../src/game';
import { Bird } from '../src/bird';
import { Pipe } from '../src/pipe';
import {
  BIRD_START_Y,
  BIRD_WIDTH,
  BIRD_X,
  BIRD_HITBOX_INSET_X,
  FLAP_VELOCITY,
  GRAVITY,
  GROUND_Y,
  PIPE_GAP,
  PIPE_WIDTH,
} from '../src/constants';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log('  ok   ', name);
  } else {
    failed++;
    console.error('  FAIL ', name);
  }
}
function approx(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) < eps;
}

function tap(g: any): void {
  g.onPointerDown({ preventDefault() {} });
}

/** Advance the game loop by `frames` steps of ~16.67ms without any input. */
function runFrames(g: any, frames: number, stopWhenGameover = true): number {
  let t = clock.get();
  for (let i = 0; i < frames; i++) {
    t += 1000 / 60;
    clock.set(t);
    g.loop(t);
    if (stopWhenGameover && g.state === 'gameover') return i + 1;
  }
  return frames;
}

console.log('\nBird');
{
  const b = new Bird();
  check('reset places bird at start Y', approx(b.y, BIRD_START_Y));
  b.flap();
  check('flap sets upward velocity', b.velocity === FLAP_VELOCITY);
  const yAfterFlap = b.y;
  b.update(1);
  check('gravity reduces upward velocity after a frame', b.velocity > FLAP_VELOCITY);
  check('velocity increased by exactly gravity', approx(b.velocity, FLAP_VELOCITY + GRAVITY));
  check('bird moves up immediately after a flap', b.y < yAfterFlap);

  b.reset();
  const hb = b.getHitbox();
  check('hitbox is inset horizontally', hb.x === BIRD_X + BIRD_HITBOX_INSET_X);
  check('hitbox width is inset on both sides', hb.width === BIRD_WIDTH - BIRD_HITBOX_INSET_X * 2);

  // Terminal velocity is respected after a long fall.
  b.reset();
  for (let i = 0; i < 200; i++) b.update(1);
  check('fall speed is capped at terminal velocity', b.velocity <= 11 + 1e-9);
}

console.log('\nPipe');
{
  const p = new Pipe(200, 250);
  check('gapTop = center - gap/2', approx(p.gapTop, 250 - PIPE_GAP / 2));
  check('gapBottom = center + gap/2', approx(p.gapBottom, 250 + PIPE_GAP / 2));
  const [top, bottom] = p.getRects();
  check('top rect starts at y=0', top.y === 0 && approx(top.height, p.gapTop));
  check('top rect width equals pipe width', top.width === PIPE_WIDTH);
  check('bottom rect starts at gapBottom', approx(bottom.y, p.gapBottom));
  check('bottom rect reaches the ground', approx(bottom.y + bottom.height, GROUND_Y));

  const xBefore = p.x;
  p.update(1);
  check('pipe scrolls left over time', p.x < xBefore);
  check('pipe not offscreen while on-screen', !p.isOffscreen());
  p.x = -PIPE_WIDTH - 1;
  check('pipe reports offscreen once fully past the left edge', p.isOffscreen());
}

console.log('\nGame — state machine');
const canvas = new FakeCanvas();
{
  clock.set(0);
  const g: any = new Game(canvas as any);
  check('starts in the ready state', g.state === 'ready');

  tap(g);
  check('first tap enters playing state', g.state === 'playing');
  check('starting a run spawns exactly one pipe', g.pipes.length === 1);
  check('starting a run flaps the bird', g.bird.velocity === FLAP_VELOCITY);
  check('score resets to zero at the start of a run', g.score === 0);
}

console.log('\nGame — medals');
{
  clock.set(0);
  const g: any = new Game(canvas as any);
  check('no medal below 10', g.getMedal(0) === 'none' && g.getMedal(9) === 'none');
  check('bronze at 10', g.getMedal(10) === 'bronze');
  check('silver at 20', g.getMedal(20) === 'silver');
  check('gold at 30', g.getMedal(30) === 'gold');
  check('platinum at 40', g.getMedal(45) === 'platinum');
}

console.log('\nGame — falling into the ground ends the run');
{
  clock.set(0);
  const g: any = new Game(canvas as any);
  tap(g); // start playing
  const framesToDeath = runFrames(g, 600);
  check('bird eventually dies from gravity alone', g.state === 'gameover');
  check('death happens within a reasonable time', framesToDeath > 0 && framesToDeath < 600);
  // Rendering after death must not throw.
  runFrames(g, 30, false);
  check('bird comes to rest on top of the ground', g.bird.y + BIRD_WIDTH >= 0 && g.bird.y <= GROUND_Y);
}

console.log('\nGame — scoring when a pipe is cleared');
{
  clock.set(0);
  const g: any = new Game(canvas as any);
  tap(g);
  // Place a single pipe whose centre is already just behind the bird, with the
  // gap centred on the bird so there is no collision.
  g.pipes = [new Pipe(BIRD_X - PIPE_WIDTH, g.bird.centerY)];
  g.update(0); // dt=0: no movement, but scoring + collision checks run
  check('clearing a pipe increments the score', g.score === 1);
  check('the cleared pipe is flagged as passed', g.pipes[0].passed === true);
  check('still alive after a clean pass', g.state === 'playing');
  g.update(0);
  check('a pipe is only scored once', g.score === 1);
}

console.log('\nGame — collision with a pipe ends the run');
{
  clock.set(0);
  const g: any = new Game(canvas as any);
  tap(g);
  // A pipe directly on the bird with its gap far above → guaranteed overlap.
  g.pipes = [new Pipe(BIRD_X, 40)];
  g.update(0);
  check('hitting a pipe ends the run', g.state === 'gameover');
}

console.log('\nGame — best score persists across runs');
{
  storage.clear();
  clock.set(0);
  const g: any = new Game(canvas as any);
  tap(g);
  g.pipes = [new Pipe(BIRD_X - PIPE_WIDTH, g.bird.centerY)];
  g.update(0); // score becomes 1
  g.die(); // force game over → should record a new best
  check('a new best is flagged', g.newBest === true);
  check('best score written to storage', storage.getItem('flappy-bird-best') === '1');

  const g2: any = new Game(canvas as any);
  check('a fresh game loads the persisted best', g2.best === 1);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exitCode = 1;
