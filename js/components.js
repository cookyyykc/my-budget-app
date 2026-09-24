import { fen } from './format.js';

// ---------------------------------------------------------------- 图标
const P = {
  bowl:     '<path d="M3.6 11.4h16.8a8.4 8.4 0 0 1-16.8 0Z"/><path d="M8.6 8.2c0-1.1.9-1.5.9-2.5M12 8.2c0-1.3 1-1.7 1-2.8"/>',
  bottle:   '<path d="M10 3.5h4v2.2l1.4 1.6c.4.5.6 1 .6 1.6v9.6a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8.9c0-.6.2-1.1.6-1.6L10 5.7Z"/><path d="M8 12h8"/>',
  book:     '<path d="M4 5.2A2.2 2.2 0 0 1 6.2 3H11v16H6.2A2.2 2.2 0 0 0 4 21.2Z"/><path d="M20 5.2A2.2 2.2 0 0 0 17.8 3H13v16h4.8A2.2 2.2 0 0 1 20 21.2Z"/>',
  bus:      '<rect x="4.5" y="4" width="15" height="13" rx="2.6"/><path d="M4.5 11.5h15M8 17v1.6M16 17v1.6M8.5 8h7"/>',
  people:   '<circle cx="9" cy="8.4" r="2.9"/><path d="M3.8 19.4c.5-3 2.6-4.7 5.2-4.7s4.7 1.7 5.2 4.7"/><path d="M16 6.2a2.6 2.6 0 0 1 0 5.1M17.4 14.9c1.7.5 2.9 2 3.3 4.1"/>',
  shield:   '<path d="M12 3.2 5.4 5.5v5.9c0 4 2.6 7 6.6 9.4 4-2.4 6.6-5.4 6.6-9.4V5.5Z"/><path d="M9.2 11.6 11.3 14l3.6-4.2"/>',
  dots:     '<circle cx="12" cy="12" r="8.4"/><circle cx="8.6" cy="12" r="1.05" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.05" fill="currentColor" stroke="none"/><circle cx="15.4" cy="12" r="1.05" fill="currentColor" stroke="none"/>',
  wallet:   '<rect x="3.4" y="6" width="17.2" height="13" rx="2.6"/><path d="M3.4 10h17.2M16 14.5h1.6"/>',
  medal:    '<circle cx="12" cy="14.4" r="5"/><path d="M8.6 8.2 6.6 3.4h10.8l-2 4.8M12 12.2v4.4"/>',
  redpack:  '<rect x="5.4" y="3.4" width="13.2" height="17.2" rx="2.4"/><path d="M5.4 7.4c2.6 0 4.4 1.2 6.6 3.2 2.2-2 4-3.2 6.6-3.2"/><circle cx="12" cy="13.6" r="1.5"/>',
  receipt:  '<path d="M6 3.6h12v16.8l-2.4-1.5-2.4 1.5-2.4-1.5-2.4 1.5Z"/><path d="M9 8.4h6M9 12.2h6"/>',
  sun:      '<circle cx="12" cy="14.6" r="4.2"/><path d="M2.8 18.8h18.4M12 5v2.4M5.7 7.9l1.7 1.7M18.3 7.9l-1.7 1.7"/>',
  sunhigh:  '<circle cx="12" cy="12" r="4.2"/><path d="M12 3.4v2.2M12 18.4v2.2M3.4 12h2.2M18.4 12h2.2M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M17.9 6.1l-1.6 1.6M7.7 16.3l-1.6 1.6"/>',
  moon:     '<path d="M19 14.6A7.6 7.6 0 0 1 9.4 5a7.8 7.8 0 1 0 9.6 9.6Z"/>',
  star:     '<path d="m12 3.6 2.5 5.4 5.9.7-4.3 4 1.1 5.8-5.2-2.9-5.2 2.9 1.1-5.8-4.3-4 5.9-.7Z"/>',
  pencil:   '<path d="M4.2 19.8h3.4l10-10a2.4 2.4 0 0 0-3.4-3.4l-10 10Z"/><path d="M13.4 7.2l3.4 3.4"/>',
  list:     '<path d="M8.4 6.6h11.2M8.4 12h11.2M8.4 17.4h11.2"/><circle cx="4.8" cy="6.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.8" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.8" cy="17.4" r="1.1" fill="currentColor" stroke="none"/>',
  chart:    '<path d="M4.4 20V10.6M10.6 20V4.6M16.8 20v-6.6M21 20H3.6"/>',
  user:     '<circle cx="12" cy="8.6" r="3.6"/><path d="M4.8 20.2c.7-3.7 3.6-5.6 7.2-5.6s6.5 1.9 7.2 5.6"/>',
  chevron:  '<path d="m9.4 5.6 6.4 6.4-6.4 6.4"/>',
  back:     '<path d="M9 4.6h8.2a2.2 2.2 0 0 1 2.2 2.2v10.4a2.2 2.2 0 0 1-2.2 2.2H9L3.4 12Z"/><path d="M11.6 9.4 14.6 12l-3 2.6"/>',
  search:   '<circle cx="10.6" cy="10.6" r="6"/><path d="m15 15 4.4 4.4"/>',
  close:    '<path d="m6.4 6.4 11.2 11.2M17.6 6.4 6.4 17.6"/>',
  check:    '<path d="m5 12.6 4.6 4.6L19 6.8"/>',
  calendar: '<rect x="3.6" y="5" width="16.8" height="15.4" rx="2.4"/><path d="M3.6 9.6h16.8M8 3.4v3.2M16 3.4v3.2"/>',
  card:     '<rect x="3" y="5.6" width="18" height="12.8" rx="2.4"/><path d="M3 9.8h18"/>',
  down:     '<path d="M12 4.6v11l3.8-3.8M12 15.6l-3.8-3.8M4.6 19.4h14.8"/>',
  trash:    '<path d="M4.8 6.6h14.4M9.4 6.6V4.4h5.2v2.2M6.8 6.6 7.8 20h8.4l1-13.4"/>',
};

