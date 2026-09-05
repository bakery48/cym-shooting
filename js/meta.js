/**
 * 恒久強化。ラン間で残る唯一の強さで、専用通貨「コア」で買う。
 *
 * ここに置けるのは **1ラン内の弧に触れない強化だけ**。
 * ポッドや弾種にかかわる強化を恒久側に出すと、2周目以降が
 * 「最初から自動化済み」で始まり、企画書 §2 のコアループが成立しなくなる。
 *
 * 企画書 §6 の原則はそのまま適用する ―「これは画面上で何が増えるか」に
 * 答えられない恒久強化は追加しない。
 */
export const META = [
  {
    id: 'wing', name: '僚機', max: 2, cost: [8, 20],
    // 画面に増えるもの: 自機の脇に付く小型機
    desc: '白い ◆ だけを狙う小型機が自機の脇に付く。弾種を持つ敵には手を出さない。',
  },
  {
    id: 'shield', name: '防壁', max: 3, cost: [6, 14, 26],
    // 画面に増えるもの: 防衛ライン上の障壁ブロック
    desc: '防衛ラインに障壁が立ち、突破を肩代わりする。ランごとに戻る。',
  },
  {
    id: 'core', name: '弾芯', max: 3, cost: [5, 12, 24],
    // 画面に増えるもの: 自機の弾そのものの太さ
    desc: '自機の弾が太くなる。かすっていた弾が当たるようになる。',
  },
];

export const metaById = (id) => META.find((m) => m.id === id);

/** 次の段の価格。上限に達していれば null。 */
export function metaCost(item, level) {
  return level >= item.max ? null : item.cost[level];
}

export const EMPTY_META_UP = Object.fromEntries(META.map((m) => [m.id, 0]));
