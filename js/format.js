// 金额一律以「分」为单位整数存储与计算，避免浮点误差（PRD 6.4）。

export const fen = {
  fromYuan(str) {
    const s = String(str ?? '').trim();
    if (!s) return 0;
    if (!/^\d*\.?\d*$/.test(s)) return 0;
    const [int = '0', dec = ''] = s.split('.');
    const cents = (dec + '00').slice(0, 2);
    return Number(int || '0') * 100 + Number(cents || '0');
  },
  toYuan(f) {
    return (Math.round(f) / 100).toFixed(2);
  },
  /** 千分位，两位小数：1,234.50 */
  format(f, { sign = false } = {}) {
    const v = Math.round(f);
    const abs = Math.abs(v);
    const body = (abs / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (sign && v !== 0) return (v < 0 ? '−' : '+') + body;
    return (v < 0 ? '−' : '') + body;
  },
  /** 带 ¥ 前缀 */
  yuan(f, opts) {
    return '¥' + fen.format(f, opts);
  },
  /** 整数金额省略小数：¥1,234 */
  compact(f) {
    const v = Math.round(f);
    const abs = Math.abs(v);
    const body = abs % 100 === 0
      ? String(abs / 100).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      : fen.format(abs);
    return (v < 0 ? '−' : '') + body;
  },
};

export const d = {
  iso(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },
  monthKey(date = new Date()) {
    return d.iso(date).slice(0, 7);
  },
  fromIso(iso) {
    const [y, m, day] = iso.split('-').map(Number);
    return new Date(y, m - 1, day);
  },
  monthKeyOf(iso) {
    return iso.slice(0, 7);
  },
  /** 当月天数 */
  daysInMonth(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  },
  /** 当月已过天数（PRD：日均按已过天数计，月初不失真） */
  daysElapsed(monthKey, today = new Date()) {
    const cur = d.monthKey(today);
    if (monthKey < cur) return d.daysInMonth(monthKey);
    if (monthKey > cur) return 0;
    return today.getDate();
  },
  daysRemaining(monthKey, today = new Date()) {
    const cur = d.monthKey(today);
    if (monthKey < cur) return 0;
    if (monthKey > cur) return d.daysInMonth(monthKey);
    return d.daysInMonth(monthKey) - today.getDate() + 1;
  },
  prevMonth(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    const dt = new Date(y, m - 2, 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  },
  monthLabel(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    return `${y} 年 ${m} 月`;
  },
  weekday(iso) {
    return '日一二三四五六'[d.fromIso(iso).getDay()];
  },
  /** 「今天 / 昨天 / 9月18日 周四」 */
  dayLabel(iso, today = new Date()) {
    const t = d.iso(today);
    if (iso === t) return '今天';
    const y = new Date(today); y.setDate(y.getDate() - 1);
    if (iso === d.iso(y)) return '昨天';
    const [, m, day] = iso.split('-').map(Number);
    return `${m}月${day}日 周${d.weekday(iso)}`;
  },
};

/** 按时间自动预选餐次（PRD 10.1） */
export function mealForTime(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 10) return 'breakfast';
  if (h >= 10 && h < 15) return 'lunch';
  if (h >= 15 && h < 21) return 'dinner';
  return 'snack';
}

export function pct(part, whole) {
  if (!whole) return 0;
  return (part / whole) * 100;
}
