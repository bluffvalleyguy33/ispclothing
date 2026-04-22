/* ============================================
   INSIGNIA — Firebase Cloud Sync
   ============================================ */

var _firebaseDb      = null;
var _firebaseStorage = null;
var _CLOUD_COLLECTION = 'app_data';

// Global sync-error callback — set by admin.js to surface failures visibly
var _onSyncError = null;

// Stored so auth.js can create accounts via a secondary app instance
var _firebaseConfig = {
  apiKey:            'AIzaSyD4vek6DytbLyg0T0pIfZhFkgSiJ53KAS0',
  authDomain:        'insignia-screen-printing.firebaseapp.com',
  projectId:         'insignia-screen-printing',
  storageBucket:     'insignia-screen-printing.firebasestorage.app',
  messagingSenderId: '866878759961',
  appId:             '1:866878759961:web:8d44c9ff0dde74272f7688',
  measurementId:     'G-WF51HQ7Y2J',
};

try {
  if (!firebase.apps.length) {
    firebase.initializeApp(_firebaseConfig);
  }
  _firebaseDb = firebase.firestore();
  console.log('[Firebase] Connected to Firestore.');
} catch (e) {
  console.warn('[Firebase] Init failed — running offline only.', e);
}

// Initialize Firebase Storage if the SDK is loaded
try {
  if (typeof firebase.storage === 'function') {
    _firebaseStorage = firebase.storage();
    console.log('[Firebase] Storage ready.');
  }
} catch (e) {
  console.warn('[Firebase] Storage init failed:', e);
}

// Upload a Blob to Firebase Storage and return a Promise<downloadURL>.
function uploadToStorage(blob, path) {
  if (!_firebaseStorage) return Promise.reject(new Error('Firebase Storage not initialised'));
  var ref = _firebaseStorage.ref(path);
  return ref.put(blob).then(function () { return ref.getDownloadURL(); });
}

// Upload a Blob to Firebase Storage and return a Promise<downloadURL>.
// UploadTask is thenable in the compat SDK — use it directly so the
// Promise resolves/rejects even if state_changed events never fire.
function uploadToStorageWithProgress(blob, path, onProgress) {
  if (!_firebaseStorage) return Promise.reject(new Error('Firebase Storage not initialised'));
  var ref  = _firebaseStorage.ref(path);
  var task = ref.put(blob);
  if (typeof onProgress === 'function') {
    task.on('state_changed', function (snap) {
      var pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
      onProgress(pct);
    });
  }
  // Use task as a Promise (UploadTask implements thenable), then fetch URL
  return task.then(function () { return ref.getDownloadURL(); });
}

// ---- Error logging ----
// Writes to the `app_errors` Firestore collection.
// Called from any page — works for admin users and anonymous customers.
// Never throws; swallows its own failures to prevent infinite loops.
function logAppError(type, message, opts) {
  if (!_firebaseDb) return;
  opts = opts || {};
  try {
    _firebaseDb.collection('app_errors').add({
      type:      String(type   || 'unknown').slice(0, 80),
      message:   String(message || '').slice(0, 500),
      code:      opts.code    ? String(opts.code).slice(0, 100)    : null,
      page:      opts.page    ? String(opts.page)                  : (window.location.pathname.split('/').pop().replace('.html','') || 'home'),
      context:   opts.context ? String(opts.context).slice(0, 400) : null,
      email:     opts.email   ? String(opts.email).slice(0, 120)   : null,
      resolved:  false,
      timestamp: new Date().toISOString(),
    }).catch(function() {});  // swallow — never recurse
  } catch(e) {}
}

function resolveAppError(docId) {
  if (!_firebaseDb || !docId) return Promise.resolve();
  return _firebaseDb.collection('app_errors').doc(docId).update({
    resolved:   true,
    resolvedAt: new Date().toISOString(),
  }).catch(function() {});
}

function cloudSave(docId, data) {
  if (!_firebaseDb) return;
  var ts = new Date().toISOString();
  // Write local timestamp synchronously so initCloudSync can detect if local is newer
  localStorage.setItem('_ts_' + docId, ts);
  _firebaseDb.collection(_CLOUD_COLLECTION).doc(docId)
    .set({ data: JSON.stringify(data), updatedAt: ts })
    .catch(function(err) {
      console.warn('[Firebase] cloudSave failed (' + docId + '):', err);
      if (typeof _onSyncError === 'function') _onSyncError(docId, err);
      logAppError('sync_fail', 'Cloud save failed for "' + docId + '"', { code: err.code || err.message });
    });
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
    { docId: 'orders',      lsKey: 'insignia_orders' },
    { docId: 'products',    lsKey: 'insignia_products' },
    { docId: 'production',  lsKey: 'insignia_production' },
    { docId: 'accounts',    lsKey: 'insignia_accounts' },
    { docId: 'catalogs',    lsKey: 'insignia_catalogs' },
    { docId: 'pricing',     lsKey: 'insignia_pricing' },
    { docId: 'automations', lsKey: 'insignia_automations' },
    { docId: 'config',      lsKey: 'insignia_config' },
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
                .catch(function(err) {
                  console.warn('[Firebase] Re-push failed for', item.docId, err);
                  if (typeof _onSyncError === 'function') _onSyncError(item.docId, err);
                  logAppError('sync_fail', 'Re-push failed for "' + item.docId + '"', { code: err.code || err.message });
                });
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
                .catch(function(err) {
                  console.warn('[Firebase] Migration failed for', item.docId, err);
                  if (typeof _onSyncError === 'function') _onSyncError(item.docId, err);
                  logAppError('sync_fail', 'First-time migration failed for "' + item.docId + '"', { code: err.code || err.message });
                });
            } catch (e) {}
          }
        }
        done();
      })
      .catch(function(err) {
        console.warn('[Firebase] Sync failed for', item.docId, err);
        if (typeof _onSyncError === 'function') _onSyncError(item.docId, err);
        logAppError('sync_fail', 'Sync read failed for "' + item.docId + '"', { code: err.code || err.message });
        done();
      });
  });
}
