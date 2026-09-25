import { icon, toast } from './components.js';
import { store } from './store.js';
import { scheduleQueueSync, registerBackgroundSync } from './sync-queue.js';
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
let suppressTabClick = false;

function mountTabs() {
  tabbar.setAttribute('role', 'tablist');
  tabbar.innerHTML = `<span class="tab-indicator" aria-hidden="true"></span>` + TABS.map((t) => `
    <button class="tab" type="button" role="tab" data-tab="${t.id}"
            aria-selected="${current.id === t.id}" aria-controls="main">
      ${icon(t.icon, 23)}
      <span>${t.name}</span>
    </button>`).join('');
}

function syncTabIndicator() {
  const active = tabbar.querySelector('.tab[aria-selected="true"]');
  const indicator = tabbar.querySelector('.tab-indicator');
  if (!active || !indicator) return;
  const barRect = tabbar.getBoundingClientRect();
  const rect = active.getBoundingClientRect();
  const x = rect.left - barRect.left - tabbar.clientLeft;
  const y = rect.top - barRect.top - tabbar.clientTop;
  indicator.style.width = `${rect.width}px`;
  indicator.style.height = `${rect.height}px`;
  indicator.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

function updateTabs({ animate = false, previousTab = null, fromPoint = null } = {}) {
  const indicator = tabbar.querySelector('.tab-indicator');
  const fromTab = animate && !fromPoint ? previousTab : null;
  const fromRect = fromTab?.isConnected ? fromTab.getBoundingClientRect() : null;
  const fromBarRect = fromTab?.isConnected ? tabbar.getBoundingClientRect() : null;
  tabbar.querySelectorAll('.tab').forEach((tab) => {
    tab.setAttribute('aria-selected', String(tab.dataset.tab === current.id));
  });
  const active = tabbar.querySelector('.tab[aria-selected="true"]');
  if (!active || !indicator) return;
  const barRect = tabbar.getBoundingClientRect();
  const rect = active.getBoundingClientRect();
  const x = rect.left - barRect.left - tabbar.clientLeft;
  const y = rect.top - barRect.top - tabbar.clientTop;

  indicator.style.width = `${rect.width}px`;
  indicator.style.height = `${rect.height}px`;

  if (animate && (fromRect || fromPoint)) {
    const fromX = fromPoint
      ? fromPoint.x
      : fromRect.left - fromBarRect.left - tabbar.clientLeft;
    const fromY = fromPoint
      ? fromPoint.y
      : fromRect.top - fromBarRect.top - tabbar.clientTop;
    if (typeof indicator.animate === 'function') {
      indicator.getAnimations?.().forEach((animation) => animation.cancel());
      indicator.animate(
        [
          { transform: `translate3d(${fromX}px, ${fromY}px, 0)` },
          { transform: `translate3d(${x}px, ${y}px, 0)` }
        ],
        { duration: 520, easing: 'cubic-bezier(.34, 1.56, .64, 1)' }
      );
      indicator.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    } else {
      indicator.style.transition = 'none';
      indicator.style.transform = `translate3d(${fromX}px, ${fromY}px, 0)`;
      void indicator.getBoundingClientRect();
      indicator.style.transition = '';
      requestAnimationFrame(() => {
        indicator.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
    }
  } else {
    indicator.style.transition = 'none';
    indicator.style.transition = '';
    indicator.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  const icon = active.querySelector('svg');
  if (icon && animate) {
    icon.classList.remove('is-bounce');
    void icon.getBoundingClientRect();
    icon.classList.add('is-bounce');
    clearTimeout(icon.__bounceTimer);
    icon.__bounceTimer = setTimeout(() => {
      icon.classList.remove('is-bounce');
    }, 520);
  }
}

function render({ animate = false, previousTab = null, fromPoint = null } = {}) {
  const apply = () => {
    setActiveView(current.view);
    main.classList.toggle('is-record', current.id === 'record');
    main.innerHTML = current.view.html();
    current.view.mount(main);
    updateTabs({ animate, previousTab, fromPoint });
    window.scrollTo(0, 0);
  };
  apply();
}

tabbar.addEventListener('click', (e) => {
  if (suppressTabClick) {
    suppressTabClick = false;
    return;
  }
  const id = e.target.closest('[data-tab]')?.dataset.tab;
  if (!id || id === current.id) return;
  const previousTab = tabbar.querySelector('.tab[aria-selected="true"]');
  current = TABS.find((t) => t.id === id);
  render({ animate: true, previousTab });
  if (navigator.vibrate) navigator.vibrate(4);
});

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
  const y = window.scrollY;
  const apply = () => {
    setActiveView(current.view);
    main.innerHTML = current.view.html();
    current.view.mount(main);
    window.scrollTo(0, y);
  };
  apply();
});

let tabDrag = null;

function getTabDragBounds() {
  const indicator = tabbar.querySelector('.tab-indicator');
  const width = indicator?.offsetWidth || 0;
  return { minX: 0, maxX: Math.max(0, tabbar.clientWidth - width) };
}

tabbar.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const active = e.target.closest('.tab[aria-selected="true"]');
  if (!active) return;
  const barRect = tabbar.getBoundingClientRect();
  const rect = active.getBoundingClientRect();
  tabDrag = {
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    x: rect.left - barRect.left - tabbar.clientLeft,
    y: rect.top - barRect.top - tabbar.clientTop,
    width: rect.width,
    moved: false
  };
  try { tabbar.setPointerCapture(e.pointerId); } catch (_) {}
  tabbar.classList.add('is-tab-dragging');
});

