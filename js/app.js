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

function renderTabs() {
  tabbar.setAttribute('role', 'tablist');
  tabbar.innerHTML = TABS.map((t) => `
    <button class="tab" type="button" role="tab" data-tab="${t.id}"
            aria-selected="${current.id === t.id}" aria-controls="main">
      ${icon(t.icon, 23)}
      <span>${t.name}</span>
    </button>`).join('');
}

function render() {
  setActiveView(current.view);
  main.classList.toggle('is-record', current.id === 'record');
  main.innerHTML = current.view.html();
  current.view.mount(main);
  renderTabs();
  window.scrollTo(0, 0);
}

tabbar.addEventListener('click', (e) => {
  const id = e.target.closest('[data-tab]')?.dataset.tab;
  if (!id || id === current.id) return;
  current = TABS.find((t) => t.id === id);
  render();
  if (navigator.vibrate) navigator.vibrate(4);
});

// 别的地方（比如明细页的「＋补记」、预算条上的餐次点）可以请求切到记账页
document.addEventListener('app:tab', (e) => {
  const next = TABS.find((t) => t.id === e.detail?.id);
  if (!next) return;
  current = next;
  render();
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

render();

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
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('离线缓存未启用', err));
  });
}
