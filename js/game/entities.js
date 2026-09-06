import { CONFIG, BARE, INK_COUNT } from '../config.js';
import { pickWeighted, poolAt, fallMulFor } from '../stages.js';
import { view } from '../core/view.js';

/** 1体ぶんの敵を組み立てる。x は呼び出し側が決める。 */
function makeEnemy(G, { inks, armored, motion, role, x, r, fallMul }) {
  return {
    inks,
    // 報酬は「元々何色乗っていたか」で決まる。剥がしていくと inks は減るので、
    // 撃破時の残りから計算すると必ず取りこぼす。
    inks0: inks,
    fallMul,
    armored, motion, role,
    x, y: -r * 2, r,
    vx: 0,
    rot: Math.random() * Math.PI * 2,
    phase: Math.random() * Math.PI * 2,   // 木の葉の揺れの位相
    hit: 0,
  };
}

export function spawnEnemy(G) {
  // 混色は種類を時間で増やす。まだ登場していない構成は候補に入らない。
  const progress = Math.min(1, G.t / G.rules.runSeconds);
  const pool = poolAt(G.rules.pool, progress);
  const role = pickWeighted(G.rules.roles);

  if (role === 'cluster' && spawnCluster(G, pool, progress)) return;

  // 白い敵（インクなし）と装甲は排他。片方は「1発で割れる」、
  // もう片方は「自機の弾しか通らない」で、性格が正反対になるため同居させない。
  const bare = Math.random() < G.rules.bareChance.base + G.rules.bareChance.perSec * G.t;
  const ac = G.rules.armoredChance;
  const armored = !bare && Math.random() < ac.base + ac.perSec * G.t;
  const inks = bare ? BARE : Number(pickWeighted(pool));

  // 分裂は黒（3発）と重ねない。3発かけたうえに破片2体は重すぎる。
  const canSplit = role === 'split' && INK_COUNT[inks] < 3 && !bare;
  const r = 18 * view.sc * (bare ? CONFIG.bareRadius : 1);

  G.enemies.push(makeEnemy(G, {
    inks, armored, role: canSplit ? 'split' : 'normal',
    motion: pickWeighted(G.rules.motions),
    x: r * 2 + Math.random() * Math.max(1, view.W - r * 4),
    r, fallMul: fallMulFor(G.rules.pool, inks, progress),
  }));
}

/**
 * 群れ。**必ず同じ単色**でまとめる ― 混色を並べると照合の負荷が跳ね上がり、
 * この役割の狙い（位置取りだけを問う）が壊れる。装甲も分裂も混ぜない。
 * 単色が候補に無ければ何もせず、呼び出し側が通常の湧きに戻す。
 */
function spawnCluster(G, pool, progress) {
  const singles = {};
  for (const k in pool) if (INK_COUNT[Number(k)] === 1) singles[k] = pool[k];
  if (!Object.keys(singles).length) return false;

  const inks = Number(pickWeighted(singles));
  const { min, max, gapMul } = CONFIG.roles.cluster;
  const n = min + Math.floor(Math.random() * (max - min + 1));
  const r = 18 * view.sc;
  const gap = r * gapMul;
  const span = gap * (n - 1);

  // 群れ全体が画面に収まる位置に置く
  const left = r * 1.5 + Math.random() * Math.max(1, view.W - span - r * 3);
  const motion = pickWeighted(G.rules.motions);
  const fallMul = fallMulFor(G.rules.pool, inks, progress);

  for (let i = 0; i < n; i++) {
    G.enemies.push(makeEnemy(G, {
      inks, armored: false, role: 'normal', motion,
      x: left + gap * i, r, fallMul,
    }));
  }
  return true;
}

/**
 * 分裂した破片。素地（どの色でも1発）なので、照合の負荷は増えない。
 * 増えるのは「あと2体を落とす時間があるか」という判断だけ。
 */
export function spawnFragments(G, from) {
  const { fragments, radiusMul, spreadPx, fallMul } = CONFIG.roles.split;
  const r = from.r * radiusMul;

  for (let i = 0; i < fragments; i++) {
    const off = (i - (fragments - 1) / 2) * spreadPx * view.sc;
    G.enemies.push({
      inks: BARE, inks0: BARE,
      fallMul: (from.fallMul ?? 1) * fallMul,
      armored: false, motion: 'drift', role: 'normal',
      x: Math.max(r, Math.min(view.W - r, from.x + off)),
      y: from.y, r,
      vx: 0, rot: Math.random() * Math.PI * 2, phase: 0, hit: 0,
    });
  }
}

/**
 * 弾を発射する。angle は上方向を0とした射角（ラジアン）。
 * 自機のみ拡散・貫通・弾芯が乗る。
 */
export function shoot(G, x, y, ink, from, angle) {
  const n = 1 + (from === 'ship' ? G.up.spread : 0);
  const speed = (from === 'ship' ? CONFIG.ship.bulletSpeed : CONFIG.pod.bulletSpeed) * view.S;
  const grow = from === 'ship' ? 1 + G.meta.core * CONFIG.meta.bullet.radiusPerLv : 1;

  for (let i = 0; i < n; i++) {
    const off = n === 1 ? 0 : (i - (n - 1) / 2) * 0.13;
    const a = angle + off;
    G.bullets.push({
      x, y,
      vx: Math.sin(a) * speed,
      vy: -Math.cos(a) * speed,
      ink, from,
      r: 4.5 * view.sc * grow,
      pierce: from === 'ship' ? G.up.pierce : 0,
    });
  }
}

export function burst(G, x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (50 + Math.random() * 180) * view.S;
    G.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color });
  }
}
