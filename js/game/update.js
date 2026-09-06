import { CONFIG, COLOR, PALETTE, BARE, INK_COUNT } from '../config.js';
import { view } from '../core/view.js';
import { fireInterval, shipInk } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { spawnEnemy, spawnFragments, spawnOffspring, shoot, burst } from './entities.js';

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
  G.shieldFlash = Math.max(0, G.shieldFlash - dt * 2.5);
}

function updateShip(G, dt, input) {
  const sh = G.ship;
  sh.y = view.LINE - 34 * view.sc;
  input.applyMovement(G, dt);
  sh.ang += (sh.targetAng - sh.ang) * Math.min(1, dt * 14);

  sh.cd -= dt;
  if (sh.cd <= 0) {
    shoot(G, sh.x, sh.y - 16 * view.S, shipInk(G), 'ship', 0);
    sh.cd = fireInterval(G);
  }
}

function updatePods(G, dt) {
  const sh = G.ship;
  const base = CONFIG.pod.orbitRadius * view.sc;
  const radius = base * ringScale(G.pods.length);

  for (const p of G.pods) {
    p.a += CONFIG.pod.orbitSpeed * dt;
    p.x = sh.x + Math.cos(p.a) * radius;
    // 縦だけは広げない。輪が下に伸びると防衛ラインを跨いでしまう
    p.y = sh.y + Math.sin(p.a) * base * 0.72;
    recordTrail(p, sh, dt);

    // **真上へ、的の有無にかかわらず一定間隔で撃つ。**
    // 狙って撃つと「どこに立つか」の判断がポッドに肩代わりされる。
    // 撃ち止めもしない ― 公転で左右に振れる弾幕が常に出ていることで、
    // 「その下に敵を入れる」という自機の位置取りが意味を持つ。
    p.cd -= dt;
    if (p.cd > 0) continue;
    shoot(G, p.x, p.y, p.ink, 'pod', 0);
    p.cd = fireInterval(G) * CONFIG.pod.fireMul;
  }
}

/**
 * 基数が増えるほど公転の輪を横に広げる（団子にならないように）。
 * 縦は広げない ― 下へ伸びると輪が防衛ラインを跨いで意味が濁る。
 */
function ringScale(n) {
  const { ringPerPod, ringMax } = CONFIG.pod;
  return Math.min(ringMax, 1 + ringPerPod * Math.max(0, n - 1));
}

/**
 * 公転の航跡。フレームごとではなく一定時間ごとに点を置く ―
 * フレームレートで帯の長さが変わらないようにするため。
 *
 * 位置は自機からの相対で持つ。絶対座標だと、マウス追従で自機が瞬間移動したとき
 * （カーソルを速く動かすと実際に起きる）航跡が直線に伸びて尾を引いてしまう。
 */
function recordTrail(p, sh, dt) {
  const { samples, interval } = CONFIG.pod.trail;
  p.trailT += dt;
  if (p.trailT < interval) return;
  p.trailT = 0;
  p.trail.push(p.x - sh.x, p.y - sh.y);
  if (p.trail.length > samples * 2) p.trail.splice(0, p.trail.length - samples * 2);
}

/**
 * 僚機（恒久強化）。素地の敵しか撃たない。
 * インクを持つ敵に手を出させないのは、ラン内の弧に恒久強化を触れさせないため。
 */
function updateWings(G, dt) {
  const sh = G.ship;
  const { offsetX, offsetY, fireMul, range } = CONFIG.meta.wing;

  for (const w of G.wings) {
    w.x = sh.x + w.side * offsetX * view.sc;
    w.y = sh.y + offsetY * view.sc;

    w.cd -= dt;
    if (w.cd > 0) continue;

    const target = nearest(G, w, (e) => e.inks === BARE, range);
    if (!target) { w.cd = 0.1; continue; }
    // インクを持たない弾。素地の敵は落とせるが、色付きの敵には弾かれる。
    shoot(G, w.x, w.y, BARE, 'pod', Math.atan2(target.x - w.x, -(target.y - w.y)));
    w.cd = fireInterval(G) * fireMul;
  }
}