export function icon(name, size = 22, cls = '') {
  const body = P[name] || P.dots;
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" focusable="false">${body}</svg>`;
}

// ---------------------------------------------------------------- 提示
export function toast(text, ms = 1900) {
  const root = document.getElementById('toast-root');
  root.replaceChildren();               // 同时只留一条，避免叠成一堆
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  root.append(el);
  setTimeout(() => {
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 240);
  }, ms);
}

// ---------------------------------------------------------------- 底部弹层
let scrimEl = null;

export function closeSheet() {
  if (!scrimEl) return;
  const el = scrimEl;
  scrimEl = null;
  el.classList.remove('is-open');
  setTimeout(() => el.remove(), 300);
  document.removeEventListener('keydown', onSheetKey);
  if (lastFocus?.isConnected) lastFocus.focus();
}

let lastFocus = null;
function onSheetKey(e) { if (e.key === 'Escape') closeSheet(); }

function bindSheetDrag(scrim, sheet) {
  const zone = sheet.querySelector('.sheet-drag-zone');
  let active = false;
  let dragging = false;
  let startY = 0;
  let lastY = 0;
  let lastTime = 0;
  let velocity = 0;

  zone.addEventListener('pointerdown', (event) => {
    if (event.button || !scrim.classList.contains('is-open')) return;
    active = true;
    dragging = false;
    startY = lastY = event.clientY;
    lastTime = performance.now();
    velocity = 0;
    zone.setPointerCapture(event.pointerId);
  });

  zone.addEventListener('pointermove', (event) => {
    if (!active) return;
    const dy = event.clientY - startY;
    if (!dragging && Math.abs(dy) < 7) return;
    if (!dragging) {
      dragging = true;
      sheet.classList.add('is-dragging');
      scrim.style.setProperty('--drag-progress', '0');
    }
    const offset = Math.max(0, dy);
    const progress = Math.min(1, offset / Math.max(120, sheet.offsetHeight * .35));
    sheet.style.transform = `translate3d(0, ${offset}px, 0)`;
    scrim.style.background = `rgba(10, 12, 13, ${(1 - progress) * .38})`;
    velocity = (event.clientY - lastY) / Math.max(1, performance.now() - lastTime);
    lastY = event.clientY;
    lastTime = performance.now();
  });

  const release = (event) => {
    if (!active) return;
    active = false;
    zone.releasePointerCapture?.(event.pointerId);
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove('is-dragging');
    const offset = sheet.getBoundingClientRect().top - sheet.parentElement.getBoundingClientRect().top;
    const shouldClose = offset > 88 || velocity > .52;
    if (shouldClose) {
      sheet.classList.add('is-settling');
      sheet.style.transform = 'translate3d(0, 110%, 0)';
      scrim.style.background = '';
      setTimeout(closeSheet, 190);
    } else {
      sheet.classList.add('is-settling');
      sheet.style.transform = 'translate3d(0, 0, 0)';
      scrim.style.background = '';
      setTimeout(() => {
        sheet.classList.remove('is-settling');
        sheet.style.transform = '';
      }, 320);
    }
  };

  zone.addEventListener('pointerup', release);
  zone.addEventListener('pointercancel', release);
}

