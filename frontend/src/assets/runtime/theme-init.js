(function () {
  try {
    var theme = localStorage.getItem('app-theme');
    if (theme) {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch (error) {
    // Ignore browser storage failures before app bootstrap.
  }
})();
