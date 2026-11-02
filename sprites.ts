/**
 * Pre-rendered sprite cache.
 *
 * The game runs on CPU-rendered canvases, so nothing in the hot loop is allowed
 * to build gradients, paths or text every frame. All art is drawn once into an
 * offscreen canvas and then blitted with drawImage, which is both cheaper and
 * allows far more detail than per-frame path drawing.
 */
import { EntityType, Tile } from './types';
import { THEMES, TILE_SIZE } from './constants';

export interface Sprite {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
}

type Builder = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

interface Def {
  w: number;
  h: number;
  build: Builder;
}

const defs = new Map<string, Def>();
const made = new Map<string, Sprite>();
const frozenCache = new Map<string, Sprite>();

function def(key: string, w: number, h: number, build: Builder) {
  defs.set(key, { w, h, build });
}

export function sprite(key: string): Sprite {
  const hit = made.get(key);
  if (hit) return hit;
  const d = defs.get(key);
  if (!d) throw new Error(`unknown sprite: ${key}`);
  const canvas = document.createElement('canvas');
  canvas.width = d.w;
  canvas.height = d.h;
  const ctx = canvas.getContext('2d')!;
  d.build(ctx, d.w, d.h);
  const s: Sprite = { canvas, w: d.w, h: d.h };
  made.set(key, s);
  return s;
}

/** Draws a sprite centred on (x, y). */
export function blit(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number) {
  ctx.drawImage(s.canvas, Math.round(x - s.w / 2), Math.round(y - s.h / 2));
}

// --- Small drawing helpers --------------------------------------------------

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function vgrad(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, top: string, bottom: string) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  return g;
}

/** A flat coloured silhouette of another sprite, cached under its own key. */
function tinted(base: Sprite, color: string, alpha: number, key: string): Sprite {
  const cached = made.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = base.w;
  canvas.height = base.h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(base.canvas, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, base.w, base.h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  const s: Sprite = { canvas, w: base.w, h: base.h };
  made.set(key, s);
  return s;
}

// --- Tiles ------------------------------------------------------------------

function buildGround(themeIndex: number, top: boolean) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const theme = THEMES[themeIndex];
    if (top) {
      ctx.fillStyle = vgrad(ctx, 0, 0, 10, theme.grass[0], theme.grass[1]);
      ctx.fillRect(0, 0, w, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(0, 0, w, 2);
      ctx.fillStyle = vgrad(ctx, 0, 10, h - 10, theme.ground[0], theme.ground[1]);
      ctx.fillRect(0, 10, w, h - 10);
    } else {
      ctx.fillStyle = vgrad(ctx, 0, 0, h, theme.ground[0], theme.ground[1]);
      ctx.fillRect(0, 0, w, h);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(4, 16, 6, 3);
    ctx.fillRect(21, 22, 5, 3);
    ctx.fillRect(12, 26, 4, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(6, 18, 5, 2);
    ctx.fillRect(23, 24, 4, 2);
  };
}

function buildBrick(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(1, 1, w - 2, h - 2);
  ctx.fillStyle = '#fca5a5';
  ctx.fillRect(2, 2, w - 4, 4);
  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(0, 14, w, 3);
  ctx.fillRect(0, 0, 3, 14);
  ctx.fillRect(15, 17, 3, 15);
  ctx.fillRect(29, 17, 3, 15);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(4, 4, 10, 2);
}

function buildQuestion(ctx: CanvasRenderingContext2D, w: number, h: number, bright: boolean) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, bright ? '#fef9c3' : '#fde047');
  g.addColorStop(0.5, '#fbbf24');
  g.addColorStop(1, '#d97706');
  ctx.fillStyle = g;
  roundRect(ctx, 0, 0, w, h, 5);
  ctx.fill();
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  roundRect(ctx, 3, 3, w - 6, 6, 3);
  ctx.fill();
  ctx.fillStyle = '#78350f';
  ctx.font = 'bold 21px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', w / 2, h / 2 + 1);
  ctx.fillStyle = '#fff7d6';
  ctx.font = 'bold 19px sans-serif';
  ctx.fillText('?', w / 2 - 1, h / 2 - 1);
}

function buildQuestionHit(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#a16207';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#92400e';
  ctx.fillRect(2, 2, w - 4, h - 4);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(3, 3, w - 6, 4);
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, w - 2, h - 2);
}

