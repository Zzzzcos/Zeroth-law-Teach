/* =============================================================================
   Scene 4 · 同一个温度，可以有不同的数字吗
   学生先自己发现"数字标签不唯一"，再研究什么样的重新标度可以接受：
     1) 换标签（分类不变、数字在变）   2) θ → θ′ 的映射（θ′ = 2θ）
     3) 相撞（滑块把 [A] 调到 10）→ 至少需要单射
     4) 单调（θ′ = 2θ + 5 与 θ′ = −θ 的顺序比较）→ 需要严格递增
   两个交互都有 8 秒自动演示兜底；不使用 ES module / fetch，file:// 双击即可运行。
   ============================================================================= */
(function () {
  'use strict';
  var root = document.querySelector('[data-scene="4"]');
  if (!root) return;

  /* 动效偏好 */
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var scale = 1;
  function applyMotion() {
    scale = motion.matches ? 0.3 : 1;
    document.documentElement.style.setProperty('--step-scale', String(scale));
  }
  applyMotion();
  if (motion.addEventListener) motion.addEventListener('change', applyMotion);
  else if (motion.addListener) motion.addListener(applyMotion);

  /* 元素索引 */
  function collect(sel, attr) {
    var out = [];
    Array.prototype.forEach.call(root.querySelectorAll(sel), function (el) {
      out[Number(el.getAttribute(attr))] = el;
    });
    return out;
  }

  var chips = collect('[data-lchip]', 'data-lchip');
  var nums = collect('[data-num]', 'data-num');
  var mapOuts = collect('[data-map-out]', 'data-map-out');
  var markers = collect('[data-marker]', 'data-marker');
  var markerVals = collect('[data-marker-val]', 'data-marker-val');

  var range = root.querySelector('[data-range]');
  var relabelBtn = root.querySelector('[data-relabel]');
  var relabelBox = root.querySelector('[data-step="relabel"]');
  var pairOut = root.querySelector('[data-pair-out]');
  var segBtns = Array.prototype.slice.call(root.querySelectorAll('[data-seg]'));
  var chain = root.querySelector('[data-chain]');
  var handoff = root.querySelector('[data-step="handoff"]');
  var nextBtn = root.querySelector('[data-next]');
  var closeBtn = root.querySelector('[data-close-handoff]');
  var replayBtn = root.querySelector('[data-replay]');

  var steps = {};
  Array.prototype.forEach.call(root.querySelectorAll('.step'), function (el) {
    var id = el.getAttribute('data-step');
    if (id) steps[id] = el;
  });

  var timers = [];
  var ctaReady = false;
  var cursor = 0;
  var stopped = false;
  var relabelHandler = null;
  var rangeHandler = null;

  function later(fn, ms) { var t = window.setTimeout(fn, Math.max(0, ms)); timers.push(t); return t; }
  function clearTimers() { timers.forEach(window.clearTimeout); timers = []; }
  function reveal(id) {
    var el = steps[id];
    if (!el) return;
    el.classList.add('is-in');
    if (id === 'cta') ctaReady = true;
  }

  /* 1) 换一种标记（三组数字） */
  var SETS = [[2, 5, 8], [40, 100, 160]];

  function applySet(values) {
    values.forEach(function (v, i) {
      if (nums[i]) nums[i].textContent = String(v);
      if (!chips[i]) return;
      chips[i].classList.add('is-changed');
      later(function () { chips[i].classList.remove('is-changed'); }, 700 * scale);
    });
  }

  function relabelStep(done) {
    var clicks = 0;
    var finished = false;

    function removeHandler() {
      if (relabelHandler) { relabelBtn.removeEventListener('click', relabelHandler); relabelHandler = null; }
    }
    function finish() {
      if (finished) return;
      finished = true;
      removeHandler();
      if (relabelBox) relabelBox.classList.add('is-done');
      later(done, 500 * scale);
    }
    function nextSet() {
      if (finished || clicks >= SETS.length) return;
      applySet(SETS[clicks]);
      clicks += 1;
      if (clicks >= SETS.length) finish();
    }

    relabelHandler = nextSet;
    relabelBtn.addEventListener('click', relabelHandler);

    /* 一直没人点：8 秒后自动演示两遍 */
    later(function () {
      if (finished) return;
      nextSet();
      later(nextSet, 1600 * scale);
    }, 8000 * scale);
  }

  /* 2) θ → θ′ 的映射表 */
  function fillMap(done) {
    ['40', '100', '160'].forEach(function (v, i) {
      later(function () { if (mapOuts[i]) mapOuts[i].textContent = v; }, i * 400 * scale + 200);
    });
    later(done, 3 * 400 * scale + 400);
  }

  /* 3) 相撞（滑块 / 自动演示） */
  var LINE_MIN = 10;
  var LINE_MAX = 60;

  function setMarker(i, value) {
    if (!markers[i]) return;
    markers[i].style.left = ((value - LINE_MIN) / (LINE_MAX - LINE_MIN) * 100) + '%';
    if (markerVals[i]) markerVals[i].textContent = String(value);
  }

  function hitMarkers() {
    markers.forEach(function (m) {
      if (!m) return;
      m.classList.remove('is-hit');
      void m.offsetWidth;
      m.classList.add('is-hit');
    });
  }

  function collideStep(done) {
    var collided = false;
    var autoTimer = 0;

    function removeHandler() {
      if (rangeHandler) { range.removeEventListener('input', rangeHandler); rangeHandler = null; }
    }
    function check() {
      if (stopped || collided) return;
      var v = Number(range.value);
      setMarker(0, v);
      if (v <= LINE_MIN) {                 /* 与 [C] 的 10 叠在一起 */
        collided = true;
        if (autoTimer) window.clearTimeout(autoTimer);
        removeHandler();
        hitMarkers();
        later(done, 700 * scale);
      }
    }

    rangeHandler = check;
    range.addEventListener('input', rangeHandler);

    /* 一直没人拖：8 秒后自动把滑块推向 10 */
    autoTimer = later(function () {
      if (stopped || collided) return;
      var v = LINE_MAX;
      var tick = window.setInterval(function () {
        if (stopped || collided) { window.clearInterval(tick); return; }
        v -= 10;
        range.value = String(v);
        check();
        if (v <= LINE_MIN) window.clearInterval(tick);
      }, 420 * scale);
      timers.push(tick);            /* 复位时一并取消 */
    }, 8000 * scale);
  }

  /* 4) 单调性：两种标度下的顺序比较 */
  var MONO = {
    inc: '45 <span class="op">&lt;</span> 105',
    dec: '<span class="op">−</span>20 <span class="op">&gt;</span> <span class="op">−</span>50'
  };

  function setMono(key) {
    var k = MONO[key] ? key : 'inc';
    segBtns.forEach(function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-seg') === k);
    });
    if (pairOut) pairOut.innerHTML = MONO[k];
  }

  /* 总结链：逐行出现（把延迟按序号写进 style） */
  function showChain() {
    if (chain) {
      Array.prototype.forEach.call(chain.children, function (el, i) {
        el.style.animationDelay = (i * 0.12 * scale) + 's';
      });
    }
    reveal('chain');
  }

  function show(id) { return function () { reveal(id); }; }

  /* ---------------------------------------------------------------- 时间线 */
  var STEPS = [
    { wait: 500,  run: show('lead') },
    { wait: 700,  run: show('relabel') },
    { wait: 400,  run: relabelStep },                /* 异步：等点击（或 8s 自动） */
    { wait: 400,  run: show('relabelNote') },
    { wait: 900,  run: show('map') },
    { wait: 300,  run: fillMap },                    /* 异步：θ′ 逐个出现 */
    { wait: 500,  run: show('keepClass') },
    { wait: 700,  run: show('keepClass2') },
    { wait: 1000, run: show('collide') },
    { wait: 300,  run: collideStep },                /* 异步：等拖动（或 8s 自动） */
    { wait: 600,  run: show('collideAsk') },
    { wait: 1200, run: show('collideAns') },
    { wait: 800,  run: show('collideKey') },
    { wait: 1000, run: show('injective') },
    { wait: 700,  run: show('injective2') },
    { wait: 1000, run: show('askBij') },
    { wait: 800,  run: show('bij') },
    { wait: 900,  run: show('bijection') },
    { wait: 800,  run: show('three') },
    { wait: 1000, run: show('askMono') },
    { wait: 800,  run: show('mono') },
    { wait: 900,  run: show('monoKeep') },
    { wait: 900,  run: show('strict') },
    { wait: 1200, run: function () { setMono('dec'); } },   /* 换成 θ′ = −θ */
    { wait: 800,  run: show('monoFlip') },
    { wait: 1000, run: show('monoNote') },
    { wait: 1000, run: show('wrap') },
    { wait: 1000, run: show('gaps') },
    { wait: 1000, run: show('frame1') },
    { wait: 800,  run: show('frame2') },
    { wait: 900,  run: show('frameEx') },
    { wait: 1000, run: showChain },
    { wait: 1000, run: show('last') },
    { wait: 900,  run: function () { reveal('cta'); } }
  ];

  function advance() {
    if (stopped) return;
    if (cursor >= STEPS.length) return;

    var item = STEPS[cursor];
    cursor += 1;

    later(function () {
      if (stopped) return;
      if (item.run.length > 0) item.run(advance);       /* 异步项：自己决定何时继续 */
      else { item.run(); advance(); }
    }, item.wait * scale);
  }

  /* ======================================================== 交接与复位 */
  /* 本幕的按钮现在是真的链接：点击就直接进入下一幕（scene5.html）。
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

    if (relabelHandler) { relabelBtn.removeEventListener('click', relabelHandler); relabelHandler = null; }
    if (rangeHandler) { range.removeEventListener('input', rangeHandler); rangeHandler = null; }
    if (relabelBox) relabelBox.classList.remove('is-done');

    /* 在"无过渡"的一帧里复位：位置、数字、滑块、按钮都要回到初始状态 */
    root.classList.add('is-resetting');
    Array.prototype.forEach.call(root.querySelectorAll('.step'), function (el) {
      el.classList.remove('is-in');
    });

    [20, 50, 80].forEach(function (v, i) {
      if (nums[i]) nums[i].textContent = String(v);
      if (chips[i]) chips[i].classList.remove('is-changed');
    });
    mapOuts.forEach(function (el) { if (el) el.textContent = ''; });
    if (range) range.value = '40';
    setMarker(0, 40);
    setMarker(1, 10);
    markers.forEach(function (m) { if (m) m.classList.remove('is-hit'); });
    setMono('inc');
    if (chain) {
      Array.prototype.forEach.call(chain.children, function (el) { el.style.animationDelay = ''; });
    }

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

  segBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-seg');
      if (key) setMono(key);
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;

    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      replay();
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && ctaReady && document.activeElement === document.body) {
      e.preventDefault();
      showHandoff();
    }
  });

  /* 开场 */
  setMarker(0, 40);
  setMarker(1, 10);
  setMono('inc');
  advance();
})();