tabbar.addEventListener('pointermove', (e) => {
  if (!tabDrag || e.pointerId !== tabDrag.pointerId) return;
  const dx = e.clientX - tabDrag.startX;
  if (Math.abs(dx) < 5) return;
  tabDrag.moved = true;
  const indicator = tabbar.querySelector('.tab-indicator');
  if (!indicator) return;
  const bounds = getTabDragBounds();
  const x = Math.min(Math.max(tabDrag.x + dx, bounds.minX), bounds.maxX);
  const squeeze = Math.min(Math.abs(dx) / 2600, .04);
  indicator.style.transition = 'none';
  indicator.style.transform =
    `translate3d(${x}px, ${tabDrag.y}px, 0) ` +
    `scaleX(${1 + squeeze}) scaleY(${1 - squeeze})`;
});

function endTabDrag(e) {
  if (!tabDrag || e.pointerId !== tabDrag.pointerId) return;
  const drag = tabDrag;
  tabDrag = null;
  tabbar.classList.remove('is-tab-dragging');
  if (!drag.moved) return;
  suppressTabClick = true;
  setTimeout(() => { suppressTabClick = false; }, 0);

  const dx = e.clientX - drag.startX;
  const bounds = getTabDragBounds();
  const x = Math.min(Math.max(drag.x + dx, bounds.minX), bounds.maxX);
  const dragCenter = x + drag.width / 2;
  const target = TABS.reduce((best, tab) => {
    const rect = tabbar.querySelector(`[data-tab="${tab.id}"]`).getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const distance = Math.abs(center - dragCenter);
    return distance < best.distance ? { tab, distance } : best;
  }, { tab: current, distance: Number.POSITIVE_INFINITY }).tab;

  const fromPoint = { x, y: drag.y };
  if (target.id === current.id) {
    updateTabs({ animate: true, fromPoint });
  } else {
    current = target;
    render({ animate: true, fromPoint });
  }
}

tabbar.addEventListener('pointerup', endTabDrag);
tabbar.addEventListener('pointercancel', endTabDrag);

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
scheduleQueueSync();
void registerBackgroundSync();
window.addEventListener('resize', syncTabIndicator);

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
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'UBUDGET_QUEUE_SYNCED') {
      document.dispatchEvent(new CustomEvent('ubudget:queue-synced', { detail: event.data }));
    }
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
