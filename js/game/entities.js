import { CONFIG, BARE } from '../config.js';
import { pickWeighted, poolAt, fallMulFor } from '../stages.js';
import { view } from '../core/view.js';

export function spawnEnemy(G) {
  // 白い敵（インクなし）と装甲は排他。片方は「1発で割れる」、
  // もう片方は「自機の弾しか通らない」で、性格が正反対になるため同居させない。
  const bare = Math.random() < G.rules.bareChance.base + G.rules.bareChance.perSec * G.t;
  const ac = G.rules.armoredChance;
  const armored = !bare && Math.random() < ac.base + ac.perSec * G.t;

  // 混色は種類を時間で増やす。まだ登場していない構成は候補に入らない。
  const progress = Math.min(1, G.t / G.rules.runSeconds);
  const inks = bare ? BARE : Number(pickWeighted(poolAt(G.rules.pool, progress)));
  const motion = pickWeighted(G.rules.motions);
  const r = 18 * view.sc * (bare ? CONFIG.bareRadius : 1);

  G.enemies.push({
    inks,
    // 報酬は「元々何色乗っていたか」で決まる。剥がしていくと inks は減るので、
    // 撃破時の残りから計算すると必ず取りこぼす。
    inks0: inks,
    // 登場したばかりの混色はゆっくり落として解読の時間を作る（生成時に固定）
    fallMul: fallMulFor(G.rules.pool, inks, progress),
    armored, motion,
    x: r * 2 + Math.random() * Math.max(1, view.W - r * 4),
    y: -r * 2,
    r,
    vx: 0,
    rot: Math.random() * Math.PI * 2,
    phase: Math.random() * Math.PI * 2,   // 木の葉の揺れの位相
    hit: 0,
  });
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
