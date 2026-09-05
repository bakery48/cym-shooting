import { CONFIG } from '../config.js';
import { pickType } from '../stages.js';
import { view } from '../core/view.js';

export function spawnEnemy(G) {
  const chance = G.rules.armoredChance;
  const armored = Math.random() < chance.base + chance.perSec * G.t;
  const type = pickType(G.rules.weights);
  const r = 18 * view.sc;
  G.enemies.push({
    type,
    x: r * 2 + Math.random() * Math.max(1, view.W - r * 4),
    y: -r * 2,
    r, hp: armored ? 3 : 1, armored,
    rot: Math.random() * Math.PI * 2,
    hit: 0,
  });
}

/**
 * 弾を発射する。angle は上方向を0とした射角（ラジアン）。
 * 自機のみ拡散・貫通の強化が乗る。
 */
export function shoot(G, x, y, type, from, angle) {
  const n = 1 + (from === 'ship' ? G.up.spread : 0);
  const speed = (from === 'ship' ? CONFIG.ship.bulletSpeed : CONFIG.pod.bulletSpeed) * view.S;

  for (let i = 0; i < n; i++) {
    const off = n === 1 ? 0 : (i - (n - 1) / 2) * 0.13;
    const a = angle + off;
    G.bullets.push({
      x, y,
      vx: Math.sin(a) * speed,
      vy: -Math.cos(a) * speed,
      type, from,
      r: 4.5 * view.sc,
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
