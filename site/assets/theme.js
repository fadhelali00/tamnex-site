// Runs before first paint: applies a saved theme choice and marks JS as available. No layout shift.
(function () {
  var d = document.documentElement;
  d.classList.add('js');
  try { var t = localStorage.getItem('tamnex-theme'); if (t === 'light' || t === 'dark') d.setAttribute('data-theme', t); } catch { /* storage blocked: follow the system */ }
})();
