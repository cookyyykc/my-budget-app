/**
 * 手写 SVG 图表组件 · 零依赖
 * 职责：接收数据，返回 SVG HTML 字符串（不直接操作 DOM）
 */

/**
 * 环形图（饼图）
 * @param {Object} data - { total: number, categories: [{id, name, amount, color, percent}] }
 * @param {Object} options - { size?, centerLabel? }
 * @returns {string} SVG HTML 字符串
 */
export function pieChart(data, options = {}) {
  const { total = 0, categories = [] } = data;
  const { size = 200, centerLabel = '' } = options;

  // 空状态
  if (!categories.length || total === 0) {
    return `<div class="chart-empty">
      <svg viewBox="0 0 ${size} ${size}" class="chart-pie">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.35}" 
                fill="none" stroke="var(--line)" stroke-width="${size * 0.12}" opacity="0.3"/>
        <text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="middle" 
              fill="var(--ink-3)" font-size="${size * 0.08}">暂无数据</text>
      </svg>
    </div>`;
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.35;
  const strokeWidth = size * 0.12;

  // 计算每个分类的弧形路径（使用 stroke-dasharray 绘制环形图）
  const circumference = 2 * Math.PI * radius;
  let currentAngle = -90; // 从 12 点钟方向开始

  const slices = categories.map((cat) => {
    const angle = (cat.percent / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    // 计算扇区中心点（用于点击区域）
    const midAngle = ((startAngle + endAngle) / 2) * (Math.PI / 180);
    const labelRadius = radius + strokeWidth * 0.5;
    const labelX = cx + labelRadius * Math.cos(midAngle);
    const labelY = cy + labelRadius * Math.sin(midAngle);

    return { ...cat, startAngle, angle, labelX, labelY };
  });

  // SVG 路径：使用多个 circle 叠加，每个 circle 用 stroke-dasharray 只显示对应的弧段
  const circles = slices.map((slice, i) => {
    const offset = (slice.startAngle / 360) * circumference;
    const length = (slice.angle / 360) * circumference;
    const dashArray = `${length} ${circumference - length}`;
    
    return `<circle
      cx="${cx}" cy="${cy}" r="${radius}"
      fill="none"
      stroke="${slice.color}"
      stroke-width="${strokeWidth}"
      stroke-dasharray="${dashArray}"
      stroke-dashoffset="${-offset}"
      class="chart-slice"
      data-category="${slice.id}"
      data-name="${esc(slice.name)}"
      data-amount="${slice.amount}"
      transform="rotate(-90 ${cx} ${cy})"
      style="cursor: pointer; transition: opacity 0.2s;"
    />`;
  }).join('');

  // 中心标签（总支出金额）
  const centerText = centerLabel || '';

  return `<svg viewBox="0 0 ${size} ${size}" class="chart-pie" role="img" aria-label="支出分类环形图">
    ${circles}
    <text x="${cx}" y="${cy - size * 0.04}" text-anchor="middle" 
          fill="var(--ink-2)" font-size="${size * 0.06}">总支出</text>
    <text x="${cx}" y="${cy + size * 0.06}" text-anchor="middle" dominant-baseline="middle"
          fill="var(--ink)" font-size="${size * 0.1}" font-weight="650" font-family="var(--num)">${centerText}</text>
  </svg>`;
}

/**
 * 折线图
 * @param {Object} data - { months: [{key, label, expense, income?, budget?}], maxValue }
 * @param {Object} options - { width?, height?, showIncome?, showBudget? }
 * @returns {string} SVG HTML 字符串
 */
export function lineChart(data, options = {}) {
  const { months = [], maxValue = 0 } = data;
  const { 
    width = 600, 
    height = 240, 
    showIncome = false, 
    showBudget = false 
  } = options;

  // 空状态
  if (months.length === 0) {
    return `<div class="chart-empty">
      <svg viewBox="0 0 ${width} ${height}" class="chart-line">
        <text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle" 
              fill="var(--ink-3)" font-size="14">暂无数据</text>
      </svg>
    </div>`;
  }

  // 历史数据不足提示
  if (months.length < 3) {
    return `<div class="chart-placeholder">
      <svg viewBox="0 0 ${width} ${height}" class="chart-line">
        <text x="${width / 2}" y="${height / 2 - 20}" text-anchor="middle" 
              fill="var(--ink-2)" font-size="16" font-weight="600">记满 3 个月后解锁趋势分析</text>
        <text x="${width / 2}" y="${height / 2 + 10}" text-anchor="middle" 
              fill="var(--ink-3)" font-size="13">继续记账，积累更多数据</text>
      </svg>
    </div>`;
  }

  const padding = { top: 30, right: 30, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 计算 Y 轴最大值（向上取整到整千）
  // 先乘后除：maxValue * 1.1 用浮点会算出 220000.00000000003，ceil 会多进一位
  const yMax = Math.ceil((maxValue * 11) / 10000) * 1000 || 100000;
  const yScale = (value) => padding.top + chartHeight - (value / yMax) * chartHeight;
  const xScale = (index) => padding.left + (index / Math.max(1, months.length - 1)) * chartWidth;

  // 网格线（4 条水平线）
  const gridLines = [0.25, 0.5, 0.75, 1].map(ratio => {
    const y = padding.top + chartHeight * (1 - ratio);
    const value = Math.round(yMax * ratio / 100);
    return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" 
                  stroke="var(--line)" stroke-width="1" opacity="0.3" stroke-dasharray="4 4"/>
            <text x="${padding.left - 8}" y="${y}" text-anchor="end" dominant-baseline="middle" 
                  fill="var(--ink-3)" font-size="11">¥${value}</text>`;
  }).join('');

  // 支出折线路径
  const expensePoints = months.map((m, i) => `${xScale(i)},${yScale(m.expense)}`).join(' ');
  const expenseLine = `<polyline points="${expensePoints}" fill="none" 
    stroke="var(--ink)" stroke-width="2.5" class="chart-line-expense"/>`;

  // 收入折线（可选）
  const incomeLine = showIncome && months.every(m => m.income != null)
    ? `<polyline points="${months.map((m, i) => `${xScale(i)},${yScale(m.income)}`).join(' ')}" 
         fill="none" stroke="var(--c-income)" stroke-width="2" stroke-dasharray="5 3" opacity="0.7"/>`
    : '';

  // 预算基准线（可选）
  const budgetLine = showBudget && months.every(m => m.budget != null)
    ? `<line x1="${padding.left}" y1="${yScale(months[0].budget)}" 
         x2="${width - padding.right}" y2="${yScale(months[0].budget)}" 
         stroke="var(--ink-3)" stroke-width="1.5" stroke-dasharray="5 5" opacity="0.5"/>`
    : '';

  // 数据点（带 hover 效果）
  const dataPoints = months.map((m, i) => {
    const x = xScale(i);
    const y = yScale(m.expense);
    return `<g class="chart-dot" data-month="${m.key}" data-expense="${m.expense}" 
               data-label="${esc(m.label)}" style="cursor: pointer;">
      <circle cx="${x}" cy="${y}" r="5" fill="var(--surface)" stroke="var(--ink)" stroke-width="2"/>
      <circle cx="${x}" cy="${y}" r="10" fill="transparent" stroke="none"/>
    </g>`;
  }).join('');

  // X 轴标签
  const xLabels = months.map((m, i) => {
    const x = xScale(i);
    return `<text x="${x}" y="${height - padding.bottom + 20}" text-anchor="middle" 
                  fill="var(--ink-2)" font-size="12">${esc(m.label)}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${width} ${height}" class="chart-line" role="img" aria-label="月度支出趋势">
    ${gridLines}
    ${budgetLine}
    ${incomeLine}
    ${expenseLine}
    ${dataPoints}
    ${xLabels}
  </svg>`;
}

/** HTML 转义 */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
