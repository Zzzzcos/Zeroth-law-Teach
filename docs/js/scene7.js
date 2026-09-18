/* =============================================================================
   Scene 7 · 现在，我们真的可以测温了
   最后一幕不引入新理论，让学生把整条链重新走一遍：
     1) 三个系统 A、B、C：自己点选 / 拖动，判定谁与谁处于热平衡
     2) 两条关系确定后，第三条由第零定律（传递性）补上 → 聚成一个等价类
     3) 自己给这个等价类挑一个数字标签（1–1000）：θ(A)=θ(B)=θ(C)=标签
     4) 换成真实温标（t = 50 °C ↔ T = 323.15 K），并说明它与经验标签层级不同
     5) 拆开第一幕的闭环、重排成正确的链；最后给出概念地图与最终问题
   不使用 ES module / fetch，保证 file:// 双击即可运行。
   ============================================================================= */
(function () {
  'use strict';
  var root = document.querySelector('[data-scene="7"]');
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
  var pairing = root.querySelector('[data-pairing]');
  var chips = {};
  Array.prototype.forEach.call(root.querySelectorAll('[data-psys]'), function (el) {
    chips[el.getAttribute('data-psys')] = el;
  });
  var links = {};
  Array.prototype.forEach.call(root.querySelectorAll('[data-link]'), function (el) {
    links[el.getAttribute('data-link')] = el;
  });
  var relNotes = {};
  Array.prototype.forEach.call(root.querySelectorAll('[data-rel-note]'), function (el) {
    relNotes[el.getAttribute('data-rel-note')] = el;
  });
  var labelInput = root.querySelector('[data-label]');
  var labelBtn = root.querySelector('[data-label-ok]');
  var labelEcho = root.querySelector('[data-label-echo]');
  var switchBtn = root.querySelector('[data-switch]');
  var switchNote = root.querySelector('[data-switch-note]');
  var recall = root.querySelector('[data-step="recall"]');
  var loop = root.querySelector('[data-loop]');
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
  var locked = false;                /* 聚合之后不再允许改动分类 */
  var selected = null;
  var relations = {};                /* 'AB' -> true */
  var labelValue = 50;
  var pairHandler = null;
  var labelHandler = null;
  var switchHandler = null;

  function later(fn, ms) { var t = window.setTimeout(fn, Math.max(0, ms)); timers.push(t); return t; }
  function clearTimers() { timers.forEach(window.clearTimeout); timers = []; }
  function reveal(id) {
    var el = steps[id];
    if (!el) return;
    el.classList.add('is-in');
    if (id === 'cta') ctaReady = true;
  }

  /* ========================================================== 分类区几何 */
  var KEYS = ['AB', 'BC', 'AC'];

  function keyOf(a, b) { return a < b ? a + b : b + a; }

  function centers() {
    var out = {};
    var base = pairing.getBoundingClientRect();
    Object.keys(chips).forEach(function (id) {
      var r = chips[id].getBoundingClientRect();
      out[id] = { x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height / 2 };
    });
    return out;
  }

  function drawLinks() {
    if (!pairing || !chips.A) return;
    var c = centers();
    KEYS.forEach(function (k) {
      var line = links[k];
      if (!line) return;
      var a = c[k.charAt(0)];
      var b = c[k.charAt(1)];
      line.setAttribute('x1', Math.round(a.x));
      line.setAttribute('y1', Math.round(a.y));
      line.setAttribute('x2', Math.round(b.x));
      line.setAttribute('y2', Math.round(b.y));
    });
  }

  function showLink(key, on) {
    var line = links[key];
    if (!line) return;
    drawLinks();
    line.classList[on ? 'add' : 'remove']('is-in');
  }

  /* -------------------------------------------------------------- 配对 */
  function pairWith(a, b) {
    if (locked || !a || !b || a === b) return;
    var k = keyOf(a, b);
    if (relations[k]) return;
    relations[k] = true;
    if (relNotes[k]) relNotes[k].textContent = '由你判定为热平衡';
    showLink(k, true);
    reveal('rel' + k);
    updatePairs();
  }

  function relationCount() {
    var n = 0;
    KEYS.forEach(function (k) { if (relations[k]) n += 1; });
    return n;
  }

  function updatePairs() {
    if (pairHandler && relationCount() >= 2) {
      var done = pairHandler;
      pairHandler = null;
      later(done, 420 * scale);
    }
  }

  /* 点选：第一次点选中，第二次点就与它配对 */
  function select(id) {
    if (locked) return;
    if (!selected) {
      selected = id;
      if (chips[id]) chips[id].classList.add('is-sel');
      return;
    }
    if (selected === id) {
      if (chips[id]) chips[id].classList.remove('is-sel');
      selected = null;
      return;
    }
    var other = selected;
    if (chips[other]) chips[other].classList.remove('is-sel');
    selected = null;
    pairWith(other, id);
  }

  /* 拖动：松手时如果落在某个系统附近，就与它配对 */
  function nearestOther(el, id) {
    var base = el.getBoundingClientRect();
    var cx = base.left + base.width / 2;
    var cy = base.top + base.height / 2;
    var best = null;
    var bestD = 1e9;
    Object.keys(chips).forEach(function (other) {
      if (other === id) return;
      var r = chips[other].getBoundingClientRect();
      var dx = r.left + r.width / 2 - cx;
      var dy = r.top + r.height / 2 - cy;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) { bestD = d; best = other; }
    });
    return bestD <= 96 ? best : null;
  }

  function enableDrag(el, id) {
    var sx = 0, sy = 0, moved = false, dragging = false;

    el.addEventListener('pointerdown', function (e) {
      if (locked || stopped) return;
      dragging = true;
      moved = false;
      sx = e.clientX;
      sy = e.clientY;
      if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - sx;
      var dy = e.clientY - sy;
      if (!moved && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        moved = true;
        el.classList.add('is-drag');
      }
      if (moved) el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    });

    el.addEventListener('pointerup', function () {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('is-drag');
      el.style.transform = '';
      if (!moved) { select(id); return; }        /* 没动过 → 当作点击 */
      var target = nearestOther(el, id);
      if (target) pairWith(id, target);
    });

    el.addEventListener('pointercancel', function () {
      dragging = false;
      el.classList.remove('is-drag');
      el.style.transform = '';
    });

    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select(id);
      }
    });
  }

  Object.keys(chips).forEach(function (id) { enableDrag(chips[id], id); });

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(drawLinks, 160);
  });

  /* -------------------------------------------------------------- 数字标签
     换温标之后的那段说明会随用户选的标签动态变化：
     选 50 时明确写出"数值相同只是巧合"，避免把经验标签与摄氏混为一谈。 */
  function applyLabel() {
    var v = Number(labelInput.value);
    if (!isFinite(v)) v = 50;
    v = Math.round(v);
    if (v < 1) v = 1;
    if (v > 1000) v = 1000;
    labelInput.value = String(v);
    labelValue = v;
    if (labelEcho) labelEcho.textContent = String(v);
    if (!switchNote) return;
    switchNote.innerHTML = (v === 50)
      ? '注意：<span class="m"><i>θ</i> <span class="op">=</span> 50</span> 是我们自己给这个类别选的经验标签；而 <span class="m"><i>t</i> <span class="op">=</span> 50 °C</span> 是经过物理定义与标定得到的数值。两者数值相同只是巧合，它们不是同一层级的东西。'
      : '注意：你选的 <span class="m"><i>θ</i> <span class="op">=</span> ' + v + '</span> 只是我们自己的经验标签；而 <span class="m"><i>t</i> <span class="op">=</span> 50 °C</span> 是经过物理定义与标定得到的数值。两者之间没有换算关系。';
  }

  /* ---------------------------------------------------------------- 闸门 */
  function waitForPairs(done) {
    if (relationCount() >= 2) { later(done, 300 * scale); return; }
    pairHandler = done;                   /* 不设兜底：分类必须由用户亲自完成 */
  }

  /* 用前面两条关系与第零定律补上第三条，并把三个系统聚成一个等价类 */
  function deriveThird() {
    var missing = null;
    KEYS.forEach(function (k) { if (!relations[k]) missing = k; });
    if (missing) {
      relations[missing] = true;
      if (relNotes[missing]) relNotes[missing].textContent = '由前面两条与第零定律得到';
      if (steps['rel' + missing]) steps['rel' + missing].classList.add('log__row--derived');
      showLink(missing, true);
      reveal('rel' + missing);
    }
    locked = true;
    if (pairing) pairing.classList.add('is-grouped');
    if (selected && chips[selected]) chips[selected].classList.remove('is-sel');
    selected = null;
  }

  function waitForLabel(done) {
    var started = false;
    function begin() {
      if (started || stopped) return;
      started = true;
      if (labelHandler) { labelBtn.removeEventListener('click', labelHandler); labelHandler = null; }
      applyLabel();
      if (steps.pick) steps.pick.classList.add('is-done');
      later(done, 400 * scale);
    }
    labelHandler = begin;
    labelBtn.addEventListener('click', labelHandler);
    labelInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); begin(); }
    });
    later(begin, 9000 * scale);           /* 无人操作时用默认值继续 */
  }

  function waitForSwitch(done) {
    var started = false;
    function begin() {
      if (started || stopped) return;
      started = true;
      if (switchHandler) { switchBtn.removeEventListener('click', switchHandler); switchHandler = null; }
      later(done, 300 * scale);
    }
    switchHandler = begin;
    switchBtn.addEventListener('click', switchHandler);
    later(begin, 9000 * scale);           /* 无人点击时自动演示 */
  }

  /* ---------------------------------------------------- 拆开第一幕的闭环
     注意：不能把闭环整块藏起来——那样小标题"第一幕的那个推理："会孤零零地没有内容。
     这里只让它淡下去（CSS 里 .recall.is-broken 还会把回环的环改成虚线）。 */
  function breakLoop() {
    if (recall) recall.classList.add('is-broken');
  }

  /* 逐行出现（把延迟按序号写进 style） */
  function stagger(el) {
    if (!el) return;
    Array.prototype.forEach.call(el.children, function (c, i) {
      c.style.animationDelay = (i * 0.10 * scale) + 's';
    });
  }

  function showFixChain() { stagger(steps.fixChain); reveal('fixChain'); }
  function showMap() { stagger(steps.map); reveal('map'); }
  function show(id) { return function () { reveal(id); }; }

  /* ---------------------------------------------------------------- 时间线 */
  var STEPS = [
    { wait: 500,  run: show('lead') },
    { wait: 800,  run: function () { reveal('sysRow'); reveal('hint'); drawLinks(); } },
    { wait: 400,  run: waitForPairs },                /* 闸门 1：等用户建立两条关系 */
    { wait: 700,  run: show('askThird') },
    { wait: 900,  run: deriveThird },                 /* 第零定律补第三条 + 聚合 */
    { wait: 800,  run: show('eqABC') },
    { wait: 1000, run: show('pick') },
    { wait: 400,  run: waitForLabel },                /* 闸门 2：等用户确定标签 */
    { wait: 800,  run: function () { reveal('thetaSame'); reveal('switchBox'); } },
    { wait: 400,  run: waitForSwitch },               /* 闸门 3：点"换一种温标" */
    { wait: 400,  run: show('switchOut') },
    { wait: 1400, run: show('recall') },
    { wait: 2600, run: function () { reveal('recallSay'); breakLoop(); } },
    { wait: 900,  run: showFixChain },
    { wait: 1200, run: show('finalBox') },
    { wait: 1200, run: function () { reveal('close1'); reveal('close2'); reveal('close3'); } },
    { wait: 1200, run: show('mapTitle') },
    { wait: 400,  run: showMap },
    { wait: 1600, run: show('sign') }                 /* 结束页：署名与余弦标志 */
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
  function showHandoff() {
    if (!handoff || handoff.classList.contains('is-in')) return;
    handoff.classList.add('is-in');
    if (nextBtn) nextBtn.setAttribute('aria-expanded', 'true');
    if (handoff.scrollIntoView) {
      handoff.scrollIntoView({ behavior: scale < 1 ? 'auto' : 'smooth', block: 'nearest' });
    }
  }

  function hideHandoff() {
    if (!handoff) return;
    handoff.classList.remove('is-in');
    if (nextBtn) nextBtn.setAttribute('aria-expanded', 'false');
  }

  function reset() {
    stopped = true;
    clearTimers();
    ctaReady = false;
    progress = 0;
    locked = false;
    selected = null;
    relations = {};
    pairHandler = null;
    if (labelHandler) { labelBtn.removeEventListener('click', labelHandler); labelHandler = null; }
    if (switchHandler) { switchBtn.removeEventListener('click', switchHandler); switchHandler = null; }

    /* 在"无过渡"的一帧里复位：分类、标签、闭环、两条链都要回到初始状态 */
    root.classList.add('is-resetting');
    Array.prototype.forEach.call(root.querySelectorAll('.step'), function (el) {
      el.classList.remove('is-in');
    });

    Object.keys(chips).forEach(function (id) {
      chips[id].classList.remove('is-sel', 'is-drag');
      chips[id].style.transform = '';
    });
    if (pairing) pairing.classList.remove('is-grouped');
    KEYS.forEach(function (k) {
      if (links[k]) links[k].classList.remove('is-in');
      if (relNotes[k]) relNotes[k].textContent = '';
      if (steps['rel' + k]) steps['rel' + k].classList.remove('log__row--derived');
    });
    if (labelInput) labelInput.value = '50';
    applyLabel();
    if (steps.pick) steps.pick.classList.remove('is-done');
    if (recall) recall.classList.remove('is-broken');
    if (loop) loop.style.visibility = '';
    Array.prototype.forEach.call(root.querySelectorAll('[data-chain]'), function (el) {
      Array.prototype.forEach.call(el.children, function (c) { c.style.animationDelay = ''; });
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
  applyLabel();
  drawLinks();
  advance();
})();
