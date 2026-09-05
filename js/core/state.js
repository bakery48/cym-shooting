import { CONFIG, TYPES, TURN_STEP } from '../config.js';
import { resolveRules } from '../stages.js';
import { view } from './view.js';
import { sfx } from './audio.js';

/** 弾種 → ポッド強化ID の対応。 */
const POD_ID = { circle: 'podCircle', tri: 'podTri', sq: 'podSq' };

export function newGame(stage, meta) {
  const rules = resolveRules(stage);

  const G = {
    stage, rules,
    // 恒久強化はランをまたいで残る唯一の強さ。ラン中は変化しない。
    meta: { ...meta.up },
    // 防壁はランごとに戻る。突破を肩代わりした回数ぶんだけ減っていく。
    shield: meta.up.shield,
    wings: [],
    running: false, over: false, paused: false, cleared: false,
    t: 0, money: rules.startMoney, breach: 0, cores: 0,
    ship: { x: view.W / 2, y: 0, idx: 0, ang: 0, targetAng: 0, cd: 0 },
    enemies: [], bullets: [], parts: [], pods: [],
    nextSpawn: 0.6, shake: 0, flash: 0,
    // ラン内強化は毎回ゼロから。ここが企画書 §2 の弧を毎ラン成立させている。
    up: { podCircle: false, podTri: false, podSq: false, rate: 0, pierce: 0, spread: 0, ...rules.startUp },
    st: { ship: 0, pod: 0, armored: 0, breach: 0, earned: 0 },
    endReason: '',
  };
  syncPods(G);   // 最初からポッドを持つモードのため
  syncWings(G);
  return G;
}

/** 僚機は自機の脇に固定で並ぶ。ポッドと違って公転しない（別物だと見て分かるように）。 */
export function syncWings(G) {
  const n = G.meta.wing ?? 0;
  G.wings = Array.from({ length: n }, (_, i) => ({
    side: i % 2 === 0 ? -1 : 1,
    x: 0, y: 0, cd: Math.random() * 0.4,
  }));
}

export const fireInterval = (G) =>
  Math.max(CONFIG.ship.fireMin, CONFIG.ship.fireBase - G.up.rate * CONFIG.ship.firePerLv);

export const podOwned = (G, type) => G.up[POD_ID[type]];

/**
 * 所持ポッドの一覧と G.pods を同期する。
 * 既存ポッドは公転角を保ったまま残し、新規ぶんだけ空いた位相に配置する。
 */
export function syncPods(G) {
  const wanted = TYPES.filter((type) => podOwned(G, type));
  const kept = G.pods.filter((p) => wanted.includes(p.type));

  G.pods = wanted.map((type, i) => {
    const old = kept.find((p) => p.type === type);
    if (old) return old;
    return { type, a: (i / wanted.length) * Math.PI * 2, x: 0, y: 0, cd: Math.random() * 0.4 };
  });
}

/** 砲塔を一段回す（●→▲→■→●）。回転方向は一方向で固定（企画書 §3）。 */
export function rotateTurret(G) {
  G.ship.idx = (G.ship.idx + 1) % 3;
  G.ship.targetAng += TURN_STEP;
  sfx.rotate(TYPES[G.ship.idx]);
}
