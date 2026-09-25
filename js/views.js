import { d, fen, mealForTime } from './format.js';
import {
  store, EXPENSE_CATS, INCOME_CATS, MEALS, ACCOUNTS, OVERSPEND_MODES, catById, mealById,
  monthRecords, totals, budgetStatus, mealStats, otherStats, overspendReasons, advice,
  todayMealDots, monthLabelShort, nowHHMM,
} from './store.js';
import { icon, toast, openSheet, closeSheet, confirmSheet, budgetStrip, tray, hbars } from './components.js';
import { getQueueCount } from './sync-queue.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const state = {
  month: d.monthKey(),
  filter: 'all',
  query: '',
};

/** 视图挂载在同一个 #main 上，重渲染时必须换掉旧监听，否则一次点击会触发多次。 */
const boundHandlers = new WeakMap();
function bind(root, fn) {
  const prev = boundHandlers.get(root);
  if (prev) root.removeEventListener('click', prev);
  boundHandlers.set(root, fn);
  root.addEventListener('click', fn);
}

export function currentMonth() { return state.month; }

const THEME_OPTIONS = [
  { id: 'system', name: '跟随系统' },
  { id: 'light',  name: '浅色' },
  { id: 'dark',   name: '深色' },
];

function applyTheme() {
  const theme = THEME_OPTIONS.some((t) => t.id === store.state.settings.theme)
    ? store.state.settings.theme : 'system';
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => { m.content = dark ? '#0E1113' : '#F4F5F1'; });
}
applyTheme();

/** 从最近 45 天的非空备注推导常用备注，不新增数据结构。 */
function commonNotes() {
  const cutoff = Date.now() - 45 * 24 * 60 * 60 * 1000;
  const notes = new Map();
  for (const r of store.state.records) {
    const at = Date.parse(r.createdAt || `${r.date}T${r.time || '12:00'}:00`);
    if (!Number.isFinite(at) || at < cutoff) continue;
    const note = (r.note || '').trim();
    if (!note) continue;
    const item = notes.get(note) || { note, count: 0, at: 0 };
    item.count += 1;
    item.at = Math.max(item.at, at);
    notes.set(note, item);
  }
  return [...notes.values()]
    .sort((a, b) => b.count - a.count || b.at - a.at)
    .slice(0, 6);
}

const BASE_TAGS = [
  '食堂', '外卖', '奶茶', '咖啡', '水果', '饮料', '日用品',
  '学习用品', '交通', '娱乐', '社交', '电费', '网购', '报销',
];

function tagSuggestions() {
  const counts = new Map();
  const add = (tag) => {
    const clean = String(tag || '').trim();
    if (clean) counts.set(clean, (counts.get(clean) || 0) + 1);
  };
  for (const r of store.state.records.slice(-180)) (r.tags || []).forEach(add);
  return [...new Set([...counts.keys(), ...BASE_TAGS])].slice(0, 14);
}

// ================================================================ 记账
const rec = {
  type: 'expense',
  amount: '',
  categoryId: 'food',
  mealType: mealForTime(),
  time: nowHHMM(),
  mealTouched: false,          // 用户手动点过餐次后，改时间不再覆盖他的选择
  date: d.iso(),
  note: '',
  tags: [],
  accountId: 'wechat',
};

/** 按 HH:MM 推餐次，用于补记时自动落到对应那一餐 */
function mealForHHMM(hhmm) {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  if (Number.isNaN(h)) return mealForTime();
  const dt = new Date();
  dt.setHours(h, m || 0, 0, 0);
  return mealForTime(dt);
}

/** 跳到记账页并预填，用于「补记」 */
export function gotoRecordWith(patch) {
  Object.assign(rec, patch);
  document.dispatchEvent(new CustomEvent('app:tab', { detail: { id: 'record' } }));
}

export const recordView = {
  html() {
    const st = budgetStatus();
    const dots = todayMealDots();
    const cats = rec.type === 'expense' ? EXPENSE_CATS : INCOME_CATS;
    const amountText = rec.amount ? fen.format(fen.fromYuan(rec.amount)) : '0.00';
    const account = ACCOUNTS.find((a) => a.id === rec.accountId);
    const activeCat = catById(rec.categoryId);
    const noteLabel = rec.note || rec.tags.map((tag) => `#${tag}`).join(' ');

    return `
      ${budgetStrip(st, dots)}
      <div class="rec-body">
        <div class="amount-row">
          <span class="amount-cur" aria-hidden="true">¥</span>
          <span class="amount ${rec.amount ? '' : 'is-empty'}" id="amount" aria-live="polite" aria-label="金额 ${amountText} 元">${amountText}</span>
          <button class="amount-back" type="button" data-key="back" aria-label="退格">${icon('back', 20)}</button>
        </div>

        <div class="seg-swap" id="seg-swap">
          <div class="seg-wrap">
            <div class="seg" role="tablist" aria-label="收支类型">
              <button type="button" role="tab" data-type="expense" aria-selected="${rec.type === 'expense'}">支出</button>
              <button type="button" role="tab" data-type="income" aria-selected="${rec.type === 'income'}">收入</button>
            </div>
          </div>

          <div class="cat-grid" role="group" aria-label="分类">
            ${cats.map((c) => `
              <button class="cat" type="button" data-cat="${c.id}" aria-pressed="${rec.categoryId === c.id}"
                      style="--cat:${c.color}">
                <span class="ic">${icon(c.icon, 21)}</span>${c.name}
              </button>`).join('')}
          </div>

          ${rec.type === 'expense' && activeCat.meals ? `
            <div class="meal-chips" role="group" aria-label="餐次">
              ${MEALS.map((m) => `
                <button class="chip" type="button" data-meal="${m.id}" aria-pressed="${rec.mealType === m.id}">${m.name}</button>`).join('')}
            </div>` : ''}

          <div class="meta-row">
            <button class="meta-btn ${rec.date !== d.iso() ? 'is-set' : ''}" type="button" data-meta="date"
                    aria-label="记账时间：${d.dayLabel(rec.date)} ${rec.time}">
              ${icon('calendar', 17)}<span>${d.dayLabel(rec.date)} ${rec.time}</span>
            </button>
            <button class="meta-btn" type="button" data-meta="account">
              ${icon('card', 17)}<span>${account?.name || '账户'}</span>
            </button>
            <button class="meta-btn ${noteLabel ? 'is-set' : ''}" type="button" data-meta="note">
              ${icon('pencil', 17)}<span>${noteLabel ? esc(noteLabel) : '备注'}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="keypad" role="group" aria-label="数字键盘">
        ${['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) =>
          `<button class="key" type="button" data-key="${k}">${k}</button>`).join('')}
        <button class="key key--fn" type="button" data-key="back" aria-label="退格">${icon('back', 20)}</button>
        <button class="key" type="button" data-key=".">.</button>
        <button class="key" type="button" data-key="0">0</button>
        <button class="key" type="button" data-key="00">00</button>
        <button class="key key--save" type="button" data-save>保存<small>¥${amountText}</small></button>
      </div>`;
  },

  mount(root) {
    const amountEl = root.querySelector('#amount');
    const saveEl = root.querySelector('.key--save small');

    const syncAmount = () => {
      const text = rec.amount ? fen.format(fen.fromYuan(rec.amount)) : '0.00';
      amountEl.textContent = text;
      amountEl.classList.toggle('is-empty', !rec.amount);
      if (saveEl) saveEl.textContent = `¥${text}`;
    };

    bind(root, (e) => {
      const key = e.target.closest('[data-key]')?.dataset.key;
      if (key) {
        if (key === 'back') rec.amount = rec.amount.slice(0, -1);
        else if (key === '.') { if (!rec.amount) rec.amount = '0.'; else if (!rec.amount.includes('.')) rec.amount += '.'; }
        else if (key === '00') { if (rec.amount && !/\.\d$/.test(rec.amount)) rec.amount += '00'; }
        else if (/^\d$/.test(key)) {
          const next = rec.amount + key;
          const [, dec] = next.split('.');
          if (dec && dec.length > 2) return;
          if (fen.fromYuan(next) > 99999999) return;
          rec.amount = next.replace(/^0(?=\d)/, '');
        }
        syncAmount();
        return;
      }

      const typeBtn = e.target.closest('[data-type]');
      if (typeBtn) {
        rec.type = typeBtn.dataset.type;
        rec.categoryId = rec.type === 'expense' ? 'food' : 'allowance';
        rec.mealType = rec.type === 'expense' ? mealForHHMM(rec.time) : null;
        rec.mealTouched = false;
        rerenderRecord(root, typeBtn.dataset.type === 'expense' ? -1 : 1);
        return;
      }

      const catBtn = e.target.closest('[data-cat]');
      if (catBtn) { rec.categoryId = catBtn.dataset.cat; rerenderRecord(root); return; }

      const mealBtn = e.target.closest('[data-meal]');
      if (mealBtn) { rec.mealType = mealBtn.dataset.meal; rec.mealTouched = true; rerenderRecord(root); return; }

      // 预算条上的 ○○● —— 点一下直接把那一餐填好
      const fill = e.target.closest('[data-fill-meal]')?.dataset.fillMeal;
      if (fill) {
        gotoRecordWith({
          type: 'expense', categoryId: 'food', mealType: fill, mealTouched: true,
          date: d.iso(),
        });
        rerenderRecord(root);
        toast(`补记${mealById(fill)?.name || ''}`);
        return;
      }

      const meta = e.target.closest('[data-meta]')?.dataset.meta;
      if (meta) openMeta(meta, root);

      if (e.target.closest('[data-save]')) save(root);
    });
  },
};

