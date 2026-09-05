/**
 * 記録の保存。保存するのは「どこまで開いたか」と「自己ベスト」だけで、
 * 自機を強くする値は保存しない（ラン間の永続強化は入れない方針）。
 */
const KEY = 'cym-shooting/progress/v1';
const EMPTY = { cleared: {}, best: {}, settings: { muted: false, volume: 0.7 } };

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    const p = JSON.parse(raw);
    return {
      cleared: p.cleared ?? {},
      best: p.best ?? {},
      settings: { ...EMPTY.settings, ...p.settings },
    };
  } catch {
    return structuredClone(EMPTY);   // 壊れていても遊べなくならないようにする
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    /* プライベートモード等で保存できなくても、ランそのものは続行させる */
  }
}

/**
 * ラン結果を記録に反映する。更新があった項目名の一覧を返す。
 */
export function recordRun(progress, stageId, cleared, stats) {
  const updated = [];
  if (cleared && !progress.cleared[stageId]) {
    progress.cleared[stageId] = true;
    updated.push('clear');
  }
  const best = progress.best[stageId] ?? { earned: 0, kills: 0 };
  const kills = stats.ship + stats.pod;
  // 0 は「最高記録」として光らせない（初回に必ず光ってしまい意味が薄れるため）
  if (stats.earned > best.earned) { best.earned = stats.earned; updated.push('earned'); }
  if (kills > best.kills) { best.kills = kills; updated.push('kills'); }
  progress.best[stageId] = best;
  saveProgress(progress);
  return updated;
}
