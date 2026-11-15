/* ============================================================
   iOS 27 液态玻璃 · 底部标签栏（方案 C 调校版）初始化脚本
   ------------------------------------------------------------
   依赖：hyalite.js 必须先于本文件加载
     <script src="hyalite.js"></script>
     <script src="ios27-tabbar-hyalite.js"></script>

   职责：
     1. 把 hyalite 挂到 .tabbar 上（用 watch，标签栏由 JS 动态生成也安全）
     2. 让 hyalite 内部 blur 跟随 --ios27-glass-transparency 联动，
        使整条的扩散程度与方案 B 的 blur(12px × (0.5+0.8t)) 对齐
     3. 把 hyalite 内部 sat 归 1，避免与 CSS 外层 saturate(1.8) 叠加
     4. 不支持 SVG backdrop filter 的浏览器（Safari/Firefox）什么都不做，
        CSS 里的 var(--hyalite, blur(...)) 回退自动生效
   ============================================================ */
(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.Hyalite) {
    console.warn('[ios27-tabbar] hyalite.js 未加载，已跳过（CSS 回退仍生效）');
    return;
  }

  var H = window.Hyalite;
  var SELECTOR = '.tabbar';

  // 与方案 B 完全一致的模糊公式：12px × (0.5 + 0.8 × transparency)
  function blurFor(transparency) {
    var t = Number.isFinite(transparency) ? transparency : 0.5;
    return 12 * (0.5 + 0.8 * t);
  }

  function readTransparency(el) {
    var raw = getComputedStyle(el).getPropertyValue('--ios27-glass-transparency');
    var v = parseFloat(raw);
    return Number.isFinite(v) ? v : 0.5;
  }

  function optsFor(el) {
    var t = readTransparency(el);
    return {
      // bevel/thickness/slope 决定边缘折射强度。
      // 底部栏高 70px、圆角 100px，bevel 30 大约是高度的 43%，
      // 边缘弯曲明显但不会吃到中间的图标和文字。
      bevel: 30,
      thickness: 52,
      slope: 1.2,
      shape: 'squircle',
      // 关键：内部 blur 跟随滑块，对齐方案 B 的扩散程度
      blur: blurFor(t),
      // 关键：归 1，饱和度只由 CSS 外层 saturate(1.8) 提供，
      // 否则会和 hyalite 默认的 0.86 叠成约 1.55，与 B 不一致
      sat: 1,
      dispersion: 1.6,   // 边缘色散，液态玻璃的「彩虹边」
      shade: 0.46,       // 边缘压暗（hyalite 默认，已调校过）
      rim: 1.76,         // 边缘高光
      materialize: 0
    };
  }

  if (!H.supported()) {
    // Safari / Firefox：不写入 --hyalite，CSS 回退到 iOS 27 纯材质
    console.info('[ios27-tabbar] 当前浏览器不支持 SVG backdrop filter，已回退到方案 B 材质');
    return;
  }

  // 手机端（触屏）不用真折射：移动 Chromium 的 SVG backdrop filter
  // 会把胶囊压到玻璃层下面（深色模式下像消失），所以手机统一走方案 B 材质。
  var finePointer = false;
  try { finePointer = matchMedia('(pointer: fine)').matches; } catch (e) { finePointer = false; }
  if (!finePointer) {
    console.info('[ios27-tabbar] 触屏设备已回退到方案 B 材质');
    return;
  }

  var el = document.querySelector(SELECTOR);
  if (!el) {
    // 脚本若被放到 <head>，等 DOM 就绪再挂
    document.addEventListener('DOMContentLoaded', function () {
      var late = document.querySelector(SELECTOR);
      if (late) boot(late);
      else console.warn('[ios27-tabbar] 找不到 ' + SELECTOR);
    }, { once: true });
    return;
  }

  boot(el);

  function boot(el) {
    H.attach(el, optsFor(el));

    // 透明度档位变化时才重新调校：hyalite 自己会往 style 写 --hyalite，
    // 无脑重算会自己触发自己。
    var applied = readTransparency(el);
    var mo = new MutationObserver(function () {
      var t = readTransparency(el);
      if (t === applied) return;
      applied = t;
      H.setOpts(optsFor(el));
    });
    mo.observe(el, {
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    // 暴露手动接口，方便以后在设置页接滑块
    window.ios27Tabbar = {
      refresh: function () { H.refresh(el); },
      retune: function () { applied = readTransparency(el); H.setOpts(optsFor(el)); },
      setTransparency: function (v) {
        el.style.setProperty('--ios27-glass-transparency', String(v));
      },
      blurFor: blurFor,
      hyalite: H
    };
  }
})();
