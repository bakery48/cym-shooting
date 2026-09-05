import { CONFIG } from './config.js';
import { view, attachView, resizeView } from './core/view.js';
import { newGame } from './core/state.js';
import { createInput } from './core/input.js';
import { update } from './game/update.js';
import { draw } from './game/render.js';
import { createShop } from './game/shop.js';
import { createHud, renderResults } from './game/hud.js';

const $ = (id) => document.getElementById(id);

const canvas = $('cv');
const stage = $('stage');
attachView(canvas, stage);

const startEl = $('screen-start');
const endEl = $('screen-end');
const pauseEl = $('screen-pause');

let G = null;
const getGame = () => G;

/** チューニングとテスト用の覗き窓。ゲーム側からは参照しない。 */
const publish = () => { window.__G = G; window.__CONFIG = CONFIG; };

const hud = createHud();
const shop = createShop($('shop'), getGame);
const input = createInput({
  canvas, getGame,
  onPause: () => togglePause(),
  onShopHotkey: (i) => shop.purchase(i),
});

/** リサイズしてもラン中の座標が画面外に取り残されないようにする。 */
function handleResize() {
  const prevW = view.W || 1;
  resizeView();
  if (!G) return;

  const ratio = view.W / prevW;
  const m = CONFIG.ship.edgeMargin;
  G.ship.x = Math.max(m, Math.min(view.W - m, G.ship.x * ratio));
  for (const e of G.enemies) e.x = Math.max(0, Math.min(view.W, e.x * ratio));
  for (const b of G.bullets) b.x *= ratio;
  for (const p of G.parts) p.x *= ratio;
}
addEventListener('resize', handleResize);

function begin() {
  handleResize();
  G = newGame();
  G.ship.x = view.W / 2;
  G.running = true;
  publish();
  input.reset();
  startEl.hidden = true;
  endEl.hidden = true;
  pauseEl.hidden = true;
  hud.invalidate();
  shop.invalidate();
  shop.paint(true);
  hud.paint(G);
}

function togglePause() {
  if (!G || !G.running) return;
  G.paused = !G.paused;
  pauseEl.hidden = !G.paused;
  input.reset();
  shop.paint(true);
}

function gameOver(reason) {
  G.running = false;
  G.over = true;
  G.paused = false;
  G.endReason = reason;
  pauseEl.hidden = true;
  endEl.hidden = false;
  renderResults(G);
  shop.paint(true);
}

let last = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ts - last) / 1000 || 0);
  last = ts;
  if (!G) return;

  if (G.running && !G.paused) {
    update(G, dt, input, gameOver);
    hud.paint(G);
    shop.paint();
  }
  if (!G.over) draw(G);
}

$('btn-start').addEventListener('click', begin);
$('btn-again').addEventListener('click', begin);
$('btn-resume').addEventListener('click', togglePause);

handleResize();
G = newGame();
G.ship.x = view.W / 2;
publish();
shop.paint(true);
hud.paint(G);
draw(G);
requestAnimationFrame(frame);
