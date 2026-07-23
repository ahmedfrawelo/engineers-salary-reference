(function () {
  var RECOVERY_QUERY_PARAM = 'engineers-salary-reference-cache-reset';
  var RECOVERY_ATTEMPT_KEY = 'engineers-salary-reference-cache-recovery-attempted';
  var currentUrl = new URL(window.location.href);

  function isSameOriginAsset(url) {
    try {
      return new URL(url, window.location.href).origin === window.location.origin;
    } catch (error) {
      return false;
    }
  }

  function getAssetUrl(target) {
    if (!target || !target.tagName) {
      return '';
    }

    if (target.tagName === 'LINK') {
      return target.href || '';
    }

    if (target.tagName === 'SCRIPT') {
      return target.src || '';
    }

    return '';
  }

  function isRecoverableAssetTarget(target) {
    var assetUrl = getAssetUrl(target);
    if (!assetUrl || !isSameOriginAsset(assetUrl)) {
      return false;
    }

    if (
      target.tagName === 'LINK' &&
      typeof target.rel === 'string' &&
      target.rel.toLowerCase().indexOf('stylesheet') !== -1
    ) {
      return true;
    }

    if (target.tagName === 'SCRIPT') {
      return /\/(?:main|polyfills|scripts|runtime|chunk)-[A-Z0-9]+\.js(?:\?.*)?$/i.test(assetUrl);
    }

    return false;
  }

  function hasRecoveryAttempted() {
    try {
      return sessionStorage.getItem(RECOVERY_ATTEMPT_KEY) === '1';
    } catch (error) {
      return false;
    }
  }

  function markRecoveryAttempted() {
    try {
      sessionStorage.setItem(RECOVERY_ATTEMPT_KEY, '1');
    } catch (error) {
      // Ignore browser storage failures before app bootstrap.
    }
  }

  function removeRecoveryQueryParam() {
    if (!currentUrl.searchParams.has(RECOVERY_QUERY_PARAM)) {
      return;
    }

    currentUrl.searchParams.delete(RECOVERY_QUERY_PARAM);
    window.history.replaceState({}, document.title, currentUrl.toString());
  }

  function clearBrowserState() {
    var cleanupTasks = [];

    if ('serviceWorker' in navigator) {
      cleanupTasks.push(
        navigator.serviceWorker
          .getRegistrations()
          .then(function (registrations) {
            return Promise.all(
              registrations.map(function (registration) {
                return registration.unregister().catch(function () {
                  return false;
                });
              })
            );
          })
          .catch(function () {
            return [];
          })
      );
    }

    if ('caches' in window) {
      cleanupTasks.push(
        caches
          .keys()
          .then(function (cacheNames) {
            return Promise.all(
              cacheNames.map(function (cacheName) {
                return caches.delete(cacheName).catch(function () {
                  return false;
                });
              })
            );
          })
          .catch(function () {
            return [];
          })
      );
    }

    return Promise.all(cleanupTasks);
  }

  function reloadWithCacheBuster() {
    currentUrl.searchParams.set(RECOVERY_QUERY_PARAM, String(Date.now()));
    window.location.replace(currentUrl.toString());
  }

  function recoverFromAssetFailure(target) {
    if (hasRecoveryAttempted()) {
      return;
    }

    markRecoveryAttempted();

    try {
      console.warn('[ENGINEERS_SALARY_REFERENCE] Recovering from stale cached asset.', getAssetUrl(target));
    } catch (error) {
      // Ignore console failures in locked-down browsers.
    }

    clearBrowserState()
      .catch(function () {
        return [];
      })
      .finally(reloadWithCacheBuster);
  }

  window.addEventListener(
    'error',
    function (event) {
      var target = event && event.target;
      if (!isRecoverableAssetTarget(target)) {
        return;
      }

      recoverFromAssetFailure(target);
    },
    true
  );

  removeRecoveryQueryParam();
})();