function buildPipe(ctx: CanvasRenderingContext2D, w: number, h: number, side: 'l' | 'r', top: boolean) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, side === 'l' ? '#166534' : '#15803d');
  g.addColorStop(0.35, '#22c55e');
  g.addColorStop(0.6, '#16a34a');
  g.addColorStop(1, side === 'l' ? '#14532d' : '#052e16');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (top) {
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(side === 'l' ? 3 : 0, 2, side === 'l' ? 6 : 4, h - 6);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, h - 4, w, 4);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}

function buildHard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#b45309';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#d97706';
  ctx.fillRect(2, 2, w - 4, h - 4);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(3, 3, w - 6, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(4, 20, w - 8, 8);
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, w - 2, h - 2);
}

function buildCastle(ctx: CanvasRenderingContext2D, w: number, h: number, kind: 'brick' | 'top' | 'door') {
  if (kind === 'door') {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(w / 2, h - 6, w / 2 - 1, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(0, h - 6, w, 6);
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(w / 2, h - 6, w / 2 - 3, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(3, h - 6, w - 6, 6);
    return;
  }
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(2, 2, w - 4, h - 4);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(3, 3, w - 6, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(4, h - 12, w - 8, 8);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, w - 2, h - 2);
  if (kind === 'top') {
    ctx.fillStyle = '#64748b';
    for (let i = 0; i < 4; i++) ctx.fillRect(2 + i * 8, 0, 4, 6);
  }
}

function buildFlagpole(ctx: CanvasRenderingContext2D, w: number, h: number, top: boolean) {
  if (!top) {
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(12, 0, 8, h);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(13, 0, 3, h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(18, 0, 2, h);
    return;
  }
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(12, 0, 8, h);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(13, 0, 3, h);
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(16, 4, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#86efac';
  ctx.beginPath();
  ctx.arc(13, 1, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(16, 8);
  ctx.lineTo(46, 18);
  ctx.lineTo(16, 30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(16, 8);
  ctx.lineTo(34, 14);
  ctx.lineTo(16, 17);
  ctx.closePath();
  ctx.fill();
}

for (let t = 0; t < THEMES.length; t++) {
  def(`ground_${t}`, TILE_SIZE, TILE_SIZE, buildGround(t, true));
  def(`ground_fill_${t}`, TILE_SIZE, TILE_SIZE, buildGround(t, false));
}
def('brick', TILE_SIZE, TILE_SIZE, buildBrick);
def('question', TILE_SIZE, TILE_SIZE, (c, w, h) => buildQuestion(c, w, h, false));
def('question_bright', TILE_SIZE, TILE_SIZE, (c, w, h) => buildQuestion(c, w, h, true));
def('question_hit', TILE_SIZE, TILE_SIZE, buildQuestionHit);
def('pipe_l', TILE_SIZE, TILE_SIZE, (c, w, h) => buildPipe(c, w, h, 'l', false));
def('pipe_r', TILE_SIZE, TILE_SIZE, (c, w, h) => buildPipe(c, w, h, 'r', false));
def('pipe_top_l', TILE_SIZE, TILE_SIZE, (c, w, h) => buildPipe(c, w, h, 'l', true));
def('pipe_top_r', TILE_SIZE, TILE_SIZE, (c, w, h) => buildPipe(c, w, h, 'r', true));
def('hard', TILE_SIZE, TILE_SIZE, buildHard);
def('castle_brick', TILE_SIZE, TILE_SIZE, (c, w, h) => buildCastle(c, w, h, 'brick'));
def('castle_top', TILE_SIZE, TILE_SIZE, (c, w, h) => buildCastle(c, w, h, 'top'));
def('castle_door', TILE_SIZE, TILE_SIZE, (c, w, h) => buildCastle(c, w, h, 'door'));
def('flagpole', TILE_SIZE, TILE_SIZE, (c, w, h) => buildFlagpole(c, w, h, false));
def('flagpole_top', TILE_SIZE, TILE_SIZE, (c, w, h) => buildFlagpole(c, w, h, true));

// --- Background -------------------------------------------------------------

function buildSky(themeIndex: number) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const theme = THEMES[themeIndex];
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, theme.sky[0]);
    g.addColorStop(0.55, theme.sky[1]);
    g.addColorStop(1, theme.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    if (theme.star) {
      for (let i = 0; i < 90; i++) {
        const x = (i * 137.508) % w;
        const y = (i * 61.803) % (h * 0.62);
        const r = 0.6 + ((i * 13) % 7) / 7;
        ctx.globalAlpha = 0.35 + ((i * 29) % 60) / 100;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const mx = w - 120;
      const my = 90;
      const glow = ctx.createRadialGradient(mx, my, 8, mx, my, 90);
      glow.addColorStop(0, 'rgba(255,255,255,0.55)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(mx - 90, my - 90, 180, 180);
      ctx.fillStyle = '#fef9c3';
      ctx.beginPath();
      ctx.arc(mx, my, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(203,213,225,0.6)';
      ctx.beginPath();
      ctx.arc(mx - 9, my - 7, 6, 0, Math.PI * 2);
      ctx.arc(mx + 8, my + 6, 8, 0, Math.PI * 2);
      ctx.arc(mx + 2, my - 12, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const sx = w - 140;
      const sy = 88;
      const glow = ctx.createRadialGradient(sx, sy, 10, sx, sy, 130);
      glow.addColorStop(0, 'rgba(255,255,255,0.5)');
      glow.addColorStop(0.35, 'rgba(255,240,180,0.28)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sx - 130, sy - 130, 260, 260);
      ctx.fillStyle = themeIndex === 1 ? '#fff7ed' : '#fefce8';
      ctx.beginPath();
      ctx.arc(sx, sy, 34, 0, Math.PI * 2);
      ctx.fill();
    }
  };
}

function buildHill(themeIndex: number) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const theme = THEMES[themeIndex];
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, theme.hill[0]);
    g.addColorStop(1, theme.hill[1]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(w / 2, h, w / 2, h, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(w / 2, h, (w / 2) * (1 - i * 0.18), h * (1 - i * 0.16), 0, Math.PI, 0);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    for (let i = 0; i < 8; i++) {
      const a = Math.PI + (i / 7) * Math.PI;
      ctx.beginPath();
      ctx.arc(w / 2 + Math.cos(a) * (w / 2 - 8), h + Math.sin(a) * (h - 8), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  };
}

function buildCloud(themeIndex: number) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const theme = THEMES[themeIndex];
    ctx.fillStyle = theme.cloud;
    const r = h / 2;
    ctx.beginPath();
    ctx.arc(w * 0.3, h * 0.6, r, 0, Math.PI * 2);
    ctx.arc(w * 0.55, h * 0.45, r * 1.15, 0, Math.PI * 2);
    ctx.arc(w * 0.78, h * 0.62, r * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.32, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  };
}

function buildBush(themeIndex: number) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const theme = THEMES[themeIndex];
    ctx.fillStyle = theme.hill[1];
    ctx.beginPath();
    ctx.arc(w * 0.25, h * 0.75, h * 0.45, 0, Math.PI * 2);
    ctx.arc(w * 0.5, h * 0.55, h * 0.55, 0, Math.PI * 2);
    ctx.arc(w * 0.78, h * 0.75, h * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.hill[0];
    ctx.beginPath();
    ctx.arc(w * 0.42, h * 0.45, h * 0.28, 0, Math.PI * 2);
    ctx.fill();
  };
}

for (let t = 0; t < THEMES.length; t++) {
  def(`sky_${t}`, 800, 600, buildSky(t));
  def(`hill_l_${t}`, 200, 100, buildHill(t));
  def(`hill_s_${t}`, 100, 60, buildHill(t));
  def(`cloud_l_${t}`, 150, 70, buildCloud(t));
  def(`cloud_s_${t}`, 100, 50, buildCloud(t));
  def(`bush_${t}`, 96, 44, buildBush(t));
}

// --- Particles & shadows ----------------------------------------------------

def('particle', 12, 12, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
});

def('shadow', 48, 18, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(15,23,42,0.34)');
  g.addColorStop(1, 'rgba(15,23,42,0)');
  ctx.fillStyle = g;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(1, h / w);
  ctx.beginPath();
  ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
});

/** Soft round particle in a specific colour (cached). */
export function particleSprite(color: string): Sprite {
  const key = `particle_${color}`;
  const hit = made.get(key);
  if (hit) return hit;
  return tinted(sprite('particle'), color, 1, key);
}

// --- Items ------------------------------------------------------------------

function buildMushroom(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cap: string,
  capDark: string,
  spots: string,
) {
  const stemH = h * 0.42;
  ctx.fillStyle = '#fef3c7';
  roundRect(ctx, w * 0.26, h - stemH, w * 0.48, stemH, 4);
  ctx.fill();
  ctx.fillStyle = '#d6d3d1';
  ctx.fillRect(w * 0.26, h - 6, w * 0.48, 4);
  ctx.fillStyle = capDark;
  ctx.beginPath();
  ctx.ellipse(w / 2, h - stemH + 2, w * 0.48, h * 0.34, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.ellipse(w / 2, h - stemH + 3, w * 0.44, h * 0.3, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = spots;
  const dot = [
    [w * 0.3, h * 0.52, 4],
    [w * 0.58, h * 0.45, 5],
    [w * 0.74, h * 0.6, 3.5],
  ];
  for (const [x, y, r] of dot) {
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(w * 0.38, h * 0.52, w * 0.14, h * 0.07, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

function buildFlower(ctx: CanvasRenderingContext2D, w: number, h: number, petal: string, center: string) {
  ctx.strokeStyle = '#16a34a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(w / 2, h);
  ctx.lineTo(w / 2, h * 0.45);
  ctx.stroke();
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.ellipse(w * 0.28, h * 0.78, 7, 4, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.72, h * 0.68, 7, 4, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = petal;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(w / 2 + Math.cos(a) * 8, h * 0.36 + Math.sin(a) * 8, 6, 8, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = center;
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.36, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(w / 2 - 2, h * 0.33, 2, 0, Math.PI * 2);
  ctx.fill();
}

function buildTanooki(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#a16207';
  ctx.beginPath();
  ctx.arc(w * 0.28, h * 0.22, 5, 0, Math.PI * 2);
  ctx.arc(w * 0.72, h * 0.22, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d97706';
  roundRect(ctx, w * 0.22, h * 0.2, w * 0.56, h * 0.46, 8);
  ctx.fill();
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.42, w * 0.22, h * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.arc(w * 0.36, h * 0.42, 2.6, 0, Math.PI * 2);
  ctx.arc(w * 0.64, h * 0.42, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.52, 3.5, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b45309';
  roundRect(ctx, w * 0.3, h * 0.62, w * 0.4, h * 0.34, 5);
  ctx.fill();
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.68, h * 0.78);
  ctx.quadraticCurveTo(w * 0.95, h * 0.66, w * 0.88, h * 0.4);
  ctx.stroke();
  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.82, h * 0.6);
  ctx.quadraticCurveTo(w * 0.93, h * 0.5, w * 0.88, h * 0.42);
  ctx.stroke();
}

function buildJetpack(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#94a3b8';
  roundRect(ctx, w * 0.22, h * 0.22, w * 0.56, h * 0.56, 6);
  ctx.fill();
  ctx.fillStyle = '#cbd5e1';
  roundRect(ctx, w * 0.26, h * 0.26, w * 0.48, h * 0.2, 4);
  ctx.fill();
  ctx.fillStyle = '#475569';
  ctx.fillRect(w * 0.3, h * 0.52, w * 0.4, h * 0.2);
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(w * 0.36, h * 0.72);
  ctx.lineTo(w * 0.46, h * 0.72);
  ctx.lineTo(w * 0.41, h * 0.95);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.moveTo(w * 0.54, h * 0.72);
  ctx.lineTo(w * 0.64, h * 0.72);
  ctx.lineTo(w * 0.59, h * 0.95);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.36, 3, 0, Math.PI * 2);
  ctx.fill();
}

function buildMagnet(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.52, w * 0.28, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.52);
  ctx.lineTo(w * 0.22, h * 0.86);
  ctx.moveTo(w * 0.78, h * 0.52);
  ctx.lineTo(w * 0.78, h * 0.86);
  ctx.stroke();
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(w * 0.15, h * 0.72, w * 0.14, h * 0.16);
  ctx.fillRect(w * 0.71, h * 0.72, w * 0.14, h * 0.16);
  ctx.strokeStyle = '#b91c1c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.52, w * 0.28, Math.PI, 0);
  ctx.stroke();
}

function buildHourglass(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h * 0.16);
  ctx.lineTo(w * 0.82, h * 0.16);
  ctx.lineTo(w * 0.55, h * 0.5);
  ctx.lineTo(w * 0.82, h * 0.84);
  ctx.lineTo(w * 0.18, h * 0.84);
  ctx.lineTo(w * 0.45, h * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.moveTo(w * 0.26, h * 0.22);
  ctx.lineTo(w * 0.38, h * 0.22);
  ctx.lineTo(w * 0.47, h * 0.48);
  ctx.lineTo(w * 0.42, h * 0.48);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.78);
  ctx.lineTo(w * 0.78, h * 0.78);
  ctx.lineTo(w * 0.56, h * 0.52);
  ctx.lineTo(w * 0.44, h * 0.52);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#78350f';
  ctx.fillRect(w * 0.12, h * 0.1, w * 0.76, 5);
  ctx.fillRect(w * 0.12, h * 0.86, w * 0.76, 5);
}

function buildSpring(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#22d3ee';
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.36, w * 0.36, h * 0.24, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#a5f3fc';
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.37, w * 0.31, h * 0.19, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#155e75';
  ctx.fillRect(w * 0.4, h * 0.36, w * 0.2, h * 0.1);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const y = h * 0.55 + i * h * 0.11;
    ctx.moveTo(w * 0.32, y);
    ctx.lineTo(w * 0.68, y + h * 0.055);
    ctx.lineTo(w * 0.32, y + h * 0.11);
  }
  ctx.stroke();
}

function buildBoomerangFlower(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = '#16a34a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(w / 2, h);
  ctx.lineTo(w / 2, h * 0.5);
  ctx.stroke();
  ctx.fillStyle = '#a855f7';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.ellipse(w / 2 + Math.cos(a) * 8, h * 0.4 + Math.sin(a) * 8, 6, 8, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.4, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.4, 3.4, 0, Math.PI * 2);
  ctx.fill();
}

def('mushroom', 30, 30, (c, w, h) => buildMushroom(c, w, h, '#ef4444', '#b91c1c', '#fff'));
def('1up', 30, 30, (c, w, h) => buildMushroom(c, w, h, '#22c55e', '#15803d', '#fff'));
def('gold_mushroom', 30, 30, (c, w, h) => buildMushroom(c, w, h, '#fbbf24', '#d97706', '#fffbeb'));
def('mega_mushroom', 30, 30, (c, w, h) => buildMushroom(c, w, h, '#a855f7', '#7e22ce', '#f5d0fe'));
def('flower', 30, 30, (c, w, h) => buildFlower(c, w, h, '#ef4444', '#facc15'));
def('ice_flower', 30, 30, (c, w, h) => buildFlower(c, w, h, '#3b82f6', '#dbeafe'));
def('boomerang_flower', 30, 30, buildBoomerangFlower);
def('tanooki', 30, 30, buildTanooki);
def('jetpack', 30, 30, buildJetpack);
def('magnet', 30, 30, buildMagnet);
def('hourglass', 30, 30, buildHourglass);
def('spring', 30, 30, buildSpring);

// Rainbow star: one sprite per hue bucket so the power-up still sparkles.
for (let b = 0; b < 12; b++) {
  const hue = b * 30;
  def(`star_${b}`, 30, 30, (ctx, w, h) => {
    ctx.fillStyle = `hsl(${hue}, 90%, 62%)`;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const a2 = a + Math.PI / 5;
      ctx.lineTo(w / 2 + Math.cos(a) * 14, h / 2 + Math.sin(a) * 14);
      ctx.lineTo(w / 2 + Math.cos(a2) * 7, h / 2 + Math.sin(a2) * 7);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `hsl(${hue}, 100%, 82%)`;
    ctx.beginPath();
    ctx.arc(w / 2 - 3, h / 2 - 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(w / 2 - 6, h / 2 - 1, 2.5, 5);
    ctx.fillRect(w / 2 + 2, h / 2 - 1, 2.5, 5);
  });
}

// Coin: 6 spin frames
for (let f = 0; f < 6; f++) {
  const squash = Math.abs(Math.cos((f / 6) * Math.PI));
  def(`coin_${f}`, 24, 26, (ctx, w, h) => {
    const rx = Math.max(2.5, 11 * squash);
    const g = ctx.createLinearGradient(w / 2 - rx, 0, w / 2 + rx, 0);
    g.addColorStop(0, '#b45309');
    g.addColorStop(0.4, '#fbbf24');
    g.addColorStop(0.7, '#fde68a');
    g.addColorStop(1, '#d97706');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, rx, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (squash > 0.45) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.ellipse(w / 2 - rx * 0.3, h / 2 - 3, rx * 0.22, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

def('boomerang', 26, 26, (ctx, w, h) => {
  ctx.strokeStyle = '#c2410c';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.16, h * 0.24);
  ctx.quadraticCurveTo(w * 0.5, h * 0.86, w * 0.84, h * 0.24);
  ctx.stroke();
  ctx.strokeStyle = '#fb923c';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.26);
  ctx.quadraticCurveTo(w * 0.5, h * 0.78, w * 0.8, h * 0.26);
  ctx.stroke();
  ctx.fillStyle = '#fff7ed';
  ctx.beginPath();
  ctx.arc(w * 0.16, h * 0.24, 2.6, 0, Math.PI * 2);
  ctx.arc(w * 0.84, h * 0.24, 2.6, 0, Math.PI * 2);
  ctx.fill();
});

function buildFireball(ctx: CanvasRenderingContext2D, w: number, h: number, cold: boolean) {
  const core = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
  if (cold) {
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.35, '#dbeafe');
    core.addColorStop(0.7, '#3b82f6');
    core.addColorStop(1, 'rgba(59,130,246,0)');
  } else {
    core.addColorStop(0, '#fffbeb');
    core.addColorStop(0.35, '#fde047');
    core.addColorStop(0.7, '#ef4444');
    core.addColorStop(1, 'rgba(239,68,68,0)');
  }
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
  ctx.fill();
  // Four little flames so it reads as a spinning ball
  ctx.fillStyle = cold ? '#bfdbfe' : '#fef08a';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(w / 2 + Math.cos(a) * w * 0.3, h / 2 + Math.sin(a) * h * 0.3, w * 0.16, w * 0.1, a, 0, Math.PI * 2);
    ctx.fill();
  }
}

def('fireball', 20, 20, (c, w, h) => buildFireball(c, w, h, false));
def('iceball', 20, 20, (c, w, h) => buildFireball(c, w, h, true));

// --- Enemies ----------------------------------------------------------------

function buildGoomba(ctx: CanvasRenderingContext2D, w: number, h: number, frame: number, big: boolean) {
  const step = frame === 0 ? 1 : -1;
  const body = big ? '#be123c' : '#d97706';
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.ellipse(w * 0.32, h - 4, w * 0.16, h * 0.08, 0, 0, Math.PI * 2);
  ctx.ellipse(w * 0.68, h - 4, w * 0.16, h * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(w * 0.08, h - 4);
  ctx.quadraticCurveTo(w * 0.5, -h * 0.12, w * 0.92, h - 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.ellipse(w * 0.34, h * 0.36, w * 0.1, h * 0.12, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(w * 0.34, h * 0.52, w * 0.14, h * 0.17, 0, 0, Math.PI * 2);
  ctx.ellipse(w * 0.66, h * 0.52, w * 0.14, h * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.ellipse(w * 0.34 + step, h * 0.54, w * 0.06, h * 0.1, 0, 0, Math.PI * 2);
  ctx.ellipse(w * 0.66 + step, h * 0.54, w * 0.06, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.78, w * 0.16, h * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
}

function buildKoopa(ctx: CanvasRenderingContext2D, w: number, h: number, red: boolean) {
  const shell = red ? '#ef4444' : '#22c55e';
  const shellDark = red ? '#b91c1c' : '#15803d';
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.ellipse(w * 0.6, h * 0.55, w * 0.2, h * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.ellipse(w * 0.42, h * 0.55, w * 0.27, h * 0.36, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shellDark;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = shellDark;
  ctx.beginPath();
  ctx.ellipse(w * 0.32, h * 0.48, w * 0.12, h * 0.16, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(w * 0.66, h * 0.42, w * 0.11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(w * 0.68, h * 0.42, w * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(w * 0.78, h * 0.46);
  ctx.lineTo(w * 0.9, h * 0.5);
  ctx.lineTo(w * 0.78, h * 0.54);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.ellipse(w * 0.42, h * 0.9, w * 0.26, h * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
}

function buildShell(ctx: CanvasRenderingContext2D, w: number, h: number, red: boolean) {
  const shell = red ? '#ef4444' : '#22c55e';
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, Math.min(w, h) / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(w / 2, h * 0.28);
  ctx.lineTo(w * 0.66, h / 2);
  ctx.lineTo(w / 2, h * 0.72);
  ctx.lineTo(w * 0.34, h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = red ? '#b91c1c' : '#15803d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, Math.min(w, h) / 2 - 1, 0, Math.PI * 2);
  ctx.stroke();
}

function buildSpiny(ctx: CanvasRenderingContext2D, w: number, h: number, frame: number) {
  const step = frame === 0 ? 1 : -1;
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.62, w * 0.4, h * 0.34, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.08);
  ctx.lineTo(w * 0.62, h * 0.32);
  ctx.lineTo(w * 0.38, h * 0.32);
  ctx.closePath();
  ctx.moveTo(w * 0.18, h * 0.24);
  ctx.lineTo(w * 0.3, h * 0.42);
  ctx.lineTo(w * 0.1, h * 0.42);
  ctx.closePath();
  ctx.moveTo(w * 0.82, h * 0.24);
  ctx.lineTo(w * 0.9, h * 0.42);
  ctx.lineTo(w * 0.7, h * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(w * 0.76, h * 0.56, w * 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(w * 0.79, h * 0.54, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#451a03';
  ctx.fillRect(w * 0.3 + step * 3, h - 5, 7, 5);
  ctx.fillRect(w * 0.62 - step * 3, h - 5, 7, 5);
}

function buildBulletBill(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(w * 0.16, h * 0.16, w * 0.72, h * 0.68, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w * 0.2, h / 2, h * 0.5, Math.PI / 2, Math.PI * 1.5);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(w * 0.36, h * 0.36, h * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(w * 0.4, h * 0.36, h * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(w * 0.78, h * 0.6);
  ctx.lineTo(w * 0.95, h * 0.7);
  ctx.lineTo(w * 0.78, h * 0.8);
  ctx.closePath();
  ctx.fill();
}

function buildPiranha(ctx: CanvasRenderingContext2D, w: number, h: number, frame: number) {
  const open = frame % 2 === 0;
  ctx.strokeStyle = '#16a34a';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(w / 2, h);
  ctx.lineTo(w / 2, h * 0.45);
  ctx.stroke();
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 1, h);
  ctx.lineTo(w / 2 - 1, h * 0.45);
  ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.36, w * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.26, w * 0.3, Math.PI, 0);
  ctx.fill();
  if (open) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.38);
    ctx.lineTo(w * 0.9, h * 0.22);
    ctx.lineTo(w * 0.9, h * 0.54);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(w * 0.26, h * 0.3, 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.4);
    ctx.quadraticCurveTo(w / 2, h * 0.52, w * 0.8, h * 0.4);
    ctx.stroke();
  }
}

function buildBee(ctx: CanvasRenderingContext2D, w: number, h: number, frame: number) {
  const wing = frame === 0 ? -3 : 2;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(w * 0.34, h * 0.16 + wing, w * 0.2, h * 0.16, -0.5, 0, Math.PI * 2);
  ctx.ellipse(w * 0.68, h * 0.16 + wing, w * 0.2, h * 0.16, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.58, w * 0.36, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(w * 0.34, h * 0.34, w * 0.1, h * 0.46);
  ctx.fillRect(w * 0.56, h * 0.34, w * 0.1, h * 0.46);
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(w * 0.36, h * 0.44, w * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.moveTo(w * 0.16, h * 0.6);
  ctx.lineTo(w * 0.02, h * 0.5);
  ctx.lineTo(w * 0.04, h * 0.72);
  ctx.closePath();
  ctx.fill();
}

def('goomba_0', 30, 30, (c, w, h) => buildGoomba(c, w, h, 0, false));
def('goomba_1', 30, 30, (c, w, h) => buildGoomba(c, w, h, 1, false));
def('big_goomba_0', 60, 60, (c, w, h) => buildGoomba(c, w, h, 0, true));
def('big_goomba_1', 60, 60, (c, w, h) => buildGoomba(c, w, h, 1, true));
def('koopa', 30, 34, (c, w, h) => buildKoopa(c, w, h, false));
def('koopa_red', 30, 34, (c, w, h) => buildKoopa(c, w, h, true));
def('shell', 30, 26, (c, w, h) => buildShell(c, w, h, false));
def('shell_red', 30, 26, (c, w, h) => buildShell(c, w, h, true));
def('spiny_0', 30, 30, (c, w, h) => buildSpiny(c, w, h, 0));
def('spiny_1', 30, 30, (c, w, h) => buildSpiny(c, w, h, 1));
def('bullet_bill', 34, 28, buildBulletBill);
def('piranha_0', 24, 34, (c, w, h) => buildPiranha(c, w, h, 0));
def('piranha_1', 24, 34, (c, w, h) => buildPiranha(c, w, h, 1));
def('bee_0', 30, 24, (c, w, h) => buildBee(c, w, h, 0));
def('bee_1', 30, 24, (c, w, h) => buildBee(c, w, h, 1));

/** Icy silhouette of an enemy sprite. */
export function frozenSprite(key: string): Sprite {
  const hit = frozenCache.get(key);
  if (hit) return hit;
  const s = tinted(sprite(key), '#60a5fa', 0.85, `frozen_${key}`);
  frozenCache.set(key, s);
  return s;
}

// --- Public lookups ---------------------------------------------------------

export function tileSprite(type: Tile['type'], theme: number, hit: boolean): Sprite | null {
  switch (type) {
    case 'ground':
      return sprite(`ground_${theme}`);
    case 'ground_fill':
      return sprite(`ground_fill_${theme}`);
    case 'brick':
      return sprite('brick');
    case 'question':
      return hit ? sprite('question_hit') : sprite('question');
    case 'pipe_l':
      return sprite('pipe_l');
    case 'pipe_r':
      return sprite('pipe_r');
    case 'pipe_top_l':
      return sprite('pipe_top_l');
    case 'pipe_top_r':
      return sprite('pipe_top_r');
    case 'hard':
      return sprite('hard');
    case 'castle_brick':
      return sprite('castle_brick');
    case 'castle_top':
      return sprite('castle_top');
    case 'castle_door':
      return sprite('castle_door');
    case 'flagpole':
      return sprite('flagpole');
    case 'flagpole_top':
      return sprite('flagpole_top');
    default:
      return null;
  }
}

export function itemSprite(type: EntityType, frame = 0): Sprite | null {
  switch (type) {
    case 'mushroom':
      return sprite('mushroom');
    case '1up':
      return sprite('1up');
    case 'gold_mushroom':
      return sprite('gold_mushroom');
    case 'mega_mushroom':
      return sprite('mega_mushroom');
    case 'flower':
      return sprite('flower');
    case 'ice_flower':
      return sprite('ice_flower');
    case 'fireball':
      return sprite('fireball');
    case 'iceball':
      return sprite('iceball');
    case 'boomerang_flower':
      return sprite('boomerang_flower');
    case 'tanooki':
      return sprite('tanooki');
    case 'jetpack':
      return sprite('jetpack');
    case 'magnet':
      return sprite('magnet');
    case 'hourglass':
      return sprite('hourglass');
    case 'spring':
      return sprite('spring');
    case 'star':
      return sprite(`star_${Math.floor(frame) % 12}`);
    case 'coin':
      return sprite(`coin_${Math.floor(frame) % 6}`);
    case 'boomerang':
      return sprite('boomerang');
    default:
      return null;
  }
}

export function enemySprite(type: EntityType, frame: number, frozen: boolean): Sprite | null {
  let key: string | null = null;
  switch (type) {
    case 'goomba':
      key = `goomba_${frame % 2}`;
      break;
    case 'big_goomba':
      key = `big_goomba_${frame % 2}`;
      break;
    case 'koopa':
      key = 'koopa';
      break;
    case 'koopa_red':
      key = 'koopa_red';
      break;
    case 'spiny':
      key = `spiny_${frame % 2}`;
      break;
    case 'bullet_bill':
      key = 'bullet_bill';
      break;
    case 'piranha_plant':
      key = `piranha_${frame % 2}`;
      break;
    case 'bee':
      key = `bee_${frame % 2}`;
      break;
    default:
      return null;
  }
  return frozen ? frozenSprite(key) : sprite(key);
}

export function decorSprite(kind: string, theme: number): Sprite | null {
  switch (kind) {
    case 'hill_l':
      return sprite(`hill_l_${theme}`);
    case 'hill_s':
      return sprite(`hill_s_${theme}`);
    case 'cloud_l':
      return sprite(`cloud_l_${theme}`);
    case 'cloud_s':
      return sprite(`cloud_s_${theme}`);
    case 'bush':
      return sprite(`bush_${theme}`);
    default:
      return null;
  }
}

export function skySprite(theme: number): Sprite {
  return sprite(`sky_${theme % THEMES.length}`);
}

export function shadowSprite(): Sprite {
  return sprite('shadow');
}
