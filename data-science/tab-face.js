/* Tab face — a small smiley living inside the active tab button.
 *
 * Covers the section tabs (MCQs / Short Questions / Practical) and the
 * dynamically created practical Set tabs. The face is injected once per
 * button and shown purely through CSS on `.active`, with a little pop-in.
 * This script adds nodes only: no click listeners, no animation drivers,
 * nothing that can interfere with tab switching. Honours
 * prefers-reduced-motion via CSS (face just appears, no pop).
 */
(() => {
  'use strict';

  var FACE_SVG =
    '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
    '<circle cx="24" cy="24" r="20" fill="#fcd34d" stroke="#b45309" stroke-width="2.5"/>' +
    '<circle cx="13.5" cy="26" r="2.6" fill="#f472b6" opacity=".45"/>' +
    '<circle cx="34.5" cy="26" r="2.6" fill="#f472b6" opacity=".45"/>' +
    '<path d="M15 20v3.2 M27 20v3.2" fill="none" stroke="#334155" stroke-width="2.6" stroke-linecap="round"/>' +
    '<path d="M16 27 Q24 28.5 32 27 Q32 37.5 24 37.5 Q16 37.5 16 27 Z" fill="#7c2d12" stroke="#334155" stroke-width="2" stroke-linejoin="round"/>' +
    '</svg>';

  function addFace(btn) {
    if (!btn || btn.querySelector(':scope > .tab-face')) return;
    var s = document.createElement('span');
    s.className = 'tab-face';
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = FACE_SVG;
    btn.insertBefore(s, btn.firstChild);
  }

  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    var btns = root.querySelectorAll('.section-controls button, .practical-tab');
    for (var i = 0; i < btns.length; i++) addFace(btns[i]);
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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
