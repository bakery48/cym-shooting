import { CONFIG } from '../config.js';
import { view } from './view.js';
import { rotateTurret } from './state.js';
import { SHOP_KEYS } from '../game/shop.js';

/**
 * 入力は「移動」と「回転」の2つだけに正規化する。
 *
 *   移動: ドラッグ（絶対座標追従） / マウス追従 / A・D・←・→（速度移動）
 *   回転: タップ・クリック / Space・W・↑
 *
 * タッチは企画書 §3 のまま、キーボードとマウスはSteam（PC）向けの追加。
 * 回転が一方向であることは維持する ― 3種を直接指定する入力は足さない。
 */
const MOVE_LEFT  = new Set(['KeyA', 'ArrowLeft']);
const MOVE_RIGHT = new Set(['KeyD', 'ArrowRight']);
const ROTATE     = new Set(['Space', 'KeyW', 'ArrowUp']);
const PAUSE      = new Set(['Escape', 'KeyP']);
const MUTE       = new Set(['KeyM']);
const DEV        = new Set(['Backquote']);   // テスト用パネルの開閉
// テスト用の強制終了。パネルを開いているときだけ効く（誤爆防止）
const FORCE_CLEAR = new Set(['KeyC']);
const FORCE_FAIL  = new Set(['KeyF']);

export function createInput({ canvas, getGame, onPause, onShopHotkey, onToggleMute, onToggleDev,
                              onForceEnd }) {
  const keys = new Set();
  const state = {
    pointerX: null,   // ポインタで指定された絶対X（null なら未指定）
    axis: 0,          // -1 / 0 / +1
    dragging: false,
    moved: 0,
    lastX: 0,
  };

  const localX = (e) => e.clientX - canvas.getBoundingClientRect().left;
  const live = () => {
    const G = getGame();
    return G && G.running && !G.paused;
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (!live()) return;
    canvas.setPointerCapture(e.pointerId);
    state.dragging = true;
    state.moved = 0;
    state.lastX = localX(e);
    // マウスは押した時点では動かさない（クリック＝回転を潰さないため）
    if (e.pointerType !== 'mouse') state.pointerX = state.lastX;
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!live()) return;
    const x = localX(e);
    if (state.dragging) {
      state.moved += Math.abs(x - state.lastX);
      state.pointerX = x;
    } else if (e.pointerType === 'mouse') {
      // マウスは押していなくてもカーソルに追従させる（PCでの自然な操作）
      state.pointerX = x;
    }
    state.lastX = x;
  });

  const endPointer = () => {
    if (!state.dragging) return;
    state.dragging = false;
    if (state.moved < CONFIG.tapThreshold && live()) rotateTurret(getGame());
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !state.dragging) state.pointerX = null;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  addEventListener('keydown', (e) => {
    if (e.repeat) {
      // 押しっぱなしでの連続回転は認めない（回転コストが消えるため）
      if (ROTATE.has(e.code)) e.preventDefault();
      return;
    }
    if (PAUSE.has(e.code)) { e.preventDefault(); onPause(); return; }
    if (MUTE.has(e.code)) { e.preventDefault(); onToggleMute(); return; }
    if (DEV.has(e.code)) { e.preventDefault(); onToggleDev(); return; }
    if (FORCE_CLEAR.has(e.code)) { e.preventDefault(); onForceEnd(true); return; }
    if (FORCE_FAIL.has(e.code)) { e.preventDefault(); onForceEnd(false); return; }

    const shopIndex = SHOP_KEYS.indexOf(e.key);
    if (shopIndex >= 0) { e.preventDefault(); onShopHotkey(shopIndex); return; }

    if (ROTATE.has(e.code)) {
      e.preventDefault();
      if (live()) rotateTurret(getGame());
      return;
    }
    if (MOVE_LEFT.has(e.code) || MOVE_RIGHT.has(e.code)) { e.preventDefault(); keys.add(e.code); }
  });

  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); state.dragging = false; });

  return {
    /** 自機のX座標を入力から更新する。ポインタ指定があればそちらを優先。 */
    applyMovement(G, dt) {
      let left = 0;
      for (const c of keys) {
        if (MOVE_LEFT.has(c)) left -= 1;
        if (MOVE_RIGHT.has(c)) left += 1;
      }
      state.axis = Math.sign(left);

      if (state.axis !== 0) {
        G.ship.x += state.axis * CONFIG.ship.keyboardSpeed * view.S * dt;
        state.pointerX = null;   // キー操作を始めたらマウス追従を解除
      } else if (state.pointerX !== null) {
        G.ship.x = state.pointerX;
      }
      const m = CONFIG.ship.edgeMargin;
      G.ship.x = Math.max(m, Math.min(view.W - m, G.ship.x));
    },
    reset() {
      keys.clear();
      state.pointerX = null;
      state.dragging = false;
    },
  };
}
