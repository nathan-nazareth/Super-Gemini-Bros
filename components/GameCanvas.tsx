import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Entity, GameState, Tile, Vector } from '../types';
import { 
  TILE_SIZE, GRAVITY, FRICTION, MOVE_ACCEL, RUN_ACCEL, MAX_SPEED, 
  MAX_RUN_SPEED, JUMP_FORCE, BOUNCE_FORCE, SCREEN_WIDTH, SCREEN_HEIGHT,
  GENERATION_BUFFER, CHUNK_SIZE 
} from '../constants';

interface GameCanvasProps {
  onGameOver: (score: number) => void;
  backgroundImage: string | null;
}

export interface GameCanvasHandle {
  getSnapshot: () => string;
}

// Helper to determine solidity
const isSolid = (type: Tile['type']) => {
  return ['ground', 'brick', 'question', 'hard', 'pipe_l', 'pipe_r', 'pipe_top_l', 'pipe_top_r', 'castle_brick', 'castle_top'].includes(type);
};

// Decoration Types
interface Decoration {
  x: number;
  y: number;
  type: 'cloud_s' | 'cloud_l' | 'hill_s' | 'hill_l' | 'bush';
}

const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(({ onGameOver, backgroundImage }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  
  const playerRef = useRef<Entity>({
    id: 'mario',
    type: 'player',
    pos: { x: 100, y: 100 },
    vel: { x: 0, y: 0 },
    width: 24, 
    height: 32, 
    state: 'small',
    facing: 1,
    grounded: false,
    animTimer: 0,
    frame: 0,
    invulnerableUntil: 0,
    starTimer: 0
  });

  const lastSafePosRef = useRef<Vector>({ x: 100, y: 100 });

  const entitiesRef = useRef<Entity[]>([]);
  const tilesRef = useRef<Tile[]>([]);
  const particlesRef = useRef<Entity[]>([]);
  const decorationsRef = useRef<Decoration[]>([]);
  
  // Track generation
  const genRef = useRef({
    nextX: 0,
    groundY: 13, // in tiles
    difficulty: 1,
    levelLength: 200 * TILE_SIZE, // Target length
    endGenerated: false
  });
  
  const stateRef = useRef<GameState>({
    score: 0,
    lives: 5, // Hearts
    coins: 0,
    world: '1-1',
    level: 1,
    time: 400,
    gameOver: false,
    paused: false,
    cameraX: 0,
    won: false
  });

  const keysRef = useRef<{ [key: string]: boolean }>({});
  const [uiState, setUiState] = useState<GameState>(stateRef.current);
  const bulletBillTimerRef = useRef(0);

  useImperativeHandle(ref, () => ({
    getSnapshot: () => {
      if (canvasRef.current) {
        return canvasRef.current.toDataURL('image/png').replace(/^data:image\/(png|jpg);base64,/, "");
      }
      return "";
    }
  }));

  useEffect(() => {
    initLevel(true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    requestRef.current = requestAnimationFrame(gameLoop);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const initLevel = (resetStats: boolean = false) => {
    if (resetStats || stateRef.current.lives <= 0) {
        stateRef.current.score = 0;
        stateRef.current.coins = 0;
        stateRef.current.lives = 5; // Start with 5 hearts
        stateRef.current.world = '1-1';
        stateRef.current.level = 1;
        genRef.current.difficulty = 1;
    }

    tilesRef.current = [];
    entitiesRef.current = [];
    particlesRef.current = [];
    decorationsRef.current = [];
    
    // Level params
    const lvl = stateRef.current.level;
    genRef.current.nextX = -5 * TILE_SIZE; 
    genRef.current.groundY = 13;
    genRef.current.levelLength = (150 + lvl * 20) * TILE_SIZE; // Levels get longer
    genRef.current.endGenerated = false;
    genRef.current.difficulty = 1 + lvl * 0.2;

    // Reset Player
    const p = playerRef.current;
    p.pos = { x: 100, y: 100 };
    p.vel = { x: 0, y: 0 };
    // Keep state (big/fire) if not resetting stats
    if (resetStats) {
        p.state = 'small';
        p.width = 24; p.height = 32;
    }
    p.isDead = false;
    p.invulnerableUntil = 0;
    p.starTimer = 0;
    
    lastSafePosRef.current = { x: 100, y: 100 };

    stateRef.current.gameOver = false;
    stateRef.current.won = false;
    stateRef.current.cameraX = 0;
    stateRef.current.time = 400; // Reset timer

    // Generate initial floor to stand on
    generateChunk(20, true);
  };

  const nextLevel = () => {
      stateRef.current.level++;
      stateRef.current.world = `1-${stateRef.current.level}`;
      stateRef.current.time = 400; // Bonus time?
      initLevel(false);
  };

  const generateChunk = (width: number, safe: boolean = false) => {
    if (genRef.current.endGenerated) return;

    // Check if we should end the level
    if (genRef.current.nextX > genRef.current.levelLength && !genRef.current.endGenerated) {
        generateEndLevel();
        genRef.current.endGenerated = true;
        return;
    }

    const startX = genRef.current.nextX;
    const groundY = genRef.current.groundY;
    
    for (let x = 0; x < width; x++) {
      const tx = startX + x * TILE_SIZE;
      
      // Pit logic
      const isPit = !safe && Math.random() < (0.05 * genRef.current.difficulty);
      
      if (!isPit) {
         // Ground
         for (let y = groundY; y < SCREEN_HEIGHT / TILE_SIZE + 2; y++) {
             tilesRef.current.push({ x: tx, y: y * TILE_SIZE, type: 'ground', solid: true });
         }

         // Features on top
         if (!safe) {
            // Pipes
            if (Math.random() < 0.08) {
               const height = Math.floor(Math.random() * 2) + 2;
               const pipeX = tx;
               const pipeTopY = (groundY - height) * TILE_SIZE;
               
               tilesRef.current.push({ x: pipeX, y: pipeTopY, type: 'pipe_top_l', solid: true });
               tilesRef.current.push({ x: pipeX + TILE_SIZE, y: pipeTopY, type: 'pipe_top_r', solid: true });
               
               for (let h = 1; h < height; h++) {
                  tilesRef.current.push({ x: pipeX, y: (groundY - h) * TILE_SIZE, type: 'pipe_l', solid: true });
                  tilesRef.current.push({ x: pipeX + TILE_SIZE, y: (groundY - h) * TILE_SIZE, type: 'pipe_r', solid: true });
               }
               
               // Piranha Plant Logic
               if (Math.random() < 0.5) {
                   entitiesRef.current.push(createEntity('piranha_plant', pipeX + TILE_SIZE/2, pipeTopY));
               }

               // Skip next tile to avoid overlap
               x++;
               continue;
            }

            // Blocks
            if (Math.random() < 0.3) {
                const by = (groundY - 4) * TILE_SIZE;
                if (Math.random() < 0.5) {
                   tilesRef.current.push({ x: tx, y: by, type: 'brick', solid: true });
                   // Stacked bricks
                   if (Math.random() < 0.3) tilesRef.current.push({ x: tx, y: by - TILE_SIZE, type: 'brick', solid: true });
                } else {
                   // Question blocks
                   let content: Tile['content'] = 'coin';
                   const r = Math.random();
                   if (r > 0.96) content = '1up';
                   else if (r > 0.92) content = 'star';
                   else if (r > 0.85) content = 'ice_flower';
                   else if (r > 0.75) content = 'flower';
                   else if (r > 0.60) content = 'mushroom';

                   tilesRef.current.push({ x: tx, y: by, type: 'question', content, solid: true });
                }
            }

            // Enemies
            if (Math.random() < (0.3 * genRef.current.difficulty)) { 
               const ex = tx;
               const ey = (groundY - 1) * TILE_SIZE;
               const rand = Math.random();
               let type: Entity['type'] = 'goomba';
               
               if (rand < 0.1) type = 'big_goomba';
               else if (rand < 0.3) type = 'spiny';
               else if (rand < 0.5) type = 'koopa'; // Green
               else if (rand < 0.7) type = 'koopa_red'; // Red
               
               entitiesRef.current.push(createEntity(type, ex, ey));
            }
         }
      } else {
          // It's a pit
          if (Math.random() < 0.5) {
             genRef.current.groundY = Math.max(10, Math.min(16, groundY + (Math.random() > 0.5 ? 1 : -1)));
          }
      }
    }
    
    // Background decor
    if (Math.random() < 0.5) {
        decorationsRef.current.push({
            x: startX + Math.random() * width * TILE_SIZE,
            y: Math.random() * 200,
            type: Math.random() > 0.5 ? 'cloud_l' : 'cloud_s'
        });
    }

    genRef.current.nextX += width * TILE_SIZE;
  };

  const generateEndLevel = () => {
      let tx = genRef.current.nextX;
      const groundY = 13; // Normalize ground for end castle

      // 1. Runway
      for(let i=0; i<5; i++) {
          tilesRef.current.push({ x: tx, y: groundY * TILE_SIZE, type: 'ground', solid: true });
          tx += TILE_SIZE;
      }

      // 2. Stairs
      for(let h=1; h<=8; h++) {
          for(let y=0; y<h; y++) {
             tilesRef.current.push({ x: tx, y: (groundY - y) * TILE_SIZE, type: 'hard', solid: true });
          }
          tilesRef.current.push({ x: tx, y: groundY * TILE_SIZE, type: 'ground', solid: true }); // Fill under
          tx += TILE_SIZE;
      }
      
      // 3. Post Stairs
      for(let i=0; i<2; i++) {
        tilesRef.current.push({ x: tx, y: groundY * TILE_SIZE, type: 'ground', solid: true });
        tx += TILE_SIZE;
      }

      // 4. Flagpole Base
      const poleX = tx;
      tilesRef.current.push({ x: poleX, y: groundY * TILE_SIZE, type: 'hard', solid: true }); // Base block
      
      // Pole
      for(let h=1; h<=9; h++) {
          tilesRef.current.push({ x: poleX, y: (groundY - h) * TILE_SIZE, type: h === 9 ? 'flagpole_top' : 'flagpole', solid: false });
      }

      tx += TILE_SIZE;

      // 5. Walk to castle
      for(let i=0; i<12; i++) {
        tilesRef.current.push({ x: tx, y: groundY * TILE_SIZE, type: 'ground', solid: true });
        if (i === 6) {
            // Castle
            createCastle(tx, groundY);
        }
        tx += TILE_SIZE;
      }

      // Update nextX so we don't gen over it, though endGenerated stops it
      genRef.current.nextX = tx;
  };

  const createCastle = (startX: number, groundY: number) => {
      // Simple 5x5 Castle
      const w = 5;
      const h = 5;
      for(let x=0; x<w; x++) {
          for(let y=0; y<h; y++) {
              let type: Tile['type'] = 'castle_brick';
              if (y === h-1) type = 'castle_top';
              if (x === 2 && y < 2) type = 'castle_door';
              
              if (type !== 'castle_door') {
                 tilesRef.current.push({ x: startX + x*TILE_SIZE, y: (groundY - 1 - y) * TILE_SIZE, type, solid: true });
              } else {
                 // Door visual
                 tilesRef.current.push({ x: startX + x*TILE_SIZE, y: (groundY - 1 - y) * TILE_SIZE, type: 'castle_door', solid: false });
              }
          }
      }
  };

  const createEntity = (type: Entity['type'], x: number, y: number): Entity => {
     const isBig = type === 'big_goomba';
     const isPiranha = type === 'piranha_plant';
     
     let w = 30, h = 30;
     if (isBig) { w = 60; h = 60; }
     if (isPiranha) { w = 24; h = 32; }
     if (type === 'bullet_bill') { w = 32; h = 28; }

     return {
        id: `${type}_${x}_${y}_${Math.random()}`,
        type,
        pos: { x: isPiranha ? x - w/2 : x, y: isBig ? y - 32 : y },
        vel: { x: (type === 'mushroom' || type === '1up' || type === 'star') ? 2 : (type === 'piranha_plant' ? 0 : -1.5), y: 0 },
        width: w,
        height: h,
        state: isPiranha ? 'down' : 'walking',
        facing: -1,
        animTimer: 0,
        frame: 0
     };
  };

  const handleKeyDown = (e: KeyboardEvent) => { 
      keysRef.current[e.code] = true; 
      
      const isFire = playerRef.current.state === 'fire';
      const isIce = playerRef.current.state === 'ice';
      
      if ((e.code === 'KeyX' || e.code === 'ShiftLeft') && (isFire || isIce) && !e.repeat && !stateRef.current.won) {
         spawnProjectile(isIce ? 'iceball' : 'fireball');
      }
  };
  const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };

  const spawnProjectile = (type: 'fireball' | 'iceball') => {
      const p = playerRef.current;
      const count = entitiesRef.current.filter(e => e.type === type).length;
      if (count >= 2) return;

      entitiesRef.current.push({
          id: `${type}_${Date.now()}`,
          type: type,
          pos: { x: p.pos.x + (p.facing === 1 ? p.width : -16), y: p.pos.y + 10 },
          vel: { x: (p.facing || 1) * 6, y: 4 },
          width: 16, height: 16,
          animTimer: 0
      });
  };

  const update = () => {
    if (stateRef.current.gameOver || stateRef.current.paused) return;

    const player = playerRef.current;
    const now = Date.now();
    
    // Time limit (only if not won)
    if (!stateRef.current.won && !stateRef.current.gameOver && now % 60 === 0) { // Approx roughly every sec depending on frame rate logic, simplified here
        // Actually update runs 60fps roughly, so every 60 frames
    }

    // --- Procedural Generation ---
    if (genRef.current.nextX < stateRef.current.cameraX + SCREEN_WIDTH + GENERATION_BUFFER) {
        generateChunk(CHUNK_SIZE);
    }
    
    // --- Bullet Bill Spawner (Disable if won) ---
    if (!stateRef.current.won) {
        bulletBillTimerRef.current++;
        if (bulletBillTimerRef.current > 300) { 
            if (Math.random() < 0.3) {
                const fromLeft = Math.random() < 0.4; 
                const bx = fromLeft ? stateRef.current.cameraX - 50 : stateRef.current.cameraX + SCREEN_WIDTH + 50;
                const by = Math.random() * (SCREEN_HEIGHT - 200) + 50;
                const bill = createEntity('bullet_bill', bx, by);
                bill.vel.x = fromLeft ? 4 : -4;
                bill.facing = fromLeft ? 1 : -1;
                entitiesRef.current.push(bill);
            }
            bulletBillTimerRef.current = 0;
        }
    }

    // --- Cleanup ---
    const cleanupX = stateRef.current.cameraX - TILE_SIZE * 10;
    if (tilesRef.current.length > 800) { 
       tilesRef.current = tilesRef.current.filter(t => t.x > cleanupX);
       entitiesRef.current = entitiesRef.current.filter(e => e.pos.x > cleanupX - 200 && e.pos.x < stateRef.current.cameraX + SCREEN_WIDTH + 500 && !e.isDead);
       decorationsRef.current = decorationsRef.current.filter(d => d.x > cleanupX);
    }

    // --- Player Logic ---
    if (stateRef.current.won) {
        // Auto-walk to castle
        player.vel.x = 2;
        player.facing = 1;
        player.animTimer += 0.1;
        player.frame = (Math.floor(player.animTimer) % 3);
        player.vel.y += GRAVITY;
        player.pos.x += player.vel.x;
        player.pos.y += player.vel.y;
        checkTileCollisionY(player); // Fall to ground
        
        // Check if hit castle door area (approx)
        // Find castle door x
        // Simplified: if stopped moving or far enough
        // Ideally we detect the door tile
    } else {
        // Normal Controls
        // Star Timer
        if (player.starTimer && player.starTimer > 0) {
            player.starTimer -= 16; 
            if (player.starTimer <= 0) player.starTimer = 0;
        }

        const isRunning = keysRef.current['ShiftLeft'] || keysRef.current['ShiftRight'] || keysRef.current['KeyX'];
        const maxSpd = isRunning ? MAX_RUN_SPEED : MAX_SPEED;
        const accel = isRunning ? RUN_ACCEL : MOVE_ACCEL;

        if (keysRef.current['ArrowRight']) {
          if (player.vel.x < maxSpd) player.vel.x += accel;
          player.facing = 1;
        } else if (keysRef.current['ArrowLeft']) {
          if (player.vel.x > -maxSpd) player.vel.x -= accel;
          player.facing = -1;
        } else {
          player.vel.x *= FRICTION;
          if (Math.abs(player.vel.x) < 0.1) player.vel.x = 0;
        }

        if (Math.abs(player.vel.x) > 0.1) {
           player.animTimer += Math.abs(player.vel.x) * 0.1;
           if (player.animTimer > 1) {
              player.animTimer = 0;
              player.frame = (player.frame! + 1) % 3;
           }
        } else {
           player.frame = 0; 
        }
        if (!player.grounded) player.frame = 3; 

        player.pos.x += player.vel.x;
        checkTileCollisionX(player);

        player.vel.y += GRAVITY;
        player.vel.y = Math.min(player.vel.y, 12); 

        if (!keysRef.current['ArrowUp'] && !keysRef.current['KeyW']) {
           if (player.vel.y < -4) player.vel.y *= 0.5;
        }

        player.pos.y += player.vel.y;
        const isGrounded = checkTileCollisionY(player);
        player.grounded = isGrounded;

        if (isGrounded) {
           lastSafePosRef.current = { x: player.pos.x, y: player.pos.y };
        }

        if (isGrounded && (keysRef.current['ArrowUp'] || keysRef.current['KeyW'])) {
          if (!keysRef.current['jumpLock']) {
             player.vel.y = JUMP_FORCE; 
             keysRef.current['jumpLock'] = true;
          }
        }
        if (!keysRef.current['ArrowUp'] && !keysRef.current['KeyW']) {
           keysRef.current['jumpLock'] = false;
        }

        // Pit Death
        if (player.pos.y > SCREEN_HEIGHT + 100) {
            handlePitFall();
        }
    }

    // --- Camera ---
    const targetCamX = Math.max(0, player.pos.x - SCREEN_WIDTH * 0.35); 
    stateRef.current.cameraX += (targetCamX - stateRef.current.cameraX) * 0.1;
    if (stateRef.current.cameraX < targetCamX - 50) stateRef.current.cameraX = targetCamX - 50; 
    
    // Wall
    if (player.pos.x < stateRef.current.cameraX) {
      player.pos.x = stateRef.current.cameraX;
      player.vel.x = 0;
    }

    // --- Entities Loop ---
    entitiesRef.current.forEach(ent => {
      if (ent.isDead) return;

      // Frozen Logic
      if (ent.frozenTimer && ent.frozenTimer > 0) {
          ent.frozenTimer -= 1;
          ent.vel.x = 0;
          ent.vel.y += GRAVITY;
          ent.pos.y += ent.vel.y;
          checkTileCollisionY(ent);
          
          if (!stateRef.current.won && checkRectCollide(player, ent)) {
             killEntity(ent, true);
             spawnParticle(ent.pos.x, ent.pos.y, '#bae6fd', 8); // Ice shatter
             spawnScore(ent.pos.x, ent.pos.y, "SMASH!");
          }
          return; 
      }

      // Piranha Logic
      if (ent.type === 'piranha_plant') {
          ent.animTimer += 1;
          const cycle = 300; 
          const t = ent.animTimer % cycle;
          
          if (t < 100) { ent.vel.y = 0; } 
          else if (t < 150) { ent.vel.y = -1; } 
          else if (t < 250) { ent.vel.y = 0; } 
          else { ent.vel.y = 1; }
          
          ent.pos.y += ent.vel.y;
          if (!stateRef.current.won && Math.abs(ent.pos.x - player.pos.x) < 40 && Math.abs(ent.pos.y - player.pos.y) < 50) {
               if (checkRectCollide(player, ent)) handlePlayerEntityCollision(player, ent, now);
          }
          entitiesRef.current.forEach(other => {
             if ((other.type === 'fireball' || other.type === 'iceball') && !other.isDead && checkRectCollide(ent, other)) {
                killEntity(ent, false);
                other.isDead = true;
                spawnParticle(other.pos.x, other.pos.y, other.type === 'iceball' ? '#bae6fd' : '#f97316', 3);
             }
          });
          return;
      }

      // Bullet Bill Logic
      if (ent.type === 'bullet_bill') {
          ent.pos.x += ent.vel.x;
          if (!stateRef.current.won && checkRectCollide(player, ent)) handlePlayerEntityCollision(player, ent, now);
          return; 
      }

      // Physics for normal entities
      ent.vel.y += GRAVITY;
      ent.vel.y = Math.min(ent.vel.y, 10);

      // Horizontal
      ent.pos.x += ent.vel.x;
      const colX = checkTileCollisionX(ent);
      if (colX) {
         if (ent.type === 'fireball' || ent.type === 'iceball') {
            ent.isDead = true;
            spawnParticle(ent.pos.x, ent.pos.y, ent.type === 'iceball' ? '#bae6fd' : '#f59e0b', 4);
         } else if (['goomba', 'big_goomba', 'koopa', 'koopa_red', 'spiny', 'mushroom', '1up', 'flower', 'ice_flower', 'star'].includes(ent.type) && ent.state !== 'shell_moving') {
            ent.vel.x *= -1;
            ent.facing = ent.vel.x > 0 ? 1 : -1;
         } else if (ent.type.includes('koopa') && ent.state === 'shell_moving') {
            ent.vel.x *= -1; 
         }
      }

      // Red Koopa Ledge Logic
      if (ent.type === 'koopa_red' && ent.state !== 'shell' && ent.state !== 'shell_moving' && ent.grounded) {
          const lookX = ent.pos.x + (ent.vel.x > 0 ? ent.width + 5 : -5);
          const lookY = ent.pos.y + ent.height + 5;
          let hasGround = false;
          for(const t of tilesRef.current) {
              if (t.type !== 'empty' && t.x <= lookX && t.x + TILE_SIZE >= lookX && t.y <= lookY && t.y + TILE_SIZE >= lookY) {
                  hasGround = true; break;
              }
          }
          if (!hasGround) {
              ent.vel.x *= -1;
              ent.facing = ent.vel.x > 0 ? 1 : -1;
          }
      }

      // Vertical
      ent.pos.y += ent.vel.y;
      const gr = checkTileCollisionY(ent);
      ent.grounded = gr;

      if ((ent.type === 'fireball' || ent.type === 'iceball') && gr) {
          ent.vel.y = -5; // Bounce
      }

      if (gr && (ent.type === 'mushroom' || ent.type === '1up' || ent.type === 'star' || ent.type.includes('flower'))) {
      } else if (gr && ent.state === 'shell') {
           ent.vel.x *= 0.9;
      }

      ent.animTimer += 0.1;
      if (ent.animTimer > 1) {
         ent.animTimer = 0;
         ent.frame = (ent.frame! + 1) % 2;
      }

      // Interaction with Player
      if (!stateRef.current.won && Math.abs(ent.pos.x - player.pos.x) < SCREEN_WIDTH) {
          if (checkRectCollide(player, ent)) {
             handlePlayerEntityCollision(player, ent, now);
          }
      }

      // Interaction with Projectiles
      if (['goomba', 'big_goomba', 'koopa', 'koopa_red', 'spiny'].includes(ent.type)) {
          entitiesRef.current.forEach(other => {
              if ((other.type === 'fireball' || other.type === 'iceball') && !other.isDead && checkRectCollide(ent, other)) {
                   if (other.type === 'iceball') {
                       ent.frozenTimer = 300; 
                       spawnScore(ent.pos.x, ent.pos.y, "FREEZE!");
                   } else {
                       killEntity(ent, true);
                   }
                   other.isDead = true;
                   spawnParticle(other.pos.x, other.pos.y, other.type === 'iceball' ? '#bae6fd' : '#f97316', 3);
              }
          });
      }

      if (ent.type.includes('koopa') && ent.state === 'shell_moving') {
         entitiesRef.current.forEach(other => {
            if (ent === other || other.isDead || other.type === 'player' || other.type === 'particle' || other.type === 'score_text' || other.type.includes('ball')) return;
            if (checkRectCollide(ent, other)) {
               killEntity(other, true);
            }
         });
      }
    });

    // Particles / Text
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
       const p = particlesRef.current[i];
       p.pos.x += p.vel.x;
       p.pos.y += p.vel.y;
       if (p.type === 'score_text') {
           p.vel.y -= 0.05; 
           p.animTimer += 1; 
           if (p.animTimer > 60) particlesRef.current.splice(i, 1);
       } else {
           p.vel.y += GRAVITY;
           if (p.pos.y > SCREEN_HEIGHT) particlesRef.current.splice(i, 1);
       }
    }

    // Tiles animation
    tilesRef.current.forEach(t => {
       if (t.bumpOffset && t.bumpOffset < 0) {
          t.bumpOffset += 2;
          if (t.bumpOffset > 0) t.bumpOffset = 0;
       }
    });

    setUiState({ ...stateRef.current });
  };

  const handleLevelComplete = () => {
      if (stateRef.current.won) return;
      stateRef.current.won = true;
      spawnScore(playerRef.current.pos.x, playerRef.current.pos.y - 40, "LEVEL COMPLETE!");
      
      // Calculate bonus
      const timeBonus = Math.floor(stateRef.current.time / 10) * 100;
      stateRef.current.score += timeBonus;
      setTimeout(() => {
          spawnScore(playerRef.current.pos.x, playerRef.current.pos.y - 60, `TIME BONUS: ${timeBonus}`);
      }, 1000);

      // Transition
      setTimeout(() => {
          nextLevel();
      }, 4000);
  };

  const handlePitFall = () => {
     if (stateRef.current.won) return;
     stateRef.current.lives--;
     if (stateRef.current.lives <= 0) {
         die();
     } else {
         spawnScore(playerRef.current.pos.x, SCREEN_HEIGHT - 100, "-1 HEART");
         playerRef.current.pos.x = lastSafePosRef.current.x;
         playerRef.current.pos.y = lastSafePosRef.current.y - 32; 
         playerRef.current.vel = { x: 0, y: 0 };
     }
  };

  const handlePlayerEntityCollision = (p: Entity, e: Entity, now: number) => {
     // Items
     if (e.type === 'mushroom') {
        e.isDead = true;
        if (p.state === 'small') {
            p.state = 'big';
            p.width = 24; p.height = 50; 
            p.pos.y -= 20;
        }
        stateRef.current.score += 1000;
        spawnScore(e.pos.x, e.pos.y, "1000");
        return;
     }
     if (e.type === '1up') {
        e.isDead = true;
        stateRef.current.lives++;
        stateRef.current.score += 500;
        spawnScore(e.pos.x, e.pos.y, "+1 UP");
        return;
     }
     if (e.type === 'flower' || e.type === 'ice_flower') {
        e.isDead = true;
        p.state = e.type === 'flower' ? 'fire' : 'ice';
        p.width = 24; p.height = 50;
        stateRef.current.score += 1000;
        spawnScore(e.pos.x, e.pos.y, e.type === 'flower' ? "FIRE!" : "ICE!");
        return;
     }
     if (e.type === 'star') {
        e.isDead = true;
        p.starTimer = 10000; 
        stateRef.current.score += 1000;
        spawnScore(e.pos.x, e.pos.y, "STAR!");
        return;
     }

     if (p.starTimer && p.starTimer > 0) {
         killEntity(e, true);
         return;
     }

     const hitFromAbove = p.vel.y > 0 && p.pos.y + p.height < e.pos.y + e.height / 2 + 10;
     
     if (hitFromAbove && !e.type.includes('piranha')) { 
        if (e.type === 'spiny') {
            stateRef.current.lives--;
            spawnScore(p.pos.x, p.pos.y, `-1 HEART`);
            p.vel.y = -6; 
            p.vel.x = p.pos.x < e.pos.x ? -6 : 6;
            p.invulnerableUntil = now + 2000;
            if (stateRef.current.lives <= 0) die();
            return;
        }
        
        if (e.type === 'bullet_bill') {
            killEntity(e, false);
            p.vel.y = BOUNCE_FORCE;
        } else if (e.type.includes('koopa')) {
             if (e.state === 'shell' || e.state === 'shell_moving') {
                 e.state = 'shell_moving';
                 const centerP = p.pos.x + p.width/2;
                 const centerE = e.pos.x + e.width/2;
                 e.vel.x = centerP < centerE ? 6 : -6;
                 e.pos.x += e.vel.x; 
                 p.vel.y = -6; 
                 spawnScore(e.pos.x, e.pos.y, "KICK");
             } else {
                 e.state = 'shell';
                 e.vel.x = 0;
                 e.height = 24; 
                 e.pos.y += 10;
                 p.vel.y = BOUNCE_FORCE;
                 spawnScore(e.pos.x, e.pos.y, "100");
             }
        } else {
            killEntity(e, false);
            p.vel.y = BOUNCE_FORCE;
        }
     } else {
        if (p.invulnerableUntil && now < p.invulnerableUntil) return;
        
        if (e.type.includes('koopa') && e.state === 'shell' && !e.state.includes('moving')) {
             e.state = 'shell_moving';
             const centerP = p.pos.x + p.width/2;
             const centerE = e.pos.x + e.width/2;
             e.vel.x = centerP < centerE ? 6 : -6;
             p.invulnerableUntil = now + 500; 
             return;
        }

        if (p.state === 'fire' || p.state === 'big' || p.state === 'ice') {
            p.state = 'small';
            p.width = 24; p.height = 32;
            p.invulnerableUntil = now + 2000;
        } else {
            stateRef.current.lives--;
            spawnScore(p.pos.x, p.pos.y, `-1 HEART`);
            if (stateRef.current.lives <= 0) {
               die();
            } else {
               p.vel.y = -6;
               p.vel.x = p.pos.x < e.pos.x ? -6 : 6;
               p.invulnerableUntil = now + 2000;
            }
        }
     }
  };

  const killEntity = (e: Entity, kicked: boolean) => {
     e.isDead = true;
     stateRef.current.lives++;
     stateRef.current.score += 100;
     spawnScore(e.pos.x, e.pos.y, "100");
     spawnScore(e.pos.x, e.pos.y - 20, "+1 ♥");
     if (kicked) {
         spawnParticle(e.pos.x, e.pos.y, '#b83800', 4);
     }
  };

  const checkTileCollisionX = (ent: Entity) => {
    let hit = false;
    for (const tile of tilesRef.current) {
      if (Math.abs(tile.x - ent.pos.x) > 50) continue;

      if (tile.type.includes('flagpole') && ent.type === 'player' && !stateRef.current.won) {
           if (checkCollide(ent, tile)) {
               handleLevelComplete();
           }
      }

      if (!isSolid(tile.type)) continue;

      if (checkCollide(ent, tile)) {
         hit = true;
         if (ent.vel.x > 0) {
             ent.pos.x = tile.x - ent.width;
         } else if (ent.vel.x < 0) {
             ent.pos.x = tile.x + TILE_SIZE;
         }
         ent.vel.x = 0;
      }
    }
    return hit;
  };

  const checkTileCollisionY = (ent: Entity): boolean => {
    let grounded = false;
    for (const tile of tilesRef.current) {
       if (Math.abs(tile.x - ent.pos.x) > 50) continue;
       
       if (tile.type.includes('flagpole') && ent.type === 'player' && !stateRef.current.won) {
            if (checkCollide(ent, tile)) {
                handleLevelComplete();
            }
       }

       if (!isSolid(tile.type)) continue;

       if (checkCollide(ent, tile)) {
          if (ent.vel.y > 0) {
             ent.pos.y = tile.y - ent.height;
             ent.vel.y = 0;
             grounded = true;
          } else if (ent.vel.y < 0) {
             ent.pos.y = tile.y + TILE_SIZE;
             ent.vel.y = 0;
             if (ent.type === 'player') handleBlockHit(tile);
          }
       }
    }
    return grounded;
  };

  const handleBlockHit = (tile: Tile) => {
    if (tile.hit) return; 
    
    if (Math.abs((playerRef.current.pos.x + playerRef.current.width/2) - (tile.x + TILE_SIZE/2)) > 20) return;

    tile.bumpOffset = -10; 

    if (tile.type === 'question') {
       tile.hit = true;
       if (tile.content === 'coin') {
          stateRef.current.coins++;
          stateRef.current.score += 200;
          spawnScore(tile.x, tile.y - 20, "200");
          spawnParticle(tile.x + 8, tile.y - 32, '#fbbf24');
       } else if (tile.content) {
          spawnItem(tile.content, tile.x, tile.y - 32);
       }
    } else if (tile.type === 'brick') {
       const p = playerRef.current;
       if (p.state === 'big' || p.state === 'fire' || p.state === 'ice') {
          tile.type = 'empty'; 
          tile.solid = false;
          tile.x = -9999; 
          spawnParticle(tile.x, tile.y, '#b45309', 4);
          stateRef.current.score += 50;
       } 
    }
  };

  const spawnItem = (type: Entity['type'], x: number, y: number) => {
     entitiesRef.current.push({
        id: `item_${Date.now()}`,
        type,
        pos: {x, y},
        vel: {x: (type === 'flower' || type === 'ice_flower') ? 0 : 2, y: 0},
        width: 30, height: 30,
        state: 'moving',
        facing: 1,
        animTimer: 0
     });
  };

  const spawnScore = (x: number, y: number, text: string) => {
      particlesRef.current.push({
          id: `score_${Math.random()}`,
          type: 'score_text',
          pos: {x, y},
          vel: {x: 0, y: -1},
          width: 0, height: 0,
          animTimer: 0,
          text
      });
  };

  const checkCollide = (ent: Entity, tile: Tile) => {
    return (
      ent.pos.x < tile.x + TILE_SIZE &&
      ent.pos.x + ent.width > tile.x &&
      ent.pos.y < tile.y + TILE_SIZE &&
      ent.pos.y + ent.height > tile.y
    );
  };

  const checkRectCollide = (r1: Entity, r2: Entity) => {
    return (
      r1.pos.x < r2.pos.x + r2.width &&
      r1.pos.x + r1.width > r2.pos.x &&
      r1.pos.y < r2.pos.y + r2.height &&
      r1.pos.y + r1.height > r2.pos.y
    );
  };

  const die = () => {
    stateRef.current.gameOver = true;
    onGameOver(stateRef.current.score);
  };

  const spawnParticle = (x: number, y: number, color: string, count = 1) => {
     for(let i=0; i<count; i++) {
        particlesRef.current.push({
            id: Math.random().toString(),
            type: 'particle',
            pos: {x, y},
            vel: {x: Math.random() * 6 - 3, y: Math.random() * -6 - 2},
            width: 8, height: 8,
            color,
            animTimer: 0
        });
     }
  };

  // --- Rendering Helpers ---

  const drawSky = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      if (backgroundImage) {
          const img = new Image();
          img.src = backgroundImage;
          if (img.complete) ctx.drawImage(img, 0, 0, width, height);
          else {
             const grad = ctx.createLinearGradient(0, 0, 0, height);
             grad.addColorStop(0, '#60a5fa'); 
             grad.addColorStop(0.4, '#bae6fd'); 
             grad.addColorStop(1, '#ecfeff'); 
             ctx.fillStyle = grad;
             ctx.fillRect(0,0,width,height);
          }
      } else {
          const grad = ctx.createLinearGradient(0, 0, 0, height);
          grad.addColorStop(0, '#60a5fa'); 
          grad.addColorStop(1, '#ecfeff'); 
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, height);
      }
  };

  const drawDecorations = (ctx: CanvasRenderingContext2D) => {
      decorationsRef.current.forEach(d => {
          const pFactor = d.type.includes('cloud') ? 0.5 : 0.2;
          const px = d.x - stateRef.current.cameraX * pFactor;
          if (px < -100 || px > SCREEN_WIDTH + 100) return;

          if (d.type.includes('cloud')) {
             ctx.fillStyle = 'rgba(255,255,255,0.8)';
             const size = d.type === 'cloud_l' ? 60 : 40;
             ctx.beginPath();
             ctx.arc(px, d.y, size, 0, Math.PI * 2);
             ctx.arc(px + size, d.y + 10, size * 0.8, 0, Math.PI * 2);
             ctx.arc(px - size, d.y + 10, size * 0.8, 0, Math.PI * 2);
             ctx.fill();
          } else if (d.type.includes('hill')) {
             const grad = ctx.createLinearGradient(px, d.y - 100, px, d.y + 100);
             grad.addColorStop(0, '#4ade80');
             grad.addColorStop(1, '#16a34a');
             ctx.fillStyle = grad;
             const w = d.type === 'hill_l' ? 200 : 100;
             const h = d.type === 'hill_l' ? 100 : 60;
             ctx.beginPath();
             ctx.ellipse(px, d.y, w, h, 0, Math.PI, 0, false);
             ctx.fill();
             ctx.strokeStyle = '#15803d';
             ctx.lineWidth = 4;
             ctx.stroke();
          }
      });
  };

  const drawTile = (ctx: CanvasRenderingContext2D, t: Tile) => {
      const x = t.x;
      const y = t.y + (t.bumpOffset || 0);
      
      if (t.type === 'ground') {
          const grad = ctx.createLinearGradient(x, y, x, y + TILE_SIZE);
          grad.addColorStop(0, '#d97706'); 
          grad.addColorStop(1, '#92400e'); 
          ctx.fillStyle = grad;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          
          const grassGrad = ctx.createLinearGradient(x, y, x, y + 8);
          grassGrad.addColorStop(0, '#86efac'); 
          grassGrad.addColorStop(1, '#22c55e'); 
          ctx.fillStyle = grassGrad;
          ctx.fillRect(x, y, TILE_SIZE, 8);
      } else if (t.type === 'brick') {
          ctx.fillStyle = '#f87171';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#fca5a5';
          ctx.fillRect(x+1, y+1, TILE_SIZE-2, TILE_SIZE-2);
          ctx.fillStyle = '#b91c1c';
          ctx.fillRect(x, y + 15, TILE_SIZE, 2);
          ctx.fillRect(x + 15, y, 2, 15);
      } else if (t.type === 'question') {
          const grad = ctx.createLinearGradient(x, y, x + TILE_SIZE, y + TILE_SIZE);
          grad.addColorStop(0, '#fde047');
          grad.addColorStop(1, '#eab308');
          if (t.hit) {
             ctx.fillStyle = '#a16207';
             ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
             ctx.strokeRect(x,y,TILE_SIZE,TILE_SIZE);
          } else {
             const blink = Math.floor(Date.now() / 200) % 2 === 0;
             ctx.fillStyle = blink ? '#fef08a' : grad;
             ctx.beginPath();
             ctx.roundRect(x, y, TILE_SIZE, TILE_SIZE, 4);
             ctx.fill();
             ctx.fillStyle = '#92400e';
             ctx.font = 'bold 22px sans-serif';
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             ctx.fillText('?', x + TILE_SIZE/2, y + TILE_SIZE/2);
          }
      } else if (t.type.startsWith('pipe')) {
          const grad = ctx.createLinearGradient(x, y, x + TILE_SIZE, y);
          grad.addColorStop(0, '#22c55e');
          grad.addColorStop(0.5, '#16a34a');
          grad.addColorStop(1, '#14532d');
          ctx.fillStyle = grad;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = '#052e16';
          ctx.lineWidth = 1;
          ctx.strokeRect(x,y,TILE_SIZE,TILE_SIZE);
          if (t.type.includes('top')) {
              ctx.fillStyle = 'rgba(0,0,0,0.2)';
              ctx.fillRect(x, y + 28, TILE_SIZE, 4); 
          }
      } else if (t.type.startsWith('flagpole')) {
          // Pole
          ctx.fillStyle = '#9ca3af';
          ctx.fillRect(x + 12, y, 8, TILE_SIZE);
          if (t.type === 'flagpole_top') {
              ctx.fillStyle = '#16a34a'; // Ball
              ctx.beginPath(); ctx.arc(x+16, y, 8, 0, Math.PI*2); ctx.fill();
              // Flag
              ctx.fillStyle = '#ef4444';
              ctx.beginPath();
              ctx.moveTo(x+16, y);
              ctx.lineTo(x+48, y+10);
              ctx.lineTo(x+16, y+20);
              ctx.fill();
          }
      } else if (t.type.startsWith('castle')) {
          if (t.type === 'castle_door') {
              ctx.fillStyle = '#000';
              ctx.beginPath(); ctx.arc(x + 16, y + 32, 16, Math.PI, 0); ctx.fill();
              ctx.fillRect(x, y+16, 32, 16);
          } else {
              ctx.fillStyle = '#94a3b8';
              ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
              ctx.strokeStyle = '#64748b';
              ctx.lineWidth = 2;
              ctx.strokeRect(x,y,TILE_SIZE,TILE_SIZE);
          }
      } else if (t.type === 'hard') {
          ctx.fillStyle = '#b45309';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.fillRect(x+4, y+4, 24, 24);
      }
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, p: Entity) => {
      // Flashing if invincible
      if (p.invulnerableUntil && p.invulnerableUntil > Date.now()) {
          if (Math.floor(Date.now() / 50) % 2 === 0) return;
      }

      const x = p.pos.x;
      const y = p.pos.y;
      const dir = p.facing || 1;
      const w = p.width;
      const h = p.height;
      
      ctx.save();
      ctx.translate(x + w/2, y + h);
      ctx.scale(dir, 1);

      // Star Power Effect (Rainbow)
      let shirtColor = '#ef4444'; // Red
      let overallColor = '#2563eb'; // Blue
      let skinColor = '#fdba74';
      
      if (p.state === 'fire') {
          shirtColor = '#ffffff';
          overallColor = '#ef4444';
      } else if (p.state === 'ice') {
          shirtColor = '#bae6fd'; // Light Blue/Cyan
          overallColor = '#1e3a8a'; // Dark Blue
      }

      if (p.starTimer && p.starTimer > 0) {
          const hue = (Date.now() / 5) % 360;
          shirtColor = `hsl(${hue}, 80%, 60%)`;
          overallColor = `hsl(${(hue + 180) % 360}, 80%, 60%)`;
          skinColor = `hsl(${(hue + 90) % 360}, 80%, 80%)`;
      }

      const walk = Math.sin(p.animTimer * Math.PI * 2);
      
      // Legs
      ctx.fillStyle = overallColor; 
      ctx.beginPath(); ctx.ellipse(-6 + (walk * 4), -8, 5, 8, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(6 - (walk * 4), -8, 5, 8, 0, 0, Math.PI*2); ctx.fill();

      // Shirt
      ctx.fillStyle = shirtColor; 
      ctx.beginPath(); ctx.roundRect(-10, -26, 20, 18, 5); ctx.fill();
      
      // Overalls
      ctx.fillStyle = overallColor; 
      ctx.beginPath();
      ctx.moveTo(-10, -14); ctx.lineTo(-10, -8); ctx.lineTo(10, -8); ctx.lineTo(10, -14);
      ctx.lineTo(6, -24); ctx.lineTo(4, -24); ctx.lineTo(6, -14);
      ctx.lineTo(-6, -14); ctx.lineTo(-4, -24); ctx.lineTo(-6, -24);
      ctx.closePath(); ctx.fill();
      
      // Buttons
      ctx.fillStyle = '#fcd34d';
      ctx.beginPath(); ctx.arc(-5, -22, 2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(5, -22, 2, 0, Math.PI*2); ctx.fill();

      // Head
      const isBig = p.state === 'big' || p.state === 'fire' || p.state === 'ice';
      const headScale = isBig ? 1.2 : 1;
      
      ctx.translate(0, -28);
      ctx.scale(headScale, headScale);
      
      // Face
      ctx.fillStyle = skinColor;
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, 0, 4, 0, Math.PI*2); ctx.fill(); // Nose

      // Hat
      ctx.fillStyle = shirtColor; // Hat matches shirt in Fire/Star
      ctx.beginPath();
      ctx.moveTo(-10, -4);
      ctx.quadraticCurveTo(0, -14, 10, -4);
      ctx.lineTo(12, -2); ctx.lineTo(-10, -2);
      ctx.fill();
      // Brim
      ctx.strokeStyle = '#b91c1c';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-11, -4); ctx.lineTo(12, -4); ctx.stroke();

      // Eye
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(4, -4, 2, 4, 0, 0, Math.PI*2); ctx.fill();

      // Moustache
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.moveTo(2, 4);
      ctx.quadraticCurveTo(6, 2, 10, 4);
      ctx.quadraticCurveTo(6, 6, 2, 4);
      ctx.fill();

      ctx.restore();
  };

  const drawEnemy = (ctx: CanvasRenderingContext2D, e: Entity) => {
     const x = e.pos.x;
     const y = e.pos.y;
     const w = e.width;
     const h = e.height;
     
     if (e.type === 'bullet_bill') {
         ctx.save();
         ctx.translate(x + w/2, y + h/2);
         ctx.scale(e.facing || -1, 1);
         
         // Body
         ctx.fillStyle = '#1e293b'; // Slate 800
         ctx.beginPath();
         ctx.roundRect(-16, -14, 28, 28, 4);
         ctx.fill();
         // Dome
         ctx.beginPath();
         ctx.arc(-16, 0, 14, Math.PI/2, Math.PI * 1.5);
         ctx.fill();
         // Eye
         ctx.fillStyle = '#fff';
         ctx.beginPath(); ctx.arc(-10, -4, 5, 0, Math.PI*2); ctx.fill();
         ctx.fillStyle = '#000';
         ctx.beginPath(); ctx.arc(-8, -4, 2, 0, Math.PI*2); ctx.fill();
         // Arm
         ctx.fillStyle = '#000';
         ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(8, 8); ctx.lineTo(4, 4); ctx.fill();
         
         ctx.restore();
         return;
     }

     if (e.type === 'piranha_plant') {
        const cx = x + w/2;
        const cy = y + h/2;
        // Stem
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(cx - 4, cy, 8, h);
        // Head
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(cx, cy, 12, 0, Math.PI * 2);
        ctx.fill();
        // Mouth cutout
        ctx.fillStyle = '#fff';
        const mouthOpen = Math.sin(e.animTimer * 0.2) * 4;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + 12, cy - 4 - mouthOpen);
        ctx.lineTo(cx + 12, cy + 4 + mouthOpen);
        ctx.fill();
        // Spots
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(cx - 6, cy - 4, 3, 0, Math.PI*2); ctx.fill();
        return;
     }

     if (e.type === 'spiny') {
         ctx.save();
         ctx.translate(x + w/2, y + h);
         if (e.frozenTimer && e.frozenTimer > 0) ctx.fillStyle = '#93c5fd'; // Frozen tint
         else ctx.fillStyle = '#b91c1c'; // Red shell
         
         const dir = e.vel.x > 0 ? -1 : 1;
         ctx.scale(dir, 1);
         
         // Shell
         ctx.beginPath(); ctx.ellipse(0, -10, 12, 10, 0, Math.PI, 0); ctx.fill();
         // Spikes
         ctx.fillStyle = '#fde047'; // Yellow spikes
         ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(4, -14); ctx.lineTo(-4, -14); ctx.fill();
         ctx.beginPath(); ctx.moveTo(-10, -15); ctx.lineTo(-6, -10); ctx.lineTo(-14, -10); ctx.fill();
         ctx.beginPath(); ctx.moveTo(10, -15); ctx.lineTo(14, -10); ctx.lineTo(6, -10); ctx.fill();
         
         // Head
         ctx.fillStyle = '#fbbf24';
         ctx.beginPath(); ctx.arc(8, -8, 6, 0, Math.PI*2); ctx.fill();
         // Eye
         ctx.fillStyle = '#000';
         ctx.beginPath(); ctx.arc(10, -9, 1.5, 0, Math.PI*2); ctx.fill();
         
         // Feet
         ctx.fillStyle = '#000';
         const step = Math.sin(e.animTimer * 10) * 3;
         if (e.frozenTimer && e.frozenTimer > 0) {
             // No anim if frozen
         } else {
             ctx.fillRect(-6 + step, 0, 4, 4);
             ctx.fillRect(4 - step, 0, 4, 4);
         }
         
         ctx.restore();
         return;
     }

     if (e.type === 'goomba' || e.type === 'big_goomba') {
         const color = e.type === 'big_goomba' ? '#be123c' : '#d97706'; 
         ctx.save();
         ctx.translate(x + w/2, y + h);
         if (e.frozenTimer && e.frozenTimer > 0) {
             // Frozen look
             ctx.globalAlpha = 0.8;
             ctx.fillStyle = '#60a5fa'; // Blue tint
         } else {
             const wobble = Math.sin(e.animTimer * 10) * 0.1;
             ctx.rotate(wobble);
         }
         
         // Feet
         ctx.fillStyle = '#451a03';
         const step = Math.sin(e.animTimer * 10) * 5;
         if (!e.frozenTimer) {
            ctx.beginPath(); ctx.ellipse(-8 + step, 0, 6, 4, 0, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(8 - step, 0, 6, 4, 0, 0, Math.PI*2); ctx.fill();
         } else {
            ctx.beginPath(); ctx.ellipse(-8, 0, 6, 4, 0, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(8, 0, 6, 4, 0, 0, Math.PI*2); ctx.fill();
         }
         
         // Body
         ctx.fillStyle = e.frozenTimer ? '#93c5fd' : color;
         ctx.beginPath();
         ctx.moveTo(-w/2, 0);
         ctx.quadraticCurveTo(0, -h, w/2, 0);
         ctx.fill();
         // Eyes
         ctx.fillStyle = '#fff';
         ctx.beginPath(); ctx.ellipse(-6, -h/2, 5, 7, 0, 0, Math.PI*2); ctx.fill();
         ctx.beginPath(); ctx.ellipse(6, -h/2, 5, 7, 0, 0, Math.PI*2); ctx.fill();
         ctx.fillStyle = '#000';
         ctx.beginPath(); ctx.ellipse(-6, -h/2, 2, 4, 0, 0, Math.PI*2); ctx.fill();
         ctx.beginPath(); ctx.ellipse(6, -h/2, 2, 4, 0, 0, Math.PI*2); ctx.fill();
         ctx.restore();

     } else if (e.type.includes('koopa')) {
         ctx.save();
         ctx.translate(x + w/2, y + h);
         
         if (e.state === 'shell' || e.state === 'shell_moving') {
             if (e.state === 'shell_moving') ctx.rotate(e.animTimer * 10);
             ctx.fillStyle = e.type === 'koopa_red' ? '#ef4444' : '#22c55e';
             if (e.frozenTimer) ctx.fillStyle = '#93c5fd';
             ctx.beginPath(); ctx.arc(0, -10, 12, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#fff'; 
             ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(5, -15); ctx.lineTo(10, -10); ctx.lineTo(5, -5); ctx.fill();
         } else {
             const dir = e.vel.x > 0 ? -1 : 1;
             ctx.scale(dir, 1);
             // Shell
             ctx.fillStyle = e.type === 'koopa_red' ? '#ef4444' : '#22c55e';
             if (e.frozenTimer) ctx.fillStyle = '#93c5fd';
             ctx.beginPath(); ctx.ellipse(-4, -14, 10, 14, 0.2, 0, Math.PI*2); ctx.fill();
             // Body
             ctx.fillStyle = '#fde047'; 
             ctx.beginPath(); ctx.ellipse(4, -10, 6, 10, 0, 0, Math.PI*2); ctx.fill();
             // Eye
             ctx.fillStyle = '#000';
             ctx.beginPath(); ctx.arc(6, -11, 1.5, 0, Math.PI*2); ctx.fill();
         }
         ctx.restore();
     } else if (e.type === 'mushroom' || e.type === '1up') {
         ctx.save();
         ctx.translate(x + w/2, y + h);
         ctx.fillStyle = '#fef08a';
         ctx.fillRect(-6, -10, 12, 10);
         ctx.fillStyle = e.type === '1up' ? '#22c55e' : '#ef4444'; // Green or Red
         ctx.beginPath(); ctx.arc(0, -10, 14, Math.PI, 0); ctx.fill();
         ctx.fillStyle = '#fff';
         ctx.beginPath(); ctx.arc(0, -16, 4, 0, Math.PI*2); ctx.fill();
         ctx.beginPath(); ctx.arc(-10, -12, 3, 0, Math.PI*2); ctx.fill();
         ctx.beginPath(); ctx.arc(10, -12, 3, 0, Math.PI*2); ctx.fill();
         ctx.restore();
     } else if (e.type === 'flower' || e.type === 'ice_flower') {
         ctx.save();
         ctx.translate(x + w/2, y + h);
         ctx.fillStyle = '#16a34a'; // Stem
         ctx.fillRect(-2, -10, 4, 10);
         // Leaves
         ctx.beginPath(); ctx.ellipse(-6, -4, 6, 3, 0, 0, Math.PI*2); ctx.fill();
         ctx.beginPath(); ctx.ellipse(6, -4, 6, 3, 0, 0, Math.PI*2); ctx.fill();
         // Head
         ctx.fillStyle = e.type === 'ice_flower' ? '#3b82f6' : '#ef4444'; // Blue or Red
         ctx.beginPath(); ctx.ellipse(0, -14, 10, 6, 0, 0, Math.PI*2); ctx.fill();
         ctx.fillStyle = e.type === 'ice_flower' ? '#dbeafe' : '#facc15'; // Light blue or Yellow Center
         ctx.beginPath(); ctx.ellipse(0, -14, 5, 3, 0, 0, Math.PI*2); ctx.fill();
         ctx.restore();
     } else if (e.type === 'star') {
         ctx.save();
         ctx.translate(x + w/2, y + h/2);
         // Rainbow
         const hue = (Date.now() / 2) % 360;
         ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
         const spikes = 5;
         const outerRadius = 14;
         const innerRadius = 7;
         ctx.beginPath();
         let rot = Math.PI / 2 * 3;
         let xS = 0, yS = 0;
         const step = Math.PI / spikes;
         ctx.moveTo(0, 0 - outerRadius);
         for (let i = 0; i < spikes; i++) {
            xS = 0 + Math.cos(rot) * outerRadius;
            yS = 0 + Math.sin(rot) * outerRadius;
            ctx.lineTo(xS, yS);
            rot += step;
            xS = 0 + Math.cos(rot) * innerRadius;
            yS = 0 + Math.sin(rot) * innerRadius;
            ctx.lineTo(xS, yS);
            rot += step;
         }
         ctx.lineTo(0, 0 - outerRadius);
         ctx.closePath();
         ctx.fill();
         // Eyes
         ctx.fillStyle = '#000';
         ctx.fillRect(-4, -2, 2, 4);
         ctx.fillRect(2, -2, 2, 4);
         ctx.restore();
     } else if (e.type === 'fireball' || e.type === 'iceball') {
         ctx.save();
         ctx.translate(x + w/2, y + h/2);
         ctx.rotate(e.animTimer * 20);
         const c1 = e.type === 'iceball' ? '#dbeafe' : '#fef08a';
         const c2 = e.type === 'iceball' ? '#3b82f6' : '#ef4444';
         const grad = ctx.createRadialGradient(0,0,2,0,0,8);
         grad.addColorStop(0, c1);
         grad.addColorStop(0.5, c2);
         grad.addColorStop(1, 'rgba(0,0,0,0)');
         ctx.fillStyle = grad;
         ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill();
         ctx.restore();
     }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawSky(ctx, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-stateRef.current.cameraX, 0);

    drawDecorations(ctx);

    tilesRef.current.forEach(tile => {
      if (tile.x < stateRef.current.cameraX - 50 || tile.x > stateRef.current.cameraX + SCREEN_WIDTH + 50) return;
      drawTile(ctx, tile);
    });

    entitiesRef.current.forEach(ent => {
       if (ent.pos.x < stateRef.current.cameraX - 100 || ent.pos.x > stateRef.current.cameraX + SCREEN_WIDTH + 100) return;
       // Piranha plant draws behind pipe
       if (ent.type === 'piranha_plant') drawEnemy(ctx, ent);
    });
    // Redraw pipes on top of piranhas
    tilesRef.current.forEach(tile => {
      if (tile.type.startsWith('pipe') && (tile.x < stateRef.current.cameraX - 50 || tile.x > stateRef.current.cameraX + SCREEN_WIDTH + 50)) return;
      if (tile.type.startsWith('pipe')) drawTile(ctx, tile);
    });

    entitiesRef.current.forEach(ent => {
       if (ent.pos.x < stateRef.current.cameraX - 100 || ent.pos.x > stateRef.current.cameraX + SCREEN_WIDTH + 100) return;
       if (ent.type !== 'piranha_plant') drawEnemy(ctx, ent);
    });

    if (!playerRef.current.isDead) drawPlayer(ctx, playerRef.current);

    particlesRef.current.forEach(p => {
       if (p.type === 'score_text') {
           ctx.shadowColor = 'rgba(0,0,0,0.3)';
           ctx.shadowBlur = 2;
           ctx.fillStyle = '#fff';
           ctx.font = 'bold 24px sans-serif';
           ctx.textAlign = 'center';
           ctx.fillText(p.text || "100", p.pos.x, p.pos.y);
           ctx.shadowBlur = 0;
       } else {
           ctx.globalAlpha = (60 - p.animTimer) / 60;
           ctx.fillStyle = p.color || '#fff';
           ctx.beginPath();
           ctx.arc(p.pos.x, p.pos.y, p.width/2, 0, Math.PI*2);
           ctx.fill();
           ctx.globalAlpha = 1;
       }
    });

    ctx.restore();
  };

  const gameLoop = (time: number) => {
    update();
    draw();
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  return (
    <div className="relative border-4 border-slate-300 rounded-3xl overflow-hidden shadow-2xl bg-sky-100">
      <div className="absolute top-4 left-4 right-4 flex justify-between text-slate-800 font-sans text-xl z-10 select-none">
        <div className="flex flex-col bg-white/80 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-sm">
           <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-1">Score</span>
           <span className="font-black text-2xl tracking-tighter text-blue-600">{uiState.score.toLocaleString()}</span>
        </div>
        <div className="flex flex-col items-center bg-white/80 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-sm">
           <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-1">Lives</span>
           <div className="flex gap-1 flex-wrap justify-end max-w-[200px]">
              {Array.from({length: Math.max(uiState.lives, 3)}).slice(0, 8).map((_, i) => (
                 <span key={i} className={`text-xl transition-all ${i < uiState.lives ? 'text-red-500 scale-110' : 'text-slate-300 scale-90 grayscale'}`}>♥</span>
              ))}
              {uiState.lives > 8 && <span className="text-red-500 font-bold text-lg leading-6">+{uiState.lives - 8}</span>}
           </div>
        </div>
        <div className="flex flex-col items-end bg-white/80 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-sm">
           <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-1">World</span>
           <span className="font-black text-2xl text-yellow-500">{uiState.world}</span>
        </div>
      </div>
      
      {uiState.gameOver && (
        <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-20 flex-col animate-in fade-in duration-500 backdrop-blur-md">
           <div className="bg-white p-8 rounded-3xl text-center shadow-2xl transform scale-100">
             <h1 className="text-5xl font-black mb-2 text-slate-800">GAME OVER</h1>
             <div className="text-2xl text-slate-500 mb-8 font-bold">
                 Score: <span className="text-blue-500">{uiState.score}</span>
             </div>
             <button 
               onClick={() => initLevel(true)}
               className="px-10 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold text-xl rounded-full shadow-xl hover:shadow-cyan-500/50 hover:scale-105 transition-all"
             >
               Play Again
             </button>
           </div>
        </div>
      )}

      <canvas 
        ref={canvasRef}
        width={SCREEN_WIDTH} 
        height={SCREEN_HEIGHT}
        className="block bg-sky-100 cursor-none w-full h-full object-contain"
      />
    </div>
  );
});

export default GameCanvas;