import { d, fen, pct } from './format.js';

const KEY = 'ubudget.v2';
const SNAPSHOT_KEY = 'ubudget.v2.snapshot';   // 冗余快照：主数据损坏时用它自救
const LEGACY_KEY = 'ubudget.v1';

/** 三餐的默认时间，用于历史数据与补记 */
const MEAL_TIME = { breakfast: '07:30', lunch: '12:10', dinner: '18:00', snack: '21:30' };

export function nowHHMM(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export const EXPENSE_CATS = [
  { id: 'food',      name: '餐饮',     icon: 'bowl',   color: 'var(--c-food)',      meals: true },
  { id: 'life',      name: '生活用品', icon: 'bottle', color: 'var(--c-life)' },
  { id: 'study',     name: '学习',     icon: 'book',   color: 'var(--c-study)' },
  { id: 'transport', name: '交通',     icon: 'bus',    color: 'var(--c-transport)' },
  { id: 'fun',       name: '娱乐社交', icon: 'people', color: 'var(--c-fun)' },
  { id: 'reserve',   name: '备用金',   icon: 'shield', color: 'var(--c-reserve)' },
  { id: 'other',     name: '其他',     icon: 'dots',   color: 'var(--c-other)' },
];

export const INCOME_CATS = [
  { id: 'allowance', name: '生活费', icon: 'wallet',  color: 'var(--c-income)' },
  { id: 'scholar',   name: '奖学金', icon: 'medal',   color: 'var(--c-income)' },
  { id: 'redpack',   name: '红包',   icon: 'redpack', color: 'var(--c-income)' },
  { id: 'reimburse', name: '报销',   icon: 'receipt', color: 'var(--c-income)' },
  { id: 'inc-other', name: '其他',   icon: 'dots',    color: 'var(--c-income)' },
];

export const MEALS = [
  { id: 'breakfast', name: '早餐', icon: 'sun',      color: 'var(--c-food)' },
  { id: 'lunch',     name: '午餐', icon: 'sunhigh',  color: 'var(--c-food)' },
  { id: 'dinner',    name: '晚餐', icon: 'moon',     color: 'var(--c-food)' },
  { id: 'snack',     name: '零食', icon: 'star',     color: 'var(--c-food)' },
];

export const ACCOUNTS = [
  { id: 'wechat', name: '微信' },
  { id: 'alipay', name: '支付宝' },
  { id: 'card',   name: '银行卡' },
  { id: 'cash',   name: '现金' },
];

export const OVERSPEND_MODES = [
  { id: 'loose',    name: '宽松',   desc: '超支不滚存，下月预算仍为 ¥2,000，只作警示。' },
  { id: 'strict',   name: '严格',   desc: '超支部分从下月扣：下月预算 = 月预算 − 本月超支。' },
  { id: 'rollover', name: '结余滚存', desc: '没花完的结余累加到下月，可设上限。' },
];

export const catById = (id) =>
  EXPENSE_CATS.find((c) => c.id === id) || INCOME_CATS.find((c) => c.id === id) ||
  { id, name: id, icon: 'dots', color: 'var(--c-other)' };

export const mealById = (id) => MEALS.find((m) => m.id === id) || null;

const DEFAULT_BUDGET = {
  mode: 'monthly',
  total: 200000,                 // ¥2,000
  category: { food: 100000, life: 20000, study: 15000, transport: 15000, fun: 30000, reserve: 20000, other: 0 },
  meals: { breakfast: 15000, lunch: 40000, dinner: 45000, snack: 0 },
  overspendMode: 'loose',
  rolloverCap: 50000,
  alertThreshold: 0.7,
};

function emptyState() {
  return {
    version: 1,
    records: [],
    budget: structuredClone(DEFAULT_BUDGET),
    settings: { defaultAccountId: 'wechat', seeded: false },
  };
}

// ---------------------------------------------------------------- 历史记录
// 来自用户 9/13–9/23 的流水记录。
// 解析口径：「吃饭 6.5+13+10」三个数字＝早餐+午餐+晚餐；
//          「吃饭 14+13」两个数字＝午餐+晚餐（早餐都在 6–8.5，两位数不可能是早餐）。
const HISTORY_MONTH = '2026-09';
const HISTORY = [
  // 9/13　吃饭 14+13　办校园网 50　充校园卡 10　垃圾桶 9
  { day: 13, cat: 'food',  meal: 'lunch',  yuan: 14,     note: '' },
  { day: 13, cat: 'food',  meal: 'dinner', yuan: 13,     note: '' },
  { day: 13, cat: 'other',                 yuan: 50,     note: '办校园网' },
  { day: 13, cat: 'other',                 yuan: 10,     note: '充校园卡' },
  { day: 13, cat: 'life',                  yuan: 9,      note: '垃圾桶' },
  // 9/14　吃饭 8.5+13+13　生活用品 23　一箱水 9.9
  { day: 14, cat: 'food',  meal: 'breakfast', yuan: 8.5,  note: '' },
  { day: 14, cat: 'food',  meal: 'lunch',     yuan: 13,   note: '' },
  { day: 14, cat: 'food',  meal: 'dinner',    yuan: 13,   note: '' },
  { day: 14, cat: 'life',                     yuan: 23,   note: '生活用品' },
  { day: 14, cat: 'life',                     yuan: 9.9,  note: '一箱水' },
  // 9/15　吃饭 8+13+11
  { day: 15, cat: 'food',  meal: 'breakfast', yuan: 8,    note: '' },
  { day: 15, cat: 'food',  meal: 'lunch',     yuan: 13,   note: '' },
  { day: 15, cat: 'food',  meal: 'dinner',    yuan: 11,   note: '' },
  // 9/16　吃饭 6.5+13+10　短袖 79.9　卫裤 79.9
  { day: 16, cat: 'food',  meal: 'breakfast', yuan: 6.5,  note: '' },
  { day: 16, cat: 'food',  meal: 'lunch',     yuan: 13,   note: '' },
  { day: 16, cat: 'food',  meal: 'dinner',    yuan: 10,   note: '' },
  { day: 16, cat: 'life',                     yuan: 79.9, note: '短袖' },
  { day: 16, cat: 'life',                     yuan: 79.9, note: '卫裤' },
  // 9/17　吃饭 6.5+15+16　画材 13.43+36.8+8　晾衣架 5.07　雪糕 3
  { day: 17, cat: 'food',  meal: 'breakfast', yuan: 6.5,  note: '' },
  { day: 17, cat: 'food',  meal: 'lunch',     yuan: 15,   note: '' },
  { day: 17, cat: 'food',  meal: 'dinner',    yuan: 16,   note: '' },
  { day: 17, cat: 'study',                    yuan: 13.43, note: '画材' },
  { day: 17, cat: 'study',                    yuan: 36.8, note: '画材' },
  { day: 17, cat: 'study',                    yuan: 8,    note: '画材' },
  { day: 17, cat: 'life',                     yuan: 5.07, note: '晾衣架' },
  { day: 17, cat: 'food',  meal: 'snack',     yuan: 3,    note: '雪糕' },
  // 9/18　吃饭 6+14+12
  { day: 18, cat: 'food',  meal: 'breakfast', yuan: 6,    note: '' },
  { day: 18, cat: 'food',  meal: 'lunch',     yuan: 14,   note: '' },
  { day: 18, cat: 'food',  meal: 'dinner',    yuan: 12,   note: '' },
  // 9/19　吃饭 12+13　剃须刀 56.8　生活费 545.5
  { day: 19, cat: 'food',  meal: 'lunch',     yuan: 12,   note: '' },
  { day: 19, cat: 'food',  meal: 'dinner',    yuan: 13,   note: '' },
  { day: 19, cat: 'life',                     yuan: 56.8, note: '剃须刀' },
  // 9/20　吃饭 5+13+10
  { day: 20, cat: 'food',  meal: 'breakfast', yuan: 5,    note: '' },
  { day: 20, cat: 'food',  meal: 'lunch',     yuan: 13,   note: '' },
  { day: 20, cat: 'food',  meal: 'dinner',    yuan: 10,   note: '' },
  // 9/21　吃饭 5+14　水果 10　饮料 3.5（水果和饮料算零食）
  { day: 21, cat: 'food',  meal: 'breakfast', yuan: 5,    note: '' },
  { day: 21, cat: 'food',  meal: 'lunch',     yuan: 14,   note: '' },
  { day: 21, cat: 'food',  meal: 'snack',     yuan: 10,   note: '水果' },
  { day: 21, cat: 'food',  meal: 'snack',     yuan: 3.5,  note: '饮料' },
  { day: 21, cat: 'food',  meal: 'dinner',    yuan: 14,   note: '', time: '17:45' },
  { day: 21, cat: 'other',                    yuan: 12.5, note: '电费', time: '20:26' },
  // 9/22　早餐 4　午餐 13　体检费 90　晚餐 9.8
  { day: 22, cat: 'food',  meal: 'breakfast', yuan: 4,    note: '', time: '11:23' },
  { day: 22, cat: 'food',  meal: 'lunch',     yuan: 13,   note: '', time: '11:23' },
  { day: 22, cat: 'other',                    yuan: 90,   note: '体检费', time: '12:00' },
  { day: 22, cat: 'food',  meal: 'dinner',    yuan: 9.8,  note: '', time: '16:23' },
  // 9/23　早餐 4.5　午餐 14
  { day: 23, cat: 'food',  meal: 'breakfast', yuan: 4.5,  note: '', time: '08:55' },
  { day: 23, cat: 'food',  meal: 'lunch',     yuan: 14,   note: '', time: '10:47' },
];

function buildHistory() {
  const recs = HISTORY.map((h, i) => ({
    id: `h-${HISTORY_MONTH}-${i}`,
    type: 'expense',
    amount: Math.round(h.yuan * 100),
    categoryId: h.cat,
    mealType: h.meal || null,
    accountId: 'wechat',
    date: `${HISTORY_MONTH}-${String(h.day).padStart(2, '0')}`,
    time: h.time || MEAL_TIME[h.meal] || '12:00',
    note: h.note,
    mealCount: 1,
    createdAt: `${HISTORY_MONTH}-${String(h.day).padStart(2, '0')}T12:00:00.000Z`,
  }));
  // 笔记最后那行「生活费 545.5」是你自己对账用的合计，不是一笔收入，所以不入账。
  return recs;
}

/** 旧版本里用户自己记过的账（排除掉我生成的演示数据） */
function migratableRecords() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const old = JSON.parse(raw);
    return (old.records || []).filter((r) => !String(r.id).startsWith('demo-'));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------- 状态
// 注意：这两个变量必须在 load() 之前声明 —— load() 会用到 recoveredFrom，
// 声明在后面会踩「暂时性死区」，只有在真的触发恢复时才炸，正常启动看不出来。
let recoveredFrom = null;
let state = null;
const listeners = new Set();

function parseState(raw) {
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.records)) throw new Error('账本结构不对');
  parsed.budget = { ...structuredClone(DEFAULT_BUDGET), ...parsed.budget };
  parsed.settings = { defaultAccountId: 'wechat', seeded: false, ...parsed.settings };
  return parsed;
}