function rerenderRecord(root, direction = 0) {
  const scrollY = window.scrollY;
  root.innerHTML = recordView.html();
  recordView.mount(root);
  window.scrollTo(0, scrollY);

  const swap = root.querySelector('#seg-swap');
  if (direction && swap && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    swap.animate(
      [
        { transform: `translateX(${direction * 16}px)`, opacity: .24 },
        { transform: 'translateX(0)', opacity: 1 },
      ],
      { duration: 280, easing: 'cubic-bezier(.22, 1.36, .64, 1)' },
    );
  }
}

function openMeta(kind, root) {
  if (kind === 'date') {
    openSheet({
      title: '记账时间',
      body: `
        <label class="field"><span class="field-lab">日期</span>
          <input type="date" id="date-input" value="${rec.date}" max="${d.iso()}" />
          <span class="hint">忘记记了？把日期改成那天，再选一下是几点吃的，餐次会自动对上。</span></label>
        <label class="field"><span class="field-lab">时间</span>
          <input type="time" id="time-input" value="${rec.time}" /></label>
        <p class="notes" id="meal-hint"></p>`,
      footer: `<button class="btn" type="button" data-ok>确定</button>`,
      onMount(el) {
        const dateI = el.querySelector('#date-input');
        const timeI = el.querySelector('#time-input');
        const hint = el.querySelector('#meal-hint');
        const refreshHint = () => {
          const m = mealById(mealForHHMM(timeI.value));
          hint.innerHTML = `按这个时间，会自动归到「${m?.name || '—'}」。` +
            (dateI.value !== d.iso() ? ' 这会是一笔补记。' : '');
        };
        // 改时间时同步餐次（用户手动点过餐次就不覆盖）
        timeI.addEventListener('input', () => {
          if (!rec.mealTouched) rec.mealType = mealForHHMM(timeI.value);
          refreshHint();
        });
        dateI.addEventListener('input', refreshHint);
        refreshHint();
        el.querySelector('[data-ok]').addEventListener('click', () => {
          rec.date = dateI.value || d.iso();
          rec.time = timeI.value || nowHHMM();
          if (!rec.mealTouched) rec.mealType = mealForHHMM(rec.time);
          closeSheet(); rerenderRecord(root);
        });
      },
    });
  }
  if (kind === 'account') {
    openSheet({
      title: '账户',
      body: `<div class="list">${ACCOUNTS.map((a) => `
        <button class="list-row" type="button" data-acc="${a.id}">
          <span class="list-lab">${a.name}</span>
          ${rec.accountId === a.id ? icon('check', 18) : ''}
        </button>`).join('')}</div>`,
      onMount(el) {
        el.addEventListener('click', (e) => {
          const id = e.target.closest('[data-acc]')?.dataset.acc;
          if (!id) return;
          rec.accountId = id;
          store.setSetting({ defaultAccountId: id });
          closeSheet(); rerenderRecord(root);
        });
      },
    });
  }
  if (kind === 'note') {
    const notes = commonNotes();
    const tags = tagSuggestions();
    openSheet({
      title: '备注',
      body: `<label class="field"><span class="field-lab">写点什么</span>
        <input type="text" id="note-input" maxlength="50" placeholder="和室友聚餐" value="${esc(rec.note)}" />
        <span class="hint">最多 50 字</span></label>
        <div class="note-presets">
          <span class="field-lab">标签</span>
          <div class="note-preset-list" role="group" aria-label="标签">
            ${tags.map((tag) => `
              <button class="note-preset" type="button" data-tag="${esc(tag)}"
                      aria-pressed="${rec.tags.includes(tag)}">${esc(tag)}</button>`).join('')}
          </div>
        </div>
        ${notes.length ? `
          <div class="note-presets">
            <span class="field-lab">常用备注</span>
            <div class="note-preset-list" role="group" aria-label="常用备注">
              ${notes.map((item) => `
                <button class="note-preset" type="button" data-common-note="${esc(item.note)}"
                        aria-pressed="${rec.note === item.note}">${esc(item.note)}</button>`).join('')}
            </div>
          </div>` : ''}`,
      footer: `<button class="btn" type="button" data-ok>确定</button>`,
      onMount(el) {
        const input = el.querySelector('#note-input');
        const presetButtons = [...el.querySelectorAll('[data-common-note]')];
        const tagButtons = [...el.querySelectorAll('[data-tag]')];
        const syncPresets = () => presetButtons.forEach((button) => {
          button.setAttribute('aria-pressed', String(button.dataset.commonNote === input.value.trim()));
        });
        el.querySelector('.note-preset-list')?.addEventListener('click', (event) => {
          const button = event.target.closest('[data-common-note]');
          if (!button) return;
          input.value = button.dataset.commonNote;
          syncPresets();
          input.focus();
        });
        input.addEventListener('input', syncPresets);
        el.querySelector('[aria-label="标签"]').addEventListener('click', (event) => {
          const button = event.target.closest('[data-tag]');
          if (!button) return;
          const tag = button.dataset.tag;
          const selected = new Set(rec.tags);
          if (selected.has(tag)) selected.delete(tag); else selected.add(tag);
          rec.tags = [...selected];
          button.setAttribute('aria-pressed', String(selected.has(tag)));
        });
        el.querySelector('[data-ok]').addEventListener('click', () => {
          rec.note = input.value.trim();
          closeSheet(); rerenderRecord(root);
        });
      },
    });
  }
}

