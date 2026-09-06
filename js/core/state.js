import { CONFIG, INK, INK_ID } from '../config.js';
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
    meta: { ...meta.up },
    shield: meta.up.shield,
    wings: [],
    running: false, over: false, paused: false, cleared: false,
    t: 0, money: rules.startMoney, breach: 0, cores: 0,
    // idx は rules.inks への添字。段階解放中は選べる色そのものが少ない。
    ship: { x: view.W / 2, y: 0, idx: 0, ang: 0, targetAng: 0, cd: 0 },
    enemies: [], bullets: [], parts: [], pods: [],
    nextSpawn: 0.6, shake: 0, flash: 0, shieldFlash: 0,
    // ラン内強化は毎回ゼロから。ここが企画書 §2 の弧を毎ラン成立させている。
    up: { podC: false, podM: false, podY: false, rate: 0, pierce: 0, spread: 0, ...rules.startUp },
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
 */
export function syncPods(G) {
  const wanted = G.rules.inks.filter((ink) => G.up[podIdFor(ink)]);
  const kept = G.pods.filter((p) => wanted.includes(p.ink));

  G.pods = wanted.map((ink, i) => {
    const old = kept.find((p) => p.ink === ink);
    if (old) return old;
    return { ink, a: (i / wanted.length) * Math.PI * 2, x: 0, y: 0, cd: Math.random() * 0.4,
             trail: [], trailT: 0 };
  });
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
