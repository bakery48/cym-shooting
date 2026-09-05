import { CONFIG, COLOR, PALETTE, TYPES, ANY } from '../config.js';
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
  updateWings(G, dt);
  updateEnemies(G, dt);
  updateBullets(G, dt);
  updateParticles(G, dt);

  G.shake = Math.max(0, G.shake - dt * 4);
  G.flash = Math.max(0, G.flash - dt * 2.5);
  G.shieldFlash = Math.max(0, (G.shieldFlash ?? 0) - dt * 2.5);
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
    recordTrail(p, sh, dt);

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

/**
 * ポッドの標的。自分の種類の敵を優先し、居ないときだけ白い敵を撃つ。
 * 白を同列に扱うと、ポッドが本来の担当を放って安い敵に構い始めるため。
 */
/**
 * 公転の航跡。フレームごとではなく一定時間ごとに点を置く ―
 * フレームレートで帯の長さが変わらないようにするため。
 *
 * 位置は自機からの相対で持つ。絶対座標だと、マウス追従で自機が瞬間移動したとき
 * （カーソルを速く動かすと実際に起きる）航跡が直線に伸びて尾を引いてしまう。
 * 相対で持てば、自機がどう動いても帯はきれいな公転の弧のままになる。
 */
function recordTrail(p, sh, dt) {
  const { samples, interval } = CONFIG.pod.trail;
  p.trailT += dt;
  if (p.trailT < interval) return;
  p.trailT = 0;
  p.trail.push(p.x - sh.x, p.y - sh.y);
  if (p.trail.length > samples * 2) p.trail.splice(0, p.trail.length - samples * 2);
}

function findPodTarget(G, p) {
  return nearest(G, p, p.type) ?? nearest(G, p, ANY);
}

function nearest(G, p, type, range = CONFIG.pod.range) {
  let best = null;
  let bestDist = range * view.S;
  for (const e of G.enemies) {
    // 装甲敵はポッドの弾を弾くので狙わない。
    // 既にポッドより下にいる敵も、撃っても届かないので対象外にする。
    if (e.type !== type || e.armored || e.y > p.y) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bestDist) { bestDist = d; best = e; }
  }
  return best;
}

/**
 * 僚機（恒久強化）。白い ◆ しか撃たない。
 * 弾種を持つ敵に手を出させないのは、ラン内の弧に恒久強化を触れさせないため。
 */
function updateWings(G, dt) {
  const sh = G.ship;
  const { offsetX, offsetY, fireMul, range } = CONFIG.meta.wing;

  for (const w of G.wings) {
    w.x = sh.x + w.side * offsetX * view.sc;
    w.y = sh.y + offsetY * view.sc;

    w.cd -= dt;
    if (w.cd > 0) continue;

    const target = nearest(G, w, ANY, range);
    if (!target) { w.cd = 0.1; continue; }
    shoot(G, w.x, w.y, ANY, 'pod', Math.atan2(target.x - w.x, -(target.y - w.y)));
    w.cd = fireInterval(G) * fireMul;
  }
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
      absorbOrBreach(G, e.x);
    }
  }
}

/** 防壁（恒久強化）が残っていれば突破を肩代わりする。ランごとに戻る。 */
function absorbOrBreach(G, x) {
  if (G.shield > 0) {
    G.shield--;
    G.shieldFlash = 1;
    burst(G, x, view.LINE, PALETTE.armor, 14);
    sfx.armorDeflect();
    return;
  }
  G.breach++; G.st.breach++;
  G.shake = 1; G.flash = 1;
  burst(G, x, view.LINE, PALETTE.bad, 16);
  sfx.breach();
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

    if (e.type !== b.type && e.type !== ANY) {   // 種類違い：弾かれる（白い敵はどの弾でも通る）
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
      const value = e.armored ? CONFIG.kill.armored
                  : e.type === ANY ? CONFIG.kill.chaff
                  : CONFIG.kill.normal;
      G.money += value;
      G.st.earned += value;
      if (e.armored) G.st.armored++;
      if (b.from === 'ship') G.st.ship++; else G.st.pod++;
      burst(G, e.x, e.y, COLOR[e.type], e.armored ? 26 : 12);
      G.enemies.splice(j, 1);
      if (e.armored) sfx.killArmored(e.type); else sfx.kill(e.type);
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
