/* ============================================
   INSIGNIA — Firebase Cloud Sync
   ============================================ */

var _firebaseDb = null;
var _CLOUD_COLLECTION = 'app_data';

try {
  if (!firebase.apps.length) {
    firebase.initializeApp({
      apiKey:            'AIzaSyD4vek6DytbLyg0T0pIfZhFkgSiJ53KAS0',
      authDomain:        'insignia-screen-printing.firebaseapp.com',
      projectId:         'insignia-screen-printing',
      storageBucket:     'insignia-screen-printing.firebasestorage.app',
      messagingSenderId: '866878759961',
      appId:             '1:866878759961:web:8d44c9ff0dde74272f7688',
      measurementId:     'G-WF51HQ7Y2J',
    });
  }
  _firebaseDb = firebase.firestore();
  console.log('[Firebase] Connected to Firestore.');
} catch (e) {
  console.warn('[Firebase] Init failed — running offline only.', e);
}

function cloudSave(docId, data) {
  if (!_firebaseDb) return;
  var ts = new Date().toISOString();
  // Write local timestamp synchronously so initCloudSync can detect if local is newer
  localStorage.setItem('_ts_' + docId, ts);
  _firebaseDb.collection(_CLOUD_COLLECTION).doc(docId)
    .set({ data: JSON.stringify(data), updatedAt: ts })
    .catch(function(err) { console.warn('[Firebase] cloudSave failed (' + docId + '):', err); });
}

function cloudLoad(docId, callback) {
  if (!_firebaseDb) { callback(null); return; }
  _firebaseDb.collection(_CLOUD_COLLECTION).doc(docId).get()
    .then(function(doc) {
      if (doc.exists) {
        try { callback(JSON.parse(doc.data().data)); }
        catch (e) { callback(null); }
      } else {
        callback(null);
      }
    })
    .catch(function(err) {
      console.warn('[Firebase] cloudLoad failed (' + docId + '):', err);
      callback(null);
    });
}

function initCloudSync(onComplete) {
  if (!_firebaseDb) { if (onComplete) onComplete(); return; }

  var keys = [
    { docId: 'orders',     lsKey: 'insignia_orders' },
    { docId: 'products',   lsKey: 'insignia_products' },
    { docId: 'production', lsKey: 'insignia_production' },
    { docId: 'accounts',   lsKey: 'insignia_accounts' },
  ];

  var pending = keys.length;

  function done() {
    pending--;
    if (pending === 0 && onComplete) onComplete();
  }

  keys.forEach(function(item) {
    _firebaseDb.collection(_CLOUD_COLLECTION).doc(item.docId).get()
      .then(function(doc) {
        var localData = localStorage.getItem(item.lsKey);
        var localTs   = localStorage.getItem('_ts_' + item.docId) || '0';

        if (doc.exists) {
          var cloudTs = doc.data().updatedAt || '0';

          if (localTs > cloudTs) {
            // Local is newer (e.g. save happened before Firestore write completed)
            // Push local data up to Firestore to reconcile
            if (localData) {
              _firebaseDb.collection(_CLOUD_COLLECTION).doc(item.docId)
                .set({ data: localData, updatedAt: localTs })
                .catch(function(err) { console.warn('[Firebase] Re-push failed for', item.docId, err); });
            }
          } else {
            // Firestore is newer or equal — use it
            try {
              var fresh = JSON.parse(doc.data().data);
              localStorage.setItem(item.lsKey, JSON.stringify(fresh));
              localStorage.setItem('_ts_' + item.docId, cloudTs);
            } catch (e) {}
          }
        } else {
          // No Firestore doc yet — push local data up (first-time migration)
          if (localData) {
            try {
              _firebaseDb.collection(_CLOUD_COLLECTION).doc(item.docId)
                .set({ data: localData, updatedAt: localTs !== '0' ? localTs : new Date().toISOString() })
                .catch(function(err) { console.warn('[Firebase] Migration failed for', item.docId, err); });
            } catch (e) {}
          }
        }
        done();
      })
      .catch(function(err) {
        console.warn('[Firebase] Sync failed for', item.docId, err);
        done();
      });
  });
}
