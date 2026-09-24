import { icon, toast } from './components.js';
import { store } from './store.js';
import { setActiveView, recordView, ledgerView, statsView, meView, gotoMonth, backupFile } from './views.js';

const TABS = [
  { id: 'record', name: '记账', icon: 'pencil', view: recordView },
  { id: 'ledger', name: '明细', icon: 'list',   view: ledgerView },
  { id: 'stats',  name: '统计', icon: 'chart',  view: statsView },
  { id: 'me',     name: '我的', icon: 'user',   view: meView },
];

const main = document.getElementById('main');
const tabbar = document.getElementById('tabbar');

let current = TABS[0];
let bubbleAnimation = null;
let bubbleRippleTimer = 0;
let highlightAnimation = null;
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function mountTabs() {
  tabbar.setAttribute('role', 'tablist');
  tabbar.innerHTML = `
    <span class="water-bubble" aria-hidden="true">
      <i class="bubble-tail"></i>
      <i class="bubble-ripple"></i>
      <i class="bubble-glow"></i>
      <i class="bubble-highlight"></i>
      <i class="bubble-shine"></i>
    </span>` + TABS.map((t) => `
    <button class="tab" type="button" role="tab" data-tab="${t.id}"
            aria-selected="${current.id === t.id}" aria-controls="main">
      ${icon(t.icon, 23)}
      <span>${t.name}</span>
    </button>`).join('');
}

function bubbleTarget(tab) {
  const bubble = tabbar.querySelector('.water-bubble');
  if (!tab || !bubble) return null;
  const barRect = tabbar.getBoundingClientRect();
  const rect = tab.getBoundingClientRect();
  return {
    x: rect.left - barRect.left - tabbar.clientLeft,
    y: rect.top - barRect.top - tabbar.clientTop,
    width: rect.width,
    height: rect.height
  };
}

function updateTabs({ animate = false, previousTab = null } = {}) {
  const active = tabbar.querySelector('.tab[aria-selected="true"]');
  tabbar.querySelectorAll('.tab').forEach((tab) => {
    tab.setAttribute('aria-selected', String(tab.dataset.tab === current.id));
  });
  const nextActive = tabbar.querySelector('.tab[aria-selected="true"]');
  positionBubble(nextActive, { animate, previousTab });
  if (animate && active !== nextActive) animateActiveIcon();
}

function positionBubble(active, { hoverTarget = null, animate = false, previousTab = null } = {}) {
  const bubble = tabbar.querySelector('.water-bubble');
  if (!active || !bubble) return;
  const target = bubbleTarget(active);
  if (!target) return;
  bubble.style.width = `${target.width}px`;
  bubble.style.height = `${target.height}px`;
  let { x, y } = target;

  if (hoverTarget && hoverTarget !== active && !prefersReducedMotion()) {
    const hovered = bubbleTarget(hoverTarget);
    if (hovered) {
      const pull = Math.max(-6, Math.min(6, (hovered.x - x) * .12));
      x += pull;
      y += (hovered.y - y) * .06;
    }
  }

  const targetTransform = `translate3d(${x}px, ${y}px, 0)`;
  if (animate && previousTab?.isConnected && !prefersReducedMotion() && typeof bubble.animate === 'function') {
    const barRect = tabbar.getBoundingClientRect();
    const currentRect = bubble.getBoundingClientRect();
    const fromX = currentRect.left + currentRect.width / 2 - barRect.left - tabbar.clientLeft - bubble.offsetWidth / 2;
    const fromY = currentRect.top + currentRect.height / 2 - barRect.top - tabbar.clientTop - bubble.offsetHeight / 2;
    const midX = (fromX + x) / 2;
    const midY = (fromY + y) / 2;
    const distance = Math.hypot(x - fromX, y - fromY);

    bubble.style.transition = 'none';
    bubble.style.transform = targetTransform;
    bubble.style.setProperty('--move-x', `${x - fromX}px`);
    bubble.style.setProperty('--move-y', `${y - fromY}px`);
    bubbleAnimation?.cancel();
    bubble.classList.add('is-moving');
    bubbleAnimation = bubble.animate(
      [
        { transform: `translate3d(${fromX}px, ${fromY}px, 0) scale(1, 1)` },
        { transform: `translate3d(${midX}px, ${midY}px, 0) scale(1.18, .84)` },
        { transform: `translate3d(${x}px, ${y}px, 0) scale(.9, 1.08)`, offset: .74 },
        { transform: `${targetTransform} scale(1, 1)` }
      ],
      {
        duration: Math.min(640, Math.max(420, 420 + distance * .18)),
        easing: 'cubic-bezier(.34, 1.56, .64, 1)'
      }
    );
    bubbleAnimation.onfinish = () => {
      bubble.style.transition = '';
      bubble.classList.remove('is-moving');
      bubbleAnimation = null;
      triggerBubbleRipple();
    };
  } else {
    bubble.style.transform = targetTransform;
  }
}

