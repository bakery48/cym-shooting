import { CONFIG, COLOR, PALETTE, TYPES } from '../config.js';
import { view } from '../core/view.js';
import { fireInterval } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { spawnEnemy, shoot, burst } from './entities.js';

export function update(G, dt, input, onGameOver) {
  G.t += dt;
  if (G.t >= G.rules.runSeconds) return onGameOver('クリア', true);
  if (G.breach >= G.rules.maxBreach) return onGameOver('防衛ライン崩壊', false);

  updateShip(G, dt, input);
  updatePods(G, dt);
  updateEnemies(G, dt);
  updateBullets(G, dt);
  updateParticles(G, dt);

  G.shake = Math.max(0, G.shake - dt * 4);
  G.flash = Math.max(0, G.flash - dt * 2.5);
}

function updateShip(G, dt, input) {
  const sh = G.ship;
  sh.y = view.LINE - 34 * view.sc;
  input.applyMovement(G, dt);
  sh.ang += (sh.targetAng - sh.ang) * Math.min(1, dt * 14);

  sh.cd -= dt;
  if (sh.cd <= 0) {
    shoot(G, sh.x, sh.y - 16 * view.S, TYPES[sh.idx], 'ship', 0);
    sh.cd = fireInterval(G);
  }
}

function updatePods(G, dt) {
  const sh = G.ship;
  const radius = CONFIG.pod.orbitRadius * view.sc;

  for (const p of G.pods) {
    p.a += CONFIG.pod.orbitSpeed * dt;
    p.x = sh.x + Math.cos(p.a) * radius;
    p.y = sh.y + Math.sin(p.a) * radius * 0.72;

    p.cd -= dt;
    if (p.cd > 0) continue;

    const target = findPodTarget(G, p);
    if (!target) { p.cd = 0.1; continue; }

    // 上方向を0とした射角。ポッドは自分の種類の通常敵だけを狙う。
    const angle = Math.atan2(target.x - p.x, -(target.y - p.y));
    shoot(G, p.x, p.y, p.type, 'pod', angle);
    p.cd = fireInterval(G) * CONFIG.pod.fireMul;
  }
}

function findPodTarget(G, p) {
  let best = null;
  let bestDist = CONFIG.pod.range * view.S;
  for (const e of G.enemies) {
    // 装甲敵はポッドの弾を弾くので狙わない。
    // 既にポッドより下にいる敵も、撃っても届かないので対象外にする。
    if (e.type !== p.type || e.armored || e.y > p.y) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bestDist) { bestDist = d; best = e; }
  }
  return best;
}

function updateEnemies(G, dt) {
  const { fall: f, spawn: sp } = G.rules;
  const fall = (f.start + f.rampPerSec * G.t) * view.S;
  const interval = Math.max(sp.min, sp.start - sp.rampPerSec * G.t);

  G.nextSpawn -= dt;
  if (G.nextSpawn <= 0) { spawnEnemy(G); G.nextSpawn = interval; }

  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    e.y += fall * dt;
    e.rot += dt * (e.armored ? 1.6 : 0.5);
    e.hit = Math.max(0, e.hit - dt * 5);

    if (e.y - e.r >= view.LINE) {
      G.enemies.splice(i, 1);
      G.breach++; G.st.breach++;
      G.shake = 1; G.flash = 1;
      burst(G, e.x, view.LINE, PALETTE.bad, 16);
      sfx.breach();
    }
  }
}

function updateBullets(G, dt) {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // 画面外に出た弾は全方向で破棄する（下向きに逸れた弾が残り続けないように）
    if (b.y < -20 || b.y > view.H + 20 || b.x < -20 || b.x > view.W + 20) {
      G.bullets.splice(i, 1);
      continue;
    }
    resolveBulletHit(G, b, i);
  }
}

function resolveBulletHit(G, b, i) {
  for (let j = G.enemies.length - 1; j >= 0; j--) {
    const e = G.enemies[j];
    if (Math.hypot(e.x - b.x, e.y - b.y) > e.r + b.r) continue;

    if (e.type !== b.type) {                     // 種類違い：弾かれる
      burst(G, b.x, b.y, PALETTE.deflect, 4);
      if (b.from === 'ship') sfx.deflect();      // 空振りが分かるのは手で撃った時だけでよい
      G.bullets.splice(i, 1);
      return;
    }
    if (e.armored && b.from === 'pod') {         // 装甲：ポッドの弾は通らない
      e.hit = 1;
      burst(G, b.x, b.y, PALETTE.armorSpark, 5);
      sfx.armorDeflect();
      G.bullets.splice(i, 1);
      return;
    }

    e.hp--; e.hit = 1;
    burst(G, b.x, b.y, COLOR[e.type], 5);

    if (e.hp <= 0) {
      const value = e.armored ? CONFIG.kill.armored : CONFIG.kill.normal;
      G.money += value;
      G.st.earned += value;
      if (e.armored) G.st.armored++;
      if (b.from === 'ship') G.st.ship++; else G.st.pod++;
      burst(G, e.x, e.y, COLOR[e.type], e.armored ? 26 : 12);
      if (e.armored) sfx.killArmored(e.type); else sfx.kill(e.type);
      G.enemies.splice(j, 1);
    }

    if (b.pierce > 0 && b.from === 'ship') b.pierce--;
    else G.bullets.splice(i, 1);
    return;
  }
}

function updateParticles(G, dt) {
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 300 * view.S * dt;
    p.life -= dt * 2.1;
    if (p.life <= 0) G.parts.splice(i, 1);
  }
}
