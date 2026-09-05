/**
 * 記録の保存。ラン間で残るのは、開放状況・自己ベスト・コア・恒久強化だけ。
 * コインとラン内強化は毎ランリセットされるので、ここには入らない。
 */
import { CONFIG } from '../config.js';
import { EMPTY_META_UP, metaCost } from '../meta.js';

const KEY = 'cym-shooting/progress/v3';
// ラン間で残るのはコアと恒久強化だけ。コインと ラン内強化 は毎ランリセットされる。
const EMPTY_META = { cores: 0, up: { ...EMPTY_META_UP } };
const EMPTY = { cleared: {}, best: {}, meta: EMPTY_META,
  settings: { muted: false, volume: 0.7, dev: false } };

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    const p = JSON.parse(raw);
    return {
      cleared: p.cleared ?? {},
      best: p.best ?? {},
      meta: { cores: p.meta?.cores ?? 0, up: { ...EMPTY_META_UP, ...p.meta?.up } },
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

export function resetProgress() {
  try { localStorage.removeItem(KEY); } catch { /* 消せなくても続行 */ }
  return structuredClone(EMPTY);
}

/**
 * ラン結果からコアを配る。クリアが本筋だが、失敗でも最低限は出す ―
 * 恒久側がまったく進まないと、詰まったときに手が無くなるため。
 * 戻り値は今回得たコア数。
 */
export function awardCores(progress, cleared, firstClear) {
  const { coreClear, coreFirstClear, coreFail } = CONFIG.meta;
  const gained = cleared ? coreClear + (firstClear ? coreFirstClear : 0) : coreFail;
  progress.meta.cores += gained;
  return gained;
}

export function buyMeta(progress, item) {
  const level = progress.meta.up[item.id];
  const cost = metaCost(item, level);
  if (cost === null || progress.meta.cores < cost) return false;
  progress.meta.cores -= cost;
  progress.meta.up[item.id] = level + 1;
  saveProgress(progress);
  return true;
}

/**
 * ラン結果を記録に反映する。{ updated: 更新項目名, cores: 今回得たコア } を返す。
 */
export function recordRun(progress, stageId, cleared, stats) {
  const updated = [];
  const firstClear = cleared && !progress.cleared[stageId];
  if (firstClear) {
    progress.cleared[stageId] = true;
    updated.push('clear');
  }
  const best = progress.best[stageId] ?? { earned: 0, kills: 0 };
  const kills = stats.ship + stats.pod;
  // 0 は「最高記録」として光らせない（初回に必ず光ってしまい意味が薄れるため）
  if (stats.earned > best.earned) { best.earned = stats.earned; updated.push('earned'); }
  if (kills > best.kills) { best.kills = kills; updated.push('kills'); }
  progress.best[stageId] = best;
  const cores = awardCores(progress, cleared, firstClear);
  saveProgress(progress);
  return { updated, cores };
}