function animateActiveIcon() {
  const active = tabbar.querySelector('.tab[aria-selected="true"]');
  const icon = active?.querySelector('svg');
  if (!icon) return;

  if (icon && typeof icon.animate === 'function') {
    icon.style.transition = 'none';
    const iconAnimation = icon.animate(
      [
        { transform: 'translateY(3px) scale(.9)' },
        { transform: 'translateY(-4px) scale(1.14)', offset: .52 },
        { transform: 'translateY(-1px) scale(1.03)', offset: .78 },
        { transform: 'translateY(-2px) scale(1.08)' }
      ],
      { duration: 520, easing: 'cubic-bezier(.34, 1.56, .64, 1)' }
    );
    iconAnimation.onfinish = () => { icon.style.transition = ''; };
  } else if (icon) {
    icon.style.transition = 'none';
    icon.classList.add('is-bounce');
    setTimeout(() => {
      icon.classList.remove('is-bounce');
      icon.style.transition = '';
    }, 520);
  }
}

function wobbleBubble() {
  const bubble = tabbar.querySelector('.water-bubble');
  if (!bubble || prefersReducedMotion()) return;
  const base = bubble.style.transform || getComputedStyle(bubble).transform;
  bubble.style.transition = 'none';
  bubbleAnimation?.cancel();
  bubbleAnimation = bubble.animate(
    [
      { transform: `${base} scale(1, 1)` },
      { transform: `${base} translateX(-4px) scale(1.08, .92)` },
      { transform: `${base} translateX(4px) scale(.94, 1.06)` },
      { transform: `${base} translateX(-2px) scale(1.03, .97)` },
      { transform: `${base} scale(1, 1)` }
    ],
    { duration: 300, easing: 'cubic-bezier(.34, 1.56, .64, 1)' }
  );
  bubbleAnimation.onfinish = () => {
    bubble.style.transition = '';
    bubbleAnimation = null;
  };
}

function animateHighlightReflection(event, tab) {
  if (!tab || prefersReducedMotion()) return;
  const bubble = tabbar.querySelector('.water-bubble');
  const highlight = bubble?.querySelector('.bubble-highlight');
  const shine = bubble?.querySelector('.bubble-shine');
  if (!highlight || !shine || typeof highlight.animate !== 'function') return;

  const rect = tab.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const offsetX = (event.clientX || centerX) - centerX;
  const offsetY = (event.clientY || centerY) - centerY;
  const highlightX = Math.max(-8, Math.min(8, -offsetX * .36));
  const highlightY = Math.max(-3, Math.min(3, -offsetY * .18));
  const shineX = Math.max(-5, Math.min(5, -offsetX * .24));
  const shineY = Math.max(-2, Math.min(2, -offsetY * .12));
  const distance = Math.hypot(offsetX, offsetY);
  const duration = Math.min(420, 240 + distance * .32);
  const easing = 'cubic-bezier(.34, 1.56, .64, 1)';

  const animateLayer = (layer, x, y) => {
    let current = new DOMMatrix(getComputedStyle(layer).transform);
    return layer.animate(
      [
        { transform: current.toString() },
        { transform: `translate(${x * 1.28}px, ${y * 1.28}px)`, offset: .68 },
        { transform: `translate(${x * .92}px, ${y * .92}px)`, offset: .86 },
        { transform: `translate(${x}px, ${y}px)` }
      ],
      { duration, easing, fill: 'forwards' }
    );
  };

  highlightAnimation?.cancel();
  highlightAnimation = animateLayer(highlight, highlightX, highlightY);
  const shineAnimation = animateLayer(shine, shineX, shineY);
  highlightAnimation.onfinish = () => {
    highlight.style.transform = `translate(${highlightX}px, ${highlightY}px)`;
    shine.style.transform = `translate(${shineX}px, ${shineY}px)`;
    shineAnimation.cancel();
    highlightAnimation.cancel();
    highlightAnimation = null;
  };
}
function triggerBubbleRipple() {
  const bubble = tabbar.querySelector('.water-bubble');
  if (!bubble || prefersReducedMotion()) return;
  bubble.classList.remove('is-rippling');
  void bubble.offsetWidth;
  bubble.classList.add('is-rippling');
  clearTimeout(bubbleRippleTimer);
  bubbleRippleTimer = setTimeout(() => bubble.classList.remove('is-rippling'), 600);
}

function render({ animate = false, previousTab = null } = {}) {
  setActiveView(current.view);
  main.classList.toggle('is-record', current.id === 'record');
  main.innerHTML = current.view.html();
  current.view.mount(main);
  updateTabs({ animate, previousTab });
  window.scrollTo(0, 0);
}

