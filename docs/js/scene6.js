/* =============================================================================
   Scene 6 · 从经验温度到物理温标
   -----------------------------------------------------------------------------
   本幕回答"为什么不能永远停留在任意的 θ"：
     1) 测量问题：只有热平衡类别做不了定量物理
     2) 测温体系：点一下气体，看 P 随冷热状态变化（V、n 不变）
     3) 两条路线：理想气体温标（PV = nRT）与热力学温标（第二定律 + 可逆热机）
     4) 摄氏与 Kelvin：t = T − 273.15（单位大小相同、零点不同）
   注意：Kelvin 与摄氏都不是第零定律的产物；本幕不推导 Carnot 定理，也不涉及熵。
   不使用 ES module / fetch，保证 file:// 双击即可运行。
   ============================================================================= */
(function () {
  'use strict';
  var root = document.querySelector('[data-scene="6"]');
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
  var device = root.querySelector('[data-device]');
  var deviceState = root.querySelector('[data-device-state]');
  var pOut = root.querySelector('[data-p]');
  var tRange = root.querySelector('[data-t]');
  var cOut = root.querySelector('[data-c-out]');
  var kOut = root.querySelector('[data-k-out]');
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
  var progress = 0;
  var stopped = false;
  var deviceKey = null;

  function later(fn, ms) { var t = window.setTimeout(fn, Math.max(0, ms)); timers.push(t); return t; }
  function clearTimers() { timers.forEach(window.clearTimeout); timers = []; }
  function reveal(id) {
    var el = steps[id];
    if (!el) return;
    el.classList.add('is-in');
    if (id === 'cta') ctaReady = true;
  }

  /* ------------------------------------------------------------ 测温装置
     只表现"可观测量随着冷热状态变化"：V 与 n 固定，P 随之改变。
     P 的取值与 n = 0.10 mol、V = 2.0×10⁻³ m³ 相容；这里刻意不显示 T，
     把 T 留到热力学温标那一节。                                        */
  var STATES = [
    { key: 'cold', word: '冷', p: '1.10' },
    { key: 'mid',  word: '中', p: '1.21' },
    { key: 'hot',  word: '热', p: '1.33' }
  ];

  function applyState(i) {
    var s = STATES[i];
    deviceKey = s.key;
    if (deviceState) deviceState.textContent = s.word;
    if (pOut) pOut.textContent = s.p;
  }

  function stateIndex() {
    for (var i = 0; i < STATES.length; i++) {
      if (STATES[i].key === deviceKey) return i;
    }
    return 0;
  }

  function cycleState() {
    applyState((stateIndex() + 1) % STATES.length);
  }

  /* --------------------------------------------------------- 摄氏与 Kelvin
     t 由滑块给出，T = t + 273.15；两个数值同步变化。                    */
  function applyCelsius() {
    var t = Number(tRange.value);
    if (cOut) cOut.textContent = String(t);
    if (kOut) kOut.textContent = (t + 273.15).toFixed(2);
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
    { wait: 800,  run: show('st1') },
    { wait: 1200, run: show('st2') },
    { wait: 1000, run: show('st3') },
    { wait: 800,  run: show('role') },
    { wait: 1000, run: show('thermo') },
    { wait: 1400, run: cycleState },                        /* 先自动演示一次状态改变 */
    { wait: 800,  run: show('observable') },
    { wait: 1200, run: show('gas') },
    { wait: 800,  run: show('box1') },
    { wait: 1000, run: show('other') },
    { wait: 1400, run: show('cycle') },
    { wait: 1000, run: function () { reveal('boxT'); reveal('abs'); } },
    { wait: 1200, run: show('beyond') },
    { wait: 1200, run: show('celsius') },
    { wait: 1200, run: showChain },
    { wait: 1200, run: function () { reveal('last1'); reveal('last2'); reveal('cta'); } }
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
  /* 本幕的按钮现在是真的链接：点击就直接进入下一幕（scene7.html）。
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

    /* 在"无过渡"的一帧里复位：装置、滑块、总结链、所有 .step */
    root.classList.add('is-resetting');
    Array.prototype.forEach.call(root.querySelectorAll('.step'), function (el) {
      el.classList.remove('is-in');
    });

    applyState(0);                     /* 装置回到"冷"、P = 1.10 */
    if (tRange) tRange.value = '50';
    applyCelsius();
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

  if (device) {
    device.addEventListener('click', function () { cycleState(); });
    device.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        cycleState();
      }
    });
  }

  if (tRange) tRange.addEventListener('input', applyCelsius);

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
  applyState(0);
  applyCelsius();
  advance();
})();
