import { CONFIG } from '../config.js';

const $ = (id) => document.getElementById(id);

/**
 * このランをクリアしたら得られるコア。初クリアなら加算ぶんも含む。
 * ラン終了時にしか入らないので、いつ・いくら入るのかを走行中から見せておく。
 */
export function pendingCores(stage, cleared) {
  const first = !cleared[stage.id];
  return CONFIG.meta.coreClear + (first ? CONFIG.meta.coreFirstClear : 0);
}

export function createHud(getCleared) {
  const elTime = $('hud-time');
  const elMoney = $('hud-money');
  const elBar = $('hud-breachbar');
  const elLabel = $('hud-breachlabel');
  const elStage = $('hud-stage');
  const elCore = $('hud-core');
  let last = '';

  return {
    paint(G) {
      const left = Math.max(0, G.rules.runSeconds - G.t);
      const mm = Math.floor(left / 60);
      const ss = Math.ceil(left % 60) % 60;
      const gain = pendingCores(G.stage, getCleared());
      const key = `${mm}:${ss}|${G.money | 0}|${G.breach}|${G.stage.id}|${gain}`;
      if (key === last) return;
      last = key;

      elStage.textContent = `${G.stage.name} ${G.stage.title}`;
      elTime.textContent = `${mm}:${String(ss).padStart(2, '0')}`;
      elMoney.textContent = Math.floor(G.money);
      elBar.style.width = (G.breach / G.rules.maxBreach * 100) + '%';
      elLabel.textContent = `突破 ${G.breach} / ${G.rules.maxBreach}`;
      elCore.textContent = `+${gain}`;
    },
    invalidate() { last = ''; },
  };
}

/** リザルト。数値そのものより「手動と自動の比率」が見えることが目的（企画書 §9）。 */
export function renderResults(G, best, updated, cores, totalCores) {
  const s = G.st;
  const total = s.ship + s.pod;
  const autoRate = total ? Math.round(s.pod / total * 100) : 0;
  const isNew = (k) => (updated.includes(k) ? ' <em class="new">最高</em>' : '');

  $('end-title').textContent = G.endReason;
  $('end-title').classList.toggle('failed', !G.cleared);
  $('end-stage').textContent = `${G.stage.name} ${G.stage.title}`;

  // コアはここでしか入らないので、統計に埋もれさせず単独で見せる
  $('end-core-gain').textContent = `コア +${cores}`;
  $('end-core-note').textContent = updated.includes('clear')
    ? `初クリア +${CONFIG.meta.coreFirstClear} を含む　→　所持 ${totalCores}`
    : G.cleared ? `クリア報酬　→　所持 ${totalCores}` : `失敗でも入る　→　所持 ${totalCores}`;
  $('end-core').classList.toggle('failed', !G.cleared);

  $('end-results').innerHTML = `
    <dt>撃破</dt><dd>${total}${isNew('kills')}</dd>
    <dt>自機 / ポッド</dt><dd>${s.ship} / ${s.pod}（自動 ${autoRate}%）</dd>
    <dt>装甲付き</dt><dd>${s.armored}</dd>
    <dt>ライン突破</dt><dd>${s.breach}</dd>
    <dt>総収入</dt><dd>${Math.floor(s.earned)}${isNew('earned')}</dd>
    <dt>自己ベスト</dt><dd>${Math.floor(best?.earned ?? 0)}</dd>`;
}
