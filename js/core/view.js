import { CONFIG } from '../config.js';

/**
 * キャンバスの寸法と座標スケールを一元管理する。
 * W/H はCSSピクセルのプレイ領域、S は縦640px基準のスケール係数。
 */
export const view = {
  W: 0, H: 0, S: 1, sc: 1, LINE: 0,
  canvas: null, ctx: null, host: null,
};

export function attachView(canvas, host) {
  view.canvas = canvas;
  view.host = host;
  view.ctx = canvas.getContext('2d');
}

/**
 * ホスト要素の寸法から縦長のプレイ領域を切り出し、キャンバスをDPR対応で作り直す。
 * 進行中のランを壊さないよう、ここでは状態を触らない（呼び出し側が座標を再クランプする）。
 */
export function resizeView() {
  const r = view.host.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const W = Math.max(CONFIG.stage.minWidth, Math.min(r.width, r.height * CONFIG.stage.aspect));
  const H = r.height;

  view.W = W;
  view.H = H;
  view.S = H / 640;
  view.sc = Math.max(0.85, view.S);
  view.LINE = H - 74 * view.sc;

  view.canvas.width = Math.round(W * dpr);
  view.canvas.height = Math.round(H * dpr);
  view.canvas.style.width = W + 'px';
  view.canvas.style.height = H + 'px';
  view.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
