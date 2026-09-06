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
    // 急降下は形そのものが「下に向かう」ことを示すので、回して向きを崩さない
    rot: role === 'dive' ? 0 : Math.random() * Math.PI * 2,
    phase: Math.random() * Math.PI * 2,   // 木の葉の揺れの位相
    dive: role === 'dive' ? 'slow' : null, // slow -> warn -> fast
    diveT: 0,
    dodgeDir: 0,                          // 回避が今ずれている向き（0 = 止まっている）
    breedT: 0, breedGen: 0,               // 増殖の残り時間と世代
    rewardMul: 1,
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

  // 役割ごとの制約:
  //   分裂  黒（3発）と重ねない。3発かけたうえに破片2体は重すぎる
  //   運び屋 素地と重ねない。安い敵に高い突破ペナルティは読み違えのもと
  //   急降下 落ち方は drift 固定。揺れながら急降下する敵は挙動が読めない
  //   増殖  必ず単色・非装甲。倍々に増えるものの照合が重いと詰みに直結する
  let finalRole = role;
  if (bare && (role === 'split' || role === 'carry')) finalRole = 'normal';
  if (role === 'split' && INK_COUNT[inks] === 3) finalRole = 'normal';
  if (role === 'breed' && (bare || armored || INK_COUNT[inks] !== 1)) finalRole = 'normal';

  const rMul = finalRole === 'carry' ? CONFIG.roles.carry.radiusMul : 1;
  const r = 18 * view.sc * (bare ? CONFIG.bareRadius : 1) * rMul;
  const fall = fallMulFor(G.rules.pool, inks, progress)
    * (finalRole === 'carry' ? CONFIG.roles.carry.fallMul : 1)
    * (finalRole === 'breed' ? CONFIG.roles.breed.fallMul : 1);

  const born = makeEnemy(G, {
    inks, armored, role: finalRole,
    motion: finalRole === 'dive' ? 'drift' : pickWeighted(G.rules.motions),
    x: r * 2 + Math.random() * Math.max(1, view.W - r * 4),
    r, fallMul: fall,
  });
  if (finalRole === 'breed') {
    born.breedT = CONFIG.roles.breed.interval;
    born.rewardMul = CONFIG.roles.breed.value;
  }
  G.enemies.push(born);
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
 *
 * 割れた瞬間は重なった位置から左下・右下へ**加速しながら**開く（motion: 'burst'）。
 * 等速で分かれるより「割れた」に見えるのと、開き方が時間で変わるので
 * 親を撃った位置のまま構えていると両方とも取り逃す。
 */
export function spawnFragments(G, from) {
  const { fragments, radiusMul, spreadPx, fallMul } = CONFIG.roles.split;
  const r = from.r * radiusMul;

  for (let i = 0; i < fragments; i++) {
    const side = i < fragments / 2 ? -1 : 1;          // 左下 / 右下
    const off = (i - (fragments - 1) / 2) * spreadPx * view.sc;
    G.enemies.push({
      inks: BARE, inks0: BARE,
      fallMul: (from.fallMul ?? 1) * fallMul,
      armored: false, motion: 'burst', role: 'normal',
      dive: null, diveT: 0, dodgeDir: 0,
      burstSide: side, bvx: 0, bvy: 0,
      x: Math.max(r, Math.min(view.W - r, from.x + off)),
      y: from.y, r,
      vx: 0, rot: Math.random() * Math.PI * 2, phase: 0, hit: 0,
    });
  }
}

/**
 * 増殖の分体。**親と同じ単色・同じ役割**で、世代がひとつ進む。
 * 世代ごとに報酬は半分になるので、泳がせて増やしても総額は変わらない ―
 * 「稼ぐために放置する」が最適解になると、この役割の狙い（後回しにできない）
 * が壊れる。
 */
export function spawnOffspring(G, from) {
  const b = CONFIG.roles.breed;
  const gen = from.breedGen + 1;
  const r = from.r * b.radiusMul;
  const gap = b.gapPx * view.sc;

  from.breedGen = gen;
  from.r = r;
  from.breedT = b.interval;
  from.rewardMul = b.value / Math.pow(2, gen);
  from.x = Math.max(r, Math.min(view.W - r, from.x - gap / 2));

  const child = {
    ...from,
    x: Math.max(r, Math.min(view.W - r, from.x + gap)),
    rot: Math.random() * Math.PI * 2,
    phase: Math.random() * Math.PI * 2,
    hit: 1,
  };
  G.enemies.push(child);
  return child;
}

/**
 * 弾を発射する。angle は上方向を0とした射角（ラジアン）。
 * 自機のみ拡散と弾芯が乗る（どちらも恒久強化）。
 */
export function shoot(G, x, y, ink, from, angle) {
  // 拡散は恒久強化（コア）。ポッドと僚機には乗らない。
  const n = 1 + (from === 'ship' ? G.meta.spread : 0);
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
