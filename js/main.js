import { CONFIG } from './config.js';
import { STAGES, stageById, isUnlocked } from './stages.js';
import { view, attachView, resizeView } from './core/view.js';
import { newGame } from './core/state.js';
import { createInput } from './core/input.js';
import { loadProgress, recordRun } from './core/save.js';
import { update } from './game/update.js';
import { draw } from './game/render.js';
import { createShop } from './game/shop.js';
import { createHud, renderResults } from './game/hud.js';
import { createSelect } from './game/select.js';

const $ = (id) => document.getElementById(id);

const canvas = $('cv');
attachView(canvas, $('stage'));

const screens = {
  select: $('screen-select'),
  pause: $('screen-pause'),
  end: $('screen-end'),
};

let G = null;
let progress = loadProgress();
const getGame = () => G;

/** チューニングとテスト用の覗き窓。ゲーム側からは参照しない。 */
const publish = () => {
  window.__G = G;
  window.__CONFIG = CONFIG;
  window.__PROGRESS = progress;
};

const hud = createHud();
const shop = createShop($('shop'), getGame);
const select = createSelect(() => progress, begin);
const input = createInput({
  canvas, getGame,
  onPause: togglePause,
  onShopHotkey: (i) => shop.purchase(i),
});

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
  // ラン中でないときはHUDとショップを出さない（古い値が残って見えるため）
  document.body.classList.toggle('no-run', name === 'select');
}

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

function begin(stage) {
  handleResize();
  G = newGame(stage);
  G.ship.x = view.W / 2;
  G.running = true;
  publish();
  input.reset();
  showScreen(null);
  hud.invalidate();
  shop.invalidate();
  shop.paint(true);
  hud.paint(G);
}

function openSelect() {
  G = null;
  publish();
  select.paint();
  showScreen('select');
}

function togglePause() {
  if (!G || !G.running) return;
  G.paused = !G.paused;
  showScreen(G.paused ? 'pause' : null);
  input.reset();
  shop.paint(true);
}

function gameOver(reason, cleared) {
  G.running = false;
  G.over = true;
  G.paused = false;
  G.cleared = cleared;
  G.endReason = reason;

  const updated = recordRun(progress, G.stage.id, cleared, G.st);
  renderResults(G, progress.best[G.stage.id], updated);

  // 次に進める面があればそれを案内する
  const next = nextStage(G.stage);
  $('btn-next').hidden = !next;
  if (next) $('btn-next').textContent = `${next.name}へ`;
  $('btn-next').dataset.stage = next?.id ?? '';

  showScreen('end');
  shop.paint(true);
}

function nextStage(stage) {
  const i = STAGES.indexOf(stage);
  for (let j = i + 1; j < STAGES.length; j++) {
    if (isUnlocked(STAGES[j], progress.cleared)) return STAGES[j];
  }
  return null;
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

$('btn-resume').addEventListener('click', togglePause);
$('btn-again').addEventListener('click', () => begin(G.stage));
$('btn-next').addEventListener('click', (e) => {
  const stage = stageById(e.currentTarget.dataset.stage);
  if (stage) begin(stage);
});
for (const id of ['btn-select', 'btn-quit']) {
  $(id).addEventListener('click', openSelect);
}

handleResize();
openSelect();
requestAnimationFrame(frame);
