import { META } from './meta.js';
import { STAGES } from './stages.js';

/**
 * テストプレイ用の調整パネル。バッククォート（`）で開閉する。
 *
 * バランス調整のために、恒久側の状態を稼がずに作れるようにするもの。
 * コアを増やすだけだと「買う」方向にしか動けず、いったん買った恒久強化を
 * 外して試すのに記録の全消しが要るので、レベルも直接上下できるようにしてある。
 *
 * ゲーム側のロジックからは参照しない。出荷時にこの呼び出しを外せば消える。
 */
export function createDev(getProgress, onChange, onForceEnd) {
  const root = document.getElementById('dev');
  const runBar = document.getElementById('dev-run');

  const coresInput = document.createElement('input');
  coresInput.type = 'number';
  coresInput.min = '0';
  coresInput.id = 'dev-cores';
  coresInput.addEventListener('input', () => {
    const v = Math.max(0, Math.floor(Number(coresInput.value) || 0));
    getProgress().meta.cores = v;
    onChange();
  });

  const row = (label, ...controls) => {
    const el = document.createElement('div');
    el.className = 'dev-row';
    const h = document.createElement('span');
    h.className = 'dev-label';
    h.textContent = label;
    el.append(h, ...controls);
    return el;
  };

  const button = (text, fn, title) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    if (title) b.title = title;
    b.addEventListener('click', () => { fn(); onChange(); });
    return b;
  };

  const step = (id, delta) => () => {
    const item = META.find((m) => m.id === id);
    const up = getProgress().meta.up;
    up[id] = Math.max(0, Math.min(item.max, up[id] + delta));
  };

  const levelLabels = {};
  const metaRows = META.map((item) => {
    const lv = document.createElement('b');
    lv.className = 'dev-lv';
    levelLabels[item.id] = lv;
    return row(item.name, button('−', step(item.id, -1)), lv, button('＋', step(item.id, +1)),
      Object.assign(document.createElement('span'), { className: 'dev-max', textContent: `/ ${item.max}` }));
  });

  root.append(
    Object.assign(document.createElement('p'), {
      className: 'dev-head',
      textContent: 'テスト用。バランス確認のための調整で、遊びとは関係ない。'
        + ' ラン中は C でクリア、F で失敗にできる。',
    }),
    row('コア', button('−10', () => {
      const m = getProgress().meta; m.cores = Math.max(0, m.cores - 10);
    }), coresInput, button('＋10', () => { getProgress().meta.cores += 10; })),
    ...metaRows,
    row('区',
      button('すべて開放', () => {
        const c = getProgress().cleared;
        for (const s of STAGES) c[s.id] = true;
      }),
      button('開放を戻す', () => { getProgress().cleared = {}; })),
  );

  // ラン中のパネルは面選択の中に置けない（走行中は選択画面が隠れるため）。
  // 盤面の隅に小さく出し、テスト用パネルが開いているランのあいだだけ見せる。
  const runButton = (text, cleared, key) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `${text} <kbd>${key}</kbd>`;
    b.addEventListener('click', () => onForceEnd(cleared));
    runBar.appendChild(b);
    return b;
  };
  runButton('クリアにする', true, 'C');
  runButton('失敗にする', false, 'F');

  return {
    /** ラン中だけ強制終了のボタンを出す。 */
    setRunning(running) {
      runBar.hidden = !running || root.hidden;
    },
    paint() {
      const { meta } = getProgress();
      if (document.activeElement !== coresInput) coresInput.value = String(meta.cores);
      for (const item of META) {
        const lv = meta.up[item.id];
        levelLabels[item.id].textContent = lv;
        levelLabels[item.id].classList.toggle('on', lv > 0);
      }
    },
    toggle() {
      root.hidden = !root.hidden;
      if (root.hidden) runBar.hidden = true;
      return !root.hidden;
    },
    setVisible(v) { root.hidden = !v; if (!v) runBar.hidden = true; },
    get visible() { return !root.hidden; },
  };
}
