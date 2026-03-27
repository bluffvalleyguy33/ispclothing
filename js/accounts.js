/* ============================================
   INSIGNIA — Customer Accounts
   ============================================ */

const ACCOUNTS_KEY = 'insignia_accounts';
const ACCT_SESSION  = 'insignia_user';

function _hashPW(pw) {
  let h = 5381;
  for (let i = 0; i < pw.length; i++) h = (h * 33) ^ pw.charCodeAt(i);
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
  return getAccounts().filter(a => {
    const fullName = ((a.firstName || '') + ' ' + (a.lastName || '')).toLowerCase();
    return (
      fullName.includes(q) ||
      (a.email || '').toLowerCase().includes(q) ||
      (a.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
      (a.company || '').toLowerCase().includes(q)
    );
  });
}

// Admin creates account — stores tempPassword in plaintext so admin can send it
// Returns { ok, user, tempPassword } or { ok: false, error }
function adminCreateAccount({ firstName, lastName, email, phone, company, tempPassword }) {
  const accts = getAccounts();
  const e = (email || '').trim().toLowerCase();
  if (!e) return { ok: false, error: 'Email is required.' };
  const existing = accts.find(a => a.email === e);
  if (existing) {
    // Update existing account fields but keep password
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
    passwordHash: _hashPW(pw),
    tempPassword: pw,   // visible to admin until customer changes it
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

// Customer changes their own password — clears tempPassword
function updateAccountPassword(email, newPassword) {
  const accts = getAccounts();
  const acct = accts.find(a => a.email === (email || '').toLowerCase());
  if (!acct) return { ok: false, error: 'Account not found.' };
  if ((newPassword || '').length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };
  acct.passwordHash = _hashPW(newPassword);
  acct.tempPassword = null;  // clear temp password once changed
  saveAccounts(accts);
  return { ok: true };
}

function createAccount({ firstName, lastName, email, phone, password }) {
  const accts = getAccounts();
  const e = (email || '').trim().toLowerCase();
  if (accts.find(a => a.email === e)) return { ok: false, error: 'An account with that email already exists.' };
  if ((password || '').length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };
  const acct = {
    email: e,
    firstName: (firstName || '').trim(),
    lastName:  (lastName || '').trim(),
    phone:     (phone || '').trim(),
    passwordHash: _hashPW(password),
    createdAt: new Date().toISOString(),
  };
  accts.push(acct);
  saveAccounts(accts);
  sessionStorage.setItem(ACCT_SESSION, e);
  return { ok: true, user: acct };
}

function loginAccount(email, password) {
  const e = (email || '').trim().toLowerCase();
  const acct = getAccounts().find(a => a.email === e);
  if (!acct) return { ok: false, error: 'No account found with that email.' };
  if (acct.passwordHash !== _hashPW(password)) return { ok: false, error: 'Incorrect password.' };
  sessionStorage.setItem(ACCT_SESSION, e);
  return { ok: true, user: acct };
}

function getLoggedInUser() {
  const email = sessionStorage.getItem(ACCT_SESSION);
  if (!email) return null;
  return getAccounts().find(a => a.email === email) || null;
}

function logoutAccount() {
  sessionStorage.removeItem(ACCT_SESSION);
}
