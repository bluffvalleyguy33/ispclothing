/* ============================================
   INSIGNIA — Page View Analytics Tracker
   Runs on all customer-facing pages.
   Writes to Firestore app_data/analytics.
   Uses anonymous Firebase Auth so Firestore
   security rules (which require auth) are met.
   ============================================ */
(function () {
  var raw  = window.location.pathname.split('/').pop();
  var page = raw ? raw.replace('.html', '') : 'home';
  if (!page) page = 'home';
  if (page === 'admin') return; // never track admin

  function doTrack() {
    if (typeof _firebaseDb === 'undefined' || !_firebaseDb) {
      setTimeout(doTrack, 400);
      return;
    }

    // Sign in anonymously so Firestore auth rules are satisfied for public visitors.
    // If already signed in (portal users, returning visitors) this is a no-op.
    var authReady;
    if (typeof firebase !== 'undefined' && typeof firebase.auth === 'function') {
      var currentUser = firebase.auth().currentUser;
      authReady = currentUser
        ? Promise.resolve(currentUser)
        : firebase.auth().signInAnonymously().catch(function () { return null; });
    } else {
      authReady = Promise.resolve(null);
    }

    authReady.then(function () {
      var sessionKey   = '_isa_session_' + page;
      var isNewSession = !sessionStorage.getItem(sessionKey);
      if (isNewSession) sessionStorage.setItem(sessionKey, '1');

      var today = new Date().toISOString().slice(0, 10);

      _firebaseDb.collection('app_data').doc('analytics').get()
        .then(function (doc) {
          var data = {};
          if (doc.exists) {
            try { data = JSON.parse(doc.data().data || '{}'); } catch (e) {}
          }

          data.totalViews = (data.totalViews || 0) + 1;
          if (isNewSession) data.totalSessions = (data.totalSessions || 0) + 1;

          data.pageStats       = data.pageStats || {};
          data.pageStats[page] = (data.pageStats[page] || 0) + 1;

          data.dailyStats = data.dailyStats || {};
          if (!data.dailyStats[today]) data.dailyStats[today] = { views: 0, sessions: 0 };
          data.dailyStats[today].views++;
          if (isNewSession) data.dailyStats[today].sessions++;

          // Prune older than 90 days
          var cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
          Object.keys(data.dailyStats).forEach(function (d) {
            if (d < cutoff) delete data.dailyStats[d];
          });

          return _firebaseDb.collection('app_data').doc('analytics').set({
            data: JSON.stringify(data),
            updatedAt: new Date().toISOString(),
          });
        })
        .catch(function (e) { console.warn('[Analytics] write failed:', e); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(doTrack, 900); });
  } else {
    setTimeout(doTrack, 900);
  }
})();
