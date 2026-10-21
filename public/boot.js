// Applied before first paint so the page never flashes the wrong theme.
(function () {
  try {
    var stored = localStorage.getItem('cms.theme');
    var dark = stored === 'dark' || ((!stored || stored === 'system')
      && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);

    var lang = localStorage.getItem('cms.lang');
    if (lang === 'sw' || lang === 'en') {
      document.documentElement.lang = lang;
    }

    // Text size and page zoom too, so the layout doesn't jump once Angular starts.
    var prefs = JSON.parse(localStorage.getItem('cms.preferences') || '{}');
    var sizes = { sm: '87.5%', md: '100%', lg: '112.5%', xl: '125%' };
    if (sizes[prefs.fontSize]) {
      document.documentElement.style.setProperty('--app-font-size', sizes[prefs.fontSize]);
    }
    if (typeof prefs.zoom === 'number' && prefs.zoom >= 75 && prefs.zoom <= 150) {
      document.documentElement.style.setProperty('--page-zoom', String(prefs.zoom / 100));
    }
  } catch (e) {}
})();
