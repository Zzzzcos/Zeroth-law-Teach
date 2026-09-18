/* =============================================================================
   Scene 3 · 从等价类到 θ
   -----------------------------------------------------------------------------
   本幕的技术核心是"聚合"：8 个系统状态先散落，再由热平衡关系聚成 3 个等价类。
   做法是绝对定位 + 由脚本计算坐标 + transform 过渡，因此每个类都能独立移动：
   先是 A、B、D 聚（D 从右上角一路走到 A、B 旁边），再是 C、E、F，最后 G、H。

     1) 几何：散落位置 / 成员列位置 / 类别标签位置，全部按实际尺寸算
     2) 时间线：STEPS 数组；"给它们一个标签"是一个闸门（必须由用户点击）
     3) 复位：重播后必须回到"未分组、无数字、无 θ"
   不使用 ES module / fetch，保证 file:// 双击即可运行。
   ============================================================================= */
(function () {
  'use strict';

  var root = document.querySelector('[data-scene="3"]');
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
  var field = root.querySelector('[data-field]');
  var tagBtn = root.querySelector('[data-tag-btn]');
  var handoff = root.querySelector('[data-step="handoff"]');
  var nextBtn = root.querySelector('[data-next]');
  var closeBtn = root.querySelector('[data-close-handoff]');
  var replayBtn = root.querySelector('[data-replay]');

  var states = {};
  Array.prototype.forEach.call(root.querySelectorAll('[data-state]'), function (el) {
    states[el.getAttribute('data-state')] = el;
  });

  var chips = [];
  Array.prototype.forEach.call(root.querySelectorAll('[data-chip]'), function (el) {
    chips[Number(el.getAttribute('data-chip'))] = el;
  });

  var tags = [];
  Array.prototype.forEach.call(root.querySelectorAll('[data-tag]'), function (el) {
    tags[Number(el.getAttribute('data-tag'))] = el;
  });

  var links = {};
  Array.prototype.forEach.call(root.querySelectorAll('[data-link]'), function (el) {
    links[el.getAttribute('data-link')] = el;
  });

  var steps = {};
  Array.prototype.forEach.call(root.querySelectorAll('.step'), function (el) {
    var id = el.getAttribute('data-step');
    if (id) steps[id] = el;
  });

  var timers = [];
  var ctaReady = false;
  var cursor = 0;
  var stopped = false;
  var tagHandler = null;

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

  /* ============================================================ 状态场几何
     初始：8 个状态散落在 4×2 的位置上。
     聚合：同一类的成员竖直排成一列，类别标签停在该列正上方。
     所有坐标都是按"实际尺寸"算出来的，因此窗口尺寸变化后可以重新摆放。
     ==================================================================== */
  var MEMBERS = [['A', 'B', 'D'], ['C', 'E', 'F'], ['G', 'H']];
  var ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  var STEP_Y = 30;          /* 同一类中相邻成员的竖直间距 */
  var pos = {};             /* 名称 -> {x, y}（中心坐标），供连线使用 */
  var fallback = 34;        /* 状态方块边长的兜底值（实测后覆盖） */
  var grouped = [false, false, false];

  function metrics() {
    var r = field.getBoundingClientRect();
    if (states.A && states.A.offsetWidth) fallback = states.A.offsetWidth;
    return { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) };
  }

  function placeEl(el, key, x, y) {
    if (!el) return;
    var w = el.offsetWidth || fallback;
    var h = el.offsetHeight || fallback;
    el.style.transform = 'translate(' + Math.round(x - w / 2) + 'px,' + Math.round(y - h / 2) + 'px)';
    if (key) pos[key] = { x: x, y: y };
  }

  function scatterPos(i, w, h) {
    var col = i % 4;
    var row = (i / 4) | 0;                 /* 0 或 1 */
    return { x: w * (col + 0.5) / 4, y: h * (row ? 0.74 : 0.28) };
  }

  function clusterX(i, w) { return w * (i + 0.5) / 3; }

  function memberPos(i, k, w, h) {
    var n = MEMBERS[i].length;
    return { x: clusterX(i, w), y: h * 0.54 + (k - (n - 1) / 2) * STEP_Y };
  }

  function chipPos(i, w, h) { return { x: clusterX(i, w), y: h * 0.22 }; }

  function layoutScatter() {
    var m = metrics();
    ORDER.forEach(function (id, i) {
      var p = scatterPos(i, m.w, m.h);
      placeEl(states[id], id, p.x, p.y);
    });
    placeChips();
  }

  /* only：只摆放某一类（聚合是逐类发生的） */
  function layoutGroup(i) {
    var m = metrics();
    MEMBERS[i].forEach(function (id, k) {
      var p = memberPos(i, k, m.w, m.h);
      placeEl(states[id], id, p.x, p.y);
    });
    grouped[i] = true;
  }

  function placeChips() {
    var m = metrics();
    chips.forEach(function (chip, i) {
      var p = chipPos(i, m.w, m.h);
      placeEl(chip, 'chip' + i, p.x, p.y);
    });
  }

  /* 把"处于热平衡"画成一条虚线（端点取两个状态的中心） */
  function setLink(key) {
    var line = links[key];
    if (!line) return;
    var a = pos[key.charAt(0)];
    var b = pos[key.charAt(1)];
    if (!a || !b) return;
    line.setAttribute('x1', Math.round(a.x));
    line.setAttribute('y1', Math.round(a.y));
    line.setAttribute('x2', Math.round(b.x));
    line.setAttribute('y2', Math.round(b.y));
  }

  function showLink(key, on) {
    var line = links[key];
    if (!line) return;
    setLink(key);
    line.classList[on ? 'add' : 'remove']('is-in');
  }

  /* ---------------------------------------------------------------- 时间线
     每项：{ wait, run }。wait 表示"上一项之后等待多久"，取自
     docs/scenes/scene3.md 的分步时间线。run 声明了参数即视为异步项，
     必须调用 done() 才会继续（"给它们一个标签"就是一个闸门）。            */
  function show(id) {
    return function () { reveal(id); };
  }

  function revealAB() {
    showLink('AB', true);
    reveal('logAB');
  }

  function revealAD() {
    showLink('AD', true);
    reveal('logAD');
  }

  /* A ∼ D 出现之后，D 走到 A、B 旁边，三者排成一列（只动这一类） */
  function groupA(done) {
    later(function () {
      layoutGroup(0);
      showLink('AB', false);
      showLink('AD', false);
      later(done, 500 * scale);
    }, 600 * scale);
  }

  function groupC() {
    layoutGroup(1);
    reveal('chipC');
    reveal('logEqC');
  }

  function groupG() {
    layoutGroup(2);
    reveal('chipG');
    reveal('logEqG');
  }

  /* 只留三个类别标签：把 8 个成员整体淡出 */
  function muteMembers() {
    ORDER.forEach(function (id) { states[id].classList.add('is-muted'); });
  }

  /* 闸门：必须由用户点击"给它们一个标签"；点击之前屏幕上不出现任何数字 */
  function waitForTag(done) {
    var started = false;

    function begin() {
      if (started || stopped) return;
      started = true;
      if (tagHandler) {
        tagBtn.removeEventListener('click', tagHandler);
        tagHandler = null;
      }
      tagBtn.setAttribute('aria-disabled', 'true');
      if (steps.askTag) steps.askTag.classList.add('is-done');
      later(done, 350 * scale);
    }

    tagHandler = begin;
    tagBtn.addEventListener('click', tagHandler);
  }

  /* 数字逐个落到类别上 */
  function tagNumbers(done) {
    var ids = ['tagA', 'tagC', 'tagG'];
    var values = ['20', '50', '80'];
    values.forEach(function (v, i) {
      later(function () {
        if (tags[i]) tags[i].innerHTML = '<span class="m"><span class="op">→</span> ' + v + '</span>';
        reveal(ids[i]);
        placeChips();                 /* 标签变宽之后重新居中 */
      }, i * 600 * scale);
    });
    later(done, values.length * 600 * scale + 300);
  }

  /* 把数字改写成 θ = …（整个网页第一次出现 θ） */
  function thetaTags() {
    ['20', '50', '80'].forEach(function (v, i) {
      if (!tags[i]) return;
      tags[i].innerHTML = '<span class="m"><span class="op">→</span> <i>θ</i> <span class="op">=</span> ' + v + '</span>';
    });
    placeChips();
  }

  /* 展开 [A]：让它的成员重新出现，并依次高亮 A、B、D */
  function expandA(done) {
    MEMBERS[0].forEach(function (id) { states[id].classList.remove('is-muted'); });
    var seq = ['A', 'B', 'D'];
    seq.forEach(function (id, i) {
      later(function () { states[id].classList.add('is-lit'); }, (400 + i * 550) * scale);
    });
    later(done, (400 + seq.length * 550 + 200) * scale);
  }

  var STEPS = [
    { wait: 500,  run: show('lead') },
    { wait: 800,  run: show('field') },
    { wait: 900,  run: revealAB },
    { wait: 900,  run: revealAD },
    { wait: 700,  run: groupA },                    /* 异步：D 走过去 */
    { wait: 400,  run: function () { reveal('chipA'); reveal('logEqA'); } },
    { wait: 1000, run: groupC },
    { wait: 1000, run: groupG },
    { wait: 900,  run: muteMembers },
    { wait: 800,  run: function () { reveal('cls1'); reveal('cls2'); } },
    { wait: 700,  run: show('cls3') },
    { wait: 1000, run: show('askTag') },
    { wait: 400,  run: waitForTag },                /* 闸门：等用户点击 */
    { wait: 400,  run: tagNumbers },                /* 异步：数字逐个落下 */
    { wait: 800,  run: show('note') },
    { wait: 1000, run: thetaTags },
    { wait: 1000, run: expandA },                   /* 异步：展开 [A] */
    { wait: 900,  run: show('same') },
    { wait: 1000, run: function () { reveal('key1'); reveal('key2'); } },
    { wait: 1000, run: show('core') },
    { wait: 1000, run: function () { reveal('repr1'); reveal('repr2'); } },
    { wait: 1200, run: function () { reveal('not1to1'); reveal('bijection'); } },
    { wait: 900,  run: show('q1') },
    { wait: 900,  run: show('q2') },
    { wait: 900,  run: show('q3') },
    { wait: 1000, run: function () { reveal('noscale'); reveal('cta'); } }
  ];

  function advance() {
    if (stopped) return;
    if (cursor >= STEPS.length) return;

    var item = STEPS[cursor];
    cursor += 1;

    later(function () {
      if (stopped) return;
      if (item.run.length > 0) item.run(advance);     /* 异步项：自己决定何时继续 */
      else { item.run(); advance(); }
    }, item.wait * scale);
  }

  /* ======================================================== 尺寸变化重排 */
  function relayout() {
    if (grouped[0] || grouped[1] || grouped[2]) {
      grouped.forEach(function (isGrouped, i) { if (isGrouped) layoutGroup(i); });
    } else {
      layoutScatter();
    }
    placeChips();
    Object.keys(links).forEach(function (k) {
      if (links[k].classList.contains('is-in')) setLink(k);
    });
  }

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(relayout, 160);
  });

  /* ========================================================= 交接与复位 */
  /* 本幕的按钮现在是真的链接：点击就直接进入下一幕（scene4.html）。
     goNext() 供 Enter / Space 使用；showHandoff / hideHandoff 保留名字，
     以免旧的调用点（reset 与快捷键分支）失效。 */
  function goNext() {
    var link = root.querySelector('[data-step="cta"] a');
    if (link) window.location.href = link.getAttribute('href');
  }

  function showHandoff() { goNext(); }

  function hideHandoff() {}

  function reset() {
    stopped = true;
    clearTimers();
    ctaReady = false;
    cursor = 0;
    grouped = [false, false, false];

    if (tagHandler) {
      tagBtn.removeEventListener('click', tagHandler);
      tagHandler = null;
    }
    tagBtn.removeAttribute('aria-disabled');
    if (steps.askTag) steps.askTag.classList.remove('is-done');

    /* 在“无过渡”的一帧里复位：否则会看到倒放动画 */
    root.classList.add('is-resetting');
    Array.prototype.forEach.call(root.querySelectorAll('.step'), function (el) {
      el.classList.remove('is-in');
    });

    ORDER.forEach(function (id) { states[id].classList.remove('is-muted', 'is-lit'); });
    Object.keys(links).forEach(function (k) { links[k].classList.remove('is-in'); });
    tags.forEach(function (t) { if (t) t.textContent = ''; });

    /* 位置也要回到最初的散落状态 */
    layoutScatter();

    hideHandoff();

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
  if (nextBtn) nextBtn.addEventListener('click', showHandoff);
  if (closeBtn) closeBtn.addEventListener('click', hideHandoff);
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
      showHandoff();
    }
  });

  /* 开场 */
  layoutScatter();
  placeChips();
  advance();
})();
