import { COLOR, MARK, PALETTE, TYPES, TURN_STEP } from '../config.js';
import { view } from '../core/view.js';

export function shapePath(ctx, type, x, y, r, rot) {
  ctx.beginPath();
  if (type === 'circle') { ctx.arc(x, y, r, 0, Math.PI * 2); return; }
  if (type === 'tri') {
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + i * TURN_STEP + rot * 0.15;
      const px = x + Math.cos(a) * r * 1.16;
      const py = y + Math.sin(a) * r * 1.16;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
    return;
  }
  const s = r * 0.88;
  ctx.roundRect(x - s, y - s, s * 2, s * 2, r * 0.28);
}

export function draw(G) {
  const { ctx, W, H, LINE } = view;
  const sx = G.shake ? (Math.random() - 0.5) * 9 * G.shake : 0;
  const sy = G.shake ? (Math.random() - 0.5) * 9 * G.shake : 0;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(-10, -10, W + 20, H + 20);

  drawDefenceLine(ctx, W, H, LINE);
  drawEnemies(ctx, G);
  drawBullets(ctx, G);
  drawPods(ctx, G);
  drawShip(ctx, G);
  drawParticles(ctx, G);

  if (G.flash > 0) {
    ctx.fillStyle = `rgba(255,77,94,${G.flash * 0.16})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function drawDefenceLine(ctx, W, H, LINE) {
  ctx.strokeStyle = PALETTE.line;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([7, 7]);
  ctx.beginPath();
  ctx.moveTo(0, LINE);
  ctx.lineTo(W, LINE);
  ctx.stroke();
  ctx.setLineDash([]);

  const g = ctx.createLinearGradient(0, LINE, 0, H);
  g.addColorStop(0, 'rgba(74,84,144,.25)');
  g.addColorStop(1, 'rgba(74,84,144,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, LINE, W, H - LINE);
}

function drawEnemies(ctx, G) {
  for (const e of G.enemies) {
    ctx.save();
    if (e.armored) { ctx.shadowColor = PALETTE.armor; ctx.shadowBlur = 14; }
    if (e.hit)     { ctx.shadowColor = '#ffffff';     ctx.shadowBlur = 18 * e.hit; }

    ctx.fillStyle = COLOR[e.type];
    shapePath(ctx, e.type, e.x, e.y, e.r, e.rot);
    ctx.fill();

    if (e.armored) {
      ctx.strokeStyle = PALETTE.armor;
      ctx.lineWidth = 2.5;
      shapePath(ctx, e.type, e.x, e.y, e.r * 1.45, e.rot);
      ctx.stroke();
      ctx.fillStyle = PALETTE.armor;
      ctx.font = '600 10px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(e.hp, e.x, e.y + 3.5);
    }
    ctx.restore();
  }
}

function drawBullets(ctx, G) {
  for (const b of G.bullets) {
    ctx.fillStyle = COLOR[b.type];
    ctx.globalAlpha = b.from === 'pod' ? 0.85 : 1;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.r * 0.7, b.r * 1.6, Math.atan2(b.vy, b.vx) - Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPods(ctx, G) {
  for (const p of G.pods) {
    ctx.save();
    ctx.shadowColor = COLOR[p.type];
    ctx.shadowBlur = 12;
    ctx.fillStyle = COLOR[p.type];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7 * view.sc, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawShip(ctx, G) {
  const sh = G.ship;
  const sc = view.sc;

  ctx.save();
  ctx.translate(sh.x, sh.y);

  ctx.fillStyle = PALETTE.hull;
  ctx.beginPath();
  ctx.moveTo(0, -20 * sc);
  ctx.lineTo(15 * sc, 14 * sc);
  ctx.lineTo(0, 7 * sc);
  ctx.lineTo(-15 * sc, 14 * sc);
  ctx.closePath();
  ctx.fill();

  // 3連バレルのリング。
  // バレル i の弾種は TYPES[i] で固定し、砲塔ごと回す。
  // ang が i 段ぶん回ったとき、そのバレルが真上に来て現在の弾種になる。
  for (let i = 0; i < 3; i++) {
    const a = sh.ang - i * TURN_STEP - Math.PI / 2;
    const isTop = i === sh.idx;
    ctx.fillStyle = COLOR[TYPES[i]];
    ctx.globalAlpha = isTop ? 1 : 0.45;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 26 * sc, Math.sin(a) * 26 * sc, (isTop ? 7 : 5) * sc, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  ctx.fillStyle = COLOR[TYPES[sh.idx]];
  ctx.font = `600 ${13 * sc}px system-ui,sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(MARK[TYPES[sh.idx]], sh.x, view.H - 14);
}

function drawParticles(ctx, G) {
  for (const p of G.parts) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}
