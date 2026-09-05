import { CONFIG } from './config.js';

/**
 * 面とモードの定義。
 *
 * ここもチューニング値の集約点で、各面は CONFIG の値を部分的に上書きするだけ。
 * ラン間の永続強化は持たない ― 面をまたいで自機が強くなることはなく、
 * 変わるのは「降ってくるものの構成」と「使える強化」だけにする。
 *
 * weights は敵の種類の出現比。3種を均等にしないことで、砲塔をどの順で
 * 回すかの判断そのものが面ごとに変わる（企画書 §3 の切り替えコストの応用）。
 */

/** 全強化。面ごとに使えるものを絞ることでモードの性格を作る。 */
const ALL = ['podCircle', 'podTri', 'podSq', 'rate', 'pierce', 'spread'];
const HAND_ONLY = ['rate', 'pierce', 'spread'];

export const STAGES = [
  {
    id: 'a1', kind: 'stage', name: '第1区', title: '展開',
    desc: '3種が均等に降りてくる。まず全部を手で捌き、ポッドで手を空ける。',
    weights: { circle: 1, tri: 1, sq: 1 },
    chaffChance: { base: 0.24 },   // 白い敵を多めにして、弾種を合わせる意味を先に覚えさせる
    shop: ALL,
  },
  {
    id: 'a2', kind: 'stage', name: '第2区', title: '圧',
    desc: '数が増え、落下も速い。自動化を踏む判断が早くなる。',
    weights: { circle: 1, tri: 1, sq: 1 },
    spawn: { start: 0.85, min: 0.26, rampPerSec: 0.0042 },
    fall: { start: 54, rampPerSec: 0.62 },
    shop: ALL,
  },
  {
    id: 'a3', kind: 'stage', name: '第3区', title: '偏り',
    desc: '■ に大きく偏る。買うポッドの順番がそのまま成否になる。',
    weights: { circle: 1, tri: 1, sq: 4 },
    armoredChance: { base: 0.06, perSec: 0.0005 },
    shop: ALL,
  },
  {
    id: 'a4', kind: 'stage', name: '第4区', title: '装甲',
    desc: '装甲付きが多い。ポッドでは壊せないので、手はほぼ装甲専任になる。',
    weights: { circle: 1, tri: 1, sq: 1 },
    armoredChance: { base: 0.20, perSec: 0.0012 },
    chaffChance: { base: 0.10 },
    spawn: { start: 0.95, min: 0.34, rampPerSec: 0.0036 },
    shop: ALL,
  },
  {
    id: 'a5', kind: 'stage', name: '第5区', title: '密集',
    desc: '2分と短いかわりに、最初から降ってくる量が多い。',
    runSeconds: 120,
    weights: { circle: 1, tri: 1, sq: 1 },
    spawn: { start: 0.55, min: 0.20, rampPerSec: 0.0030 },
    fall: { start: 62, rampPerSec: 0.70 },
    startMoney: 150,
    shop: ALL,
  },
  {
    id: 'a6', kind: 'stage', name: '第6区', title: '完走',
    desc: '5分。終盤はポッドだけでは追いつかず、手が通常敵にも戻ってくる。',
    runSeconds: 300,
    maxBreach: 12,
    weights: { circle: 1, tri: 1, sq: 1 },
    spawn: { start: 0.90, min: 0.22, rampPerSec: 0.0032 },
    fall: { start: 50, rampPerSec: 0.52 },
    armoredChance: { base: 0.08, perSec: 0.0006 },
    shop: ALL,
  },

  // --- モード（第2区クリアで開放） ---
  {
    id: 'm1', kind: 'mode', name: '手動限定', title: 'ポッドなし',
    desc: 'ポッドを買えない。3種すべてを最後まで手で回し続ける。',
    unlockAfter: 'a2',
    weights: { circle: 1, tri: 1, sq: 1 },
    armoredChance: { base: 0.03, perSec: 0.0002 },
    chaffChance: { base: 0.30 },   // ポッドが無いぶん、弾種を問わない敵で手を回す
    spawn: { start: 1.05, min: 0.40, rampPerSec: 0.0030 },
    shop: HAND_ONLY,
  },
  {
    id: 'm2', kind: 'mode', name: '全自動', title: '装甲専任',
    desc: '3種のポッドを最初から持つ。そのぶん装甲付きしか金にならない。',
    unlockAfter: 'a2',
    weights: { circle: 1, tri: 1, sq: 1 },
    armoredChance: { base: 0.30, perSec: 0.0015 },
    chaffChance: { base: 0.08 },
    spawn: { start: 0.70, min: 0.24, rampPerSec: 0.0038 },
    startUp: { podCircle: true, podTri: true, podSq: true },
    shop: HAND_ONLY,
  },
];

export const stageById = (id) => STAGES.find((s) => s.id === id);

/** その面で実際に使うルール一式。CONFIG を土台に面の指定を重ねる。 */
export function resolveRules(stage) {
  return {
    runSeconds: stage.runSeconds ?? CONFIG.runSeconds,
    maxBreach: stage.maxBreach ?? CONFIG.maxBreach,
    spawn: { ...CONFIG.spawn, ...stage.spawn },
    fall: { ...CONFIG.fall, ...stage.fall },
    armoredChance: { ...CONFIG.armoredChance, ...stage.armoredChance },
    chaffChance: { ...CONFIG.chaffChance, ...stage.chaffChance },
    weights: stage.weights,
    shop: stage.shop,
    // 持ち込める強化。既定ではその面で買えるものと同じにする。
    carry: stage.carry ?? stage.shop,
    startMoney: stage.startMoney ?? 0,
    startUp: stage.startUp ?? {},
  };
}

/**
 * 面の開放状態。
 * 前の面をクリアすると次が開く。開くのは「遊べる面」だけで、
 * 自機の性能は一切引き継がない。
 */
export function isUnlocked(stage, cleared) {
  if (stage.unlockAfter) return !!cleared[stage.unlockAfter];
  const stages = STAGES.filter((s) => s.kind === 'stage');
  const i = stages.indexOf(stage);
  if (i <= 0) return true;
  return !!cleared[stages[i - 1].id];
}

/** weights に従って敵の種類を1つ選ぶ。 */
export function pickType(weights) {
  let total = 0;
  for (const k in weights) total += weights[k];
  let r = Math.random() * total;
  for (const k in weights) {
    r -= weights[k];
    if (r <= 0) return k;
  }
  return 'circle';
}
