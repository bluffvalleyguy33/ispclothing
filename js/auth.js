/* ============================================
   INSIGNIA — Multi-User Firebase Auth
   ============================================ */

const SUPER_ADMIN_EMAIL = 'blake@insigniascreenprinting.com';

let _currentAdminProfile = null; // { uid, email, name, role, approved }

function getCurrentAdminProfile() { return _currentAdminProfile; }
function isSuperAdmin() {
  return _currentAdminProfile && _currentAdminProfile.email === SUPER_ADMIN_EMAIL;
}

// ---- Bootstrap super admin on first login ----
async function _bootstrapSuperAdmin(user) {
  if (!_firebaseDb) return { uid: user.uid, email: user.email, name: 'Blake', role: 'super_admin', approved: true };
  try {
    const ref = _firebaseDb.collection('admins').doc(user.uid);
    const snap = await ref.get();
    const ts = new Date().toISOString();
    if (!snap.exists) {
      const data = { uid: user.uid, email: user.email, name: 'Blake', role: 'super_admin', approved: true, createdAt: ts, lastLogin: ts };
      await ref.set(data);
      return data;
    } else {
      await ref.update({ lastLogin: ts });
      return { uid: user.uid, ...snap.data(), lastLogin: ts };
    }
  } catch (e) {
    console.error('[Auth] Bootstrap failed', e);
    return { uid: user.uid, email: user.email, name: 'Blake', role: 'super_admin', approved: true };
  }
}

// ---- Load profile from Firestore ----
async function _loadAdminProfile(user) {
  if (user.email === SUPER_ADMIN_EMAIL) {
    return await _bootstrapSuperAdmin(user);
  }
  if (!_firebaseDb) return null;
  try {
    const snap = await _firebaseDb.collection('admins').doc(user.uid).get();
    if (snap.exists) return { uid: user.uid, ...snap.data() };

    // Not an admin — check if there's a pending/rejected request
    const reqSnap = await _firebaseDb.collection('access_requests').doc(user.uid).get();
    if (reqSnap.exists) return { uid: user.uid, approved: false, _isRequest: true, ...reqSnap.data() };

    return null;
  } catch (e) {
    console.error('[Auth] Load profile failed', e);
    return null;
  }
}

// ---- initAuth — call on DOMContentLoaded ----
function initAuth(onAuthed, onUnauthed) {
  firebase.auth().onAuthStateChanged(async user => {
    if (!user) {
      _currentAdminProfile = null;
      onUnauthed(null);
      return;
    }

    const profile = await _loadAdminProfile(user);

    if (profile && profile.approved && !profile._isRequest) {
      _currentAdminProfile = profile;
      if (profile.role !== 'super_admin' && _firebaseDb) {
        _firebaseDb.collection('admins').doc(user.uid)
          .update({ lastLogin: new Date().toISOString() }).catch(() => {});
      }
      onAuthed(profile);
    } else {
      const status = (profile && profile.status) || (profile ? 'pending' : 'unauthorized');
      await firebase.auth().signOut();
      onUnauthed(status);
    }
  });
}

// ---- Sign in ----
function authSignIn(email, password) {
  return firebase.auth().signInWithEmailAndPassword(email, password);
}

// ---- Sign out ----
function authSignOut() {
  return firebase.auth().signOut();
}

// ---- Create a Firebase Auth user without affecting Blake's session ----
// Uses a temporary secondary Firebase app instance so the current user stays logged in.
async function _createAuthUser(email, tempPassword) {
  const appName = 'secondary_' + Date.now();
  const secondaryApp = firebase.initializeApp(_firebaseConfig, appName);
  try {
    const cred = await secondaryApp.auth().createUserWithEmailAndPassword(email, tempPassword);
    const uid = cred.user.uid;
    await secondaryApp.auth().signOut();
    return uid;
  } finally {
    await secondaryApp.delete();
  }
}

// ---- Add a team member (Blake-initiated) ----
async function authAddTeamMember(name, email) {
  if (!_firebaseDb) throw new Error('Not connected to database.');
  email = email.toLowerCase().trim();

  // Generate a temp password as a fallback Blake can share manually
  const tempPassword = _generateTempPW();

  // Create Firebase Auth account via secondary app (keeps Blake signed in)
  const uid = await _createAuthUser(email, tempPassword);

  const ts = new Date().toISOString();
  const me = getCurrentAdminProfile();

  // Write approved admin profile immediately
  await _firebaseDb.collection('admins').doc(uid).set({
    uid,
    email,
    name: name.trim(),
    role: 'admin',
    approved: true,
    createdAt: ts,
    addedBy: me ? me.email : SUPER_ADMIN_EMAIL,
    lastLogin: null,
    tempPassword, // stored so Blake can reference it if email fails
  });

  // Send Firebase's built-in "set your password" email (password reset flow)
  // This gives the employee a secure link to choose their own password
  await firebase.auth().sendPasswordResetEmail(email);

  logActivity('added_employee', 'employee', uid, `Added ${name} (${email})`);

  return { uid, tempPassword };
}