function load() {
  // 先读主数据；读不出来就读冗余快照；都不行才用内置历史重新开始。
  // 关键点：任何一步失败都不会静默把你的账本换成空白的。
  for (const [key, label] of [[KEY, '主数据'], [SNAPSHOT_KEY, '备份快照']]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = parseState(raw);
      if (key === SNAPSHOT_KEY) {
        recoveredFrom = 'snapshot';
        console.warn('主数据读取失败，已从备份快照恢复');
        // 顺手把主数据修好，否则下次打开还会再走一遍恢复
        try { localStorage.setItem(KEY, raw); } catch { /* 存不下就算了 */ }
      }
      return parsed;
    } catch (err) {
      console.warn(`${label} 读取失败：`, err);
      recoveredFrom = key === KEY ? 'main-broken' : recoveredFrom;
    }
  }
  const fresh = emptyState();
  // 旧设备上如果有用户自己记过的账，先搬过来，再接上内置历史。
  fresh.records = [...migratableRecords(), ...buildHistory()];
  fresh.settings.seeded = true;
  try { localStorage.setItem(KEY, JSON.stringify(fresh)); } catch { /* 隐私模式下忽略 */ }
  return fresh;
}

function persist() {
  const payload = JSON.stringify(state);
  try {
    localStorage.setItem(KEY, payload);
  } catch (err) {
    console.warn('主数据保存失败', err);
  }
  // 再写一份快照：两次写入之间被打断，也不会两处同时坏掉
  try {
    localStorage.setItem(SNAPSHOT_KEY, payload);
  } catch { /* 存不下就只留主数据 */ }
}