/** いちばん近い敵。僚機が狙って撃つために使う（ポッドは狙わない）。 */
function nearest(G, from, accept, range = CONFIG.pod.range) {
  let best = null;
  let bestDist = range * view.S;
  for (const e of G.enemies) {
    // 装甲敵はポッドの弾を弾くので狙わない。
    // 既に撃ち手より下にいる敵も、撃っても届かないので対象外にする。
    if (e.armored || e.y > from.y || !accept(e)) continue;
    const d = Math.hypot(e.x - from.x, e.y - from.y);
    if (d < bestDist) { bestDist = d; best = e; }
  }
  return best;
}

function updateEnemies(G, dt) {
  const { fall: f, spawn: sp } = G.rules;
  const baseFall = (f.start + f.rampPerSec * G.t) * view.S;
  const interval = spawnInterval(G);

  G.nextSpawn -= dt;
  if (G.nextSpawn <= 0) { spawnEnemy(G); G.nextSpawn = interval; }

  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    moveEnemy(G, e, dt, baseFall);
    breedTick(G, e, dt);
    e.hit = Math.max(0, e.hit - dt * 5);

    if (e.y - e.r >= view.LINE) {
      G.enemies.splice(i, 1);
      // 運び屋は突破が余分に重い。優先順位をつける理由になる。
      absorbOrBreach(G, e.x, e.role === 'carry' ? CONFIG.roles.carry.breachCost : 1);
    }
  }
}

/**
 * 増殖。放っておくと一定時間ごとに倍々に分かれる。
 *
 * 後ろに押していける敵ばかりだと「順番」の判断が生まれないので、
 * **待つほど損になる敵**を1種類だけ置いている。落下は遅いので、
 * 難しいのは当てることではなく「いつ手を回すか」。
 *
 * 分裂は後ろに追加するだけ。呼び出し側は後ろから走査しているので、
 * 生まれたばかりの分体を同じフレームでもう一度回すことはない。
 */
function breedTick(G, e, dt) {
  const b = CONFIG.roles.breed;
  // 増える上限は maxGen だけ（1体につき最大8体）。
  // 「画面が混んできたら分裂を止める」は入れない ― 溺れている時にだけ
  // 静かに楽になるうえ、満ちた弧が何も起こさないので表示が嘘になる。
  if (e.role !== 'breed' || e.breedGen >= b.maxGen) return;

  e.breedT -= dt;
  if (e.breedT > 0) return;

  spawnOffspring(G, e);
  burst(G, e.x, e.y, COLOR[e.inks], 8);
  sfx.peel(e.inks);
}

/**
 * 落ち方。形を統一したぶん、敵の性格はここで出す。
 *
 *   drift  まっすぐ落ちる
 *   leaf   木の葉のように左右に揺れながら、少し遅く落ちる
 *   dodge  遅い代わりに、自機と同じ縦軸から常にずれ続ける
 *   burst  分裂の破片。左下・右下へ加速しながら開く（湧きでは選ばれない）
 */
function moveEnemy(G, e, dt, base) {
  const m = CONFIG.motion;
  // 覚えたての混色はゆっくり落ちる（生成時に決まった係数）
  const baseFall = base * (e.fallMul ?? 1) * diveMul(e, dt);

  if (e.motion === 'leaf') {
    e.phase += dt * m.leaf.swayHz * Math.PI * 2;
    e.y += baseFall * m.leaf.fallMul * dt;
    e.x += Math.cos(e.phase) * m.leaf.swayPx * view.S * dt;
    e.rot += dt * m.leaf.spin * Math.sin(e.phase);
  } else if (e.motion === 'burst') {
    const k = CONFIG.roles.split.burst;
    // 初速ゼロから加速させる ― 弾かれたのではなく「割れて開いた」に見せる
    e.bvx = clampAbs(e.bvx + e.burstSide * k.ax * view.S * dt, k.vxMax * view.S);
    e.bvy = Math.min(e.bvy + k.ay * view.S * dt, k.vyMax * view.S);
    e.vx = e.bvx;
    e.x += e.bvx * dt;
    e.y += (baseFall + e.bvy) * dt;
    e.rot += dt * k.spin * (e.burstSide || 1);
    // 壁では跳ね返す。勢いを殺すと、斜めに飛んだものが急に真下へ落ち始めて見える。
    // 弾けた勢いは一度きりなので、跳ねた後は加速をやめて（burstSide = 0）
    // 反発ぶんだけ弱まった速度で戻る ― 壁の間を等速で往復し続けないように。
    if ((e.x <= e.r && e.bvx < 0) || (e.x >= view.W - e.r && e.bvx > 0)) {
      e.bvx = -e.bvx * k.bounce;
      e.burstSide = 0;
    }
  } else if (e.motion === 'dodge') {
    e.y += baseFall * m.dodge.fallMul * dt;
    e.vx = dodgeDrift(G, e) * m.dodge.speed * view.S;
    e.x += e.vx * dt;
    e.rot += dt * 0.8;
  } else {
    e.y += baseFall * dt;
    e.rot += dt * (e.armored ? 1.6 : 0.5);
  }

  applyKick(e, dt);

  // 画面の外へは出さない（避け続けて端に張り付くのを防ぐ）
  e.x = Math.max(e.r, Math.min(view.W - e.r, e.x));
}

