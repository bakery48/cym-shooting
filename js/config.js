/**
 * 全チューニング値の集約点。
 * ロジック中に数値をベタ書きしない（企画書 §8）。
 */
export const CONFIG = {
  runSeconds: 180,
  maxBreach: 10,

  kill: { normal: 12, armored: 95 },
  armoredChance: { base: 0.05, perSec: 0.0004 },

  spawn: { start: 1.00, min: 0.30, rampPerSec: 0.0038 },
  fall:  { start: 46,   rampPerSec: 0.55 },   // px/秒（縦640px基準）

  ship: {
    fireBase: 0.30, fireMin: 0.10, firePerLv: 0.035,
    bulletSpeed: 560,
    keyboardSpeed: 420,   // px/秒（縦640px基準）: キー移動の速度
    edgeMargin: 24,
  },
  pod: { orbitRadius: 58, orbitSpeed: 0.9, fireMul: 1.9, bulletSpeed: 460, range: 520 },

  tapThreshold: 10,       // これ未満の移動なら「タップ＝砲塔回転」

  // 縦シューの見え方を保つため、プレイ領域は縦長に制限して中央に置く。
  // 横に広いデスクトップ画面でも体感を揃える（企画書 §8 のS基準と同じ考え方）。
  stage: { aspect: 0.78, minWidth: 300 },

  costs: {
    podCircle: 150, podTri: 260, podSq: 400,
    rate:   { base: 130, mul: 1.65, max: 5 },
    pierce: { base: 220, mul: 2.0,  max: 3 },
    spread: { base: 280, mul: 2.1,  max: 3 },
  },
};

export const TYPES = ['circle', 'tri', 'sq'];
// 弾種と敵種の対応そのもの。装飾ではなく情報なので、他の用途に流用しない（企画書 §7）
export const COLOR = { circle: '#ffe23c', tri: '#2fe4f0', sq: '#ff53d6' };   // Y / C / M
export const MARK  = { circle: '●', tri: '▲', sq: '■' };

export const PALETTE = {
  bg: '#232a45',
  line: '#4a5490',
  armor: '#e8edff',
  bad: '#ff4d5e',
  deflect: '#7a86b8',
  armorSpark: '#c9d2f0',
  hull: '#c9d2f0',
};

/** 1/3回転（ラジアン）。砲塔は3バレルなので一段 = 120度。 */
export const TURN_STEP = (Math.PI * 2) / 3;
