import type { PowerUpId } from './types';

export const TILE_SIZE = 32;
// Physics tuned for that "heavy" but responsive feel
export const GRAVITY = 0.5;
export const FRICTION = 0.85;
export const MOVE_ACCEL = 0.25;
export const RUN_ACCEL = 0.45;
export const MAX_SPEED = 5;
export const MAX_RUN_SPEED = 8;
export const JUMP_FORCE = -15.5; // Much higher jump
export const BOUNCE_FORCE = -8;

export const SCREEN_WIDTH = 800;
export const SCREEN_HEIGHT = 600;

// Generation Constants
export const GENERATION_BUFFER = 1000; // Pixels ahead to generate
export const CHUNK_SIZE = 16; // Tiles per chunk

// --- Power-up tuning -------------------------------------------------------

/** Points for a chain of airborne kills; the last hit converts into a 1-UP. */
export const STOMP_CHAIN = [100, 200, 400, 800, 1000, 2000, 4000, 8000];

/** Coins needed for a free life. */
export const COINS_PER_LIFE = 100;

/** How long each timed ability lasts, in ms. */
export const ABILITY_DURATIONS: Record<string, number> = {
  jetpack: 18000,
  magnet: 14000,
  slowmo: 10000,
  spring: 15000,
};

/** Mega form duration (ms). */
export const MEGA_DURATION = 8000;

/** Jetpack fuel budget and refill rate. */
export const JETPACK_FUEL_MAX = 100;
export const JETPACK_FUEL_BURN = 1.1;
export const JETPACK_FUEL_REFILL = 0.9;

/** Radius (px) in which the magnet drags coins and items toward the player. */
export const MAGNET_RADIUS = 260;

/** Slow motion slows enemies down to this fraction of their speed. */
export const SLOWMO_FACTOR = 0.35;

/** Score multiplier granted while slow motion is active. */
export const SLOWMO_MULTIPLIER = 2;

/** Frames per tick of the level countdown (60fps => ~1.5 units/second). */
export const TIME_TICK_FRAMES = 40;

/** Level palettes, cycled by level number. */
export interface Theme {
  name: string;
  sky: [string, string, string];
  ground: [string, string];
  grass: [string, string];
  hill: [string, string];
  cloud: string;
  star: boolean;
}

export const THEMES: Theme[] = [
  {
    name: 'MEADOW',
    sky: ['#38bdf8', '#a5d8f5', '#ecfeff'],
    ground: ['#d97706', '#92400e'],
    grass: ['#86efac', '#22c55e'],
    hill: ['#4ade80', '#15803d'],
    cloud: 'rgba(255,255,255,0.85)',
    star: false,
  },
  {
    name: 'SUNSET',
    sky: ['#f97316', '#fbbf24', '#fef3c7'],
    ground: ['#b45309', '#78350f'],
    grass: ['#fcd34d', '#f59e0b'],
    hill: ['#fb923c', '#c2410c'],
    cloud: 'rgba(255,240,220,0.9)',
    star: false,
  },
  {
    name: 'NIGHT',
    sky: ['#0f172a', '#312e81', '#4f46e5'],
    ground: ['#64748b', '#334155'],
    grass: ['#bae6fd', '#60a5fa'],
    hill: ['#6366f1', '#3730a3'],
    cloud: 'rgba(148,163,184,0.35)',
    star: true,
  },
];

/** Items that walk around once they leave a block. */
export const MOVER_ITEMS = [
  'mushroom',
  '1up',
  'star',
  'spring',
  'gold_mushroom',
  'mega_mushroom',
  'jetpack',
  'magnet',
  'hourglass',
  'tanooki',
];

/** Items that stay put on top of the block. */
export const STATIC_ITEMS = ['flower', 'ice_flower', 'boomerang_flower'];

// --- Power-up tuning (abilities) --------------------------------------------

/** Upward speed while the jetpack thruster is engaged (px/frame). */
export const JETPACK_THRUST = 4.2;

/** Jump force of the tanooki suit's mid-air jump. */
export const TANOOKI_JUMP_FORCE = -13;

/** Jump force while the spring ability is active. */
export const SPRING_JUMP_FORCE = -20;

/** Bounce speed when landing hard with the spring ability. */
export const SPRING_BOUNCE = -16;

/** Fall speed (px/frame) that counts as a hard landing for the spring. */
export const SPRING_BOUNCE_MIN_FALL = 8;

/** Pull speed the magnet applies to nearby coins and items. */
export const MAGNET_PULL = 5;

/** Boomerang flight speed and how far it travels before turning back. */
export const BOOMERANG_SPEED = 9;
export const BOOMERANG_RANGE = 220;

/** Coins released by the gold mushroom, and what each one is worth. */
export const GOLD_COIN_COUNT = 8;
export const GOLD_COIN_VALUE = 100;

/** Score for grabbing the gold mushroom itself. */
export const GOLD_MUSHROOM_SCORE = 2000;

/** Weighted table of what a ? block can hand out. */
export const BLOCK_ITEMS: { item: PowerUpId | 'coin'; weight: number }[] = [
  { item: 'coin', weight: 26 },
  { item: 'mushroom', weight: 18 },
  { item: 'flower', weight: 12 },
  { item: 'ice_flower', weight: 8 },
  { item: 'star', weight: 8 },
  { item: 'tanooki', weight: 6 },
  { item: 'boomerang_flower', weight: 5 },
  { item: 'jetpack', weight: 5 },
  { item: 'magnet', weight: 4 },
  { item: 'hourglass', weight: 4 },
  { item: 'spring', weight: 4 },
  { item: 'gold_mushroom', weight: 3 },
  { item: 'mega_mushroom', weight: 3 },
  { item: '1up', weight: 3 },
];
