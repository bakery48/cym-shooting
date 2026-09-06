import { CONFIG, INK } from './config.js';
import { STAGES, stageById, isUnlocked } from './stages.js';
import { view, attachView, resizeView } from './core/view.js';
import { newGame } from './core/state.js';
import { createInput } from './core/input.js';
import { loadProgress, recordRun, saveProgress, resetProgress, buyMeta } from './core/save.js';
import { audio, sfx } from './core/audio.js';
import { update } from './game/update.js';
import { draw } from './game/render.js';
import { createShop } from './game/shop.js';
import { createHud, renderResults } from './game/hud.js';
import { createSelect } from './game/select.js';
import { createDev } from './dev.js';

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

// 音量設定の復元と、最初のユーザー操作でのオーディオ開始（自動再生制限のため）
audio.setVolume(progress.settings.volume);
audio.setMuted(progress.settings.muted);
for (const ev of ['pointerdown', 'keydown']) {
  addEventListener(ev, () => audio.unlock(), { once: true });
}

const elVol = $('opt-volume');
const elMute = $('opt-mute');

function applyAudioSettings({ persist } = { persist: true }) {
  audio.setVolume(Number(elVol.value) / 100);
  audio.setMuted(elMute.checked);
  elVol.disabled = elMute.checked;
  if (!persist) return;
  // 設定は音量以外も入るので、丸ごと差し替えず必要な項目だけ更新する
  Object.assign(progress.settings, { muted: audio.muted, volume: audio.volume });
  saveProgress(progress);
}

elVol.value = String(Math.round(progress.settings.volume * 100));
elMute.checked = progress.settings.muted;
applyAudioSettings({ persist: false });
elVol.addEventListener('input', () => applyAudioSettings());
elVol.addEventListener('change', () => sfx.kill(INK.M));   // 音量確認用の試聴
elMute.addEventListener('change', () => { applyAudioSettings(); if (!audio.muted) sfx.kill(INK.M); });

const hud = createHud(() => progress.cleared);
const shop = createShop($('shop'), getGame);
const select = createSelect(() => progress, begin, (item) => {
  const ok = buyMeta(progress, item);
  if (ok) { sfx.buy(); dev.paint(); publish(); }
  return ok;
});
// テスト用パネル。ゲーム側からは参照しない（出荷時はこの2行を外せば消える）。
const dev = createDev(() => progress, () => { saveProgress(progress); refreshSelect(); });
dev.setVisible(progress.settings.dev || new URLSearchParams(location.search).has('dev'));

function refreshSelect() {
  select.paint();
  dev.paint();
  publish();
}

const input = createInput({
  canvas, getGame,
  onPause: togglePause,
  onShopHotkey: (i) => shop.purchase(i),
  onToggleMute: () => { elMute.checked = !elMute.checked; applyAudioSettings(); },
  onToggleDev: () => {
    progress.settings.dev = dev.toggle();
    saveProgress(progress);
    if (dev.visible) dev.paint();

  },
});

/** 音量設定は1つしか無いので、今出ている画面へ差し替えて置く。 */
function moveOptionsTo(name) {
  const slot = screens[name]?.querySelector('.slot');
  if (slot) slot.appendChild($('options'));
}

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
  moveOptionsTo(name);
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
  // 航跡は旧スケールでの相対座標なので、寸法が変わったら引き継がず捨てる
  for (const p of G.pods) { p.trail.length = 0; p.trailT = 0; }
}
// HUDとショップの出し入れでも盤面の高さは変わるので、
// window の resize だけでなく要素そのものの寸法変化を見る。
new ResizeObserver(handleResize).observe($('stage'));
addEventListener('resize', handleResize);

function begin(stage) {
  G = null;              // 旧ランの座標を新しい寸法に引きずらせない
  showScreen(null);      // HUDとショップを出してから測る（出す前だと盤面が画面より高くなる）
  handleResize();
  G = newGame(stage, progress.meta);
  G.ship.x = view.W / 2;
  G.running = true;
  publish();
  input.reset();
  hud.invalidate();
  shop.invalidate();
  shop.paint(true);
  hud.paint(G);
}

function openSelect() {
  G = null;
  refreshSelect();
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

  const { updated, cores } = recordRun(progress, G.stage.id, cleared, G.st);
  G.cores = cores;
  if (cleared) sfx.clear(); else sfx.fail();
  renderResults(G, progress.best[G.stage.id], updated, cores, progress.meta.cores);

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

$('btn-reset').addEventListener('click', () => {
  if (!confirm('コア・恒久強化・クリア記録をすべて消します。よろしいですか？')) return;
  const settings = progress.settings;
  progress = resetProgress();
  progress.settings = settings;      // 音量設定は進行状況ではないので残す
  saveProgress(progress);
  refreshSelect();
});

handleResize();
openSelect();
requestAnimationFrame(frame);
