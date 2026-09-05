import { CONFIG } from '../config.js';
import { syncPods } from '../core/state.js';
import { sfx } from '../core/audio.js';

/**
 * ラン中に買える強化の定義。
 * 企画書 §6 の原則により、ここに足せるのは「画面上の物が増える」強化だけ。
 */
export const SHOP = [
  { id: 'podCircle', name: '● ポッド', cost: () => CONFIG.costs.podCircle,
    owned: (G) => G.up.podCircle, buy: (G) => { G.up.podCircle = true; syncPods(G); } },
  { id: 'podTri', name: '▲ ポッド', cost: () => CONFIG.costs.podTri,
    owned: (G) => G.up.podTri, buy: (G) => { G.up.podTri = true; syncPods(G); } },
  { id: 'podSq', name: '■ ポッド', cost: () => CONFIG.costs.podSq,
    owned: (G) => G.up.podSq, buy: (G) => { G.up.podSq = true; syncPods(G); } },

  { id: 'rate', name: '連射速度', lv: (G) => G.up.rate, max: CONFIG.costs.rate.max,
    cost: (G) => scaled(CONFIG.costs.rate, G.up.rate), buy: (G) => G.up.rate++ },
  { id: 'pierce', name: '貫通弾', lv: (G) => G.up.pierce, max: CONFIG.costs.pierce.max,
    cost: (G) => scaled(CONFIG.costs.pierce, G.up.pierce), buy: (G) => G.up.pierce++ },
  { id: 'spread', name: '拡散弾', lv: (G) => G.up.spread, max: CONFIG.costs.spread.max,
    cost: (G) => scaled(CONFIG.costs.spread, G.up.spread), buy: (G) => G.up.spread++ },
];

const scaled = (c, lv) => Math.round(c.base * Math.pow(c.mul, lv));
const isDone = (u, G) => (u.owned ? u.owned(G) : u.lv(G) >= u.max);

export function createShop(rootEl, getGame) {
  const buttons = SHOP.map((u, i) => {
    const b = document.createElement('button');
    b.className = 'buy';
    b.type = 'button';
    b.innerHTML = '<span class="k"></span><span class="n"></span><span class="c"></span>';
    b.addEventListener('click', () => purchase(i));
    rootEl.appendChild(b);
    return b;
  });

  let key = '';

  /** 面ごとに買える強化が違う（モードの性格はここで作る）。 */
  const available = (G) => SHOP.filter((u) => G.rules.shop.includes(u.id));

  function purchase(index) {
    const G = getGame();
    const u = available(G)[index];
    if (!G || !G.running || G.paused || !u || isDone(u, G)) return false;
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
      b.querySelector('.k').textContent = i + 1;
      b.querySelector('.n').textContent = u.name + (u.lv && !done ? ` Lv${u.lv(G) + 1}` : '');
      b.querySelector('.c').textContent = done ? (u.owned ? '稼働中' : 'MAX') : cost;
      b.classList.toggle('owned', done);
      b.classList.toggle('ready', !done && G.money >= cost);
      b.disabled = done || G.money < cost;
    });
  }

  return { paint, purchase, invalidate() { key = ''; } };
}