function save(root) {
  const amount = fen.fromYuan(rec.amount);
  if (amount <= 0) { toast('先输入金额'); return; }

  const st = budgetStatus();
  let warned = false;
  if (rec.type === 'expense' && amount > st.remaining && st.remaining >= 0) {
    warned = true;
  }

  store.addRecord({
    type: rec.type,
    amount,
    categoryId: rec.categoryId,
    mealType: rec.type === 'expense' && catById(rec.categoryId).meals ? rec.mealType : null,
    accountId: rec.accountId,
    date: rec.date,
    time: rec.time || nowHHMM(),
    note: rec.note,
    tags: rec.tags,
    mealCount: 1,
  });

  const label = rec.type === 'expense'
    ? `已记下 ¥${fen.format(amount)}`
    : `已记下收入 ¥${fen.format(amount)}`;
  toast(warned ? `${label} · 这笔让本月超支了` : label);
  if (navigator.vibrate) navigator.vibrate(8);

  const keepDate = rec.date;
  const keepTime = rec.time;
  rec.amount = '';
  rec.note = '';
  rec.tags = [];
  rec.mealTouched = false;
  rec.mealType = rec.type === 'expense' ? mealForHHMM(keepTime) : null;
  rec.date = keepDate;
  rec.time = keepTime;
  rerenderRecord(root);
}

// ================================================================ 明细
export const ledgerView = {
  html() {
    const all = monthRecords(state.month);
    const q = state.query.trim();
    const rows = all.filter((r) => {
      if (state.filter === 'food' && !(r.categoryId === 'food' || r.mealType)) return false;
      if (state.filter === 'income' && r.type !== 'income') return false;
      if (state.filter === 'other' && (r.categoryId === 'food' || r.type === 'income')) return false;
      if (q && !(r.note || '').includes(q) && !catById(r.categoryId).name.includes(q)) return false;
      return true;
    });

    const groups = new Map();
    for (const r of rows) {
      if (!groups.has(r.date)) groups.set(r.date, []);
      groups.get(r.date).push(r);
    }

    const t = totals(state.month);

    return `
      ${monthNav()}
      <div class="screen">
        <div class="search">
          ${icon('search', 18)}
          <input type="search" id="q" placeholder="搜备注、标签或分类" value="${esc(state.query)}" aria-label="搜索流水" />
        </div>
        <div class="filters" role="group" aria-label="筛选">
          ${[['all', '全部'], ['food', '餐饮'], ['other', '其他花费'], ['income', '收入']].map(([k, n]) => `
            <button class="fchip" type="button" data-filter="${k}" aria-pressed="${state.filter === k}">${n}</button>`).join('')}
        </div>

        <div class="section-head">
          <h2>${rows.length} 笔</h2>
          <span class="hint">支出 ${fen.yuan(t.expense)} · 收入 ${fen.yuan(t.income)}</span>
        </div>

        ${rows.length === 0 ? `
          <div class="empty">
            ${icon('list', 30)}
            <h3>${q || state.filter !== 'all' ? '没有符合条件的流水' : '这个月还没有记账'}</h3>
            <p>${q || state.filter !== 'all' ? '换个筛选条件试试。' : '去「记账」页记下第一笔。'}</p>
          </div>` :
        [...groups.entries()].map(([date, list]) => {
          const dayOut = list.filter((r) => r.type === 'expense').reduce((a, r) => a + r.amount, 0);
          const dayIn = list.filter((r) => r.type === 'income').reduce((a, r) => a + r.amount, 0);
          return `
            <div class="day-head">
              <span class="d">${d.dayLabel(date)}</span>
              <span style="display:flex;align-items:center;gap:10px">
                <span class="num">${dayOut ? `−${fen.format(dayOut)}` : ''}${dayIn ? ` +${fen.format(dayIn)}` : ''}</span>
                <button class="day-fill" type="button" data-backfill="${date}"
                        aria-label="补记 ${d.dayLabel(date)} 的账">＋补记</button>
              </span>
            </div>
            <div class="ledger">
              ${list.map((r) => {
                const c = catById(r.categoryId);
                const m = mealById(r.mealType);
                const tagText = (r.tags || []).map((tag) => `#${tag}`).join(' ');
                const sub = [r.time, m?.name, r.note, tagText, r.type === 'income' ? '收入' : null]
                  .filter(Boolean).join(' · ');
                return `<button class="ledger-row" type="button" data-rec="${r.id}">
                  <span class="ledger-ic" style="--cat:${c.color}">${icon(m?.icon || c.icon, 18)}</span>
                  <span class="ledger-main">
                    <span class="ledger-title">${c.name}</span>
                    <span class="ledger-sub">${esc(sub) || '&nbsp;'}</span>
                  </span>
                  <span class="ledger-amt ${r.type === 'income' ? 'is-income' : ''}">${r.type === 'income' ? '+' : '−'}${fen.format(r.amount)}</span>
                </button>`;
              }).join('')}
            </div>`;
        }).join('')}
      </div>`;
  },

  mount(root) {
    root.querySelector('#q')?.addEventListener('input', (e) => {
      state.query = e.target.value;
      const pos = e.target.selectionStart;
      rerenderPreserving(root, () => {
        const input = root.querySelector('#q');
        input?.focus();
        input?.setSelectionRange(pos, pos);
      });
    });
    bind(root, (e) => {
      const backfill = e.target.closest('[data-backfill]')?.dataset.backfill;
      if (backfill) {
        gotoRecordWith({
          type: 'expense', categoryId: 'food', date: backfill,
          time: '12:00', mealType: mealForHHMM('12:00'), mealTouched: false,
        });
        toast('补记：改一下时间就能对上餐次');
        return;
      }
      const f = e.target.closest('[data-filter]')?.dataset.filter;
      if (f) { state.filter = f; rerender(root); return; }
      const id = e.target.closest('[data-rec]')?.dataset.rec;
      if (id) openRecord(id, root);
    });
  },
};

function rerenderPreserving(root, after) {
  const y = window.scrollY;
  root.innerHTML = ledgerView.html();
  ledgerView.mount(root);
  window.scrollTo(0, y);
  after?.();
}

function rerender(root) {
  const y = window.scrollY;
  root.innerHTML = currentViewFor(root).html();
  currentViewFor(root).mount(root);
  window.scrollTo(0, y);
}

