/* =============================================================================
   Scene 1 · 一个看似合理的证明
   -----------------------------------------------------------------------------
   本幕只做一件事：让学生怀疑“温度”是不是被偷偷预设了。第一幕只提问，不回答。
   代码分三段：
     1) 时间线：按 docs/scenes/scene1.md 的分步时间线逐项揭示 .step 元素
     2) 回环箭头：按实际排版计算路径，再用 stroke-dashoffset 描边生长
     3) 交互与复位：重播（R）、继续（Enter）；悬停提问由 CSS 负责
   不使用 ES module / fetch，保证 file:// 双击即可运行。
   ============================================================================= */
(function () {
  'use strict';

  var root = document.querySelector('[data-scene="1"]');
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
  var chain = root.querySelector('[data-chain]');
  var loop = root.querySelector('[data-loop]');
  var loopPath = root.querySelector('[data-loop-path]');
  var loopHead = root.querySelector('[data-loop-head]');
  var ctaLink = root.querySelector('[data-step="cta"] a');
  var replayBtn = root.querySelector('[data-replay]');

  var nodes = {
    1: root.querySelector('[data-node="1"]'),
    2: root.querySelector('[data-node="2"]'),
    3: root.querySelector('[data-node="3"]')
  };

  var steps = {};
  Array.prototype.forEach.call(root.querySelectorAll('.step'), function (el) {
    var id = el.getAttribute('data-step');
    if (id) steps[id] = el;
  });

  var timers = [];
  var ctaReady = false;
  var loopDrawn = false;

  function later(fn, ms) { timers.push(window.setTimeout(fn, ms)); }

  function clearTimers() {
    timers.forEach(window.clearTimeout);
    timers = [];
  }

  /* ------------------------------------------------------------------ 时间线
     每个 wait 表示“上一项之后等待多久”，数值取自 docs/scenes/scene1.md。
     实际时长 = wait × scale（scale 由 prefers-reduced-motion 决定）。      */
  var TIMELINE = [
    { step: 'lead',    wait: 500 },
    { step: 'n1',      wait: 900 },
    { step: 'link1',   wait: 560 },
    { step: 'n2',      wait: 640 },
    { step: 'link2',   wait: 560 },
    { step: 'n3',      wait: 640 },
    { loop: true,      wait: 900 },
    { step: 'verdict', wait: 1000 },
    { hold: true,      wait: 2000 },   /* 结论停留约 2 秒：不解释、不点评 */
    { dim: true,       wait: 300 },    /* 页面变暗：逻辑链淡化，疑问区展开 */
    { step: 'doubt1',  wait: 520 },
    { step: 'doubt2',  wait: 820 },
    { step: 'doubt3',  wait: 1050 },   /* 深蓝强调的关键一问 */
    { step: 'tip',     wait: 600 },
    { step: 'cta',     wait: 900 }
  ];

  function reveal(id) {
    var el = steps[id];
    if (!el) return;
    el.classList.add('is-in');
    if (id === 'cta') ctaReady = true;
  }

  function play() {
    var t = 0;
    TIMELINE.forEach(function (item) {
      t += Math.round(item.wait * scale);
      if (item.step) {
        later(function () { reveal(item.step); }, t);
      } else if (item.loop) {
        later(function () { drawLoop(true); }, t);
      } else if (item.dim) {
        later(function () { document.body.classList.add('is-doubt'); }, t);
      }
      /* item.hold 只表示“什么都不做地等待”，用来表达结论停留 */
    });
  }

  /* ======================================================== 回环箭头几何
     回环箭头必须真的“从第三个节点指回第一个节点”，所以不能写死坐标：
     这里按实际渲染出来的矩形计算路径；右侧所需的空白由 .chain 的 padding 提供。
     ==================================================================== */
  function round1(v) { return Math.round(v * 10) / 10; }

  function geometry() {
    var box = chain.getBoundingClientRect();
    var w = Math.max(1, Math.round(box.width));
    var h = Math.max(1, Math.round(box.height));

    function rel(el) {
      var r = el.getBoundingClientRect();
      return {
        right: r.right - box.left,
        centerY: r.top - box.top + r.height / 2
      };
    }

    var first = rel(nodes[1]);
    var last = rel(nodes[3]);

    var startX = last.right + 12;   /* 从第三个节点右侧出发 */
    var bracketX = w - 18;          /* 右外缘的折返位置 */
    var tipX = first.right + 3;     /* 箭头尖：指回第一个节点 */
    var baseX = tipX + 9;           /* 箭头底 */

    var d = 'M ' + round1(startX) + ' ' + round1(last.centerY) +
            ' C ' + round1(bracketX) + ' ' + round1(last.centerY) + ', ' +
                    round1(bracketX) + ' ' + round1(first.centerY) + ', ' +
                    round1(baseX) + ' ' + round1(first.centerY);

    var head = [
      [tipX, first.centerY],
      [baseX, first.centerY - 4.4],
      [baseX, first.centerY + 4.4]
    ].map(function (p) {
      return round1(p[0]) + ',' + round1(p[1]);
    }).join(' ');

    return { w: w, h: h, d: d, head: head };
  }

  function drawLoop(animate) {
    if (!chain || !loopPath || !nodes[1] || !nodes[3]) return;

    var g = geometry();
    loopPath.setAttribute('d', g.d);
    loopHead.setAttribute('points', g.head);
    loop.setAttribute('viewBox', '0 0 ' + g.w + ' ' + g.h);

    var len = loopPath.getTotalLength();
    loopDrawn = true;

    if (!animate) {
      /* 尺寸变化后的重绘：瞬时完成，不重新播放描边 */
      loopPath.style.transition = 'none';
      loopPath.style.setProperty('--loop-len', len + 'px');
      loop.classList.add('is-drawn', 'is-complete');
      void loopPath.getBoundingClientRect();
      loopPath.style.removeProperty('transition');
      return;
    }

    /* 先在没有过渡的情况下写入起始长度，否则浏览器会从 0 反向补画出一段假动画 */
    loopPath.style.transition = 'none';
    loopPath.style.setProperty('--loop-len', len + 'px');
    void loopPath.getBoundingClientRect();
    loopPath.style.removeProperty('transition');

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        loop.classList.add('is-drawn');
        later(function () { loop.classList.add('is-complete'); }, Math.round(950 * scale));
      });
    });
  }

  /* 窗口尺寸变化：仅在箭头已经画出之后重绘（防抖 150ms） */
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    if (!loopDrawn) return;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () { drawLoop(false); }, 150);
  });

  /* ============================================================ 交接与复位
     第一幕的按钮现在是真的链接，点了就直接进入第二幕（scene2.html）。 */
  function goNext() {
    if (ctaLink) window.location.href = ctaLink.getAttribute('href');
  }

  function reset() {
    clearTimers();
    ctaReady = false;

    /* 在“无过渡”的一帧里复位，避免出现倒放动画 */
    root.classList.add('is-resetting');
    Array.prototype.forEach.call(root.querySelectorAll('.step'), function (el) {
      el.classList.remove('is-in');
    });
    document.body.classList.remove('is-doubt');

    loop.classList.remove('is-drawn', 'is-complete');
    loopPath.removeAttribute('d');
    loopPath.style.removeProperty('--loop-len');
    loopHead.setAttribute('points', '');
    loopDrawn = false;

    void root.offsetWidth;
    root.classList.remove('is-resetting');
  }

  function replay() {
    reset();
    play();
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
    /* 只有本幕播完、且焦点不在链接 / 按钮上时，Enter / Space 才等同于“继续” */
    if ((e.key === 'Enter' || e.key === ' ') && ctaReady && document.activeElement === document.body) {
      e.preventDefault();
      goNext();
    }
  });

  /* 开场 */
  play();
})();

