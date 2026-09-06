import { CONFIG, INK, INK_ORDER, INK_COUNT } from './config.js';

/**
 * 敵の出現比の書き方。
 *
 *   w    重み。数値、または [登場時, ラン終了時] で線形に変化させる
 *   from ラン全体に対する登場時刻（0〜1）。既定は 0（最初から）
 *
 * 混色を最初から全種類降らせると頭が追いつかないので、種類は時間で増やす。
 * 単色 → 混色1種 → 2種 → 3種 → 黒、の順に開いていく。
 */
const at = (from, w) => ({ from, w });

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
const ALL = ['podC', 'podM', 'podY', 'rate'];
const HAND_ONLY = ['rate'];

const MONO = [M];
const DUO  = [M, C];
const TRIO = [M, C, Y];

export const STAGES = [
  {
    id: '1-1', kind: 'stage', name: '1-1', title: '単色',
    desc: 'マゼンタだけ。まず動いて当てることに慣れる。砲塔はまだ回らない。',
    inks: MONO,
    pool: { [M]: at(0, 1) },
    motions: { drift: 1 },
    // 最初の面。密度の伸びはいちばん穏やかにする
    spawn: { rate0: 0.50, rate1: 4.5, curve: 1.8 },
    bareChance: { base: 0.22 },
    armoredChance: { base: 0.02, perSec: 0 },
    shop: ALL,
  },
  {
    id: '1-2', kind: 'stage', name: '1-2', title: '二色',
    desc: 'シアンが開く。青は C と M が重なった敵で、二色とも剥がさないと落ちない。',
    inks: DUO,
    // 混色は1種類しかないので、中盤から出す
    pool: { [M]: at(0, 3), [C]: at(0, 3), [C | M]: at(0.30, [1, 3]) },
    motions: { drift: 3, leaf: 1 },
    roles: { normal: 6, cluster: 1, carry: 1 },
    spawn: { rate0: 0.55, rate1: 5.5, curve: 1.9 },
    bareChance: { base: 0.18 },
    armoredChance: { base: 0.03, perSec: 0.0002 },
    shop: ALL,
  },
  {
    id: '1-3', kind: 'stage', name: '1-3', title: '三色',
    desc: 'イエローが開いて全色そろう。赤・緑・青は二色、黒は三色すべてを剥がす。',
    inks: TRIO,
    // 序盤は混色1種、中盤2種、終盤3種、最終盤に黒
    pool: {
      [M]: at(0, 3), [C]: at(0, 3), [Y]: at(0, 3),
      [C | M]: at(0.15, [1, 3]),
      [M | Y]: at(0.40, [1, 3]),
      [C | Y]: at(0.62, [1, 3]),
      [C | M | Y]: at(0.82, [0.4, 2]),
    },
    motions: { drift: 3, leaf: 1 },
    // 増殖はここには置かない ― 1-3 は最初の関門なので役割を増やしすぎない
    roles: { normal: 6, cluster: 2, split: 2, carry: 1 },
    // 役割が4種そろう面なので、既定より薄くする
    spawn: { rate0: 0.55, rate1: 5.4, curve: 2.0 },
    shop: ALL,
  },
  {
    id: '2-1', kind: 'stage', name: '2-1', title: '回避',
    desc: '自機の真上から常にずれていく敵が混じる。追い込む位置取りが要る。',
    inks: TRIO,
    pool: {
      [M]: at(0, 2), [C]: at(0, 2), [Y]: at(0, 2),
      [C | M]: at(0.10, [1, 3]),
      [M | Y]: at(0.32, [1, 3]),
      [C | Y]: at(0.54, [1, 3]),
      [C | M | Y]: at(0.72, [0.5, 3]),
    },
    motions: { drift: 3, leaf: 2, dodge: 2 },
    roles: { normal: 5, cluster: 2, split: 2, dive: 2, carry: 1, breed: 1 },
    spawn: { rate0: 0.60, rate1: 7.0, curve: 2.0 },
    shop: ALL,
  },
  {
    id: '2-2', kind: 'stage', name: '2-2', title: '黒',
    desc: '三色すべてを乗せた黒が多い。1体に3発、砲塔を2回まわす必要がある。',
    inks: TRIO,
    // 黒が主役の面。それでも最初から黒だらけにはせず、段階を踏む
    pool: {
      [M]: at(0, 2), [C]: at(0, 2), [Y]: at(0, 2),
      [C | M]: at(0.08, [2, 2]), [M | Y]: at(0.20, [2, 2]), [C | Y]: at(0.32, [2, 2]),
      [C | M | Y]: at(0.40, [1, 9]),
    },
    motions: { drift: 3, leaf: 1, dodge: 1 },
    roles: { normal: 6, split: 2, dive: 1, carry: 1, breed: 2 },
    // 黒は1体3発。体数で押すと手数が足りなくなるので伸びは抑える
    spawn: { rate0: 0.50, rate1: 5.0, curve: 1.9 },
    bareChance: { base: 0.10 },
    shop: ALL,
  },
  {
    id: '2-3', kind: 'stage', name: '2-3', title: '完走',
    desc: '5分。終盤はポッドだけでは追いつかず、手が通常の敵にも戻ってくる。',
    inks: TRIO,
    runSeconds: 300, maxBreach: 12,
    pool: {
      [M]: at(0, 3), [C]: at(0, 3), [Y]: at(0, 3),
      [C | M]: at(0.12, [1, 3]),
      [M | Y]: at(0.30, [1, 3]),
      [C | Y]: at(0.48, [1, 3]),
      [C | M | Y]: at(0.66, [0.4, 3]),
    },
    motions: { drift: 3, leaf: 2, dodge: 1 },
    roles: { normal: 5, cluster: 2, split: 2, dive: 2, carry: 2, breed: 2 },
    spawn: { rate0: 0.60, rate1: 5.1, curve: 2.1 },
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
    pool: {
      [M]: at(0, 3), [C]: at(0, 3), [Y]: at(0, 3),
      [C | M]: at(0.25, [1, 2]), [M | Y]: at(0.50, [1, 2]), [C | Y]: at(0.70, [1, 2]),
    },
    motions: { drift: 3, leaf: 1 },
    roles: { normal: 5, cluster: 2, dive: 1 },
    bareChance: { base: 0.30 },
    armoredChance: { base: 0.03, perSec: 0.0002 },
    // ポッドを買えない＝ラン中に伸びるのは連射だけ。
    // in の伸びもそれに合わせて抑える（ここだけ密度カーブが浅い）
    spawn: { rate0: 0.50, rate1: 2.1, curve: 1.8 },
    shop: HAND_ONLY,
  },
  {
    id: 'm2', kind: 'mode', name: '全自動', title: '装甲専任',
    desc: '3色のポッドを最初から持つ。そのぶん装甲付きしか金にならない。',
    unlockAfter: '1-3',
    inks: TRIO,
    pool: {
      [M]: at(0, 3), [C]: at(0, 3), [Y]: at(0, 3),
      [C | M]: at(0.15, [1, 2]), [M | Y]: at(0.35, [1, 2]), [C | Y]: at(0.55, [1, 2]),
    },
    motions: { drift: 3, leaf: 1, dodge: 1 },
    roles: { normal: 5, cluster: 2, split: 1, carry: 2, breed: 1 },
    armoredChance: { base: 0.30, perSec: 0.0015 },
    bareChance: { base: 0.08 },
    spawn: { rate0: 0.70, rate1: 3.6, curve: 1.8 },
    startUp: { podC: 1, podM: 1, podY: 1 },
    // 増設は買える。自動化を伸ばす面なので、金の行き先もそこに置く
    shop: ALL,
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
    // 役割の出現比。既定は全部ふつうの敵。
    roles: stage.roles ?? { normal: 1 },
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

/**
 * その時点で出現しうるインク構成と重み。
 * `from` 未満の組み合わせはまだ降ってこない。重みが [a, b] なら
 * 登場時 a からラン終了時 b へ線形に増える（「たまに → 普通」を表す）。
 */
export function poolAt(pool, progress) {
  const out = {};
  for (const key in pool) {
    const { from = 0, w } = pool[key];
    if (progress < from) continue;
    if (typeof w === 'number') { out[key] = w; continue; }
    const k = from >= 1 ? 1 : (progress - from) / (1 - from);
    out[key] = w[0] + (w[1] - w[0]) * Math.min(1, Math.max(0, k));
  }
  return out;
}

/**
 * その構成が「登場したばかり」なら落下を遅くする係数。
 * 解読の時間が要るのは覚えたての混色だけなので、慣れる頃には単色と同じ速さに戻す。
 * 単色と素地は常に等速。
 */
export function fallMulFor(pool, inks, progress) {
  if (INK_COUNT[inks] < 2) return 1;
  const from = pool[inks]?.from ?? 0;
  const k = from >= 1 ? 1 : (progress - from) / (1 - from);   // 登場からの経過（0〜1）
  const t = Math.min(1, Math.max(0, k));
  return CONFIG.mixed.slowStart + (1 - CONFIG.mixed.slowStart) * t;
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
    let hasStart = false;
    for (const key of Object.keys(s.pool)) {
      const inks = Number(key);
      const { from = 0, w } = s.pool[key];
      if (inks === 0) { problems.push(`${s.id}: pool に素地(0)は置かない`); continue; }
      if (inks & ~available) {
        problems.push(`${s.id}: 撃てないインクを含む敵 (${inks}) が出る`);
      }
      if (from < 0 || from >= 1) problems.push(`${s.id}: from は 0以上1未満 (${key}: ${from})`);
      if (from === 0) hasStart = true;
      const ws = typeof w === 'number' ? [w] : w;
      if (!ws?.length || ws.some((v) => !(v > 0))) problems.push(`${s.id}: 重みが不正 (${key})`);
    }
    // ラン開始時点で何も降ってこない面は成立しない
    if (!hasStart) problems.push(`${s.id}: 開始時（from:0）に出る敵がいない`);
    // 密度カーブは「だんだん増える」形でなければならない
    const sp = resolveRules(s).spawn;
    if (!(sp.rate0 > 0)) problems.push(`${s.id}: spawn.rate0 が不正`);
    if (!(sp.rate1 > sp.rate0)) problems.push(`${s.id}: spawn が終盤に増えない`);
    if (!(sp.curve > 0)) problems.push(`${s.id}: spawn.curve が不正`);
    for (const key of Object.keys(s.motions)) {
      if (!['drift', 'leaf', 'dodge'].includes(key)) {
        problems.push(`${s.id}: 未知の落ち方 "${key}"`);
      }
    }
    for (const key of Object.keys(s.roles ?? {})) {
      if (!['normal', 'split', 'cluster', 'dive', 'carry', 'breed'].includes(key)) {
        problems.push(`${s.id}: 未知の役割 "${key}"`);
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

/** 混色が何種類そろうか（面選択の表示に使う）。 */
export const mixedKinds = (stage) =>
  Object.keys(stage.pool).filter((k) => INK_COUNT[Number(k)] >= 2).length;
