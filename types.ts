export interface Vector {
  x: number;
  y: number;
}

/** Every item that can live inside a ? block or bounce out of one. */
export type PowerUpId =
  | 'mushroom'
  | '1up'
  | 'flower'
  | 'ice_flower'
  | 'star'
  | 'tanooki'
  | 'boomerang_flower'
  | 'jetpack'
  | 'magnet'
  | 'hourglass'
  | 'spring'
  | 'gold_mushroom'
  | 'mega_mushroom';

/** Active player abilities. `slowmo` is a timed world effect, the rest are carried. */
export type PlayerAbility = 'tanooki' | 'boomerang' | 'jetpack' | 'magnet' | 'slowmo' | 'spring';

export type EntityType =
  | 'player'
  | 'goomba'
  | 'big_goomba'
  | 'koopa'
  | 'koopa_red'
  | 'spiny'
  | 'mushroom'
  | '1up'
  | 'flower'
  | 'ice_flower'
  | 'star'
  | 'tanooki'
  | 'boomerang_flower'
  | 'jetpack'
  | 'magnet'
  | 'hourglass'
  | 'spring'
  | 'gold_mushroom'
  | 'mega_mushroom'
  | 'particle'
  | 'score_text'
  | 'fireball'
  | 'iceball'
  | 'boomerang'
  | 'bullet_bill'
  | 'piranha_plant'
  | 'bee'
  | 'coin';

export interface Entity {
  id: string;
  type: EntityType;
  pos: Vector;
  vel: Vector;
  width: number;
  height: number;
  isDead?: boolean;
  state?: string; // 'small', 'big', 'fire', 'ice', 'shell', 'shell_moving'
  facing?: number; // 1 or -1
  color?: string;
  grounded?: boolean;
  animTimer: number; // Accumulator for animation
  frame?: number; // Current animation frame
  text?: string; // For score popups
  invulnerableUntil?: number; // Timestamp for damage iframe
  starTimer?: number; // Timestamp until star power ends
  frozenTimer?: number; // Timestamp for being frozen
  ability?: PlayerAbility | null; // Carried ability (player)
  abilityTimer?: number; // ms left on a timed ability (0 = until damaged)
  fuel?: number; // Jetpack fuel, 0..100
  jumpsLeft?: number; // Extra jumps left (tanooki double jump)
  megaTimer?: number; // ms of mega form left
  age?: number; // Frames alive
  baseY?: number; // Hover anchor (bee)
  amp?: number; // Hover amplitude (bee)
  returning?: boolean; // Boomerang phase
  coinValue?: number; // Points a coin is worth
  buffs?: Record<string, number>; // Timed powers (jetpack/magnet/slowmo/spring) in ms
  prevState?: string; // Form to fall back to when mega wears off
}

export interface Tile {
  x: number;
  y: number;
  type: 'ground' | 'ground_fill' | 'brick' | 'question' | 'pipe_l' | 'pipe_r' | 'pipe_top_l' | 'pipe_top_r' | 'hard' | 'flagpole' | 'flagpole_top' | 'castle_brick' | 'castle_top' | 'castle_door' | 'flagpole_flag' | 'empty';
  content?: PowerUpId | 'coin';
  hit?: boolean;
  bumpOffset?: number; // For animation when hit
  solid?: boolean;
  multi?: number; // Remaining coin payouts on a multi-coin brick
}

export interface GameState {
  score: number;
  lives: number;
  coins: number;
  world: string;
  level: number;
  time: number;
  gameOver: boolean;
  paused: boolean;
  cameraX: number;
  won: boolean;
  combo: number; // Consecutive airborne kills
  ability: PlayerAbility | null;
  abilityTimer: number; // ms remaining on the timed ability
  starTimer: number;
  megaTimer: number;
  fuel: number;
  muted: boolean;
  hurry: boolean;
  theme: number;
  buffs: Record<string, number>; // Active timed powers in ms
}

// AI Types
export type AIModelType =
  | 'gemini-3-pro-preview'
  | 'gemini-3-flash-preview'
  | 'gemini-2.5-flash-image'
  | 'gemini-3-pro-image-preview';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  image?: string;
  groundingUrls?: string[];
}
