import { STAGES, isUnlocked, resolveRules } from '../stages.js';

const $ = (id) => document.getElementById(id);
const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/**
 * 面選択。開いているのは「遊べる面」だけで、自機の性能は面をまたがない。
 * 表示するのはクリア状況と自己ベストのみ。
 */
export function createSelect(getProgress, onPick) {
  const listEl = $('select-list');

  function paint() {
    const progress = getProgress();
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
          <span class="meta">${unlocked ? fmtTime(rules.runSeconds) : '未開放'}</span>
        </span>
        <span class="ds">${unlocked ? stage.desc : '前の区をクリアすると開く'}</span>
        <span class="bs">${best ? `ベスト ${Math.floor(best.earned)}` : ''}${cleared ? ' ・ クリア済' : ''}</span>`;
      b.addEventListener('click', () => onPick(stage));
      listEl.appendChild(b);
    }
  }

  return { paint };
}