let activeView = null;
function currentViewFor() { return activeView; }
export function setActiveView(v) { activeView = v; }

/** 打开一笔记录：可以直接改分类、餐次、金额、时间，不用删了重记 */
function openRecord(id, root) {
  const found = store.state.records.find((x) => x.id === id);
  if (!found) return;
  const draft = { ...found };
  draft.tags = [...(found.tags || [])];
  if (!draft.time) draft.time = '12:00';

  const cats = () => (draft.type === 'expense' ? EXPENSE_CATS : INCOME_CATS);
  const needMeal = () => draft.type === 'expense' && !!catById(draft.categoryId).meals;

  const bodyHtml = () => {
    const acc = ACCOUNTS.find((a) => a.id === draft.accountId);
    return `
      <label class="field"><span class="field-lab">金额（元）</span>
        <input type="number" inputmode="decimal" step="0.01" min="0" id="e-amount" value="${(draft.amount / 100).toFixed(2)}" />
      </label>

      <span class="field-lab">分类</span>
      <div class="filters" style="margin-bottom:14px">
        ${cats().map((c) => `<button class="fchip" type="button" data-e-cat="${c.id}"
            aria-pressed="${draft.categoryId === c.id}">${c.name}</button>`).join('')}
      </div>

      ${needMeal() ? `
        <span class="field-lab">餐次</span>
        <div class="filters" style="margin-bottom:14px">
          ${MEALS.map((m) => `<button class="fchip" type="button" data-e-meal="${m.id}"
              aria-pressed="${draft.mealType === m.id}">${m.name}</button>`).join('')}
        </div>` : ''}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <label class="field"><span class="field-lab">日期</span>
          <input type="date" id="e-date" value="${draft.date}" /></label>
        <label class="field"><span class="field-lab">时间</span>
          <input type="time" id="e-time" value="${draft.time}" /></label>
      </div>

      <label class="field"><span class="field-lab">备注</span>
        <input type="text" id="e-note" maxlength="50" value="${esc(draft.note || '')}" /></label>

      <span class="field-lab">标签</span>
      <div class="note-preset-list" style="margin-bottom:16px">
        ${tagSuggestions().map((tag) => `
          <button class="note-preset" type="button" data-e-tag="${esc(tag)}"
                  aria-pressed="${draft.tags.includes(tag)}">${esc(tag)}</button>`).join('')}
      </div>

      <p class="notes">账户：${acc?.name || '—'}</p>`;
  };

  openSheet({
    title: '编辑这笔',
    body: bodyHtml(),
    footer: `
      <button class="btn" type="button" data-save>保存修改</button>
      <button class="btn btn--danger" type="button" data-del>删除这笔</button>`,
    onMount(el) {
      // 切换分类/餐次会重画表单，先把已经输入的内容收进草稿，别让用户白填
      const capture = () => {
        const a = el.querySelector('#e-amount');
        if (a) { const v = fen.fromYuan(a.value); if (v > 0) draft.amount = v; }
        const n = el.querySelector('#e-note');
        if (n) draft.note = n.value;
        const dt = el.querySelector('#e-date');
        if (dt?.value) draft.date = dt.value;
        const tm = el.querySelector('#e-time');
        if (tm?.value) draft.time = tm.value;
      };
      el.addEventListener('click', (event) => {
        const tagBtn = event.target.closest('[data-e-tag]');
        if (!tagBtn) return;
        const tag = tagBtn.dataset.eTag;
        const selected = new Set(draft.tags);
        if (selected.has(tag)) selected.delete(tag); else selected.add(tag);
        draft.tags = [...selected];
        tagBtn.setAttribute('aria-pressed', String(selected.has(tag)));
      });
      const repaint = () => {
        capture();
        el.querySelector('.sheet-body').innerHTML = bodyHtml();
      };

      el.addEventListener('click', async (e) => {
        const cat = e.target.closest('[data-e-cat]')?.dataset.eCat;
        if (cat) {
          draft.categoryId = cat;
          if (!catById(cat).meals) draft.mealType = null;
          else if (!draft.mealType) draft.mealType = mealForHHMM(draft.time);
          repaint();
          return;
        }
        const meal = e.target.closest('[data-e-meal]')?.dataset.eMeal;
        if (meal) { draft.mealType = meal; repaint(); return; }

        if (e.target.closest('[data-save]')) {
          const amount = fen.fromYuan(el.querySelector('#e-amount').value);
          if (amount <= 0) { toast('金额要大于 0'); return; }
          const date = el.querySelector('#e-date').value || draft.date;
          const time = el.querySelector('#e-time').value || draft.time;
          store.updateRecord(id, {
            amount,
            categoryId: draft.categoryId,
            mealType: needMeal() ? (draft.mealType || mealForHHMM(time)) : null,
            date,
            time,
            note: el.querySelector('#e-note').value.trim(),
            tags: draft.tags,
          });
          closeSheet();
          toast('已保存修改');
          rerender(root);
        }

        if (e.target.closest('[data-del]')) {
          closeSheet();
          const c = catById(found.categoryId);
          const m = mealById(found.mealType);
          const ok = await confirmSheet({
            title: '删除这笔记录？',
            message: `¥${fen.format(found.amount)} · ${c.name}${m ? ` · ${m.name}` : ''}。删除后无法撤销。`,
            confirmText: '删除',
            danger: true,
          });
          if (!ok) return;
          store.deleteRecord(id);
          toast('已删除');
          rerender(root);
        }
      });
    },
  });
}

