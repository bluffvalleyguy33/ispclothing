/* ============================================
   INSIGNIA — Global Error Tracker
   Catches unhandled JS errors and promise
   rejections on every page and logs them to
   Firestore via logAppError() so they show up
   in the admin dashboard error log.
   ============================================ */
(function () {
  // Rate-limit: max 8 errors logged per page session to prevent floods
  var _errCount = 0;
  var MAX_PER_SESSION = 8;

  // Noise patterns to ignore — browser internals, ad scripts, extensions
  var IGNORE_PATTERNS = [
    /ResizeObserver loop/i,
    /Script error/i,
    /Non-Error promise rejection/i,
    /Extension context invalidated/i,
    /chrome-extension/i,
    /moz-extension/i,
  ];

  function shouldIgnore(msg) {
    if (!msg) return true;
    return IGNORE_PATTERNS.some(function (p) { return p.test(msg); });
  }

  function send(type, message, code, context) {
    if (_errCount >= MAX_PER_SESSION) return;
    if (shouldIgnore(message)) return;
    _errCount++;
    // logAppError is defined in firebase-init.js which loads before this
    if (typeof logAppError === 'function') {
      logAppError(type, message, { code: code, context: context });
    }
  }

  // Uncaught JS errors (syntax errors, null refs, etc.)
  window.addEventListener('error', function (e) {
    var msg  = e.message || 'Unknown JS error';
    var code = e.filename ? (e.filename.split('/').pop() + ':' + e.lineno) : null;
    var ctx  = e.error && e.error.stack ? e.error.stack.slice(0, 400) : null;
    send('js_error', msg, code, ctx);
  });

  // Unhandled promise rejections — catches Firebase write failures,
  // failed fetches, async errors in order wizard, portal approvals, etc.
  window.addEventListener('unhandledrejection', function (e) {
    if (!e.reason) return;
    var msg  = e.reason.message || String(e.reason).slice(0, 200);
    var code = e.reason.code    || null;
    var ctx  = e.reason.stack   ? e.reason.stack.slice(0, 400) : null;
    // Skip Firebase permission errors on public pages — those are expected
    // until the security rules are updated; they're already surfaced elsewhere
    if (code === 'permission-denied' && msg.indexOf('product') !== -1) return;
    send('promise_rejection', msg, code, ctx);
  });
})();
