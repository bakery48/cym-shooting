import { CONFIG, INK, INK_ID } from '../config.js';
import { EMPTY_META_UP } from '../meta.js';
import { resolveRules } from '../stages.js';
import { view } from './view.js';
import { sfx } from './audio.js';

/** 強化ID → インク。 */
export const POD_INK = { podC: INK.C, podM: INK.M, podY: INK.Y };
const podIdFor = (ink) => `pod${INK_ID[ink]}`;

export function newGame(stage, meta) {
  const rules = resolveRules(stage);

  const G = {
    stage, rules,
    // 恒久強化はランをまたいで残る唯一の強さ。ラン中は変化しない。
    // 既定を敷いてから重ねる ― 項目を足した直後の古い保存で undefined を掴まない。
    meta: { ...EMPTY_META_UP, ...meta.up },
    shield: meta.up.shield,
    wings: [],
    running: false, over: false, paused: false, cleared: false,
    t: 0, money: rules.startMoney, breach: 0, cores: 0,
    // idx は rules.inks への添字。段階解放中は選べる色そのものが少ない。
    ship: { x: view.W / 2, y: 0, idx: 0, ang: 0, targetAng: 0, cd: 0 },
    enemies: [], bullets: [], parts: [], pods: [],
    nextSpawn: 0.6, shake: 0, flash: 0, shieldFlash: 0,
    // ラン内強化は毎回ゼロから。ここが企画書 §2 の弧を毎ラン成立させている。
    // ポッドは色ごとの「基数」。1基目で自動化が始まり、以降は増設で密度が上がる。
    up: { podC: 0, podM: 0, podY: 0, rate: 0, ...rules.startUp },
    st: { ship: 0, pod: 0, armored: 0, breach: 0, earned: 0 },
    endReason: '',
  };
  syncPods(G);   // 最初からポッドを持つモードのため
  syncWings(G);
  return G;
}

export const fireInterval = (G) =>
  Math.max(CONFIG.ship.fireMin, CONFIG.ship.fireBase - G.up.rate * CONFIG.ship.firePerLv);

/** 自機が今撃っているインク。 */
export const shipInk = (G) => G.rules.inks[G.ship.idx];

/** 砲塔が一段まわる角度。使える色の本数で決まる（1色なら回らない）。 */
export const turnStep = (G) => (Math.PI * 2) / Math.max(1, G.rules.inks.length);

/**
 * 所持ポッドの一覧と G.pods を同期する。
 * 既存ポッドは公転角と航跡を保ったまま残し、新規ぶんだけ空いた位相に配置する。
 *
 * 同じ色を何基でも増設できる。`slot` は同色内の番号で、
 * 増設・売却をまたいで各基の公転位相と航跡を保つための識別に使う。
 */
export function syncPods(G) {
  const wanted = [];
  for (const ink of G.rules.inks) {
    const n = G.up[podIdFor(ink)] | 0;
    for (let slot = 0; slot < n; slot++) wanted.push({ ink, slot });
  }

  const kept = new Map(G.pods.map((p) => [`${p.ink}/${p.slot}`, p]));
  const pods = wanted.map(({ ink, slot }) => kept.get(`${ink}/${slot}`)
    ?? { ink, slot, a: null, x: 0, y: 0, cd: Math.random() * 0.4, trail: [], trailT: 0 });

  // **既存の位相をすべて数え上げてから**新規ぶんを配る。
  // 作りながら配ると、まだ配列に入っていない既存ポッドと同じ角度を選んで重なる。
  const taken = pods.filter((p) => p.a !== null).map((p) => p.a);
  for (const p of pods) {
    if (p.a !== null) continue;
    p.a = phaseInLargestGap(taken);
    taken.push(p.a);
  }
  G.pods = pods;
}

/**
 * 公転リングの「いちばん広い隙間」の中央を返す。
 * 全基が同じ角速度で回るので初期位相はずっと保たれる ―
 * 追加のたびに割り振り直すと既存のポッドが飛ぶので、空きに差し込む。
 */
function phaseInLargestGap(taken) {
  if (!taken.length) return 0;
  const TAU = Math.PI * 2;
  const angs = taken.map((a) => ((a % TAU) + TAU) % TAU).sort((a, b) => a - b);
  // 最後の1つから最初の1つへ回り込む隙間から始める
  let bestGap = TAU - angs[angs.length - 1] + angs[0];
  let best = angs[angs.length - 1] + bestGap / 2;
  for (let i = 1; i < angs.length; i++) {
    const gap = angs[i] - angs[i - 1];
    if (gap > bestGap) { bestGap = gap; best = angs[i - 1] + gap / 2; }
  }
  return best % TAU;
}

/** 僚機は自機の脇に固定で並ぶ。ポッドと違って公転しない（別物だと見て分かるように）。 */
export function syncWings(G) {
  const n = G.meta.wing ?? 0;
  G.wings = Array.from({ length: n }, (_, i) => ({
    side: i % 2 === 0 ? -1 : 1,
    x: 0, y: 0, cd: Math.random() * 0.4,
  }));
}

/** 砲塔を一段まわす。回転方向は一方向で固定（企画書 §3）。 */
export function rotateTurret(G) {
  const n = G.rules.inks.length;
  if (n < 2) return;            // 1色しか無い面では回すものが無い
  G.ship.idx = (G.ship.idx + 1) % n;
  G.ship.targetAng += turnStep(G);
  sfx.rotate(shipInk(G));
}
