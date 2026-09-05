/**
 * 効果音。音源ファイルは使わず Web Audio API で合成する
 * （画像アセットを使わないのと同じ理由で、素材を用意せずに成立させる）。
 *
 * AudioContext はユーザー操作より前には開始できないので、
 * 最初の操作まで生成を遅らせる。音が出せない環境でも黙って続行する。
 */
import { ANY } from '../config.js';

// ド・ミ・ソ。白い敵は弾種を持たないので、一段上のドを軽く鳴らす。
const TYPE_HZ = { circle: 523.25, tri: 659.25, sq: 783.99, [ANY]: 1046.5 };
const HZ = (type) => TYPE_HZ[type] ?? TYPE_HZ.circle;

let ctx = null;
let master = null;
let muted = false;
let volume = 0.7;
let voices = 0;              // 同時発音数。撃破が連続しても飽和させないため
const MAX_VOICES = 14;

function ensure() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);
    return ctx;
  } catch {
    return null;                // 音が出せなくてもゲームは続ける
  }
}

/** 減衰するトーン。 */
function tone({ freq, to = freq, dur = 0.12, type = 'triangle', gain = 0.25, delay = 0 }) {
  if (!Number.isFinite(freq) || !Number.isFinite(to)) return;
  if (!ensure() || voices >= MAX_VOICES) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);

  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
  voices++;
  osc.onended = () => { voices--; };
}

/** ノイズ。弾かれ・突破のような「当たらなかった / 壊れた」音に使う。 */
function noise({ dur = 0.12, gain = 0.2, hz = 1200, q = 1, sweepTo = null }) {
  if (!Number.isFinite(hz)) return;
  if (!ensure() || voices >= MAX_VOICES) return;
  const t0 = ctx.currentTime;
  const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(hz, t0);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t0 + dur);
  filter.Q.value = q;

  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  src.connect(filter).connect(g).connect(master);
  src.start(t0);
  voices++;
  src.onended = () => { voices--; };
}

const EFFECTS = {
  /** 砲塔が一段回った。手数のフィードバックなので、必ず鳴らす。 */
  rotate(type) {
    tone({ freq: HZ(type), dur: 0.07, type: 'square', gain: 0.10 });
  },
  kill(type) {
    // 白い敵は下位なので、同じ形の音を軽く短く鳴らす
    const light = type === ANY;
    tone({ freq: HZ(type), to: HZ(type) * 2, dur: light ? 0.07 : 0.10, gain: light ? 0.08 : 0.14 });
  },
  killArmored(type) {
    tone({ freq: HZ(type) / 2, to: HZ(type) * 1.5, dur: 0.26, gain: 0.22 });
    tone({ freq: HZ(type), dur: 0.22, gain: 0.12, delay: 0.05 });
  },
  /** 種類違いで弾かれた。空振りが分かることが目的なので鈍い音にする。 */
  deflect() {
    noise({ dur: 0.07, gain: 0.06, hz: 500, q: 0.8 });
  },
  /** 装甲にポッドの弾が弾かれた。金属質に。 */
  armorDeflect() {
    noise({ dur: 0.06, gain: 0.07, hz: 3200, q: 6 });
  },
  buy() {
    tone({ freq: 587.33, dur: 0.09, gain: 0.16, type: 'square' });
    tone({ freq: 880, dur: 0.14, gain: 0.16, type: 'square', delay: 0.07 });
  },
  breach() {
    noise({ dur: 0.35, gain: 0.28, hz: 900, sweepTo: 90, q: 0.7 });
    tone({ freq: 150, to: 55, dur: 0.34, gain: 0.20, type: 'sawtooth' });
  },
  clear() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone({ freq: f, dur: 0.32, gain: 0.16, delay: i * 0.10 }));
  },
  fail() {
    [392, 329.63, 261.63].forEach((f, i) =>
      tone({ freq: f, dur: 0.42, gain: 0.18, type: 'sawtooth', delay: i * 0.13 }));
  },
};

/**
 * 効果音はゲーム進行の途中から呼ばれる。ここで例外が漏れると更新処理が中断し、
 * 「報酬は入ったが敵が消えない」といった壊れ方をするので、音は絶対に投げさせない。
 */
export const sfx = Object.fromEntries(
  Object.entries(EFFECTS).map(([name, fn]) => [name, (...args) => {
    try { fn(...args); } catch { /* 音が鳴らないだけでゲームは続ける */ }
  }])
);

export const audio = {
  /** 最初のユーザー操作で呼ぶ。ブラウザの自動再生制限のため。 */
  unlock() { ensure(); },
  get muted() { return muted; },
  get volume() { return volume; },
  setMuted(v) {
    muted = !!v;
    if (master) master.gain.value = muted ? 0 : volume;
  },
  setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (master && !muted) master.gain.value = volume;
  },
};
