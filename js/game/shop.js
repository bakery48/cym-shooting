import { CONFIG, INK, INK_NAME, COLOR } from '../config.js';
import { syncPods } from '../core/state.js';
import { sfx } from '../core/audio.js';

/**
 * ポッドは色ごとに何基でも増設できる（上限なし）。
 * 1基目が自動化の開始で、2基目以降は「終盤に金の使い道が尽きない」ための穴。
 * 使い道が尽きると、そこから先は撃つ手数が伸びず画面が寂しくなる。
 */
const podEntry = (id, ink) => ({
  id, ink, name: `${INK_NAME[ink]} ポッド`,
  lv: (G) => G.up[id],
  max: Infinity,
  cost: (G) => Math.round(CONFIG.costs.pod[{ [INK.C]: 'C', [INK.M]: 'M', [INK.Y]: 'Y' }[ink]]
    * Math.pow(CONFIG.costs.podMul, G.up[id])),
  buy: (G) => { G.up[id]++; syncPods(G); },
});

/**
 * ラン中に買える強化の定義。買ったものはランが終わると失われる ―
 * ここが毎ラン「全手動 → 自動化」の弧を作っている。
 * 企画書 §6 の原則により、ここに足せるのは「画面上の物が増える」強化だけ。
 */
export const SHOP = [
  podEntry('podM', INK.M),
  podEntry('podC', INK.C),
  podEntry('podY', INK.Y),

  { id: 'rate', name: '連射速度', lv: (G) => G.up.rate, max: CONFIG.costs.rate.max,
    cost: (G) => scaled(CONFIG.costs.rate, G.up.rate), buy: (G) => G.up.rate++ },
];

/** ショップの並び順に対応するキー。面ごとに並ぶ数は違うが、上限はこの本数。 */
export const SHOP_KEYS = SHOP.map((_, i) => String(i + 1)).join('');

const scaled = (c, lv) => Math.round(c.base * Math.pow(c.mul, lv));
const isDone = (u, G) => (u.owned ? u.owned(G) : u.lv(G) >= u.max);

export function createShop(rootEl, getGame) {
  const buttons = SHOP.map(() => {
    const b = document.createElement('button');
    b.className = 'buy';
    b.type = 'button';
    b.innerHTML = '<span class="k"></span><span class="n"><i class="sw"></i><span></span></span><span class="c"></span>';
    rootEl.appendChild(b);
    return b;
  });
  buttons.forEach((b, i) => b.addEventListener('click', () => purchase(i)));

  let key = '';

  /** 面ごとに買える強化が違う（撃てない色のポッドは並ばない）。 */
  const available = (G) => SHOP.filter((u) => G.rules.shop.includes(u.id));

  function purchase(index) {
    const G = getGame();
    if (!G || !G.running || G.paused) return false;
    const u = available(G)[index];
    if (!u || isDone(u, G)) return false;
    const cost = u.cost(G);
    if (G.money < cost) return false;
    G.money -= cost;
    u.buy(G);
    sfx.buy();
    paint(true);
    return true;
  }

  function paint(force) {
    const G = getGame();
    if (!G) return;
    const next = `${G.money | 0}|${JSON.stringify(G.up)}|${G.running}|${G.paused}|${G.stage.id}`;
    if (!force && next === key) return;
    key = next;

    const list = available(G);
    buttons.forEach((b, i) => {
      const u = list[i];
      b.hidden = !u;
      if (!u) return;
      const done = isDone(u, G);
      const cost = u.cost(G);
      const sw = b.querySelector('.sw');
      sw.hidden = !u.ink;
      if (u.ink) sw.style.background = COLOR[u.ink];
      b.querySelector('.k').textContent = i + 1;
      b.querySelector('.n span').textContent = u.name + (u.lv && !done ? ` Lv${u.lv(G) + 1}` : '');
      b.querySelector('.c').textContent = done ? (u.owned ? '稼働中' : 'MAX') : cost;
      b.classList.toggle('owned', done);
      b.classList.toggle('ready', !done && G.money >= cost);
      b.disabled = done || G.money < cost;
    });
  }

  return { paint, purchase, invalidate() { key = ''; } };
}
