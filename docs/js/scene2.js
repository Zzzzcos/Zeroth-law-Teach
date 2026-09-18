/* =============================================================================
   Scene 2 · 去掉温度，只留下热平衡关系
   -----------------------------------------------------------------------------
   本幕的时间线上有一个"闸门"：热接触必须由用户点击（未点击则 7 秒后自动）
   触发，动画结束后时间线才继续。因此这里使用一个可以中途等待的顺序执行器，
   而不是第一幕那种"一次性排好所有 setTimeout"的写法。

     1) 曲线：宏观状态随时间的变化曲线，由脚本按阻尼振荡逐点生成
     2) 时间线：STEPS 数组；run 接收 done 参数即成为"异步项"
     3) 交互与复位：点击热接触、重播（R）、继续（Enter）
   不使用 ES module / fetch，保证 file:// 双击即可运行。
   ============================================================================= */
(function () {
  'use strict';

  var root = document.querySelector('[data-scene="2"]');
  if (!root) return;

  /* ------------------------------------------------------------- 动效偏好 */
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var scale = 1;

  function applyMotion() {
    scale = motion.matches ? 0.3 : 1;
    document.documentElement.style.setProperty('--step-scale', String(scale));
  }
  applyMotion();
  if (motion.addEventListener) motion.addEventListener('change', applyMotion);
  else if (motion.addListener) motion.addListener(applyMotion);

  /* ------------------------------------------------------------- 元素索引 */
  var contactBtn = root.querySelector('[data-contact]');
  var hint = root.querySelector('[data-step="hint"]');
  var traceFigure = root.querySelector('[data-trace-figure]');
  var traceContact = root.querySelector('[data-trace-contact]');
  var traceA = root.querySelector('[data-trace-a]');
  var traceB = root.querySelector('[data-trace-b]');
  var props = root.querySelector('[data-props]');
  var replayBtn = root.querySelector('[data-replay]');

  var steps = {};
  Array.prototype.forEach.call(root.querySelectorAll('.step'), function (el) {
    var id = el.getAttribute('data-step');
    if (id) steps[id] = el;
  });

  var timers = [];
  var ctaReady = false;
  var cursor = 0;            /* 时间线进度 */
  var stopped = false;       /* 复位时用来打断异步项 */
  var contactHandler = null;

  function later(fn, ms) {
    var t = window.setTimeout(fn, Math.max(0, ms));
    timers.push(t);
    return t;
  }

  function clearTimers() {
    timers.forEach(window.clearTimeout);
    timers = [];
  }

  function reveal(id) {
    var el = steps[id];
    if (!el) return;
    el.classList.add('is-in');
    if (id === 'cta') ctaReady = true;
  }

  /* --------------------------------------------------- 热流量随时间的变化
     纵轴是 A 与 B 之间的热流量，零线表示"没有热量交换"。
     接触之前两条曲线都停在零线上；接触之后分别向零线的两侧张开
     （A 放热画在下方、B 吸热画在上方），幅度先增后减，
     最后重新并回零线 —— 两条曲线合成一条线，热量交换停止。
     曲线是示意图：没有刻度，也不代表任何具体数值。                       */
  var CONTACT_X = 64;      /* 图上"热接触"发生的横坐标 */
  var SETTLE_X = 220;      /* 两条曲线重新并回零线的横坐标 */
  var ZERO_Y = 32;         /* 零线：没有热量交换 */
  var PEAK = 22;           /* 示意图上的最大幅度 */
  var TRACE_MS = 2400;     /* 描边时长，与 CSS 里的 --trace-dur 保持一致 */

  var traceArea = root.querySelector('[data-trace-area]');

  /* 热流量的形状：接触之前恒为 0；接触之后先升后降，很快回到 0 */
  function heatShape(x) {
    if (x <= CONTACT_X) return 0;
    var u = (x - CONTACT_X) / 60;
    var s = (1 - Math.exp(-u / 0.25)) * Math.exp(-u / 0.85);
    return s < 0.02 ? 0 : s;
  }

  /* dir = -1 画在零线上方（B 吸热）；dir = +1 画在零线下方（A 放热） */
  function curvePath(dir) {
    var d = '';
    for (var x = 2; x <= 312; x += 3) {
      var y = ZERO_Y + dir * PEAK * heatShape(x);
      d += (x === 2 ? 'M ' : 'L ') + x + ' ' + (Math.round(y * 10) / 10) + ' ';
    }
    return d;
  }

  /* 曲线与零线围成的区域：面积就是这段时间里交换的总热量 */
  function areaPath() {
    return curvePath(-1) + 'L 312 ' + ZERO_Y + ' L 2 ' + ZERO_Y + ' Z';
  }

  function setCurve(path, d) {
    if (!path) return;
    path.setAttribute('d', d);
    var len = path.getTotalLength();
    /* 先在没有过渡的情况下写入起点长度，避免浏览器从 0 反向补画出假动画 */
    path.style.transition = 'none';
    path.style.setProperty('--len', len + 'px');
    void path.getBoundingClientRect();
    path.style.removeProperty('transition');
  }

  function drawTrace() {
    setCurve(traceB, curvePath(-1));       /* B 吸热：零线上方 */
    setCurve(traceA, curvePath(1));        /* A 放热：零线下方 */
    if (traceArea) traceArea.setAttribute('d', areaPath());
    if (traceContact) traceContact.classList.add('is-in');

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        if (traceFigure) traceFigure.classList.add('is-drawn');
      });
    });

    /* 描边画到"重新并回零线"的那一刻：出现虚线标记与第一句说明 */
    later(function () {
      reveal('traceSettle');
      reveal('traceNote1');
    }, TRACE_MS * (SETTLE_X / 312) * scale);

    /* 描边结束：把"交换的总热量"以阴影面积的形式补上 */
    later(function () {
      reveal('traceArea');
      reveal('traceNote2');
    }, TRACE_MS * scale + 200);
  }

  /* -------------------------------------------------------- 热接触（闸门） */
  function startContact(done) {
    var started = false;
    var auto = 0;

    function begin() {
      if (started || stopped) return;
      started = true;
      if (auto) window.clearTimeout(auto);
      if (contactHandler) {
        contactBtn.removeEventListener('click', contactHandler);
        contactHandler = null;
      }

      contactBtn.classList.add('is-active');
      contactBtn.setAttribute('aria-disabled', 'true');
      if (hint) hint.classList.add('is-gone');

      reveal('trace');
      drawTrace();

      later(function () {
        contactBtn.classList.remove('is-active');
        done();
      }, TRACE_MS * scale + 500);
    }

    contactHandler = begin;
    contactBtn.addEventListener('click', contactHandler);
    /* 用户没有点击时，7 秒后自动开始，避免页面停住不动 */
    auto = later(begin, 7000 * scale);
  }

  /* ---------------------------------------------------------------- 时间线
     每项：{ wait, run }。wait 表示"上一项之后等待多久"，取自
     docs/scenes/scene2.md 的分步时间线。run 若声明了参数，即被视为异步项：
     它必须调用 done() 才能让时间线继续（例如等待用户点击热接触）。         */
  function show(id) {
    return function () { reveal(id); };
  }

  function showSystems() {
    reveal('sysA');
    later(function () { reveal('sysB'); }, 180);
  }

  function showViaC() {
    /* 中间的连接符换成系统 C，形成 A —— C —— B；
       同时把状态变化图收起，为后面的推理腾出位置 */
    contactBtn.classList.add('is-hidden');
    if (traceFigure) traceFigure.classList.add('is-collapsed');
    reveal('viaC');
  }

  function mergeProperties() {
    if (props) props.classList.add('is-merging');
    later(function () {
      if (props) props.classList.add('is-done');
      root.setAttribute('data-phase', 'equiv');
    }, 900 * scale);
  }

  var STEPS = [
    { wait: 500,  run: show('lead') },
    { wait: 800,  run: showSystems },
    { wait: 700,  run: function () { reveal('contact'); reveal('hint'); } },
    { wait: 900,  run: startContact },                       /* ← 闸门：等待点击 */
    { wait: 400,  run: show('def1') },
    { wait: 700,  run: show('def1b') },     /* 强调：两者之间没有净热量交换 */
    { wait: 700,  run: show('def2') },
    { wait: 700,  run: show('relAB1') },
    { wait: 1000, run: show('note') },                       /* 幕内关键提醒 */
    { wait: 800,  run: showViaC },
    { wait: 800,  run: show('relAC') },
    { wait: 700,  run: show('relBC') },
    { wait: 1400, run: show('ask') },                        /* 停顿后再给答案 */
    { wait: 800,  run: show('relAB2') },
    { wait: 600,  run: show('core') },
    { wait: 1000, run: show('law') },
    { wait: 1000, run: function () { root.setAttribute('data-phase', 'props'); reveal('p1'); } },
    { wait: 1200, run: show('p2') },
    { wait: 1200, run: show('p3') },
    { wait: 1000, run: mergeProperties },
    { wait: 800,  run: show('equiv') },
    { wait: 1000, run: show('after') },
    { wait: 900,  run: function () { reveal('endask'); reveal('cta'); } }
  ];

  function advance() {
    if (stopped) return;
    if (cursor >= STEPS.length) return;

    var item = STEPS[cursor];
    cursor += 1;

    later(function () {
      if (stopped) return;
      if (item.run.length > 0) item.run(advance);            /* 异步项：自己决定何时继续 */
      else { item.run(); advance(); }
    }, item.wait * scale);
  }

  /* ============================================================ 交接与复位
     第二幕的按钮现在是真的链接，点了就直接进入第三幕（scene3.html）。 */
  function goNext() {
    var link = root.querySelector('[data-step="cta"] a');
    if (link) window.location.href = link.getAttribute('href');
  }

  function reset() {
    stopped = true;
    clearTimers();
    ctaReady = false;
    cursor = 0;

    if (contactHandler) {
      contactBtn.removeEventListener('click', contactHandler);
      contactHandler = null;
    }

    /* 在"无过渡"的一帧里复位，避免出现倒放动画 */
    root.classList.add('is-resetting');
    root.removeAttribute('data-phase');
    Array.prototype.forEach.call(root.querySelectorAll('.step'), function (el) {
      el.classList.remove('is-in', 'is-gone', 'is-collapsed');
    });

    if (traceFigure) traceFigure.classList.remove('is-drawn');
    if (traceContact) traceContact.classList.remove('is-in');
    [traceA, traceB].forEach(function (p) {
      if (!p) return;
      p.removeAttribute('d');
      p.style.removeProperty('--len');
    });

    contactBtn.classList.remove('is-active', 'is-hidden');
    contactBtn.removeAttribute('aria-disabled');
    if (props) props.classList.remove('is-merging', 'is-done');

    void root.offsetWidth;
    root.classList.remove('is-resetting');
    stopped = false;
  }

  function replay() {
    reset();
    advance();
    if (root.scrollIntoView) {
      root.scrollIntoView({ behavior: scale < 1 ? 'auto' : 'smooth', block: 'start' });
    }
  }

  /* ================================================================= 事件 */
  if (replayBtn) replayBtn.addEventListener('click', replay);

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;

    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      replay();
      return;
    }
    /* 只有本幕播完、且焦点不在链接 / 按钮上时，Enter / Space 才等同于"继续" */
    if ((e.key === 'Enter' || e.key === ' ') && ctaReady && document.activeElement === document.body) {
      e.preventDefault();
      goNext();
    }
  });

  /* 开场 */
  advance();
})();
