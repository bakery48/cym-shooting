import { COLOR, MARK, PALETTE, TYPES, TURN_STEP, ANY } from '../config.js';
import { view } from '../core/view.js';

export function shapePath(ctx, type, x, y, r, rot) {
  ctx.beginPath();
  if (type === 'circle') { ctx.arc(x, y, r, 0, Math.PI * 2); return; }
  if (type === ANY) {
    // 菱形。●▲■ のどれとも違う形にして、白い ● と見間違えないようにする。
    const d = r * 1.15;
    ctx.moveTo(x, y - d); ctx.lineTo(x + d, y);
    ctx.lineTo(x, y + d); ctx.lineTo(x - d, y);
    ctx.closePath();
    return;
  }
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
  drawShield(ctx, G, W, LINE);
  drawEnemies(ctx, G);
  drawBullets(ctx, G);
  drawPods(ctx, G);
  drawWings(ctx, G);
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

/**
 * 防壁。恒久強化は「画面上の物が増える」形で出す（企画書 §6）。
 * 残り数ぶんのブロックが防衛ライン上に並び、肩代わりするたびに1つ消える。
 */
function drawShield(ctx, G, W, LINE) {
  const total = G.meta.shield;
  if (!total) return;

  const gap = 5 * view.sc;
  const h = 7 * view.sc;
  const w = (W - gap * (total + 1)) / total;

  for (let i = 0; i < total; i++) {
    const spent = i >= G.shield;
    ctx.save();
    if (!spent && G.shieldFlash) { ctx.shadowColor = PALETTE.armor; ctx.shadowBlur = 16 * G.shieldFlash; }
    ctx.globalAlpha = spent ? 0.12 : 0.72;
    ctx.fillStyle = PALETTE.armor;
    ctx.beginPath();
    ctx.roundRect(gap + i * (w + gap), LINE - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** 僚機。ポッドと違って公転せず自機の脇に固定で並ぶ ― 別物だと見て分かるように。 */
function drawWings(ctx, G) {
  for (const w of G.wings) {
    ctx.save();
    ctx.shadowColor = COLOR[ANY];
    ctx.shadowBlur = 10;
    ctx.fillStyle = COLOR[ANY];
    const r = 5.5 * view.sc;
    ctx.beginPath();
    ctx.moveTo(w.x, w.y - r * 1.5);
    ctx.lineTo(w.x + r, w.y);
    ctx.lineTo(w.x, w.y + r * 1.5);
    ctx.lineTo(w.x - r, w.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawEnemies(ctx, G) {
  for (const e of G.enemies) {
    ctx.save();
    if (e.armored) { ctx.shadowColor = PALETTE.armor; ctx.shadowBlur = 14; }
    if (e.hit)     { ctx.shadowColor = '#ffffff';     ctx.shadowBlur = 18 * e.hit; }

    // 白い敵はグローも枠も持たない。装甲敵（色つきの塗り＋白い枠）と読み違えないよう、
    // 見た目の情報量そのものを落としておく。
    ctx.fillStyle = COLOR[e.type];
    ctx.globalAlpha = e.type === ANY ? 0.82 : 1;
    shapePath(ctx, e.type, e.x, e.y, e.r, e.rot);
    ctx.fill();
    ctx.globalAlpha = 1;

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