function emit() { listeners.forEach((fn) => fn()); }

state = load();

export const store = {
  get state() { return state; },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  load,

  addRecord(rec) {
    const record = {
      id: `r-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
      mealCount: 1,
      note: '',
      time: nowHHMM(),
      ...rec,
      createdAt: new Date().toISOString(),
    };
    state.records.push(record);
    persist(); emit();
    return record;
  },
  updateRecord(id, patch) {
    const i = state.records.findIndex((r) => r.id === id);
    if (i < 0) return;
    state.records[i] = { ...state.records[i], ...patch };
    persist(); emit();
  },
  deleteRecord(id) {
    state.records = state.records.filter((r) => r.id !== id);
    persist(); emit();
  },
  setBudget(patch) {
    state.budget = { ...state.budget, ...patch };
    persist(); emit();
  },
  setSetting(patch) {
    state.settings = { ...state.settings, ...patch };
    persist(); emit();
  },
  clearRecords() {
    state.records = [];
    state.settings.seeded = false;
    persist(); emit();
  },
  loadHistory() {
    state.records = buildHistory();
    state.settings.seeded = true;
    persist(); emit();
  },
  isSeeded() { return !!state.settings.seeded; },
  recoveredFrom() { return recoveredFrom; },

  /** 申请持久化存储：让浏览器尽量不回收本站数据 */
  async requestPersistence() {
    try {
      if (!navigator.storage?.persist) {
        state.settings.persistState = 'unsupported';
        persist();
        return 'unsupported';
      }
      if (await navigator.storage.persisted?.()) {
        state.settings.persistState = 'granted';
        persist();
        return 'granted';
      }
      const ok = await navigator.storage.persist();
      state.settings.persistState = ok ? 'granted' : 'denied';
      persist();
      return state.settings.persistState;
    } catch {
      state.settings.persistState = 'unknown';
      return 'unknown';
    }
  },

  /** 估算占用，用于「我的」页显示数据量 */
  async usage() {
    try {
      const est = await navigator.storage?.estimate?.();
      if (!est) return null;
      return { used: est.usage || 0, quota: est.quota || 0 };
    } catch { return null; }
  },

  /** 完整备份：导出成一个文件，换设备 / 换网址都不会丢 */
  exportAll() {
    return {
      app: 'university-budget-app',
      format: 1,
      exportedAt: new Date().toISOString(),
      counts: { records: state.records.length },
      budget: state.budget,
      settings: { defaultAccountId: state.settings.defaultAccountId },
      records: state.records,
    };
  },

  /** 恢复备份：返回 {ok, count, error} */
  importAll(data) {
    if (!data || data.app !== 'university-budget-app' || !Array.isArray(data.records)) {
      return { ok: false, error: '这不是本应用导出的备份文件' };
    }
    const bad = data.records.find((r) => typeof r.amount !== 'number' || typeof r.date !== 'string');
    if (bad) return { ok: false, error: '备份里有损坏的记录，已中止导入' };

    // 覆盖前先把当前账本另存一份，万一导错了还能退回
    try {
      localStorage.setItem(`${KEY}.before-import`, JSON.stringify(state));
    } catch { /* 存不下就跳过 */ }

    state.records = data.records;
    if (data.budget) state.budget = { ...structuredClone(DEFAULT_BUDGET), ...data.budget };
    if (data.settings?.defaultAccountId) state.settings.defaultAccountId = data.settings.defaultAccountId;
    state.settings.seeded = true;
    persist(); emit();
    return { ok: true, count: data.records.length };
  },

  /** 撤销上一次导入 */
  undoImport() {
    try {
      const raw = localStorage.getItem(`${KEY}.before-import`);
      if (!raw) return false;
      state = parseState(raw);
      persist(); emit();
      return true;
    } catch { return false; }
  },

  hasImportBackup() {
    try { return !!localStorage.getItem(`${KEY}.before-import`); } catch { return false; }
  },
};

// ---------------------------------------------------------------- 计算

const inMonth = (r, monthKey) => r.date.startsWith(monthKey);

export function monthRecords(monthKey = d.monthKey()) {
  return state.records
    .filter((r) => inMonth(r, monthKey))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.time || '').localeCompare(a.time || '');
    });
}

export function totals(monthKey = d.monthKey()) {
  let expense = 0, income = 0;
  for (const r of state.records) {
    if (!inMonth(r, monthKey)) continue;
    if (r.type === 'income') income += r.amount; else expense += r.amount;
  }
  return { expense, income, net: income - expense };
}

/** 滚存模式决定当月实际可用预算（PRD 3.4④） */
export function effectiveBudget(monthKey = d.monthKey()) {
  const base = state.budget.total;
  const mode = state.budget.overspendMode;
  if (mode === 'loose') return { amount: base, carry: 0, mode };

  const prev = d.prevMonth(monthKey);
  const prevExpense = totals(prev).expense;
  const prevBudget = state.budget.total;
  if (!prevExpense) return { amount: base, carry: 0, mode };

  if (mode === 'strict') {
    const over = Math.max(0, prevExpense - prevBudget);
    return { amount: Math.max(0, base - over), carry: -over, mode };
  }
  const saved = Math.max(0, prevBudget - prevExpense);
  const cap = state.budget.rolloverCap || 0;
  const carry = cap ? Math.min(saved, cap) : saved;
  return { amount: base + carry, carry, mode };
}

/** 预算状态：安全 / 注意 / 警戒 / 超支 */
export function budgetStatus(monthKey = d.monthKey()) {
  const { amount, carry, mode } = effectiveBudget(monthKey);
  const spent = totals(monthKey).expense;
  const ratio = amount ? spent / amount : 0;
  const remaining = amount - spent;
  const elapsed = Math.max(d.daysElapsed(monthKey), 1);
  const daysLeft = d.daysRemaining(monthKey);
  const dailyLeft = daysLeft > 0 ? remaining / daysLeft : remaining;
  const dailyBurn = spent / elapsed;

  let state_ = 'safe';
  if (ratio > 1) state_ = 'over';
  else if (ratio >= 0.9) state_ = 'alert';
  else if (ratio >= 0.7) state_ = 'warn';

  const label = { safe: '安全', warn: '注意', alert: '警戒', over: '超支' }[state_];

  // 按当前烧钱速度，预计几号用完
  let runOutDay = null;
  if (dailyBurn > 0 && remaining > 0 && dailyLeft > 0 && dailyBurn > dailyLeft) {
    runOutDay = Math.min(d.daysInMonth(monthKey), Math.ceil(new Date().getDate() + remaining / dailyBurn));
  }

  return {
    budget: amount, carry, mode, spent, remaining, ratio, state: state_, label,
    daysLeft, dailyLeft, dailyBurn, runOutDay,
    overspend: remaining < 0 ? -remaining : 0,
  };
}

/** 三餐统计（PRD 10.2）：月总额 / 有记录天数 / 日均 / 子预算 */
export function mealStats(monthKey = d.monthKey()) {
  const elapsed = Math.max(d.daysElapsed(monthKey), 1);
  const threeDates = new Set();
  const rows = MEALS.map((m) => {
    let sum = 0, count = 0;
    const dates = new Set();
    for (const r of state.records) {
      if (!inMonth(r, monthKey) || r.type !== 'expense' || r.mealType !== m.id) continue;
      sum += r.amount;
      count += r.mealCount || 1;
      const date = String(r.date).slice(0, 10);
      dates.add(date);
      if (m.id !== 'snack') threeDates.add(date);
    }
    const budget = state.budget.meals[m.id] || 0;
    return {
      ...m, sum, count, days: dates.size,
      avg: count > 0 ? Math.round(sum / count) : null,
      daily: dates.size > 0 ? Math.round(sum / dates.size) : null,
      budget,
      over: budget > 0 ? Math.max(0, sum - budget) : 0,
      saved: budget > 0 ? Math.max(0, budget - sum) : 0,
    };
  });
  const sum = rows.reduce((a, r) => a + r.sum, 0);
  const count = rows.reduce((a, r) => a + r.count, 0);
  const budget = MEALS.reduce((a, m) => a + (state.budget.meals[m.id] || 0), 0);
  // 「三餐合计」只算早/午/晚 —— 零食不属于三餐，单列且只统计合计。
  // 「餐饮合计」才等于四者之和，用来和「餐饮」分类预算对账。
  const three = rows.filter((r) => r.id !== 'snack');
  const threeSum = three.reduce((a, r) => a + r.sum, 0);
  const threeCount = three.reduce((a, r) => a + r.count, 0);
  const threeDays = threeDates.size;
  return {
    rows,
    sum, count, budget,
    daily: Math.round(sum / elapsed),
    avg: count > 0 ? Math.round(sum / count) : null,
    over: Math.max(0, sum - budget),
    threeSum, threeCount,
    threeAvg: threeCount > 0 ? Math.round(threeSum / threeCount) : null,
    threeDays,
    threeDaily: threeDays > 0 ? Math.round(threeSum / threeDays) : null,
  };
}

/** 餐饮之外各分类（PRD 10.3）：月总额 / 占比 / 日均 / 笔数 / 环比 */
export function otherStats(monthKey = d.monthKey()) {
  const elapsed = Math.max(d.daysElapsed(monthKey), 1);
  const prevKey = d.prevMonth(monthKey);
  const total = totals(monthKey).expense;

  const rows = EXPENSE_CATS.filter((c) => c.id !== 'food').map((c) => {
    let sum = 0, count = 0;
    for (const r of state.records) {
      if (!inMonth(r, monthKey) || r.type !== 'expense' || r.categoryId !== c.id) continue;
      sum += r.amount; count++;
    }
    let prev = 0;
    for (const r of state.records) {
      if (!inMonth(r, prevKey) || r.type !== 'expense' || r.categoryId !== c.id) continue;
      prev += r.amount;
    }
    const budget = state.budget.category[c.id] || 0;
    return {
      ...c, sum, count, prev, budget,
      share: pct(sum, total),
      daily: Math.round(sum / elapsed),
      delta: prev > 0 ? pct(sum - prev, prev) : null,
      over: budget > 0 ? Math.max(0, sum - budget) : 0,
    };
  }).filter((r) => r.sum > 0 || r.budget > 0);

  const sum = rows.reduce((a, r) => a + r.sum, 0);
  const count = rows.reduce((a, r) => a + r.count, 0);
  const prevSum = rows.reduce((a, r) => a + r.prev, 0);
  return {
    rows, sum, count, prev: prevSum,
    share: pct(sum, total),
    daily: Math.round(sum / elapsed),
    delta: prevSum > 0 ? pct(sum - prevSum, prevSum) : null,
  };
}

/** 超支归因 Top3（PRD 3.4②） */
export function overspendReasons(monthKey = d.monthKey()) {
  const rows = [];
  const foodSum = mealStats(monthKey).sum;
  const foodBudget = state.budget.category.food || 0;
  if (foodBudget > 0 && foodSum > foodBudget) {
    rows.push({ id: 'food', name: '餐饮', sum: foodSum, budget: foodBudget, over: foodSum - foodBudget });
  }
  for (const r of otherStats(monthKey).rows) {
    if (r.over > 0) rows.push({ id: r.id, name: r.name, sum: r.sum, budget: r.budget, over: r.over });
  }
  return rows.sort((a, b) => b.over - a.over).slice(0, 3);
}

/** 补救建议（PRD 3.4③） */
export function advice(monthKey = d.monthKey()) {
  const st = budgetStatus(monthKey);
  const ms = mealStats(monthKey);
  const elapsed = Math.max(d.daysElapsed(monthKey), 1);
  const lines = [];

  if (st.overspend > 0) {
    lines.push(`本月已超支 <b>${fen.yuan(st.overspend)}</b>，还剩 ${st.daysLeft} 天。`);
    const reasons = overspendReasons(monthKey);
    if (reasons.length) {
      lines.push(`超支主要来自 ${reasons.map((r) => r.name).join('、')}，这几类先停或砍半。`);
    }
    if (ms.sum > 0) {
      // 餐饮还能用的额度摊到剩余天数；若餐饮本身也超了，就按当前日均砍三成给目标。
      const foodLeft = Math.max(0, ms.budget - ms.sum);
      const cap = foodLeft > 0
        ? Math.round(foodLeft / Math.max(1, st.daysLeft))
        : Math.round(ms.daily * 0.7);
      lines.push(`餐饮目前日均 ${fen.yuan(ms.daily)}，剩下的日子尽量压到 <b>${fen.yuan(cap)}</b> 以内。`);
    }
    const saved = otherStats(monthKey).rows.filter((r) => r.budget > 0 && r.sum < r.budget);
    if (saved.length) {
      const s = saved.sort((a, b) => (b.budget - b.sum) - (a.budget - a.sum))[0];
      lines.push(`想留点余地，可以从「${s.name}」结余的 ${fen.yuan(s.budget - s.sum)} 里调剂。`);
    }
  } else if (st.state === 'alert' || st.state === 'warn') {
    lines.push(`本月已用 ${Math.round(st.ratio * 100)}%，剩 ${fen.yuan(st.remaining)}。`);
    lines.push(`余下 ${st.daysLeft} 天，每天花 <b>${fen.yuan(st.dailyLeft)}</b> 以内就能撑到月底。`);
    if (ms.rows.some((r) => r.over > 0)) {
      const over = ms.rows.filter((r) => r.over > 0).map((r) => r.name).join('、');
      lines.push(`${over}已经超了子预算，先盯着它。`);
    }
  } else {
    lines.push(`本月已用 ${Math.round(st.ratio * 100)}%，还剩 ${fen.yuan(st.remaining)}。`);
    lines.push(`按 ${st.daysLeft} 天算，日均可用 <b>${fen.yuan(st.dailyLeft)}</b>。`);
    if (ms.sum > 0) lines.push(`餐饮日均 ${fen.yuan(ms.daily)}，${ms.avg ? `单均 ${fen.yuan(ms.avg)}。` : ''}`);
  }
  return lines;
}

/** 当日三餐待记标记（PRD 10.5） */
export function todayMealDots(today = new Date()) {
  const iso = d.iso(today);
  const done = new Set(
    state.records.filter((r) => r.date === iso && r.mealType).map((r) => r.mealType)
  );
  return MEALS.map((m) => ({ ...m, done: done.has(m.id) }));
}

/** 本月剩余额度（供首页显示） */
export function monthLabelShort(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return y === new Date().getFullYear() ? `${m} 月` : `${y}/${m}`;
}