// ================================================================ 统计
export const statsView = {
  html() {
    const mk = state.month;
    const t = totals(mk);
    const st = budgetStatus(mk);
    const ms = mealStats(mk);
    const isCurrentMonth = mk === d.monthKey();
    const os = otherStats(mk);
    const osRows = os.rows.filter((r) => r.sum > 0);
    const reasons = overspendReasons(mk);
    const catBudgetSum = EXPENSE_CATS.reduce((a, c) => a + (store.state.budget.category[c.id] || 0), 0);
    const topSpend = [
      { name: '餐饮', sum: ms.sum },
      ...os.rows.map((r) => ({ name: r.name, sum: r.sum })),
    ].sort((a, b) => b.sum - a.sum).slice(0, 3);
    return `
      ${monthNav()}
      <div class="screen">
        <div class="section">
          <div class="kpis">
            <div class="kpi">
              <div class="kpi-lab">收入</div>
              <div class="kpi-val is-income">${fen.compact(t.income)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-lab">支出</div>
              <div class="kpi-val">${fen.compact(t.expense)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-lab">${t.expense > st.budget ? '超支' : '预算结余'}</div>
              <div class="kpi-val ${t.expense > st.budget ? 'is-over' : ''}">${fen.compact(Math.abs(st.budget - t.expense))}</div>
              <div class="kpi-note">预算 ${fen.compact(st.budget)}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-head">
            <h2>钱去了哪儿</h2>
            <span class="hint">宽度＝额度占比　高度＝已花</span>
          </div>
          ${tray(ms, os)}
        </div>

        <div class="section">
          <div class="section-head">
            <h2>三餐</h2>
            <span class="hint">天数＝有记录的日期数</span>
          </div>
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>餐次</th><th>总额</th><th>天数</th><th>日均</th>
                </tr>
              </thead>
              <tbody>
                ${ms.rows.map((r) => (r.id === 'snack'
                  // 零食只显示合计。
                  ? `<tr class="is-tap" data-meal-row="${r.id}">
                       <td class="rowname">${r.name}</td>
                       <td>${fen.compact(r.sum)}</td>
                       <td class="muted" colspan="3" style="text-align:right">—</td>
                     </tr>`
                  : `<tr class="is-tap" data-meal-row="${r.id}">
                       <td class="rowname">${r.name}</td>
                       <td>${fen.compact(r.sum)}</td>
                       <td>${r.days}</td>
                       <td>${r.daily == null ? '<span class="muted">—</span>' : fen.compact(r.daily)}</td>
                     </tr>`)).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td>三餐合计</td>
                  <td>${fen.compact(ms.threeSum)}</td>
                  <td>${ms.threeDays}</td>
                  <td>${ms.threeDaily == null ? '—' : fen.compact(ms.threeDaily)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div class="forecast" aria-label="${isCurrentMonth ? '预计本月三餐' : '预计该月三餐'}">
            <div class="forecast-copy">
              <div class="forecast-label">${isCurrentMonth ? '预计本月三餐' : '预计该月三餐'}</div>
              <div class="forecast-note">${
                ms.threeDaily == null
                  ? '有三餐记录后自动估算'
                  : `按三餐日均 ${fen.yuan(ms.threeDaily)} × ${ms.threeProjectionDays} 天估算 · 不含零食`
              }</div>
            </div>
            <div class="forecast-value">${
              ms.threeProjection == null ? '<span class="muted">—</span>' : fen.compact(ms.threeProjection)
            }</div>
          </div>
          <p class="notes" style="margin-top:10px">
            <b>三餐合计 = 早餐 + 午餐 + 晚餐</b>；零食单列，不计入三餐。<br>
            餐饮合计（含零食）${fen.yuan(ms.sum)} · 子预算 ${fen.compact(ms.budget)} ·
            ${ms.over > 0 ? `<span class="tag-over">超 ${fen.compact(ms.over)}</span>`
              : `<span class="tag-ok">剩 ${fen.compact(ms.budget - ms.sum)}</span>`}<br>
            日均 = 月总额 ÷ 有记录天数。
          </p>
        </div>

        <div class="section">
          <div class="section-head"><h2>三餐对比</h2></div>
          <div class="card">${hbars(ms.rows)}</div>
        </div>

        <div class="section">
          <div class="section-head">
            <h2>餐饮之外</h2>
            <span class="hint">合计 ${fen.compact(os.sum)} · 占 ${Math.round(os.share)}%</span>
          </div>
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr><th>分类</th><th>月总额</th><th>占比</th><th>日均</th><th>笔数</th><th>vs 上月</th></tr>
              </thead>
              <tbody>
                ${osRows.length === 0
                  ? `<tr><td colspan="6" style="text-align:center;color:var(--ink-3);padding:24px">这个月还没有餐饮之外的支出</td></tr>`
                  : osRows.map((r) => `
                  <tr class="is-tap" data-cat-row="${r.id}">
                    <td class="rowname">${r.name}</td>
                    <td>${fen.compact(r.sum)}</td>
                    <td>${r.share.toFixed(1)}%</td>
                    <td>${fen.compact(r.daily)}</td>
                    <td>${r.count}</td>
                    <td>${r.delta == null ? '<span class="delta-flat">—</span>'
                      : r.delta > 1 ? `<span class="delta-up">↑ ${Math.round(r.delta)}%</span>`
                      : r.delta < -1 ? `<span class="delta-down">↓ ${Math.abs(Math.round(r.delta))}%</span>`
                      : '<span class="delta-flat">—</span>'}</td>
                  </tr>`).join('')}
              </tbody>
              ${osRows.length ? `<tfoot><tr>
                <td>合计</td><td>${fen.compact(os.sum)}</td><td>${os.share.toFixed(1)}%</td>
                <td>${fen.compact(os.daily)}</td><td>${os.count}</td>
                <td>${os.delta == null ? '—' : `${os.delta > 0 ? '↑' : '↓'} ${Math.abs(Math.round(os.delta))}%`}</td>
              </tr></tfoot>` : ''}
            </table>
          </div>
        </div>

        ${st.state === 'over' ? `
          <div class="section">
            <div class="section-head">
              <h2>超支归因</h2>
              <span class="hint">已超 ${fen.yuan(st.overspend)}</span>
            </div>
            <div class="card">
              ${reasons.length ? `<div class="reason">
                ${reasons.map((r) => `
                  <div class="reason-row">
                    <span class="reason-name">${r.name}</span>
                    <span class="reason-amt">超 ${fen.compact(r.over)}</span>
                    <span class="reason-detail">花了 ${fen.compact(r.sum)} / 预算 ${fen.compact(r.budget)}</span>
                  </div>`).join('')}
              </div>` : `
              <div class="reason is-share">
                ${topSpend.map((r) => `
                  <div class="reason-row">
                    <span class="reason-name">${r.name}</span>
                    <span class="reason-amt">${fen.compact(r.sum)}</span>
                    <span class="reason-detail">占总支出 ${Math.round((r.sum / Math.max(1, t.expense)) * 100)}%</span>
                  </div>`).join('')}
              </div>
              <p class="notes" style="margin-top:14px">
                各分类都没超自己的子预算，超的是总额：分类额度合计 ${fen.compact(catBudgetSum)}，
                比月总预算 ${fen.compact(st.budget)} 高出 ${fen.compact(catBudgetSum - st.budget)}。
                要么把分类额度改小，要么把月总预算调回 ${fen.compact(catBudgetSum)}。
              </p>`}
            </div>
          </div>` : ''}

        <div class="section">
          <div class="section-head"><h2>${st.state === 'over' ? '怎么补救' : '本月进度'}</h2></div>
          <div class="advice">${advice(mk).map((l) => `<p style="margin:0 0 6px">${l}</p>`).join('')}</div>
        </div>
      </div>`;
  },

  mount(root) {
    bind(root, (e) => {
      const meal = e.target.closest('[data-tray]')?.dataset.tray || e.target.closest('[data-meal-row]')?.dataset.mealRow;
      const ms = mealStats(state.month);
      const os = otherStats(state.month);

      if (meal === 'other') {
        const budget = os.rows.reduce((a, r) => a + r.budget, 0);
        openCatList(root, '其他花费', { used: os.sum, budget });
        return;
      }
      if (meal) {
        const row = ms.rows.find((r) => r.id === meal);
        openCatList(root, `${row?.name || meal}的明细`, {
          mealType: meal, used: row?.sum ?? 0, budget: row?.budget ?? 0,
        });
        return;
      }
      const cat = e.target.closest('[data-cat-row]')?.dataset.catRow;
      if (cat) {
        const row = os.rows.find((r) => r.id === cat);
        openCatList(root, `${catById(cat).name}的明细`, {
          categoryId: cat, used: row?.sum ?? 0, budget: row?.budget ?? 0,
        });
      }
    });
  },
};

