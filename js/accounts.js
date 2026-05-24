/* ============================================
   INSIGNIA — Customer Accounts
   --------------------------------------------
   Password operations (login / signup / change password) go through
   Cloud Functions which:
     1. Verify passwords server-side with bcrypt
     2. Transparently upgrade legacy DJB2 hashes on first successful login
     3. Mint a Firebase custom token so the customer's subsequent
        callable-function calls are authenticated as themselves
   Local helpers like getAccountByEmail / searchAccounts continue to work
   against the cached `insignia_accounts` localStorage for admin contexts
   (admin pages still need to look customers up by email / search).
   ============================================ */

const ACCOUNTS_KEY = 'insignia_accounts';
const ACCT_SESSION = 'insignia_user';

// Legacy DJB2 — kept only so already-cached UIs can render an existing
// session if a customer reloads after logging in. Server is the only
// place that authoritatively verifies passwords now.
function _hashPW(pw) {
  let h = 5381;
  for (let i = 0; i < (pw || '').length; i++) h = (h * 33) ^ pw.charCodeAt(i);
  return (h >>> 0).toString(16);
}

function getAccounts() {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)) || []; } catch(e) { return []; }
}

function saveAccounts(accts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accts));
  if (typeof cloudSave === 'function') cloudSave('accounts', accts);
}

function getAccountByEmail(email) {
  const e = (email || '').trim().toLowerCase();
  return getAccounts().find(a => a.email === e) || null;
}

// Search accounts by name, email, phone, or company (case-insensitive)
function searchAccounts(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return [];
  const qDigits = q.replace(/\D/g, '');
  return getAccounts().filter(a => {
    const fullName = ((a.firstName || '') + ' ' + (a.lastName || '')).toLowerCase();
    return (
      fullName.includes(q) ||
      (a.email || '').toLowerCase().includes(q) ||
      (qDigits.length > 0 && (a.phone || '').replace(/\D/g, '').includes(qDigits)) ||
      (a.company || '').toLowerCase().includes(q)
    );
  });
}

// ------------------------------------------------------------------
// Cloud-Function callable shim
// ------------------------------------------------------------------
function _callFn(name, payload) {
  if (typeof firebase === 'undefined' || !firebase.functions) {
    return Promise.reject(new Error('Cloud Functions not available'));
  }
  const fns = firebase.functions();
  return fns.httpsCallable(name)(payload || {}).then(r => r.data);
}

// Sign in to Firebase Auth with a custom token from a Cloud Function so
// subsequent calls carry the customer's identity in context.auth.
async function _signInWithCustomToken(token) {
  if (!token || typeof firebase === 'undefined' || !firebase.auth) return;
  try { await firebase.auth().signInWithCustomToken(token); }
  catch (e) { console.warn('[accounts] custom-token sign-in failed:', e.message); }
}

// ------------------------------------------------------------------
// Admin path — create-account-for-customer (admin already authenticated
// via Firebase Auth and writes app_data/accounts directly). This path
// stores a temp password the admin can see; the password is bcrypt-
// upgraded the first time the customer actually logs in.
// ------------------------------------------------------------------
function adminCreateAccount({ firstName, lastName, email, phone, company, tempPassword }) {
  const accts = getAccounts();
  const e = (email || '').trim().toLowerCase();
  if (!e) return { ok: false, error: 'Email is required.' };
  const existing = accts.find(a => a.email === e);
  if (existing) {
    existing.firstName = (firstName || '').trim() || existing.firstName;
    existing.lastName  = (lastName || '').trim()  || existing.lastName;
    existing.phone     = (phone || '').trim()     || existing.phone;
    existing.company   = (company || '').trim()   || existing.company;
    saveAccounts(accts);
    return { ok: true, user: existing, alreadyExists: true };
  }
  const pw = tempPassword || generateTempPassword();
  const acct = {
    email: e,
    firstName: (firstName || '').trim(),
    lastName:  (lastName || '').trim(),
    phone:     (phone || '').trim(),
    company:   (company || '').trim(),
    passwordHash: _hashPW(pw),  // legacy hash; auto-upgraded on first login
    tempPassword: pw,           // admin-visible until first customer login
    createdAt: new Date().toISOString(),
  };
  accts.push(acct);
  saveAccounts(accts);
  return { ok: true, user: acct, tempPassword: pw };
}

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pw = 'ISP-';
  for (let i = 0; i < 6; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

// ------------------------------------------------------------------
// Customer-facing password ops — go through Cloud Functions
// ------------------------------------------------------------------

// Returns { ok, user, error } — async
async function createAccount({ firstName, lastName, email, phone, password }) {
  const e = (email || '').trim().toLowerCase();
  if (!e) return { ok: false, error: 'Email is required.' };
  if ((password || '').length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters.' };
  }
  try {
    const res = await _callFn('signupCustomer', {
      firstName, lastName, email: e, phone, password,
    });
    if (!res || !res.ok) throw new Error((res && res.error) || 'Signup failed.');
    if (res.customToken) await _signInWithCustomToken(res.customToken);
    sessionStorage.setItem(ACCT_SESSION, e);
    return { ok: true, user: res.profile };
  } catch (err) {
    const msg = (err && err.message) || 'Could not create account.';
    return { ok: false, error: msg };
  }
}

// Returns { ok, user, error } — async
async function loginAccount(email, password) {
  const e = (email || '').trim().toLowerCase();
  if (!e || !password) return { ok: false, error: 'Email and password required.' };
  try {
    const res = await _callFn('loginCustomer', { email: e, password });
    if (!res || !res.ok) throw new Error((res && res.error) || 'Login failed.');
    if (res.customToken) await _signInWithCustomToken(res.customToken);
    sessionStorage.setItem(ACCT_SESSION, e);
    return { ok: true, user: res.profile };
  } catch (err) {
    // Normalise Firebase callable errors to a flat message
    const msg = (err && err.message) || 'Login failed.';
    // Firebase prefixes callable errors with "FirebaseError: ..." — strip it
    return { ok: false, error: msg.replace(/^FirebaseError:\s*/, '') };
  }
}

// Returns { ok, error } — async. Requires the OLD password for safety.
async function updateAccountPassword(email, newPassword, oldPassword) {
  const e = (email || '').trim().toLowerCase();
  if (!e) return { ok: false, error: 'Email is required.' };
  if ((newPassword || '').length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters.' };
  }
  if (!oldPassword) {
    return { ok: false, error: 'Your current password is required to change it.' };
  }
  try {
    const res = await _callFn('changeCustomerPassword', {
      email: e, oldPassword, newPassword,
    });
    if (!res || !res.ok) throw new Error((res && res.error) || 'Could not update password.');
    return { ok: true };
  } catch (err) {
    const msg = (err && err.message) || 'Could not update password.';
    return { ok: false, error: msg.replace(/^FirebaseError:\s*/, '') };
  }
}

function getLoggedInUser() {
  const email = sessionStorage.getItem(ACCT_SESSION);
  if (!email) return null;
  return getAccounts().find(a => a.email === email) || null;
}

function logoutAccount() {
  sessionStorage.removeItem(ACCT_SESSION);
  try {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      const u = firebase.auth().currentUser;
      // Only sign out customer custom-token users — keep admin sessions intact
      if (u && (u.uid || '').startsWith('cust_')) firebase.auth().signOut();
    }
  } catch (_) {}
}