/**
 * 横へ突き放す勢い。落ち方の上に足すので、どの motion とも併用できる。
 * いまは増殖が分かれるときにだけ使う ― その場で倍になるだけだと重なったまま
 * 並ぶので、1発の射線でまとめて落ちて「増えた」ことの意味が消える。
 *
 * 初速ゼロから加速し、加速をやめたら減衰して止まる。等速で飛ばすと
 * 「分かれた」ではなく「弾かれた」に見える。
 */
function applyKick(e, dt) {
  if (!e.kickVx && !e.kickT) return;
  const k = CONFIG.roles.breed.kick;

  if (e.kickT > 0) {
    const cap = k.vxMax * view.S * Math.pow(k.genScale, Math.max(0, e.breedGen - 1));
    e.kickT -= dt;
    e.kickVx = clampAbs(e.kickVx + e.kickDir * k.ax * view.S * dt, cap);
  } else {
    e.kickVx *= Math.exp(-k.decay * dt);
    if (Math.abs(e.kickVx) < 1) { e.kickVx = 0; return; }
  }
  e.x += e.kickVx * dt;
  // 壁では跳ね返して加速も止める（押し付け続けると張り付いて見える）
  if ((e.x <= e.r && e.kickVx < 0) || (e.x >= view.W - e.r && e.kickVx > 0)) {
    e.kickVx = -e.kickVx * k.bounce;
    e.kickT = 0;
  }
}

/**
 * 湧きの密度カーブ。in（降ってくる数）側の本体。
 *
 * **間隔（秒）ではなく毎秒の湧き数で補間する。** 間隔を等速で詰めると
 * 毎秒の数は後半に跳ね上がる形になり、中盤がずっと平坦なまま最後だけ急に
 * 洪水になる。毎秒の数で補間すれば、画面の濃さがそのまま素直に増える。
 */
export function spawnInterval(G) {
  const sp = G.rules.spawn;
  const p = Math.min(1, G.t / G.rules.runSeconds);
  const rate = sp.rate0 + (sp.rate1 - sp.rate0) * Math.pow(p, sp.curve);
  return 1 / rate;
}

/**
 * 急降下。遅く落ちてきて、途中から加速する。
 * **加速の前に必ず予備動作を挟む** ― 予告なく速くなると
 * 「見ていたのに落ちた」になって理不尽にしかならない。
 */
function diveMul(e, dt) {
  if (!e.dive) return 1;
  const d = CONFIG.roles.dive;

  if (e.dive === 'slow') {
    if (e.y >= view.LINE * d.triggerY) { e.dive = 'warn'; e.diveT = 0; }
    return d.slowMul;
  }
  if (e.dive === 'warn') {
    e.diveT += dt;
    if (e.diveT >= d.warnSec) { e.dive = 'fast'; e.diveT = 0; }
    return 0;                       // 予備動作のあいだは止まって「ためる」
  }
  return d.fastMul;
}

const clampAbs = (v, max) => Math.max(-max, Math.min(max, v));

/**
 * 回避。**弾を見て避けるのではなく、自機と同じ縦軸に居続けないようにずれる。**
 *
 * 弾に反応させると「撃った瞬間に逃げる」ので、当たらない理由がプレイヤーから
 * 見えない（撃つ → 外れる、を繰り返すだけになる）。自機の位置だけを見て
 * じりじりずれるなら、**自分がどこに立っているか**が理由になり、
 * 追い込む・回り込むという手が意味を持つ。
 *
 * ずれ終わったら止まる。常に逃げ続けると端に張り付いて的になるだけで、
 * 「ずらす」という挙動も読めなくなる。
 */