function openCatList(root, title, filter = {}) {
  void root;
  const list = monthRecords(state.month).filter((r) => {
    if (r.type !== 'expense') return false;
    if (filter.mealType && r.mealType !== filter.mealType) return false;
    if (filter.categoryId && r.categoryId !== filter.categoryId) return false;
    if (!filter.mealType && !filter.categoryId && r.categoryId === 'food') return false;
    return true;
  });
  const sum = list.reduce((a, r) => a + r.amount, 0);

  openSheet({
    title,
    body: `
      ${summaryHtml(filter.used != null ? filter.used : sum, filter.budget)}
      ${list.length === 0
        ? `<div class="empty"><p>没有对应的流水。</p></div>`
        : `<p class="notes" style="margin-bottom:12px">共 ${list.length} 笔</p>
        <div class="list">${list.map((r) => {
          const c = catById(r.categoryId);
          const m = mealById(r.mealType);
          return `<div class="list-row">
            <span class="ledger-ic" style="--cat:${c.color}">${icon(m?.icon || c.icon, 16)}</span>
            <span class="list-lab">${c.name}${m ? ` · ${m.name}` : ''}
              <span class="ledger-sub" style="display:block">${r.date}${r.note ? ` · ${esc(r.note)}` : ''}</span></span>
            <span class="list-val">${fen.format(r.amount)}</span>
          </div>`;
        }).join('')}</div>`}`,
  });
}

/** 点开柱子后顶部的「用了 / 剩余」摘要 */
function summaryHtml(used, budget) {
  const hasBudget = budget > 0;
  const left = (budget || 0) - used;
  const over = hasBudget && left < 0;
  const ratio = hasBudget ? Math.min(100, (used / budget) * 100) : 0;

  return `<div class="card" style="margin-bottom:var(--sp-4)">
    <div style="display:flex;justify-content:${hasBudget ? 'space-between' : 'flex-start'};align-items:flex-end;gap:12px">
      <span>
        <span class="kpi-lab">用了</span>
        <span class="kpi-val" style="display:block">${fen.yuan(used)}</span>
      </span>
      ${hasBudget ? `
      <span style="text-align:right">
        <span class="kpi-lab">${over ? '超了' : '剩余'}</span>
        <span class="kpi-val ${over ? 'is-over' : ''}" style="display:block">${fen.yuan(Math.abs(left))}</span>
      </span>` : ''}
    </div>
    ${hasBudget ? `
      <div class="bar ${over ? 'is-over' : ''}" style="margin-top:12px">
        <div class="bar-fill" style="width:${ratio}%;background:${over ? 'var(--over)' : 'var(--ink-3)'}"></div>
      </div>
      <div class="kpi-note" style="margin-top:8px">子预算 ${fen.yuan(budget)} · 已用 ${Math.round((used / budget) * 100)}%</div>`
      : `<div class="kpi-note" style="margin-top:8px">没有设子预算，只统计合计</div>`}
  </div>`;
}

