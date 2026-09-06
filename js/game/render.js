import { CONFIG, COLOR, PALETTE, INK, BARE, INK_COUNT, INK_ORDER } from '../config.js';
import { view } from '../core/view.js';
import { shipInk, turnStep } from '../core/state.js';

/**
 * 敵の形はすべて同じ（六角形）。差は色と落ち方で付ける。
 * 自機は三角、ポッドは円、僚機は菱形なので、敵とは形で区別できる。
 */
export function enemyPath(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rot + i * Math.PI / 3;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

/* ------------------------------------------------------------
   インクの模様
   ------------------------------------------------------------
   形を統一すると色だけが情報になり、色覚特性のあるプレイヤーが遊べなくなる
   （赤と緑の区別は最も頻度が高い）。塗りに模様を重ねて冗長なチャネルを戻す。

     C 横線 / M 縦線 / Y 点

   混色は模様が重なるので、「何色が乗っているか」が模様からも読める。
   組み合わせは8通りしかないので、タイルは起動時に1度だけ作って使い回す。
------------------------------------------------------------ */
const TILE = 14;
const patterns = new Map();

/** 相対輝度（sRGB）。模様の色を塗りの明るさで切り替えるために使う。 */
function luminance(hex) {
  const v = (i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * v(1) + 0.7152 * v(3) + 0.0722 * v(5);
}

function inkPattern(ctx, inks) {
  if (patterns.has(inks)) return patterns.get(inks);

  const c = document.createElement('canvas');
  c.width = c.height = TILE;
  const p = c.getContext('2d');
  // 明るい塗りの上では白い模様が消えるので、塗りの明るさで模様の色を反転させる。
  // 模様は色覚特性への冗長チャネルなので、8通りすべてで読めないと意味がない。
  const stroke = luminance(COLOR[inks]) > 0.45 ? 'rgba(20,24,38,.38)' : 'rgba(255,255,255,.38)';
  p.strokeStyle = stroke;
  p.fillStyle = stroke;
  p.lineWidth = 2;

  if (inks & INK.C) {                       // 横線
    for (const y of [3.5, 10.5]) { p.beginPath(); p.moveTo(0, y); p.lineTo(TILE, y); p.stroke(); }
  }
  if (inks & INK.M) {                       // 縦線
    for (const x of [3.5, 10.5]) { p.beginPath(); p.moveTo(x, 0); p.lineTo(x, TILE); p.stroke(); }
  }
  if (inks & INK.Y) {                       // 点
    for (const [x, y] of [[3.5, 3.5], [10.5, 10.5]]) {
      p.beginPath(); p.arc(x, y, 1.9, 0, Math.PI * 2); p.fill();
    }
  }

  const pat = inks === BARE ? null : ctx.createPattern(c, 'repeat');
  patterns.set(inks, pat);
  return pat;
}

/**
 * 何が混ざっているかを、混ざる前の色の点で示す。
 *
 * 色と模様だけだと「赤 = マゼンタ＋イエロー」を頭の中で分解する必要があり、
 * 複数体が同時に降ると追いつかない。素の色を並べて見せれば分解が要らなくなる。
 * 単色と素地には出さない ― 分解するものが無く、点は邪魔にしかならない。
 */
function drawInkGuide(ctx, r, inks) {
  if (INK_COUNT[inks] < 2) return;
  const g = CONFIG.mixed.guide;
  const present = INK_ORDER.filter((ink) => inks & ink);
  const dot = r * g.radius;
  const step = dot * 2 + r * g.gap * 0.5;
  const x0 = -step * (present.length - 1) / 2;

  present.forEach((ink, i) => {
    ctx.beginPath();
    ctx.arc(x0 + i * step, 0, dot, 0, Math.PI * 2);
    ctx.fillStyle = COLOR[ink];
    ctx.fill();
    // どんな塗りの上でも点が浮くように、暗い縁で囲う
    ctx.lineWidth = g.ring;
    ctx.strokeStyle = 'rgba(16,20,32,.85)';
    ctx.stroke();
  });
}

/**
 * 分裂する敵の目印。割れる線を縦に走らせる。
 * インクの案内は横一列なので、縦線なら重ならずに読める。
 */
function drawSplitSeam(ctx, r) {
  ctx.save();
  ctx.strokeStyle = 'rgba(16,20,32,.7)';
  ctx.lineWidth = 2.2;
  ctx.setLineDash([r * 0.28, r * 0.2]);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(0, r);
  ctx.stroke();
  ctx.restore();
}

/**
 * 敵1体ぶんの見た目を、任意のコンテキストに描く。
 * 凡例と盤面で同じ関数を使うことで、説明と実物がずれないようにする。
 */
export function drawEnemyMark(ctx, x, y, r, inks, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = COLOR[inks];
  enemyPath(ctx, 0, 0, r, rot);
  ctx.fill();
  const pat = inkPattern(ctx, inks);
  if (pat) { ctx.fillStyle = pat; ctx.fill(); }
  if (INK_COUNT[inks] === 3) {
    ctx.strokeStyle = PALETTE.rim;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  drawInkGuide(ctx, r, inks);
  ctx.restore();
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
  drawPodTrails(ctx, G);
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

function drawEnemies(ctx, G) {
  for (const e of G.enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);          // 模様を敵に貼り付けるため原点を移す

    if (e.armored) { ctx.shadowColor = PALETTE.armor; ctx.shadowBlur = 14; }
    if (e.hit)     { ctx.shadowColor = '#ffffff';     ctx.shadowBlur = 18 * e.hit; }

    ctx.fillStyle = COLOR[e.inks];
    enemyPath(ctx, 0, 0, e.r, e.rot);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 乗っているインクを模様でも示す（色だけに頼らせない）
    const pat = inkPattern(ctx, e.inks);
    if (pat) { ctx.fillStyle = pat; ctx.fill(); }

    // 黒は背景に沈むので縁で浮かせる
    if (INK_COUNT[e.inks] === 3) {
      ctx.strokeStyle = PALETTE.rim;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (e.armored) {   // 装甲はポッドの弾を弾く（インクとは別の軸）
      ctx.strokeStyle = PALETTE.armor;
      ctx.lineWidth = 2.5;
      enemyPath(ctx, 0, 0, e.r * 1.42, e.rot);
      ctx.stroke();
    }
    if (e.role === 'split') drawSplitSeam(ctx, e.r);
    // 何が混ざっているかの案内は、回転させずに常に水平に並べる
    drawInkGuide(ctx, e.r, e.inks);
    ctx.restore();
  }
}

function drawBullets(ctx, G) {
  for (const b of G.bullets) {
    ctx.fillStyle = COLOR[b.ink];
    ctx.globalAlpha = b.from === 'pod' ? 0.85 : 1;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.r * 0.7, b.r * 1.6, Math.atan2(b.vy, b.vx) - Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * 公転の航跡。買うほど自機の周りが賑やかになる（企画書 §4）ことを、
 * 点ではなく「回る帯」として見せるための描画。
 *
 * 加算合成は使わない ― 色が重なって白くなると、白は「インクを持たない」の
 * 意味を持っているので嘘の情報になる（企画書 §7）。
 */
function drawPodTrails(ctx, G) {
  const { width, alpha } = CONFIG.pod.trail;
  const sh = G.ship;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const p of G.pods) {
    const t = p.trail;                       // 自機からの相対座標で持っている
    if (t.length < 4) continue;
    const n = t.length / 2;
    ctx.strokeStyle = COLOR[p.ink];

    for (let i = 1; i < n; i++) {
      const k = i / n;                       // 新しい点ほど 1 に近い
      ctx.globalAlpha = k * k * alpha;       // 古い側を早めに消して尾を細く見せる
      ctx.lineWidth = width * view.sc * k;
      ctx.beginPath();
      ctx.moveTo(sh.x + t[(i - 1) * 2], sh.y + t[(i - 1) * 2 + 1]);
      ctx.lineTo(sh.x + t[i * 2], sh.y + t[i * 2 + 1]);
      ctx.stroke();
    }
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width * view.sc;
    ctx.beginPath();
    ctx.moveTo(sh.x + t[t.length - 2], sh.y + t[t.length - 1]);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawPods(ctx, G) {
  for (const p of G.pods) {
    ctx.save();
    ctx.shadowColor = COLOR[p.ink];
    ctx.shadowBlur = 12;
    ctx.fillStyle = COLOR[p.ink];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7 * view.sc, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** 僚機。ポッドと違って公転せず自機の脇に固定で並ぶ ― 別物だと見て分かるように。 */
function drawWings(ctx, G) {
  for (const w of G.wings) {
    ctx.save();
    ctx.shadowColor = COLOR[BARE];
    ctx.shadowBlur = 10;
    ctx.fillStyle = COLOR[BARE];
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

function drawShip(ctx, G) {
  const sh = G.ship;
  const sc = view.sc;
  const inks = G.rules.inks;
  const step = turnStep(G);

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

  // バレルのリング。本数は使える色の数と一致する（段階解放で増えていく）。
  // バレル i の色は固定で、砲塔ごと回る。i 段ぶん回ったとき真上に来る。
  for (let i = 0; i < inks.length; i++) {
    const a = sh.ang - i * step - Math.PI / 2;
    const isTop = i === sh.idx;
    ctx.fillStyle = COLOR[inks[i]];
    ctx.globalAlpha = isTop ? 1 : 0.45;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 26 * sc, Math.sin(a) * 26 * sc, (isTop ? 7 : 5) * sc, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // 今撃っている色。形が全部同じになったので記号ではなく色そのもので示す。
  ctx.fillStyle = COLOR[shipInk(G)];
  ctx.beginPath();
  ctx.arc(sh.x, sh.y + 44 * sc, 6 * sc, 0, Math.PI * 2);
  ctx.fill();
}

function drawParticles(ctx, G) {
  for (const p of G.parts) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}
