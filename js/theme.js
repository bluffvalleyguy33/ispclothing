/* ============================================
   INSIGNIA — Theme Toggle (light / dark)
   ============================================
   Include this script in <head> (before CSS if possible, or early body)
   so theme applies before first paint and avoids flash.
*/

(function () {
  var LS_KEY = 'insignia_theme';

  // Determine initial theme: saved pref → system pref → dark default
  function getInitialTheme() {
    var saved = localStorage.getItem(LS_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    return 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(LS_KEY, theme);
    // Update all toggle buttons on page
    document.querySelectorAll('.theme-toggle-btn').forEach(function (btn) {
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      btn.setAttribute('title',      theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      var sunEl  = btn.querySelector('.theme-icon-sun');
      var moonEl = btn.querySelector('.theme-icon-moon');
      if (sunEl)  sunEl.style.display  = theme === 'dark'  ? '' : 'none';
      if (moonEl) moonEl.style.display = theme === 'light' ? '' : 'none';
    });
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  // Apply immediately on script load (before DOM ready) to avoid flash
  applyTheme(getInitialTheme());

  // Expose globally so onclick handlers work
  window.toggleTheme = toggleTheme;

  // Re-apply to any buttons added after DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function () {
    applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');
  });
})();
