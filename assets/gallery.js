/* Spotlight gallery: one large photo with its caption, and thumbnails to switch between them.
   Markup lives in the page (see the Impact section of index.html), so captions keep their
   claims.json figures and links. Without JavaScript every photo and caption shows, stacked. */
(function () {
  'use strict';

  document.querySelectorAll('[data-gallery]').forEach(function (g) {
    var figs = g.querySelectorAll('.spot-fig'), thumbs = g.querySelectorAll('.spot-th');
    if (!figs.length || !thumbs.length) return;

    function show(btn) {
      var id = btn.getAttribute('aria-controls');
      thumbs.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      figs.forEach(function (f) { var on = f.id === id; f.hidden = !on; f.classList.toggle('is-active', on); });
    }

    g.classList.add('is-ready');
    figs.forEach(function (f, i) { f.hidden = i !== 0; });

    thumbs.forEach(function (b, i) {
      b.addEventListener('click', function () { show(b); });
      // arrow keys move between thumbnails
      b.addEventListener('keydown', function (e) {
        var k = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
        if (!k) return;
        e.preventDefault();
        var next = thumbs[(i + k + thumbs.length) % thumbs.length];
        next.focus(); show(next);
      });
    });
  });
})();