// ================================================================ 我的
export const meView = {
  html() {
    const b = store.state.budget;
    const st = budgetStatus();
    const ms = mealStats();
    const os = otherStats();
    const mode = OVERSPEND_MODES.find((m) => m.id === b.overspendMode);
    const theme = THEME_OPTIONS.find((t) => t.id === store.state.settings.theme) || THEME_OPTIONS[0];
    const catTotal = Object.values(b.category).reduce((a, v) => a + v, 0);
    // 三餐子预算只管早/午/晚 —— 零食不设子预算，只统计合计
    const mealTotal = MEALS.filter((m) => m.id !== 'snack')
      .reduce((a, m) => a + (b.meals[m.id] || 0), 0);

    return `
      <div class="screen">
        <div class="screen-head">
          <h1>我的</h1>
          <span class="sub">${d.monthLabel(state.month)}</span>
        </div>

        ${store.recoveredFrom() === 'snapshot' ? `<div class="banner" style="background:color-mix(in srgb, var(--alert) 10%, var(--surface-sunk))">
          ${icon('shield', 16)}
          <span>上次打开时<b>主数据读不出来</b>，已自动从备份快照恢复。建议现在做一次「备份到文件」。</span>
        </div>` : ''}

        ${store.isSeeded() ? `<div class="banner">
          ${icon('dots', 16)}
          <span>账本里是<b>你 9/13–9/23 的真实记录</b>（从笔记导入）。之后每天记新的就行，不用再管这份历史。</span>
        </div>` : ''}

        <div class="section">
          <div class="section-head"><h2>预算</h2><span class="hint">每月 1 日自动重置</span></div>
          <div class="list">
            <button class="list-row" type="button" data-set="total">
              <span class="list-lab">月总预算</span>
              <span class="list-val">${fen.yuan(b.total)}</span>
              <span class="list-chev">${icon('chevron', 16)}</span>
            </button>
            <button class="list-row" type="button" data-set="category">
              <span class="list-lab">分类子预算</span>
              <span class="list-val">${fen.compact(catTotal)} / ${fen.compact(b.total)}</span>
              <span class="list-chev">${icon('chevron', 16)}</span>
            </button>
            <button class="list-row" type="button" data-set="meals">
              <span class="list-lab">三餐子预算</span>
              <span class="list-val">${fen.compact(mealTotal)}</span>
              <span class="list-chev">${icon('chevron', 16)}</span>
            </button>
            <button class="list-row" type="button" data-set="mode">
              <span class="list-lab">超支处理</span>
              <span class="list-val">${mode?.name || '宽松'}</span>
              <span class="list-chev">${icon('chevron', 16)}</span>
            </button>
          </div>
          ${st.carry !== 0 ? `<p class="notes" style="margin-top:8px">
            本月生效预算 ${fen.yuan(st.budget)}（${st.carry > 0 ? '含上月结余滚存' : '已扣上月超支'} ${fen.compact(Math.abs(st.carry))}）。
          </p>` : ''}
        </div>

        <div class="section">
          <div class="section-head"><h2>本月速览</h2></div>
          <div class="list">
            <div class="list-row"><span class="list-lab">总支出</span><span class="list-val">${fen.yuan(st.spent)}</span></div>
            <div class="list-row"><span class="list-lab">餐饮合计</span><span class="list-val">${fen.yuan(ms.sum)}</span></div>
            <div class="list-row"><span class="list-lab">其他花费合计</span><span class="list-val">${fen.yuan(os.sum)}</span></div>
            <div class="list-row"><span class="list-lab">预算状态</span>
              <span class="list-val" style="color:var(--st);font-weight:650">${st.state === 'over' ? `超 ${fen.compact(st.overspend)}` : st.label}</span></div>
          </div>
        </div>

        <div class="section">
          <div class="section-head"><h2>外观</h2><span class="hint">可强制浅色或深色</span></div>
          <div class="list">
            <button class="list-row" type="button" data-set="theme">
              <span class="list-lab">主题模式</span>
              <span class="list-val">${theme.name}</span>
              <span class="list-chev">${icon('chevron', 16)}</span>
            </button>
          </div>
        </div>

        <div class="section">
          <div class="section-head"><h2>数据</h2><span class="hint">只存在这台设备</span></div>
          <div class="list">
            <button class="list-row" type="button" data-act="backup">
              <span class="list-lab">备份到文件</span>
              <span class="list-val">${store.state.records.length} 条</span>
              <span class="list-chev">${icon('down', 17)}</span>
            </button>
            <button class="list-row" type="button" data-act="restore">
              <span class="list-lab">从文件恢复</span>
              <span class="list-chev">${icon('chevron', 16)}</span>
            </button>
            ${store.hasImportBackup() ? `
            <button class="list-row" type="button" data-act="undo">
              <span class="list-lab">撤销上次恢复</span>
              <span class="list-chev">${icon('chevron', 16)}</span>
            </button>` : ''}
            <button class="list-row" type="button" data-act="export">
              <span class="list-lab">导出 CSV</span>
              <span class="list-chev">${icon('down', 17)}</span>
            </button>
            <button class="list-row" type="button" data-act="demo">
              <span class="list-lab">重新载入内置历史</span>
              <span class="list-chev">${icon('chevron', 16)}</span>
            </button>
            <button class="list-row" type="button" data-act="clear">
              <span class="list-lab" style="color:var(--over)">清空全部记录</span>
              <span class="list-chev">${icon('trash', 17)}</span>
            </button>
          </div>
          <div class="list" style="margin-top:12px">
            <div class="list-row">
              <span class="list-lab">存储保护
                <span class="ledger-sub" style="display:block">${persistHint()}</span></span>
              <span class="list-val">${persistLabel()}</span>
            </div>
            <div class="list-row">
              <span class="list-lab">已用空间</span>
              <span class="list-val" id="usage">计算中…</span>
            </div>
            <div class="list-row">
              <span class="list-lab">离线队列
                <span class="ledger-sub" style="display:block">恢复网络后自动补同步</span></span>
              <span class="list-val" id="queue-count">检查中…</span>
            </div>
          </div>
          <p class="notes" style="margin-top:8px">
            浏览器存储可能被系统回收。建议每周点一次「备份到文件」，把导出的 json 存到网盘或微信收藏里；
            换网址、换手机时用「从文件恢复」导回来，记录一条都不会丢。
          </p>
        </div>

        <div class="section">
          <div class="section-head"><h2>口径说明</h2></div>
          <div class="card">
            <div class="notes">
              <p><b>日均</b>：分类日均 = 分类月总额 ÷ 当月已过天数；三餐日均 = 三餐合计 ÷ 有记录天数。</p>
              <p><b>预计</b>：预计三餐 = 三餐日均 × 当月天数，不含零食。</p>
              <p><b>三餐合计</b>：只算早餐 + 午餐 + 晚餐；<b>零食</b>单列一行，不算在三餐里，只统计合计。</p>
              <p><b>餐饮合计</b>：三餐 + 零食，等于「餐饮」分类支出，在统计页表格下方跟餐饮子预算对账。</p>
              <p><b>预算</b>：分类子预算之和可以小于总预算，差额算未分配额度。</p>
              <p><b>金额</b>：全程以「分」为单位整数计算，不会出现浮点误差。</p>
              <p><b>数据存储</b>：只存在这台设备的浏览器里，不上传任何服务器。</p>
            </div>
          </div>
        </div>
      </div>`;
  },

  mount(root) {
    const syncCountEl = root.querySelector('#queue-count');
    const refreshSyncCount = async () => {
      if (!syncCountEl) return;
      const count = await getQueueCount();
      syncCountEl.textContent = navigator.onLine
        ? (count ? `待补 ${count} 条` : '已同步')
        : (count ? `离线 ${count} 条` : '已同步');
    };
    refreshSyncCount();
    document.addEventListener('ubudget:queue-synced', refreshSyncCount);
    window.addEventListener('online', refreshSyncCount);
    window.addEventListener('offline', refreshSyncCount);
    bind(root, (e) => {
      const set = e.target.closest('[data-set]')?.dataset.set;
      if (set) { openSetting(set, root); return; }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'export') exportCSV();
      if (act === 'demo') { store.loadHistory(); toast('已载入 9/13–9/23 的记录'); rerender(root); }
      if (act === 'clear') clearAll(root);
      if (act === 'backup') backupFile();
      if (act === 'restore') restoreFromFile(root);
      if (act === 'undo') {
        if (store.undoImport()) { toast('已撤销上次恢复'); rerender(root); }
        else toast('没有可撤销的备份');
      }
    });

    store.usage().then((u) => {
      const el = root.querySelector('#usage');
      if (!el) return;
      el.textContent = u ? `${(u.used / 1024).toFixed(0)} KB` : '不支持查询';
    });
  },
};

// ---------------------------------------------------------------- 数据保护
function persistLabel() {
  const s = store.state.settings.persistState;
  return { granted: '已开启', denied: '未开启', unsupported: '不支持', unknown: '未知' }[s] || '未申请';
}

function persistHint() {
  const s = store.state.settings.persistState;
  if (s === 'granted') return '浏览器已同意长期保留本站数据，不会被自动清理。';
  if (s === 'denied') return '浏览器暂时不同意长期保留，数据仍可能被回收，请定期备份。';
  if (s === 'unsupported') return '这个浏览器不支持申请长期保留（iOS 常见），务必定期备份。';
  return '尚未申请。每次记账时会自动申请一次。';
}

