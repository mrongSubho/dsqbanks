/* Tab buddy — a tiny smiley that rides the active tab.
 *
 * Covers the section tabs (MCQs / Short Questions / Practical) and the
 * practical Set tabs. Pure decoration: it never intercepts clicks or delays
 * the real section switch — it watches for the `.active` class and hops over
 * afterwards with squash-and-stretch, a grin, and a blink.
 *
 * - One instance per tab bar; dynamically created Set bars are picked up via
 *   a document observer. No global IDs; all queries are scoped to the bar.
 * - Motion uses the Web Animations API (cancellable) with instant placement
 *   when prefers-reduced-motion is set. No audio.
 * - aria-hidden, pointer-events:none; keyboard and screen-reader behavior
 *   of the tabs is untouched.
 */
(() => {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var HOP_MS = 480;
  var attached = new WeakSet();
  var instances = [];

  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function buddySize() {
    return window.matchMedia && window.matchMedia('(max-width: 600px)').matches ? 26 : 30;
  }

  var MOUTHS = {
    idle: 'M16 28 Q24 35 32 28',
    fly: 'M16 27 Q24 28.5 32 27 Q32 37.5 24 37.5 Q16 37.5 16 27 Z',
    land: 'M13.5 27 Q24 40 34.5 27'
  };
  var EYES = {
    idle: 'M15 20v3.2 M27 20v3.2',
    fly: 'M13.5 22 Q16 18.5 18.5 22 M25.5 22 Q28 18.5 30.5 22'
  };

  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function buildFace() {
    var svg = el('svg', { viewBox: '0 0 48 48', 'aria-hidden': 'true', focusable: 'false', 'class': 'tab-buddy-face' });
    svg.appendChild(el('circle', { cx: '24', cy: '24', r: '20', 'class': 'tb-face' }));
    svg.appendChild(el('circle', { cx: '13.5', cy: '26', r: '2.6', 'class': 'tb-cheek' }));
    svg.appendChild(el('circle', { cx: '34.5', cy: '26', r: '2.6', 'class': 'tb-cheek' }));
    var eyesG = el('g', { 'class': 'tb-eyes' });
    var eyes = el('path', { d: EYES.idle, 'class': 'tb-feature' });
    eyesG.appendChild(eyes);
    svg.appendChild(eyesG);
    var mouth = el('path', { d: MOUTHS.idle, 'class': 'tb-mouth' });
    svg.appendChild(mouth);
    return { svg: svg, eyesG: eyesG, eyes: eyes, mouth: mouth };
  }

  function attach(bar) {
    if (!bar || attached.has(bar)) return null;
    attached.add(bar);
    bar.classList.add('has-buddy');

    var node = document.createElement('div');
    node.className = 'tab-buddy';
    node.setAttribute('aria-hidden', 'true');
    var face = buildFace();
    node.appendChild(face.svg);
    bar.appendChild(node);

    var lastKey = null;
    var lastPos = null;
    var wasHidden = true;
    var flight = null;
    var revertTimer = 0;

    function setFace(name) {
      face.mouth.setAttribute('d', MOUTHS[name]);
      face.mouth.setAttribute('class', name === 'fly' ? 'tb-mouth tb-open' : 'tb-mouth');
      face.eyes.setAttribute('d', EYES[name] || EYES.idle);
    }

    function keyOf(btn) {
      if (!btn) return '';
      if (btn.dataset && btn.dataset.set !== undefined) return 'set:' + btn.dataset.set;
      return 'id:' + (btn.id || btn.textContent.trim());
    }
    function activeBtn() { return bar.querySelector('.active'); }
    function barVisible() { return bar.isConnected && bar.offsetParent !== null; }

    function anchor(btn) {
      var s = buddySize();
      return { x: btn.offsetLeft + btn.offsetWidth - s * 0.55, y: btn.offsetTop - s * 0.62 };
    }

    function blink() {
      if (reduceMotion() || !node.isConnected || node.style.display === 'none') return;
      try {
        face.eyesG.animate(
          [{ transform: 'scaleY(1)' }, { transform: 'scaleY(.12)', offset: 0.5 }, { transform: 'scaleY(1)' }],
          { duration: 160, easing: 'ease-in-out' });
      } catch (e) { /* WAAPI unavailable: stay smiling */ }
    }

    function hop(from, to) {
      if (flight) { try { flight.cancel(); } catch (e) {} flight = null; }
      if (revertTimer) { clearTimeout(revertTimer); revertTimer = 0; }
      setFace('fly');
      lastPos = to;
      try {
        var mx = (from.x + to.x) / 2, my = Math.min(from.y, to.y) - 16;
        flight = node.animate([
          { transform: 'translate(' + from.x + 'px,' + from.y + 'px) scale(1,1)' },
          { transform: 'translate(' + mx + 'px,' + my + 'px) scale(.94,1.06)', offset: 0.55 },
          { transform: 'translate(' + to.x + 'px,' + to.y + 'px) scale(1.16,.8)', offset: 0.86 },
          { transform: 'translate(' + to.x + 'px,' + to.y + 'px) scale(1,1)' }
        ], { duration: HOP_MS, easing: 'ease-out', fill: 'forwards' });
        flight.onfinish = function () {
          flight = null;
          setFace('land');
          blink();
          revertTimer = setTimeout(function () { revertTimer = 0; setFace('idle'); }, 650);
        };
      } catch (e) {
        node.style.transform = 'translate(' + to.x + 'px,' + to.y + 'px)';
        setFace('idle');
      }
    }

    function place(instant) {
      if (!bar.isConnected) { destroy(); return; }
      var btn = activeBtn();
      var visible = barVisible() && !!btn && btn.offsetParent !== null;
      var justShown = !visible ? false : wasHidden;
      wasHidden = !visible;
      node.style.display = visible ? '' : 'none';
      if (!visible) return;
      var p = anchor(btn);
      var key = keyOf(btn);
      if (instant || reduceMotion() || justShown || !lastPos) {
        if (flight) { try { flight.cancel(); } catch (e) {} flight = null; }
        node.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)';
        setFace('idle');
        lastPos = p;
        lastKey = key;
        return;
      }
      if (key === lastKey) return;
      lastKey = key;
      hop(lastPos, p);
    }

    var mo = new MutationObserver(function () { place(false); });
    mo.observe(bar, { attributes: true, attributeFilter: ['class', 'style'], subtree: true, childList: true });

    var blinkTimer = setInterval(function () {
      if (document.visibilityState === 'visible' && node.style.display !== 'none') blink();
    }, 4200);

    // Pop-in on first appearance.
    place(true);
    if (!reduceMotion() && node.style.display !== 'none') {
      try {
        node.animate(
          [{ transform: node.style.transform + ' scale(0)' }, { transform: node.style.transform + ' scale(1)' }],
          { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' });
      } catch (e) { /* static buddy is fine */ }
    }

    function reposition() { place(true); }
    function destroy() {
      try { mo.disconnect(); } catch (e) {}
      clearInterval(blinkTimer);
      if (revertTimer) clearTimeout(revertTimer);
      if (flight) { try { flight.cancel(); } catch (e) {} }
      if (node.parentNode) node.parentNode.removeChild(node);
      bar.classList.remove('has-buddy');
      var i = instances.indexOf(inst);
      if (i !== -1) instances.splice(i, 1);
    }
    var inst = { bar: bar, reposition: reposition, destroy: destroy };
    instances.push(inst);
    return inst;
  }

  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    var bars = root.querySelectorAll('.section-controls, .practical-tab-bar');
    for (var i = 0; i < bars.length; i++) attach(bars[i]);
    if (root.matches && root.matches('.section-controls, .practical-tab-bar')) attach(root);
  }

  function init() {
    scan(document);
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          if (added[j].nodeType === 1) scan(added[j]);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', function () {
      for (var i = 0; i < instances.length; i++) instances[i].reposition();
    });
    window.addEventListener('pagehide', function () {
      while (instances.length) instances[0].destroy();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.__tabBuddies = { attach: attach, instances: instances };
})();
