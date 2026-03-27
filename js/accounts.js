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
}

function createAccount({ firstName, lastName, email, phone, password }) {
  const accts = getAccounts();
  const e = email.trim().toLowerCase();
  if (accts.find(a => a.email === e)) return { ok: false, error: 'An account with that email already exists.' };
  if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };
  const acct = {
    email: e,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phone: (phone || '').trim(),
    passwordHash: _hashPW(password),
    createdAt: new Date().toISOString(),
  };
  accts.push(acct);
  saveAccounts(accts);
  sessionStorage.setItem(ACCT_SESSION, e);
  return { ok: true, user: acct };
}

function loginAccount(email, password) {
  const e = email.trim().toLowerCase();
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
