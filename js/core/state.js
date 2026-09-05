import { CONFIG, TYPES, TURN_STEP } from '../config.js';
import { view } from './view.js';

/** 弾種 → ポッド強化ID の対応。 */
const POD_ID = { circle: 'podCircle', tri: 'podTri', sq: 'podSq' };

export function newGame() {
  return {
    running: false, over: false, paused: false,
    t: 0, money: 0, breach: 0,
    ship: { x: view.W / 2, y: 0, idx: 0, ang: 0, targetAng: 0, cd: 0 },
    enemies: [], bullets: [], parts: [], pods: [],
    nextSpawn: 0.6, shake: 0, flash: 0,
    up: { podCircle: false, podTri: false, podSq: false, rate: 0, pierce: 0, spread: 0 },
    st: { ship: 0, pod: 0, armored: 0, breach: 0, earned: 0 },
    endReason: '',
  };
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
}
