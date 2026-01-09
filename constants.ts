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