export function backupFile() {
  const data = store.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `记账备份-${d.iso()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`已备份 ${data.records.length} 条记录`);
}

function restoreFromFile(root) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      toast('这个文件读不出来，可能不是备份文件');
      return;
    }
    const incoming = Array.isArray(data.records) ? data.records.length : 0;
    const ok = await confirmSheet({
      title: '恢复备份？',
      message: `备份里有 <b>${incoming}</b> 条记录，会覆盖当前的 <b>${store.state.records.length}</b> 条。<br><br>
                覆盖前会自动把当前账本另存一份，导错了可以在「我的 → 数据 → 撤销上次恢复」退回。`,
      confirmText: '恢复',
    });
    if (!ok) return;
    const res = store.importAll(data);
    if (!res.ok) { toast(res.error); return; }
    toast(`已恢复 ${res.count} 条记录`);
    rerender(root);
  });
  input.click();
}

function openSetting(kind, root) {
  const b = store.state.budget;

  if (kind === 'theme') {
    openSheet({
      title: '外观',
      body: `<div class="list">${THEME_OPTIONS.map((t) => `
        <button class="list-row" type="button" data-theme-choice="${t.id}">
          <span class="list-lab">${t.name}</span>
          ${store.state.settings.theme === t.id ? icon('check', 18) : ''}
        </button>`).join('')}</div>`,
      onMount(el) {
        el.addEventListener('click', (e) => {
          const choice = e.target.closest('[data-theme-choice]')?.dataset.themeChoice;
          if (!choice) return;
          store.setSetting({ theme: choice });
          applyTheme();
          closeSheet();
          rerender(root);
          toast('已更新外观');
        });
      },
    });
  }

  if (kind === 'total') {
    openSheet({
      title: '月总预算',
      body: `<label class="field"><span class="field-lab">每月可用金额（元）</span>
        <input type="number" inputmode="decimal" id="v" value="${(b.total / 100).toFixed(2)}" />
        <span class="hint">默认 ¥2,000，每月 1 日自动重置</span></label>`,
      footer: `<button class="btn" type="button" data-ok>保存</button>`,
      onMount(el) {
        el.querySelector('[data-ok]').addEventListener('click', () => {
          const v = Math.max(0, Math.round(Number(el.querySelector('#v').value) * 100) || 0);
          store.setBudget({ total: v }); closeSheet(); rerender(root); toast('已更新月预算');
        });
      },
    });
  }

  if (kind === 'category') {
    openSheet({
      title: '分类子预算',
      body: `<div class="list">${EXPENSE_CATS.map((c) => `
        <label class="list-row">
          <span class="ledger-ic" style="--cat:${c.color}">${icon(c.icon, 16)}</span>
          <span class="list-lab">${c.name}</span>
          <input type="number" inputmode="decimal" data-cb="${c.id}" value="${((b.category[c.id] || 0) / 100).toFixed(0)}"
            style="width:96px;text-align:right;border:1px solid var(--line);border-radius:8px;padding:7px 9px;font-family:var(--num)" />
        </label>`).join('')}</div>
        <div style="display:grid;gap:8px;margin-top:16px">
          <p class="notes" id="sumbox"></p>
          <button class="btn btn--ghost btn--sm" type="button" data-preset>套用 ¥2,000 建议模板</button>
        </div>`,
      footer: `<button class="btn" type="button" data-ok>保存</button>`,
      onMount(el) {
        const sumbox = el.querySelector('#sumbox');
        const readAll = () => {
          const out = {};
          el.querySelectorAll('[data-cb]').forEach((i) => { out[i.dataset.cb] = Math.round(Number(i.value) * 100) || 0; });
          return out;
        };
        const sync = () => {
          const vals = readAll();
          const sum = Object.values(vals).reduce((a, v) => a + v, 0);
          const diff = b.total - sum;
          sumbox.innerHTML = `分类合计 ${fen.yuan(sum)}，${diff >= 0
            ? `还剩 ${fen.yuan(diff)} 未分配。` : `已超出总预算 ${fen.yuan(-diff)}。`}`;
        };
        el.addEventListener('input', sync);
        el.querySelector('[data-preset]').addEventListener('click', () => {
          const preset = { food: 1000, life: 200, study: 150, transport: 150, fun: 300, reserve: 200, other: 0 };
          for (const [k, v] of Object.entries(preset)) {
            const input = el.querySelector(`[data-cb="${k}"]`);
            if (input) input.value = v;
          }
          el.querySelector('[data-cb="food"]')?.focus();
          sync();
        });
        sync();
        el.querySelector('[data-ok]').addEventListener('click', () => {
          store.setBudget({ category: readAll() }); closeSheet(); rerender(root); toast('已更新分类子预算');
        });
      },
    });
  }

  if (kind === 'meals') {
    openSheet({
      title: '三餐子预算',
      body: `<div class="list">${MEALS.filter((m) => m.id !== 'snack').map((m) => `
        <label class="list-row">
          <span class="ledger-ic" style="--cat:var(--c-food)">${icon(m.icon, 16)}</span>
          <span class="list-lab">${m.name}</span>
          <input type="number" inputmode="decimal" data-mb="${m.id}" value="${((b.meals[m.id] || 0) / 100).toFixed(0)}"
            style="width:96px;text-align:right;border:1px solid var(--line);border-radius:8px;padding:7px 9px;font-family:var(--num)" />
        </label>`).join('')}</div>
        <p class="notes" style="margin-top:16px">
          这里只设早/午/晚三个子预算；<b>零食不设子预算</b>，在统计页只统计合计。<br>
          三者之和建议不超过「餐饮」分类的预算，这样「分类 → 三餐」才是二级管控。
        </p>`,
      footer: `<button class="btn" type="button" data-ok>保存</button>`,
      onMount(el) {
        el.querySelector('[data-ok]').addEventListener('click', () => {
          const out = {};
          el.querySelectorAll('[data-mb]').forEach((i) => { out[i.dataset.mb] = Math.round(Number(i.value) * 100) || 0; });
          out.snack = 0;                 // 零食不再设子预算，明确清零
          store.setBudget({ meals: out }); closeSheet(); rerender(root); toast('已更新三餐子预算');
        });
      },
    });
  }

  if (kind === 'mode') {
    openSheet({
      title: '超支怎么处理',
      body: `<div class="list">${OVERSPEND_MODES.map((m) => `
        <button class="list-row" type="button" data-mode="${m.id}">
          <span class="list-lab">${m.name}
            <span class="ledger-sub" style="display:block">${m.desc}</span></span>
          ${b.overspendMode === m.id ? icon('check', 18) : ''}
        </button>`).join('')}</div>`,
      onMount(el) {
        el.addEventListener('click', (e) => {
          const id = e.target.closest('[data-mode]')?.dataset.mode;
          if (!id) return;
          store.setBudget({ overspendMode: id }); closeSheet(); rerender(root); toast('已切换');
        });
      },
    });
  }
}

async function clearAll(root) {
  const ok = await confirmSheet({
    title: '清空全部记录？',
    message: `会删除账本里的 <b>${store.state.records.length}</b> 笔记录，只保留预算设置。此操作无法撤销。`,
    confirmText: '清空',
    danger: true,
  });
  if (!ok) return;
  store.clearRecords();
  toast('已清空');
  rerender(root);
}

function exportCSV() {
  const rows = [['日期', '类型', '分类', '餐次', '金额(元)', '账户', '备注']];
  for (const r of monthRecords(state.month)) {
    const c = catById(r.categoryId);
    const m = mealById(r.mealType);
    rows.push([
      r.date,
      r.type === 'income' ? '收入' : '支出',
      c.name,
      m?.name || '',
      fen.toYuan(r.amount),
      ACCOUNTS.find((a) => a.id === r.accountId)?.name || '',
      (r.note || '').replace(/"/g, '""'),
    ]);
  }
  const csv = '\uFEFF' + rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `记账-${state.month}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('已导出 CSV');
}

// ================================================================ 月份切换
function monthNav() {
  const cur = d.monthKey();
  const isCur = state.month === cur;
  return `
    <div class="strip" style="display:flex;align-items:center;justify-content:space-between">
      <button class="nav-btn" type="button" data-month="-1" aria-label="上个月">‹</button>
      <span class="nav-title">${d.monthLabel(state.month)}${isCur ? ' · 本月' : ''}</span>
      <button class="nav-btn" type="button" data-month="1" aria-label="下个月" ${isCur ? 'disabled' : ''}>›</button>
    </div>`;
}

export function gotoMonth(delta) {
  const [y, m] = state.month.split('-').map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  state.month = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  if (state.month > d.monthKey()) state.month = d.monthKey();
}

export { monthLabelShort };