tabbar.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]');
  const id = tab?.dataset.tab;
  if (!id) return;
  if (id === current.id) {
    animateHighlightReflection(e, tab);
    wobbleBubble();
    if (navigator.vibrate) navigator.vibrate(4);
    return;
  }
  animateHighlightReflection(e, tab);
  const previousTab = tabbar.querySelector('.tab[aria-selected="true"]');
  current = TABS.find((t) => t.id === id);
  render({ animate: true, previousTab });
  if (navigator.vibrate) navigator.vibrate(4);
});

if (window.matchMedia('(hover: hover)').matches) {
  tabbar.addEventListener('pointerover', (e) => {
    const hovered = e.target.closest('.tab');
    if (hovered) positionBubble(tabbar.querySelector('.tab[aria-selected="true"]'), { hoverTarget: hovered });
  });
  tabbar.addEventListener('pointerleave', () => {
    positionBubble(tabbar.querySelector('.tab[aria-selected="true"]'));
  });
}

// 别的地方（比如明细页的「＋补记」、预算条上的餐次点）可以请求切到记账页
document.addEventListener('app:tab', (e) => {
  const next = TABS.find((t) => t.id === e.detail?.id);
  if (!next) return;
  const previousTab = tabbar.querySelector('.tab[aria-selected="true"]');
  current = next;
  render({ animate: true, previousTab });
});

// 月份切换（明细 / 统计页共用）
document.addEventListener('click', (e) => {
  const delta = e.target.closest('[data-month]')?.dataset.month;
  if (!delta) return;
  gotoMonth(Number(delta));
  setActiveView(current.view);
  const y = window.scrollY;
  main.innerHTML = current.view.html();
  current.view.mount(main);
  window.scrollTo(0, y);
});

// 物理键盘：在记账页也能直接敲数字
document.addEventListener('keydown', (e) => {
  if (current.id !== 'record') return;
  if (e.target.matches('input, textarea')) return;
  const visible = document.querySelector('.keypad');
  if (!visible) return;

  if (/^[0-9.]$/.test(e.key)) {
    visible.querySelector(`[data-key="${e.key}"]`)?.click();
    e.preventDefault();
  } else if (e.key === 'Backspace') {
    visible.querySelector('[data-key="back"]')?.click();
    e.preventDefault();
  } else if (e.key === 'Enter') {
    visible.querySelector('[data-save]')?.click();
    e.preventDefault();
  }
});

mountTabs();
render();
window.addEventListener('resize', () => positionBubble(tabbar.querySelector('.tab[aria-selected="true"]')));

// 离线不是错误：账本仍可使用，但要把状态说清楚。
function syncOnlineState(showToast = false) {
  const online = navigator.onLine;
  document.documentElement.dataset.online = String(online);
  if (showToast) toast(online ? '网络已恢复' : '当前离线，仍可继续记账');
}
window.addEventListener('online', () => syncOnlineState(true));
window.addEventListener('offline', () => syncOnlineState(true));
syncOnlineState(false);

// 便于排障和自动化测试：控制台里可以直接查看账本
window.__store = store;

// 申请长期保留存储：降低被系统回收的概率
store.requestPersistence().then((result) => {
  console.info('存储保护状态：', result);
});

// 界面崩了也不能让数据被困住：给一个能导出备份的兜底面板
function showFatal(detail) {
  if (document.getElementById('fatal')) return;
  const el = document.createElement('div');
  el.id = 'fatal';
  el.className = 'fatal';
  el.setAttribute('role', 'alertdialog');
  el.innerHTML = `
    <h2>界面出错了</h2>
    <p>账本数据还在你这台设备上，没有丢。建议先导出备份，再重新加载。</p>
    <pre></pre>
    <div style="display:grid;gap:8px">
      <button class="btn" type="button" id="fatal-save">导出备份</button>
      <button class="btn btn--ghost" type="button" id="fatal-reload">重新加载</button>
    </div>`;
  el.querySelector('pre').textContent = String(detail || '').slice(0, 220);
  document.body.append(el);
  el.querySelector('#fatal-save').addEventListener('click', () => {
    try { backupFile(); } catch { toast('导出失败'); }
  });
  el.querySelector('#fatal-reload').addEventListener('click', () => location.reload());
}

window.addEventListener('error', (e) => showFatal(e.message || e.error));
window.addEventListener('unhandledrejection', (e) => showFatal(e.reason?.message || e.reason));

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // 首次安装也会触发，只有「本来就有旧版本」才提示更新
    if (hadController) toast('已更新到新版本');
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('sw.js', { updateViaCache: 'none' })
      .then(async (registration) => {
        await registration.update();
      })
      .catch((err) => console.warn('离线缓存未启用', err));
  });
}