function dodgeDrift(G, e) {
  const range = CONFIG.motion.dodge.keepX * view.S;
  const dx = e.x - G.ship.x;

  // 十分ずれたら止まる。次に自機が寄ってきたら、また向きを選び直す。
  if (Math.abs(dx) >= range) { e.dodgeDir = 0; return 0; }

  if (!e.dodgeDir) {
    e.dodgeDir = dx === 0 ? (e.x < view.W / 2 ? 1 : -1) : Math.sign(dx);
  }
  // 端に詰まったら向きを変えて、自機の上を横切って反対側へ抜ける。
  // そのまま張り付かせると、動かない的が端に溜まっていくだけになる。
  const edge = e.r + 2;
  if ((e.dodgeDir < 0 && e.x <= edge) || (e.dodgeDir > 0 && e.x >= view.W - edge)) {
    e.dodgeDir = -e.dodgeDir;
  }
  // 自機に近いほど速くずれる（危ない位置ほど強く逃げるのが読みやすい）。
  // 下限を残すのは、境界へ漸近して永久に止まらなくなるのを防ぐため。
  return e.dodgeDir * (0.3 + 0.7 * (1 - Math.abs(dx) / range));
}

/**
 * 防壁（恒久強化）が残っていれば突破を肩代わりする。ランごとに戻る。
 * 防壁は1体ぶんを丸ごと受け止める ― 運び屋の重い突破ほど守れるほうが、
 * 「防壁を残しておく」判断に意味が出る。
 */
function absorbOrBreach(G, x, cost = 1) {
  if (G.shield > 0) {
    G.shield--;
    G.shieldFlash = 1;
    burst(G, x, view.LINE, PALETTE.armor, 14);
    sfx.armorDeflect();
    return;
  }
  G.breach += cost; G.st.breach += cost;
  G.shake = 1; G.flash = 1;
  burst(G, x, view.LINE, PALETTE.bad, 16 * cost);
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

    // 乗っていないインクの弾は弾かれる。素地（インクなし）はどの弾でも割れる。
    // 【未決定】外れ弾を「弾く」ではなく「インクを足す」にする案がある。
    // docs/next-design.md を参照。決まるまでは弾く。
    if (e.inks !== BARE && !(e.inks & b.ink)) {
      burst(G, b.x, b.y, PALETTE.deflect, 4);
      if (b.from === 'ship') sfx.deflect();   // 空振りが分かるのは手で撃った時だけでよい
      G.bullets.splice(i, 1);
      return;
    }
    if (e.armored && b.from === 'pod') {      // 装甲：ポッドの弾は通らない
      e.hit = 1;
      burst(G, b.x, b.y, PALETTE.armorSpark, 5);
      sfx.armorDeflect();
      G.bullets.splice(i, 1);
      return;
    }

    const before = e.inks;
    e.inks &= ~b.ink;                         // 当たった色のインクが剥がれる
    e.hit = 1;
    burst(G, b.x, b.y, COLOR[before], 5);

    if (e.inks === BARE) {
      const value = reward(e, e.inks0 ?? before);
      G.money += value;
      G.st.earned += value;
      if (e.armored) G.st.armored++;
      if (b.from === 'ship') G.st.ship++; else G.st.pod++;
      burst(G, e.x, e.y, COLOR[before], e.armored ? 26 : 10 + INK_COUNT[before] * 6);
      G.enemies.splice(j, 1);
      // 分裂は撃破した位置で割れる。高い位置で割るほど破片を処理する時間ができる。
      if (e.role === 'split') spawnFragments(G, e);
      if (e.armored) sfx.killArmored(before); else sfx.kill(before);
    } else {
      sfx.peel(e.inks);                       // 剥がれて色が変わった
    }

    G.bullets.splice(i, 1);
    return;
  }
}

/**
 * 報酬は「元々乗っていたインクの本数」で決まる。剥がす手数がそのまま値段になる。
 * 撃破時に残っている inks で計算すると、必ず1本ぶんしか数えられない。
 */
function reward(e, inks0) {
  if (inks0 === BARE) return CONFIG.kill.bare;
  const mul = (e.armored ? CONFIG.kill.armoredMul : 1)
            * (e.role === 'carry' ? CONFIG.roles.carry.rewardMul : 1)
            * (e.rewardMul ?? 1);
  return Math.round(CONFIG.kill.perInk * INK_COUNT[inks0] * mul);
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
