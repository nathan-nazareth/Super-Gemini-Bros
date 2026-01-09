export interface Vector {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  type: 'player' | 'goomba' | 'big_goomba' | 'koopa' | 'koopa_red' | 'spiny' | 'mushroom' | '1up' | 'flower' | 'ice_flower' | 'star' | 'particle' | 'score_text' | 'fireball' | 'iceball' | 'bullet_bill' | 'piranha_plant';
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
}

export interface Tile {
  x: number;
  y: number;
  type: 'ground' | 'brick' | 'question' | 'pipe_l' | 'pipe_r' | 'pipe_top_l' | 'pipe_top_r' | 'hard' | 'flagpole' | 'flagpole_top' | 'castle_brick' | 'castle_top' | 'castle_door' | 'flagpole_flag' | 'empty';
  content?: 'coin' | 'mushroom' | '1up' | 'star' | 'flower' | 'ice_flower';
  hit?: boolean;
  bumpOffset?: number; // For animation when hit
  solid?: boolean;
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