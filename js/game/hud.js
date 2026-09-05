const $ = (id) => document.getElementById(id);

export function createHud() {
  const elTime = $('hud-time');
  const elMoney = $('hud-money');
  const elBar = $('hud-breachbar');
  const elLabel = $('hud-breachlabel');
  const elStage = $('hud-stage');
  let last = '';

  return {
    paint(G) {
      const left = Math.max(0, G.rules.runSeconds - G.t);
      const mm = Math.floor(left / 60);
      const ss = Math.ceil(left % 60) % 60;
      const key = `${mm}:${ss}|${G.money | 0}|${G.breach}|${G.stage.id}`;
      if (key === last) return;
      last = key;

      elStage.textContent = `${G.stage.name}・${G.stage.title}`;
      elTime.textContent = `${mm}:${String(ss).padStart(2, '0')}`;
      elMoney.textContent = Math.floor(G.money);
      elBar.style.width = (G.breach / G.rules.maxBreach * 100) + '%';
      elLabel.textContent = `突破 ${G.breach} / ${G.rules.maxBreach}`;
    },
    invalidate() { last = ''; },
  };
}

/** リザルト。数値そのものより「手動と自動の比率」が見えることが目的（企画書 §9）。 */
export function renderResults(G, best, updated, cores) {
  const s = G.st;
  const total = s.ship + s.pod;
  const autoRate = total ? Math.round(s.pod / total * 100) : 0;
  const isNew = (k) => (updated.includes(k) ? ' <em class="new">最高</em>' : '');

  $('end-title').textContent = G.endReason;
  $('end-title').classList.toggle('failed', !G.cleared);
  $('end-stage').textContent = `${G.stage.name}・${G.stage.title}`;
  $('end-results').innerHTML = `
    <dt>撃破</dt><dd>${total}${isNew('kills')}</dd>
    <dt>自機 / ポッド</dt><dd>${s.ship} / ${s.pod}（自動 ${autoRate}%）</dd>
    <dt>装甲付き</dt><dd>${s.armored}</dd>
    <dt>ライン突破</dt><dd>${s.breach}</dd>
    <dt>総収入</dt><dd>${Math.floor(s.earned)}${isNew('earned')}</dd>
    <dt>自己ベスト</dt><dd>${Math.floor(best?.earned ?? 0)}</dd>
    <dt>コア獲得</dt><dd class="core">+${cores}</dd>`;
}
