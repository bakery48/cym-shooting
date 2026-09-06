import { CONFIG, INK, INK_ORDER, INK_COUNT } from './config.js';

const { C, M, Y } = INK;

/**
 * 面とモードの定義。
 *
 * `inks` はその面で撃てるインク。INK_ORDER の先頭からの部分列で、
 * 段階解放はここを伸ばしていくことで表現する。
 *
 * `pool` は敵のインク構成の出現比（キーは3ビットの組み合わせ）。
 * **その面で撃てないインクを含む敵を置いてはいけない** ― 倒せず詰むため。
 * `validateStages()` が全面を検査する。
 *
 * `motions` は落ち方の出現比。形を統一したぶん、差はここで付ける。
 */
const ALL = ['podC', 'podM', 'podY', 'rate', 'pierce', 'spread'];
const HAND_ONLY = ['rate', 'pierce', 'spread'];

const MONO = [M];
const DUO  = [M, C];
const TRIO = [M, C, Y];

export const STAGES = [
  {
    id: '1-1', kind: 'stage', name: '1-1', title: '単色',
    desc: 'マゼンタだけ。まず動いて当てることに慣れる。砲塔はまだ回らない。',
    inks: MONO,
    pool: { [M]: 1 },
    motions: { drift: 1 },
    bareChance: { base: 0.22 },
    armoredChance: { base: 0.02, perSec: 0 },
    shop: ALL,
  },
  {
    id: '1-2', kind: 'stage', name: '1-2', title: '二色',
    desc: 'シアンが開く。青は C と M が重なった敵で、二色とも剥がさないと落ちない。',
    inks: DUO,
    pool: { [M]: 3, [C]: 3, [C | M]: 2 },
    motions: { drift: 3, leaf: 1 },
    bareChance: { base: 0.18 },
    armoredChance: { base: 0.03, perSec: 0.0002 },
    shop: ALL,
  },
  {
    id: '1-3', kind: 'stage', name: '1-3', title: '三色',
    desc: 'イエローが開いて全色そろう。赤・緑・青は二色、黒は三色すべてを剥がす。',
    inks: TRIO,
    pool: { [M]: 3, [C]: 3, [Y]: 3, [C | M]: 2, [C | Y]: 2, [M | Y]: 2, [C | M | Y]: 1 },
    motions: { drift: 3, leaf: 1 },
    shop: ALL,
  },
  {
    id: '2-1', kind: 'stage', name: '2-1', title: '回避',
    desc: 'ゆっくり横に逃げる敵が混じる。狙って撃つ手が要る。',
    inks: TRIO,
    pool: { [M]: 2, [C]: 2, [Y]: 2, [C | M]: 2, [C | Y]: 2, [M | Y]: 2, [C | M | Y]: 1 },
    motions: { drift: 3, leaf: 2, dodge: 2 },
    spawn: { start: 0.85, min: 0.26, rampPerSec: 0.0042 },
    shop: ALL,
  },
  {
    id: '2-2', kind: 'stage', name: '2-2', title: '黒',
    desc: '三色すべてを乗せた黒が多い。1体に3発、砲塔を2回まわす必要がある。',
    inks: TRIO,
    pool: { [M]: 1, [C]: 1, [Y]: 1, [C | M]: 2, [C | Y]: 2, [M | Y]: 2, [C | M | Y]: 6 },
    motions: { drift: 3, leaf: 1, dodge: 1 },
    spawn: { start: 1.05, min: 0.38, rampPerSec: 0.0030 },
    bareChance: { base: 0.10 },
    shop: ALL,
  },
  {
    id: '2-3', kind: 'stage', name: '2-3', title: '完走',
    desc: '5分。終盤はポッドだけでは追いつかず、手が通常の敵にも戻ってくる。',
    inks: TRIO,
    runSeconds: 300, maxBreach: 12,
    pool: { [M]: 3, [C]: 3, [Y]: 3, [C | M]: 2, [C | Y]: 2, [M | Y]: 2, [C | M | Y]: 2 },
    motions: { drift: 3, leaf: 2, dodge: 1 },
    spawn: { start: 0.90, min: 0.22, rampPerSec: 0.0032 },
    fall: { start: 50, rampPerSec: 0.52 },
    armoredChance: { base: 0.08, perSec: 0.0006 },
    shop: ALL,
  },

  // --- モード（1-3 クリアで開放） ---
  {
    id: 'm1', kind: 'mode', name: '手動限定', title: 'ポッドなし',
    desc: 'ポッドを買えない。混色をすべて手で剥がし続ける。',
    unlockAfter: '1-3',
    inks: TRIO,
    pool: { [M]: 3, [C]: 3, [Y]: 3, [C | M]: 1, [C | Y]: 1, [M | Y]: 1 },
    motions: { drift: 3, leaf: 1 },
    bareChance: { base: 0.30 },
    armoredChance: { base: 0.03, perSec: 0.0002 },
    spawn: { start: 1.05, min: 0.40, rampPerSec: 0.0030 },
    shop: HAND_ONLY,
  },
  {
    id: 'm2', kind: 'mode', name: '全自動', title: '装甲専任',
    desc: '3色のポッドを最初から持つ。そのぶん装甲付きしか金にならない。',
    unlockAfter: '1-3',
    inks: TRIO,
    pool: { [M]: 3, [C]: 3, [Y]: 3, [C | M]: 2, [C | Y]: 2, [M | Y]: 2 },
    motions: { drift: 3, leaf: 1, dodge: 1 },
    armoredChance: { base: 0.30, perSec: 0.0015 },
    bareChance: { base: 0.08 },
    spawn: { start: 0.70, min: 0.24, rampPerSec: 0.0038 },
    startUp: { podC: true, podM: true, podY: true },
    shop: HAND_ONLY,
  },
];