// ---- Send a password reset email to a team member ----
async function authSendPasswordReset(email) {
  await firebase.auth().sendPasswordResetEmail(email);
}

// ---- Set a new temp password for a team member (Blake override) ----
async function authSetTempPassword(uid, email, name) {
  if (!_firebaseDb) throw new Error('Not connected to database.');
  const tempPassword = _generateTempPW();

  // Store it in their admin profile so Blake can see/share it
  await _firebaseDb.collection('admins').doc(uid).update({
    tempPassword,
    tempPasswordSetAt: new Date().toISOString(),
  });

  // Also send them a password reset email so they can set their own
  await firebase.auth().sendPasswordResetEmail(email);

  logActivity('reset_password', 'employee', uid, `Reset password for ${name} (${email})`);

  return { tempPassword };
}

function _generateTempPW() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = 'ISP-';
  for (let i = 0; i < 8; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)];
  }
  return pw;
}

// ---- Approve employee ----
async function authApproveEmployee(uid, requestData) {
  if (!_firebaseDb) return;
  const me = getCurrentAdminProfile();
  const ts = new Date().toISOString();
  await _firebaseDb.collection('admins').doc(uid).set({
    uid,
    email: requestData.email,
    name: requestData.name,
    role: 'admin',
    approved: true,
    approvedAt: ts,
    approvedBy: me ? me.email : SUPER_ADMIN_EMAIL,
    createdAt: requestData.requestedAt || ts,
    lastLogin: null,
  });
  await _firebaseDb.collection('access_requests').doc(uid).update({
    status: 'approved',
    reviewedAt: ts,
    reviewedBy: me ? me.email : SUPER_ADMIN_EMAIL,
  });
  logActivity('approved_employee', 'employee', uid, `Approved ${requestData.name} (${requestData.email})`);
}

// ---- Reject employee ----
async function authRejectEmployee(uid, requestData) {
  if (!_firebaseDb) return;
  const me = getCurrentAdminProfile();
  const ts = new Date().toISOString();
  await _firebaseDb.collection('access_requests').doc(uid).update({
    status: 'rejected',
    reviewedAt: ts,
    reviewedBy: me ? me.email : SUPER_ADMIN_EMAIL,
  });
  logActivity('rejected_employee', 'employee', uid, `Rejected ${requestData.name} (${requestData.email})`);
}

// ---- Revoke employee access ----
async function authRevokeEmployee(uid, name) {
  if (!_firebaseDb) return;
  await _firebaseDb.collection('admins').doc(uid).update({
    approved: false,
    revokedAt: new Date().toISOString(),
  });
  logActivity('revoked_employee', 'employee', uid, `Revoked access for ${name || uid}`);
}

// ---- Get pending requests ----
async function getPendingRequests() {
  if (!_firebaseDb) return [];
  try {
    const snap = await _firebaseDb.collection('access_requests').where('status', '==', 'pending').get();
    return snap.docs.map(d => d.data());
  } catch (e) {
    console.warn('[Auth] getPendingRequests failed', e);
    return [];
  }
}

// ---- Get all admin accounts ----
async function getAllAdmins() {
  if (!_firebaseDb) return [];
  try {
    const snap = await _firebaseDb.collection('admins').get();
    return snap.docs.map(d => d.data());
  } catch (e) {
    console.warn('[Auth] getAllAdmins failed', e);
    return [];
  }
}

// ---- Activity logging ----
function logActivity(action, targetType, targetId, details) {
  if (!_firebaseDb || !_currentAdminProfile) return;
  _firebaseDb.collection('activity').add({
    userId: _currentAdminProfile.uid,
    userEmail: _currentAdminProfile.email,
    userName: _currentAdminProfile.name || _currentAdminProfile.email,
    action,
    targetType: targetType || '',
    targetId: targetId || '',
    details: details || '',
    timestamp: new Date().toISOString(),
  }).catch(() => {});
}

// ---- Get activity log ----
async function getActivityLog(limitCount) {
  if (!_firebaseDb) return [];
  try {
    const snap = await _firebaseDb.collection('activity')
      .orderBy('timestamp', 'desc')
      .limit(limitCount || 50)
      .get();
    return snap.docs.map(d => d.data());
  } catch (e) {
    console.warn('[Auth] getActivityLog failed', e);
    return [];
  }
}

// ---- Format activity action for display ----
function formatActivityAction(action) {
  const labels = {
    approved_employee: 'Approved employee',
    rejected_employee: 'Rejected employee',
    revoked_employee: 'Revoked access',
    created_order: 'Created order',
    updated_order: 'Updated order',
    deleted_order: 'Deleted order',
    saved_product: 'Saved product',
    deleted_product: 'Deleted product',
    updated_status: 'Updated order status',
  };
  return labels[action] || action;
}
