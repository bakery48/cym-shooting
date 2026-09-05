import { CONFIG } from '../config.js';

const $ = (id) => document.getElementById(id);

export function createHud() {
  const elTime = $('hud-time');
  const elMoney = $('hud-money');
  const elBar = $('hud-breachbar');
  const elLabel = $('hud-breachlabel');
  let last = '';

  return {
    paint(G) {
      const left = Math.max(0, CONFIG.runSeconds - G.t);
      const mm = Math.floor(left / 60);
      const ss = Math.floor(left % 60);
      const key = `${mm}:${ss}|${G.money | 0}|${G.breach}`;
      if (key === last) return;
      last = key;

      elTime.textContent = `${mm}:${String(ss).padStart(2, '0')}`;
      elMoney.textContent = Math.floor(G.money);
      elBar.style.width = (G.breach / CONFIG.maxBreach * 100) + '%';
      elLabel.textContent = `突破 ${G.breach} / ${CONFIG.maxBreach}`;
    },
    invalidate() { last = ''; },
  };
}

/** リザルト。数値そのものより「手動と自動の比率」が見えることが目的（企画書 §9）。 */
export function renderResults(G) {
  const s = G.st;
  const total = s.ship + s.pod;
  const autoRate = total ? Math.round(s.pod / total * 100) : 0;
  $('end-title').textContent = G.endReason;
  $('end-results').innerHTML = `
    <dt>撃破</dt><dd>${total}</dd>
    <dt>自機 / ポッド</dt><dd>${s.ship} / ${s.pod}（自動 ${autoRate}%）</dd>
    <dt>装甲付き</dt><dd>${s.armored}</dd>
    <dt>ライン突破</dt><dd>${s.breach}</dd>
    <dt>総収入</dt><dd>${Math.floor(s.earned)}</dd>`;
}