export function openSheet({ title, body, footer = '', onMount }) {
  closeSheet();
  lastFocus = document.activeElement;

  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="sheet-drag-zone" aria-hidden="true"><span class="sheet-handle"></span></div>
      <div class="sheet-head">
        <h2>${title}</h2>
        <button class="sheet-close" type="button" data-close aria-label="关闭">${icon('close', 20)}</button>
      </div>
      <div class="sheet-body"></div>
      ${footer ? `<div class="sheet-foot">${footer}</div>` : ''}
    </div>`;
  scrim.querySelector('.sheet-body').innerHTML = body;
  if (footer) scrim.querySelector('.sheet-foot').innerHTML = footer;

  scrim.addEventListener('click', (e) => {
    if (e.target === scrim || e.target.closest('[data-close]')) closeSheet();
  });
  document.addEventListener('keydown', onSheetKey);

  document.getElementById('sheet-root').append(scrim);
  scrimEl = scrim;
  requestAnimationFrame(() => scrim.classList.add('is-open'));
  scrim.querySelector('[data-close]')?.focus();
  bindSheetDrag(scrim, scrim.querySelector('.sheet'));
  onMount?.(scrim);
  return scrim;
}

export function confirmSheet({ title, message, confirmText = '确认', danger = false }) {
  return new Promise((resolve) => {
    const scrim = openSheet({
      title,
      body: `<p style="margin:0;font-size:14px;line-height:1.7;color:var(--ink-2)">${message}</p>`,
      footer: `<div style="display:grid;gap:8px">
        <button class="btn ${danger ? 'btn--danger' : ''}" type="button" data-ok>${confirmText}</button>
        <button class="btn btn--ghost" type="button" data-close>取消</button>
      </div>`,
      onMount(el) {
        el.querySelector('[data-ok]').addEventListener('click', () => { closeSheet(); resolve(true); });
        el.addEventListener('click', (e) => {
          if (e.target === el || e.target.closest('[data-close]')) resolve(false);
        });
      },
    });
    void scrim;
  });
}

// ---------------------------------------------------------------- 预算条
export function budgetStrip(st, dots) {
  const over = st.state === 'over';
  const stateText = over ? `已超支 ${fen.yuan(st.overspend)}` : st.label;
  const ratioPct = Math.min(100, st.ratio * 100);

  const daily = st.dailyLeft < 0
    ? '<span class="neg"><b>本月已透支</b></span>'
    : `${st.daysLeft} 天 · 日均可用 <b>${fen.yuan(st.dailyLeft)}</b>`;

  const runOut = st.runOutDay && !over
    ? ` · 照这速度 ${st.runOutDay} 号会用完`
    : '';

  return `
    <div class="strip" data-state="${st.state}">
      <div class="strip-top">
        <span class="strip-label">已用 <strong class="num">${fen.yuan(st.spent)}</strong> / ${fen.compact(st.budget)}</span>
        <span class="strip-state">${stateText}</span>
      </div>
      <div class="bar ${over ? 'is-over' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100"
           aria-valuenow="${Math.round(ratioPct)}" aria-label="本月预算已用 ${Math.round(ratioPct)}%">
        <div class="bar-fill" style="width:${ratioPct}%"></div>
      </div>
      <div class="strip-foot">
        <span>剩余 <b class="num">${fen.yuan(Math.max(0, st.remaining))}</b></span>
        <span>${daily}${runOut}</span>
      </div>
      ${dots ? `<div style="margin-top:10px" class="meal-dots" role="group" aria-label="今日三餐记录情况，未记的可点一下补记">
        ${dots.map((m) => `<button class="meal-dot ${m.done ? 'is-done' : ''}" type="button"
            data-fill-meal="${m.id}"
            aria-label="${m.done ? `${m.name}已记` : `补记${m.name}`}">
          <i aria-hidden="true"></i>${m.name}</button>`).join('')}
      </div>` : ''}
    </div>`;
}

// ---------------------------------------------------------------- 餐盘
/** 宽度 = 预算占比，填充 = 已花比例。超支的格子用斜纹溢出表示。 */
export function tray(meal, other, { compact = false } = {}) {
  const cells = [
    ...meal.rows.map((r) => ({
      key: r.id, name: r.name, icon: r.icon,
      budget: r.budget, sum: r.sum, over: r.over,
    })),
    { key: 'other', name: '其他花费', icon: 'dots', budget: otherBudget(other), sum: other.sum, over: 0 },
  ];

  const totalBudget = cells.reduce((a, c) => a + (c.budget > 0 ? c.budget : 0), 0);
  const totalSpend = cells.reduce((a, c) => a + c.sum, 0);
  const maxSum = Math.max(...cells.map((c) => c.sum), 1);

  return `<div class="tray" role="group" aria-label="预算去向，格子宽度表示额度占比">
    ${cells.map((c) => {
      const basis = totalBudget > 0 && c.budget > 0 ? c.budget : (c.sum || 1);
      const denom = totalBudget > 0 ? totalBudget : totalSpend || 1;
      const width = Math.max(10, (basis / denom) * 100);
      const ratio = c.budget > 0 ? c.sum / c.budget : (c.sum > 0 ? 1 : 0);
      const isOver = c.budget > 0 && c.sum > c.budget;
      const noBudget = !(c.budget > 0);
      // 没设子预算的格子不按「花满」画，改成相对花费，避免误导成 100%
      const fill = noBudget ? Math.min(100, (c.sum / maxSum) * 100) : Math.min(100, ratio * 100);
      // 柱子上显示「用了多少」；剩余改成点开看
      const tag = `用 ${fen.compact(c.sum)}`;
      return `<button class="tray-cell ${isOver ? 'is-over' : ''} ${noBudget ? 'is-nobudget' : ''}" type="button" style="flex:${width} 1 0;--cat:${catColor(c.key)}" data-tray="${c.key}">
        <span class="tray-tag">${tag}</span>
        <span class="tray-fill" style="height:${fill}%"></span>
        <span class="tray-cap">
          <span class="tray-name">${c.key === 'other' ? '其他' : c.name}</span>
        </span>
      </button>`;
    }).join('')}
  </div>
  ${compact ? '' : `<div class="tray-legend">
    ${cells.map((c) => `<span class="tray-li">
      <i style="--cat:${catColor(c.key)}" aria-hidden="true"></i>${c.key === 'other' ? '其他花费' : c.name}
      <b class="num">${fen.compact(c.sum)}</b>
      ${c.budget > 0 ? `<em class="num">${Math.round((c.sum / c.budget) * 100)}%</em>` : ''}
    </span>`).join('')}
  </div>`}`;
}

function otherBudget(other) {
  return other.rows.reduce((a, r) => a + r.budget, 0);
}

function catColor(key) {
  const map = {
    breakfast: 'var(--c-food)', lunch: 'var(--c-food)',
    dinner: 'var(--c-food)', snack: 'var(--c-food)', other: 'var(--c-other)',
  };
  return map[key] || 'var(--c-other)';
}

// ---------------------------------------------------------------- 横条
export function hbars(rows) {
  const max = Math.max(...rows.map((r) => r.sum), 1);
  return `<div class="hbars">${rows.map((r) => `
    <div class="hbar-row">
      <span class="hbar-name">${r.name}</span>
      <span class="hbar-track"><span class="hbar-fill" style="width:${(r.sum / max) * 100}%;--cat:${catColor(r.id)}"></span></span>
      <span class="hbar-val">${fen.compact(r.sum)}</span>
    </div>`).join('')}</div>`;
}
