/**
 * Central configuration for the game. All spatial values are expressed in the
 * game's *logical* coordinate space (288 x 512), which mirrors the resolution
 * of the original mobile release. The canvas is then scaled up to fit the
 * viewport while preserving crisp, chunky pixels.
 *
 * Physics values are tuned in "per-frame-at-60fps" units. The game loop feeds
 * every update a `dt` factor (1.0 == exactly 60fps) so the simulation runs at a
 * consistent speed regardless of the display's refresh rate.
 */

// ---------------------------------------------------------------------------
// Canvas / world dimensions
// ---------------------------------------------------------------------------
export const BASE_WIDTH = 288;
export const BASE_HEIGHT = 512;

/** Height of the scrolling ground strip along the bottom. */
export const GROUND_HEIGHT = 112;
/** Y coordinate where the ground begins (top of the base). */
export const GROUND_Y = BASE_HEIGHT - GROUND_HEIGHT;

// ---------------------------------------------------------------------------
// Bird
// ---------------------------------------------------------------------------
export const BIRD_WIDTH = 34;
export const BIRD_HEIGHT = 24;

/** Horizontal position of the bird (fixed; the world scrolls past it). */
export const BIRD_X = 68;
/** Starting vertical position when a run begins. */
export const BIRD_START_Y = Math.round(BASE_HEIGHT * 0.42);

/**
 * The visible sprite is a touch larger than the true hitbox. Insetting the
 * collision box makes near-misses feel fair, matching the forgiving feel of
 * the original.
 */
export const BIRD_HITBOX_INSET_X = 3;
export const BIRD_HITBOX_INSET_Y = 4;

// ---------------------------------------------------------------------------
// Physics (per-frame @ 60fps)
// ---------------------------------------------------------------------------
/**
 * Downward acceleration applied every frame. Softened for a calmer, less
 * twitchy feel — the bird builds speed more gradually, giving the player more
 * time to react.
 */
export const GRAVITY = 0.34;
/**
 * Instantaneous upward velocity set when the player flaps. Reduced alongside
 * gravity so each tap is gentler while the overall jump-arc height (≈ v²/2g)
 * stays close to the original, keeping pipe gaps just as fair to clear.
 */
export const FLAP_VELOCITY = -6.1;
/** Terminal downward velocity so the bird never falls unreadably fast. */
export const MAX_FALL_SPEED = 9.5;

/** Rotation (radians) the bird snaps to at the peak of a flap (nose up). */
export const BIRD_MIN_ANGLE = (-25 * Math.PI) / 180;
/** Rotation (radians) the bird reaches in a full nose-dive. */
export const BIRD_MAX_ANGLE = (90 * Math.PI) / 180;
/**
 * Velocity at which the downward tilt reaches its maximum. Below this the tilt
 * interpolates smoothly from the flap angle toward straight-down.
 */
export const BIRD_ROTATION_VELOCITY = 10;
/** How quickly the bird rotates toward its target angle (fraction per frame). */
export const BIRD_ROTATION_LERP = 0.18;

/** Frames between wing-animation frame changes while flapping. */
export const WING_ANIM_INTERVAL = 5;
/** Above this downward velocity the wing freezes mid-dive (like the original). */
export const WING_FREEZE_VELOCITY = 6;

/** Idle bob (ready screen) parameters. */
export const IDLE_BOB_AMPLITUDE = 4;
export const IDLE_BOB_SPEED = 0.12;

// ---------------------------------------------------------------------------
// Pipes
// ---------------------------------------------------------------------------
export const PIPE_WIDTH = 52;
/** Vertical opening the bird must fly through. */
export const PIPE_GAP = 110;
/** Horizontal distance between the leading edges of consecutive pipe pairs. */
export const PIPE_SPACING = 172;
/** Leftward scroll speed shared by pipes and the ground. */
export const PIPE_SPEED = 2.15;

/** Height of the decorative lip/cap at the mouth of each pipe. */
export const PIPE_CAP_HEIGHT = 26;
/** How far the cap overhangs the pipe body on each side. */
export const PIPE_CAP_OVERHANG = 3;

/** Clamp gap centers so pipes never hug the ceiling or the ground. */
export const PIPE_GAP_MIN_CENTER = 90;
export const PIPE_GAP_MAX_CENTER = GROUND_Y - 90;

/** X position where the very first pipe of a run appears. */
export const FIRST_PIPE_X = BASE_WIDTH + 40;

// ---------------------------------------------------------------------------
// Scoring / medals
// ---------------------------------------------------------------------------
export const BEST_SCORE_STORAGE_KEY = 'flappy-bird-best';

export type MedalTier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';

/** Score thresholds for each medal, matching the classic tiers. */
export const MEDAL_THRESHOLDS: ReadonlyArray<{ tier: MedalTier; score: number }> = [
  { tier: 'platinum', score: 40 },
  { tier: 'gold', score: 30 },
  { tier: 'silver', score: 20 },
  { tier: 'bronze', score: 10 },
];

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------
/** Reference frame duration (ms) that a dt factor of 1.0 represents. */
export const FRAME_MS = 1000 / 60;
/** Largest dt factor allowed per frame, to avoid tunneling after a stall. */
export const MAX_DT = 2.5;

/** Duration (ms) of the white "hit" flash when the bird dies. */
export const FLASH_DURATION = 90;
/** Delay (ms) after death before restart input is accepted. */
export const RESTART_COOLDOWN = 550;

// ---------------------------------------------------------------------------
// Colour palette (approximation of the original day-time art)
// ---------------------------------------------------------------------------
export const COLORS = {
  skyTop: '#4ec0ca',
  skyBottom: '#7ed6cf',
  cloud: '#ffffff',
  cloudShade: '#e4f3f1',
  cityLight: '#9be0d5',
  cityDark: '#84d3c6',
  bushLight: '#96d05a',
  bushMid: '#71bb3b',
  bushDark: '#5a9e30',

  groundGrassTop: '#8ed94e',
  groundGrassMid: '#73bf2e',
  groundGrassLine: '#5a9c22',
  groundDirt: '#ded895',
  groundDirtStripe: '#d3cc7d',
  groundDirtLine: '#c6bd66',

  pipeHighlight: '#bef25b',
  pipeBody: '#74bf2e',
  pipeShade: '#5a9e26',
  pipeDeep: '#4a8020',
  pipeOutline: '#3b5323',

  birdBody: '#fad429',
  birdBodyShade: '#f0a52a',
  birdBelly: '#fff2c4',
  birdOutline: '#513f30',
  birdWing: '#ffffff',
  birdWingShade: '#dfe0e0',
  eyeWhite: '#ffffff',
  pupil: '#2b2b2b',
  beak: '#fb8b1e',
  beakShade: '#e0730c',

  textLight: '#ffffff',
  textOutline: '#513f30',
  panel: '#ded895',
  panelBorder: '#54402f',
  panelInner: '#f7f0c8',

  medalBronze: '#d98a3d',
  medalSilver: '#c9cdd2',
  medalGold: '#fbd000',
  medalPlatinum: '#8fe3e0',
} as const;

/** Game lifecycle states. */
export type GameState = 'ready' | 'playing' | 'gameover';