export const stageById = (id) => STAGES.find((s) => s.id === id);

/** 強化ID → その色のインク。ポッド以外は null。 */
export const podInk = (id) => ({ podC: INK.C, podM: INK.M, podY: INK.Y }[id] ?? null);

/** その面で実際に使うルール一式。CONFIG を土台に面の指定を重ねる。 */
export function resolveRules(stage) {
  const available = stage.inks.reduce((a, b) => a | b, 0);
  return {
    runSeconds: stage.runSeconds ?? CONFIG.runSeconds,
    maxBreach: stage.maxBreach ?? CONFIG.maxBreach,
    spawn: { ...CONFIG.spawn, ...stage.spawn },
    fall: { ...CONFIG.fall, ...stage.fall },
    armoredChance: { ...CONFIG.armoredChance, ...stage.armoredChance },
    bareChance: { ...CONFIG.bareChance, ...stage.bareChance },
    inks: stage.inks,
    pool: stage.pool,
    motions: stage.motions,
    // 撃てない色のポッドは買えない。面ごとに書き分けると必ずずれるので、
    // インクの解放状況から機械的に絞る。
    shop: stage.shop.filter((id) => { const ink = podInk(id); return !ink || (available & ink); }),
    startMoney: stage.startMoney ?? 0,
    startUp: stage.startUp ?? {},
  };
}

/**
 * 面の開放状態。前の面をクリアすると次が開く。
 * 開くのは「遊べる面」だけで、自機の性能は一切引き継がない。
 */
export function isUnlocked(stage, cleared) {
  if (stage.unlockAfter) return !!cleared[stage.unlockAfter];
  const stages = STAGES.filter((s) => s.kind === 'stage');
  const i = stages.indexOf(stage);
  if (i <= 0) return true;
  return !!cleared[stages[i - 1].id];
}

/** 重み付きで1つ選ぶ。キーは数値でも文字列でもよい。 */
export function pickWeighted(weights) {
  let total = 0;
  for (const k in weights) total += weights[k];
  let r = Math.random() * total;
  for (const k in weights) {
    r -= weights[k];
    if (r <= 0) return k;
  }
  return Object.keys(weights)[0];
}

/**
 * 全面の検査。撃てないインクを含む敵が出る面があれば、その面は詰む。
 * インクの並びが INK_ORDER の先頭からの部分列であることも確かめる ―
 * 段階解放は「途中の色だけ持つ」形にはしない。
 */
export function validateStages() {
  const problems = [];

  for (const s of STAGES) {
    const available = s.inks.reduce((a, b) => a | b, 0);
    const expected = INK_ORDER.slice(0, s.inks.length);
    if (s.inks.join(',') !== expected.join(',')) {
      problems.push(`${s.id}: inks が INK_ORDER の先頭からの部分列でない`);
    }
    for (const key of Object.keys(s.pool)) {
      const inks = Number(key);
      if (inks === 0) { problems.push(`${s.id}: pool に素地(0)は置かない`); continue; }
      if (inks & ~available) {
        problems.push(`${s.id}: 撃てないインクを含む敵 (${inks}) が出る`);
      }
    }
    for (const key of Object.keys(s.motions)) {
      if (!['drift', 'leaf', 'dodge'].includes(key)) {
        problems.push(`${s.id}: 未知の落ち方 "${key}"`);
      }
    }
    // ポッドは自分の色のインクしか剥がせないので、買える色は撃てる色に限る。
    // resolveRules が絞ったあとの結果を検査する（絞り漏れの検出）。
    for (const id of resolveRules(s).shop) {
      const ink = podInk(id);
      if (ink && !(available & ink)) problems.push(`${s.id}: 撃てない色のポッドが買える (${id})`);
    }
    // 最初から持たせる強化にも同じ制約がかかる
    for (const id of Object.keys(s.startUp ?? {})) {
      const ink = podInk(id);
      if (ink && !(available & ink)) problems.push(`${s.id}: 撃てない色のポッドを最初から持つ (${id})`);
    }
  }
  return problems;
}

/** その面で最も手数のかかる敵が何発必要か（表示と検査に使う）。 */
export const maxInkCount = (stage) =>
  Math.max(...Object.keys(stage.pool).map((k) => INK_COUNT[Number(k)]));
