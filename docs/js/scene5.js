/* =============================================================================
   Scene 5 · 一把尺子究竟要满足什么要求
   -----------------------------------------------------------------------------
   本幕不加新的抽象数学，只用"测量一个物理量"的直觉说明三件事：
     1) 系统状态连续变化 → 温度表示也应该连续变化（一条连续移动的指示器）
     2) 重新标度 θ′ = 2θ + 5：拖动 θ，θ′ 同步变；而它属于哪个等价类不变
     3) 三把抽象尺子：不同的数值标度可以描述同一批有序状态
   指示器的连续运动由 requestAnimationFrame 驱动，不用任何第三方库。
   不使用 ES module / fetch，保证 file:// 双击即可运行。
   ============================================================================= */
(function () {
  'use strict';
  var root = document.querySelector('[data-scene="5"]');
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
  var marker = root.querySelector('[data-marker]');
  var sysLabel = root.querySelector('[data-sys-label]');
  var thetaRange = root.querySelector('[data-theta]');
  var thetaOut = root.querySelector('[data-theta-out]');
  var thetaPrime = root.querySelector('[data-theta-prime]');
  var thetaClass = root.querySelector('[data-theta-class]');
  var scaleCursor = root.querySelector('[data-cursor]');
  var rulers = Array.prototype.slice.call(root.querySelectorAll('[data-ruler]'));
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
  var progress = 0;
  var stopped = false;
  var rafId = 0;
  var startTime = 0;
  var thetaHandler = null;

  function later(fn, ms) { var t = window.setTimeout(fn, Math.max(0, ms)); timers.push(t); return t; }
  function clearTimers() { timers.forEach(window.clearTimeout); timers = []; }
  function reveal(id) {
    var el = steps[id];
    if (!el) return;
    el.classList.add('is-in');
    if (id === 'cta') ctaReady = true;
  }

  /* --------------------------------------------------- 连续变化的热系统
     指示器 0 → 1 → 0 一个来回约 6 秒；屏幕上不出现任何数字，只给
     "冷 / 较冷 / 中等 / 较热 / 热"这样的定性词。                        */
  var WORDS = ['冷', '较冷', '中等', '较热', '热'];
  var CYCLE = 6000;

  function wordFor(u) {
    var i = Math.floor(u * WORDS.length);
    if (i > WORDS.length - 1) i = WORDS.length - 1;
    if (i < 0) i = 0;
    return WORDS[i];
  }

  function tick(now) {
    if (stopped) return;
    if (!startTime) startTime = now;
    var t = (now - startTime) % CYCLE;
    var half = CYCLE / 2;
    var u = t < half ? t / half : (CYCLE - t) / half;      /* 0 → 1 → 0 */
    if (marker) marker.style.left = (u * 100) + '%';
    if (sysLabel) {
      var w = wordFor(u);
      if (sysLabel.textContent !== w) sysLabel.textContent = w;
    }
    rafId = window.requestAnimationFrame(tick);
  }

  function startIndicator() {
    if (rafId) return;
    startTime = 0;
    rafId = window.requestAnimationFrame(tick);
  }

  function stopIndicator() {
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
    startTime = 0;
    if (marker) marker.style.left = '50%';
    if (sysLabel) sysLabel.textContent = '中等';
  }

  /* ------------------------------------------------- 重新标度滑块 θ → θ′
     θ′ = 2θ + 5；同时显示"与它最接近的类别"，让学生看到
     "数字在变、所属类别不变"。                                        */
  var CLASSES = [
    { v: 20, html: '[<i>A</i>]' },
    { v: 50, html: '[<i>C</i>]' },
    { v: 80, html: '[<i>G</i>]' }
  ];

  function nearestClass(v) {
    var best = CLASSES[0];
    var bestD = Math.abs(v - best.v);
    for (var i = 1; i < CLASSES.length; i++) {
      var d = Math.abs(v - CLASSES[i].v);
      if (d < bestD) { bestD = d; best = CLASSES[i]; }
    }
    return best;
  }

  function applyTheta() {
    var v = Number(thetaRange.value);
    if (thetaOut) thetaOut.textContent = String(v);
    if (thetaPrime) thetaPrime.textContent = String(2 * v + 5);
    if (scaleCursor) scaleCursor.style.left = v + '%';
    if (thetaClass) thetaClass.innerHTML = nearestClass(v).html;
  }

  /* ------------------------------------------------------------ 三把尺子
     依次出现（用行内 opacity + 既有的 opacity 过渡实现错落），
     点一下可以把它藏起来，方便比较刻度疏密与零点。                     */
  function showRulers() {
    reveal('rulers');
    rulers.forEach(function (el, i) {
      el.style.opacity = '0';
      later(function () { el.style.opacity = ''; }, (i * 350 + 60) * scale);
    });
  }

  function toggleRuler(el) {
    var off = el.classList.toggle('is-off');
    el.setAttribute('aria-pressed', off ? 'false' : 'true');
  }

  function show(id) { return function () { reveal(id); }; }

  /* ---------------------------------------------------------------- 时间线 */
  var STEPS = [
    { wait: 500,  run: show('lead') },
    { wait: 700,  run: show('sys') },
    { wait: 600,  run: startIndicator },                    /* 指示器开始连续移动 */
    { wait: 800,  run: show('st1') },
    { wait: 1000, run: show('st2') },
    { wait: 1000, run: show('st3') },
    { wait: 1000, run: show('scale') },
    { wait: 400,  run: applyTheta },                        /* 滑块与读数同步 */
    { wait: 1200, run: show('scaleDone') },
    { wait: 900,  run: showRulers },                        /* 三把尺子依次出现 */
    { wait: 1200, run: function () { reveal('rk1'); reveal('rk2'); } },
    { wait: 1200, run: function () { reveal('box1'); reveal('sum1'); } },
    { wait: 1000, run: function () { reveal('box2'); reveal('sum2'); } },
    { wait: 1000, run: function () { reveal('endask'); reveal('cta'); } }
  ];

  function advance() {
    if (stopped) return;
    if (progress >= STEPS.length) return;

    var item = STEPS[progress];
    progress += 1;

    later(function () {
      if (stopped) return;
      if (item.run.length > 0) item.run(advance);      /* 异步项：自己决定何时继续 */
      else { item.run(); advance(); }
    }, item.wait * scale);
  }

  /* ======================================================== 交接与复位 */
  /* 本幕的按钮现在是真的链接：点击就直接进入下一幕（scene6.html）。
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
    progress = 0;
    stopIndicator();                 /* 指示器回到中点、"中等" */

    /* 在"无过渡"的一帧里复位：滑块、尺子、所有 .step 都要回到初始状态 */
    root.classList.add('is-resetting');
    Array.prototype.forEach.call(root.querySelectorAll('.step'), function (el) {
      el.classList.remove('is-in');
    });

    if (thetaRange) thetaRange.value = '20';
    applyTheta();
    rulers.forEach(function (el) {
      el.classList.remove('is-off');
      el.setAttribute('aria-pressed', 'true');
      el.style.opacity = '';
    });

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

  thetaHandler = applyTheta;
  if (thetaRange) thetaRange.addEventListener('input', thetaHandler);

  rulers.forEach(function (el) {
    el.addEventListener('click', function () { toggleRuler(el); });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleRuler(el);
      }
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
  applyTheta();
  advance();
})();
