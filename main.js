// Reveal-on-scroll animation
(function () {
  var items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.08 });
  items.forEach(function (el) { io.observe(el); });
})();

// Project filters (projects page)
(function () {
  var buttons = document.querySelectorAll('.filter');
  if (!buttons.length) return;
  var cards = document.querySelectorAll('.project-card');

  buttons.forEach(function (btn) {
    var f = btn.dataset.filter;
    var n = f === 'all' ? cards.length
      : Array.prototype.filter.call(cards, function (c) { return c.dataset.category === f; }).length;
    var count = document.createElement('span');
    count.className = 'count';
    count.textContent = n;
    btn.appendChild(count);

    btn.addEventListener('click', function () {
      buttons.forEach(function (b) { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      cards.forEach(function (c) {
        c.classList.toggle('hidden', f !== 'all' && c.dataset.category !== f);
      });
    });
  });
})();

// Footer year
document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
