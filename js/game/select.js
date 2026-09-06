import { STAGES, isUnlocked, resolveRules } from '../stages.js';
import { META, metaCost } from '../meta.js';
import { INK, INK_NAME, INK_COUNT } from '../config.js';
import { drawEnemyMark } from './render.js';

const $ = (id) => document.getElementById(id);

/**
 * インクの凡例。混色は言葉より現物のほうが早いので、
 * 盤面と同じ描画関数で実物を並べる。
 */
function paintLegend() {
  const root = $('ink-legend');
  if (!root || root.childElementCount) return;

  const label = (inks) => {
    const names = [INK.C, INK.M, INK.Y].filter((i) => inks & i).map((i) => INK_NAME[i][0]);
    return names.length ? names.join('+') : '素地';
  };

  for (const inks of [0, INK.M, INK.C, INK.Y, INK.C | INK.M, INK.C | INK.Y, INK.M | INK.Y, 7]) {
    const cell = document.createElement('div');
    cell.className = 'ink-cell';

    const cv = document.createElement('canvas');
    const size = 34, dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = cv.height = size * dpr;
    cv.style.width = cv.style.height = size + 'px';
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawEnemyMark(ctx, size / 2, size / 2, size * 0.38, inks, 0.3);

    const cap = document.createElement('span');
    cap.textContent = `${label(inks)}・${INK_COUNT[inks] || 1}発`;
    cell.append(cv, cap);
    root.appendChild(cell);
  }
}
const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/**
 * 面選択。開いているのは「遊べる面」だけで、自機の性能は面をまたがない。
 * 表示するのはクリア状況と自己ベストのみ。
 */
export function createSelect(getProgress, onPick, onBuyMeta) {
  const listEl = $('select-list');
  const metaEl = $('meta-list');

  // 恒久強化はラン外で買う。ラン内のショップとは通貨も置き場も分ける。
  const metaButtons = META.map((item) => {
    const b = document.createElement('button');
    b.className = 'meta';
    b.type = 'button';
    b.innerHTML = '<span class="row"><span class="nm"></span><span class="c"></span></span><span class="ds"></span>';
    b.querySelector('.ds').textContent = item.desc;
    b.addEventListener('click', () => { if (onBuyMeta(item)) paint(); });
    metaEl.appendChild(b);
    return b;
  });

  function paintMeta(meta) {
    $('meta-cores').textContent = meta.cores;
    META.forEach((item, i) => {
      const b = metaButtons[i];
      const lv = meta.up[item.id];
      const cost = metaCost(item, lv);
      b.querySelector('.nm').textContent = `${item.name}${lv ? ` Lv${lv}` : ''}`;
      b.querySelector('.c').textContent = cost === null ? 'MAX' : `${cost} コア`;
      b.classList.toggle('owned', lv > 0);
      b.classList.toggle('ready', cost !== null && meta.cores >= cost);
      b.disabled = cost === null || meta.cores < cost;
    });
  }

  function paint() {
    const progress = getProgress();
    paintLegend();
    paintMeta(progress.meta);
    listEl.innerHTML = '';
    let lastKind = null;

    for (const stage of STAGES) {
      if (stage.kind !== lastKind) {
        lastKind = stage.kind;
        const h = document.createElement('h2');
        h.className = 'group';
        h.textContent = stage.kind === 'stage' ? '区' : 'モード';
        listEl.appendChild(h);
      }

      const unlocked = isUnlocked(stage, progress.cleared);
      const cleared = !!progress.cleared[stage.id];
      const best = progress.best[stage.id];
      const rules = resolveRules(stage);

      const b = document.createElement('button');
      b.className = 'stage';
      b.type = 'button';
      b.disabled = !unlocked;
      b.classList.toggle('cleared', cleared);
      b.innerHTML = `
        <span class="row">
          <span class="nm">${stage.name}<span class="ti">${stage.title}</span></span>
          <span class="meta">${unlocked ? `${rules.inks.length}色 ・ ${fmtTime(rules.runSeconds)}` : '未開放'}</span>
        </span>
        <span class="ds">${unlocked ? stage.desc : '前の区をクリアすると開く'}</span>
        <span class="bs">${[best?.earned ? `ベスト ${Math.floor(best.earned)}` : '', cleared ? 'クリア済' : ''].filter(Boolean).join(' ・ ')}</span>`;
      b.addEventListener('click', () => onPick(stage));
      listEl.appendChild(b);
    }
  }

  return { paint };
}


