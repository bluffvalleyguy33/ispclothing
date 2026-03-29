/* ============================================
   INSIGNIA — Page View Analytics Tracker
   Runs on all customer-facing pages.
   Writes to Firestore app_data/analytics.
   ============================================ */
(function () {
  // Derive page name from URL
  var raw  = window.location.pathname.split('/').pop();
  var page = raw ? raw.replace('.html', '') : 'home';
  if (!page) page = 'home';
  // Never track admin page
  if (page === 'admin') return;

  function doTrack() {
    if (typeof _firebaseDb === 'undefined' || !_firebaseDb) {
      setTimeout(doTrack, 400);
      return;
    }

    // One unique session per browser session per page
    var sessionKey  = '_isa_session_' + page;
    var isNewSession = !sessionStorage.getItem(sessionKey);
    if (isNewSession) sessionStorage.setItem(sessionKey, '1');

    var today = new Date().toISOString().slice(0, 10);

    _firebaseDb.collection('app_data').doc('analytics').get()
      .then(function (doc) {
        var data = {};
        if (doc.exists) {
          try { data = JSON.parse(doc.data().data || '{}'); } catch (e) {}
        }

        // All-time totals
        data.totalViews    = (data.totalViews    || 0) + 1;
        if (isNewSession) data.totalSessions = (data.totalSessions || 0) + 1;

        // Per-page counts
        data.pageStats         = data.pageStats || {};
        data.pageStats[page]   = (data.pageStats[page] || 0) + 1;

        // Daily breakdown
        data.dailyStats = data.dailyStats || {};
        if (!data.dailyStats[today]) data.dailyStats[today] = { views: 0, sessions: 0 };
        data.dailyStats[today].views++;
        if (isNewSession) data.dailyStats[today].sessions++;

        // Prune stats older than 90 days to keep the document lean
        var cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
        Object.keys(data.dailyStats).forEach(function (d) {
          if (d < cutoff) delete data.dailyStats[d];
        });

        return _firebaseDb.collection('app_data').doc('analytics').set({
          data: JSON.stringify(data),
          updatedAt: new Date().toISOString(),
        });
      })
      .catch(function (e) { console.warn('[Analytics] failed:', e); });
  }

  // Wait for DOM + Firebase init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(doTrack, 900); });
  } else {
    setTimeout(doTrack, 900);
  }
})();
