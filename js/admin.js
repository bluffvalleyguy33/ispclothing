/* ============================================
   INSIGNIA ADMIN — Dashboard Logic
   ============================================ */

// Admin password removed — auth handled by Firebase Auth (js/auth.js)

const ICON_SVG = {
  tshirt: `<svg viewBox="0 0 80 80" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M52 8L60 8 76 24 62 30 62 72 18 72 18 30 4 24 20 8 28 8C28 18 36 24 40 24C44 24 52 18 52 8Z"/></svg>`,
  hoodie: `<svg viewBox="0 0 80 80" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M28 8C28 8 24 22 20 26L4 26 4 38 18 34 18 72 62 72 62 34 76 38 76 26 60 26C56 22 52 8 52 8C48 14 44 18 40 20C36 18 32 14 28 8Z"/></svg>`,
  hat:    `<svg viewBox="0 0 80 50" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><ellipse cx="40" cy="44" rx="38" ry="6"/><path d="M14 44 Q8 22 40 10 Q72 22 66 44Z"/></svg>`,
  polo:   `<svg viewBox="0 0 80 80" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M52 8L60 8 76 24 62 30 62 72 18 72 18 30 4 24 20 8 28 8C28 8 32 20 40 20 48 20 52 8 52 8Z"/><rect x="36" y="8" width="8" height="16" rx="2"/></svg>`,
};

// ---- State ----
let adminProducts = [];
let editingProductId = null;
let productColors = [];
let confirmCallback = null;
let pricingMetrics = {};
let activePricingTab = null;
let showingArchived = false;

// ============================================
// AUTH — Login screen view switching
// ============================================
function toggleLoginPw() {
  const inp = document.getElementById('login-password');
  const eye = document.getElementById('login-pw-eye');
  if (inp.type === 'password') {
    inp.type = 'text';
    eye.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
  } else {
    inp.type = 'password';
    eye.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  }
}

function showLoginView() {
  document.getElementById('login-view').style.display = '';
  document.getElementById('request-view').style.display = 'none';
  document.getElementById('pending-view').style.display = 'none';
  document.getElementById('rejected-view').style.display = 'none';
  document.getElementById('login-error').textContent = '';
}

function showPendingView() {
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('request-view').style.display = 'none';
  document.getElementById('pending-view').style.display = '';
  document.getElementById('rejected-view').style.display = 'none';
}

function showRejectedView() {
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('request-view').style.display = 'none';
  document.getElementById('pending-view').style.display = 'none';
  document.getElementById('rejected-view').style.display = '';
}

async function doLogin() {
  const email = (document.getElementById('login-email').value || '').trim();
  const pw = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  errEl.textContent = '';

  if (!email || !pw) {
    errEl.textContent = 'Enter your email and password.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in…';
  try {
    await authSignIn(email, pw);
    // onAuthStateChanged handles showing the app
  } catch (e) {
    const code = e.code || '';
    if (code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
      errEl.textContent = 'Incorrect email or password.';
    } else if (code === 'auth/too-many-requests') {
      errEl.textContent = 'Too many attempts. Try again later.';
    } else {
      errEl.textContent = e.message || 'Sign in failed.';
    }
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}


function doLogout() {
  authSignOut().then(() => {
    document.getElementById('admin-app').style.display = 'none';
    document.getElementById('login-screen').style.display = '';
    showLoginView();
  });
}

// ---- Render current user in sidebar ----
function renderCurrentUser(profile) {
  const el = document.getElementById('sidebar-user');
  if (!el || !profile) return;
  const initials = (profile.name || profile.email).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const roleLabel = profile.role === 'super_admin' ? 'Owner' : 'Team Member';
  el.innerHTML = `
    <div class="sidebar-user-avatar">${initials}</div>
    <div class="sidebar-user-info">
      <div class="sidebar-user-name">${profile.name || 'Admin'}</div>
      <div class="sidebar-user-role">${roleLabel}</div>
    </div>`;
}

// ============================================
// INIT
// ============================================
function initAdmin() {
  migrateOrderStatuses(); // one-time migration of old status IDs
  adminProducts = getProducts();
  pricingMetrics = getPricingMetrics();
  renderProductsTable();
  renderKbSavedViews();
  toggleOrdersView('kanban');
  initPricing();
  initSidebarNav();
  renderKpiDashboard();
  if (typeof initAutomations === 'function') initAutomations();
  _refreshUnpaidBadge();

  // Auto-populate price breaks when blank cost changes in the product form
  const blankCostInput = document.getElementById('f-blank-cost');
  if (blankCostInput) {
    blankCostInput.addEventListener('input', () => {
      const selectedDeco = getCheckedDeco();
      if (selectedDeco.length > 0) rebuildPriceBreaks();
    });
  }
}

function initSidebarNav() {
  document.querySelectorAll('.sidebar-link[data-section]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const section = link.dataset.section;
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      document.getElementById('section-' + section).classList.add('active');
      if (section === 'orders') {
        if (ordersViewMode === 'kanban') renderKanbanBoard();
        else renderOrdersList();
      }
      if (section === 'production') renderProductionBoard();
      if (section === 'kpi') renderKpiDashboard();
      if (section === 'team') renderTeamSection();
      if (section === 'commissions') renderCommissionsSection();
      if (section === 'customers') renderCustomersSection();
      if (section === 'automations' && typeof renderAutomationsSection === 'function') renderAutomationsSection();
      if (section === 'payments') renderPaymentsSection();
      closeSidebar();
    });
  });
}

// ============================================
// TEAM SECTION
// ============================================
async function renderTeamSection() {
  const wrap = document.getElementById('team-section-content');
  if (!wrap) return;
  wrap.innerHTML = '<p class="a-hint">Loading team data…</p>';

  // Fetch last_logins collection — one doc per uid, written on every login.
  // No compound index required; simple collection-level .get().
  const fetchLastLogins = async () => {
    if (!_firebaseDb) return {};
    try {
      const snap = await _firebaseDb.collection('last_logins').get();
      const map = {};
      snap.docs.forEach(d => { map[d.id] = d.data().lastLogin || null; });
      return map;
    } catch (e) { return {}; }
  };

  const [admins, pending, activity, lastLoginByUid] = await Promise.all([
    getAllAdmins(),
    getPendingRequests(),
    getActivityLog(30),
    fetchLastLogins(),
  ]);

  // Update pending badge
  _refreshPendingBadge(pending.length);

  let html = '';

  // ---- Pending Requests ----
  if (pending.length > 0) {
    html += `
    <div class="team-card">
      <div class="team-card-header">
        <h3 class="team-card-title">Pending Requests <span class="team-badge">${pending.length}</span></h3>
      </div>
      <div class="team-requests-list">
        ${pending.map(req => `
          <div class="team-request-row" data-uid="${req.uid}">
            <div class="team-req-avatar">${(req.name || '?')[0].toUpperCase()}</div>
            <div class="team-req-info">
              <div class="team-req-name">${req.name}</div>
              <div class="team-req-email">${req.email}</div>
              <div class="team-req-date">Requested ${_relativeTime(req.requestedAt)}</div>
            </div>
            <div class="team-req-actions">
              <button class="a-btn a-btn-primary a-btn-sm" onclick="_approveRequest('${req.uid}','${req.name.replace(/'/g, "\\'")}','${req.email}','${req.requestedAt}')">Approve</button>
              <button class="a-btn a-btn-sm" style="color:var(--danger);border-color:var(--danger)40;background:var(--danger)10" onclick="_rejectRequest('${req.uid}','${req.name.replace(/'/g, "\\'")}','${req.email}')">Reject</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  }

  // ---- Team Members ----
  const sorted = [...admins].sort((a, b) => {
    if (a.role === 'super_admin') return -1;
    if (b.role === 'super_admin') return 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  html += `
  <div class="team-card">
    <div class="team-card-header" style="display:flex;align-items:center;justify-content:space-between">
      <h3 class="team-card-title">Team Members <span class="team-badge team-badge-neutral">${admins.length}</span></h3>
      <button class="a-btn a-btn-primary a-btn-sm" onclick="openAddMemberModal()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Team Member
      </button>
    </div>
    <table class="team-table">
      <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th></th></tr></thead>
      <tbody>
        ${sorted.map(a => {
          const isOwner = a.role === 'super_admin';
          const active = a.approved !== false;
          const initials = (a.name || a.email).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
          const escapedName = (a.name || '').replace(/'/g, "\\'");
          const escapedEmail = (a.email || '').replace(/'/g, "\\'");
          return `
          <tr>
            <td><div style="display:flex;align-items:center;gap:10px">
              <div class="team-member-avatar">${initials}</div>
              <span>${a.name || '—'}</span>
            </div></td>
            <td style="color:var(--text-muted);font-size:12px">${a.email}</td>
            <td><span class="team-role-badge ${isOwner ? 'team-role-owner' : 'team-role-admin'}">${isOwner ? 'Owner' : 'Admin'}</span></td>
            <td><span class="team-status-dot ${active ? 'active' : 'inactive'}"></span>${active ? 'Active' : 'Revoked'}</td>
            <td style="color:var(--text-muted);font-size:12px">${(lastLoginByUid[a.uid] || a.lastLogin) ? _relativeTime(lastLoginByUid[a.uid] || a.lastLogin) : 'Never'}</td>
            <td>
              ${!isOwner ? (() => {
                const ds = a.dashboardSections || {};
                const defOn  = { alerts: true, kpi: true, analytics: false, dueTracker: true };
                const secOn  = key => key in ds ? !!ds[key] : defOn[key];
                const dashSections = [
                  { key: 'alerts',     label: 'Alerts' },
                  { key: 'kpi',        label: 'KPI Stats' },
                  { key: 'dueTracker', label: 'Due Dates' },
                  { key: 'analytics',  label: 'Analytics' },
                ];
                return `
                <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
                  <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;align-items:center">
                    <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text-muted)">
                      <span>Comm%</span>
                      <input type="number" class="a-input" style="width:58px;padding:4px 6px;font-size:12px" min="0" max="100" step="0.5"
                        value="${a.commissionRate || ''}" placeholder="0"
                        onchange="_saveCommissionRate('${a.uid}', this.value)"
                        title="Commission rate %">
                      <label style="display:flex;align-items:center;gap:4px;cursor:pointer" title="Allow this user to view commission dollar amounts">
                        <input type="checkbox" ${a.canViewCommissions ? 'checked' : ''} onchange="_toggleCommissionAccess('${a.uid}', this.checked)">
                        <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.04em">See $</span>
                      </label>
                    </div>
                    <button class="a-btn a-btn-ghost a-btn-sm" onclick="_resetMemberPassword('${a.uid}','${escapedName}','${escapedEmail}')">Reset PW</button>
                    <button class="a-btn a-btn-ghost a-btn-sm" style="${active ? 'color:var(--danger);border-color:var(--danger)40' : ''}" onclick="_revokeAccess('${a.uid}','${escapedName}',${active})">
                      ${active ? 'Revoke' : 'Restore'}
                    </button>
                  </div>
                  <div class="team-dash-toggles">
                    <span class="team-dash-label">Dashboard:</span>
                    ${dashSections.map(s => `
                      <label class="team-dash-toggle" title="Show ${s.label} section on this user's dashboard">
                        <input type="checkbox" ${secOn(s.key) ? 'checked' : ''} onchange="_toggleDashboardSection('${a.uid}','${s.key}',this.checked)">
                        <span>${s.label}</span>
                      </label>`).join('')}
                  </div>
                </div>`;
              })() : ''}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;

  // ---- Activity Log ----
  html += `
  <div class="team-card">
    <div class="team-card-header">
      <h3 class="team-card-title">Recent Activity</h3>
    </div>
    ${activity.length === 0 ? '<p class="a-hint" style="padding:16px">No activity recorded yet.</p>' : `
    <div class="team-activity-list">
      ${activity.map(a => `
        <div class="team-activity-row">
          <div class="team-act-avatar">${(a.userName || a.userEmail || '?')[0].toUpperCase()}</div>
          <div class="team-act-info">
            <span class="team-act-name">${a.userName || a.userEmail}</span>
            <span class="team-act-action">${formatActivityAction(a.action)}</span>
            ${a.details ? `<span class="team-act-details">${a.details}</span>` : ''}
          </div>
          <div class="team-act-time">${_relativeTime(a.timestamp)}</div>
        </div>`).join('')}
    </div>`}
  </div>`;

  wrap.innerHTML = html;
}

async function _approveRequest(uid, name, email, requestedAt) {
  if (!confirm(`Approve access for ${name} (${email})?`)) return;
  try {
    await authApproveEmployee(uid, { name, email, requestedAt });
    toast(`${name} approved — they can now log in`, 'success');
    renderTeamSection();
  } catch (e) {
    toast('Approval failed: ' + (e.message || e), 'error');
  }
}

async function _rejectRequest(uid, name, email) {
  if (!confirm(`Reject access request from ${name} (${email})?`)) return;
  try {
    await authRejectEmployee(uid, { name, email });
    toast(`Request from ${name} rejected`, 'success');
    renderTeamSection();
  } catch (e) {
    toast('Rejection failed: ' + (e.message || e), 'error');
  }
}

async function _revokeAccess(uid, name, currentlyActive) {
  const action = currentlyActive ? 'revoke' : 'restore';
  if (!confirm(`${currentlyActive ? 'Revoke' : 'Restore'} access for ${name}?`)) return;
  try {
    if (currentlyActive) {
      await authRevokeEmployee(uid, name);
      toast(`Access revoked for ${name}`, 'success');
    } else {
      await _firebaseDb.collection('admins').doc(uid).update({ approved: true, revokedAt: null });
      logActivity('restored_employee', 'employee', uid, `Restored access for ${name}`);
      toast(`Access restored for ${name}`, 'success');
    }
    renderTeamSection();
  } catch (e) {
    toast('Failed: ' + (e.message || e), 'error');
  }
}

// ---- Add Team Member Modal ----
function openAddMemberModal() {
  document.getElementById('add-member-form-wrap').style.display = '';
  document.getElementById('add-member-success').style.display = 'none';
  document.getElementById('add-member-footer').style.display = '';
  document.getElementById('am-first').value = '';
  document.getElementById('am-last').value = '';
  document.getElementById('am-email').value = '';
  document.getElementById('am-error').textContent = '';
  document.getElementById('am-submit-btn').disabled = false;
  document.getElementById('am-submit-btn').innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
    Add &amp; Send Invite`;
  document.getElementById('add-member-overlay').classList.add('open');
  setTimeout(() => { const el = document.getElementById('am-first'); if (el) el.focus(); }, 80);
}

function closeAddMemberModal() {
  document.getElementById('add-member-overlay').classList.remove('open');
}

async function submitAddMember() {
  const first = document.getElementById('am-first').value.trim();
  const last  = document.getElementById('am-last').value.trim();
  const email = document.getElementById('am-email').value.trim().toLowerCase();
  const errEl = document.getElementById('am-error');
  const btn   = document.getElementById('am-submit-btn');
  errEl.textContent = '';

  if (!first || !email) { errEl.textContent = 'First name and email are required.'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = 'Enter a valid email address.'; return; }

  const name = last ? `${first} ${last}` : first;
  btn.disabled = true;
  btn.textContent = 'Adding…';

  try {
    const { tempPassword } = await authAddTeamMember(name, email);

    // Show success state
    document.getElementById('add-member-form-wrap').style.display = 'none';
    document.getElementById('add-member-footer').style.display = 'none';
    document.getElementById('am-success-email').textContent = email;
    document.getElementById('am-temp-pw-val').textContent = tempPassword;
    document.getElementById('add-member-success').style.display = '';

    toast(`${name} added — invite email sent`, 'success');
    renderTeamSection();
  } catch (e) {
    const code = e.code || '';
    if (code === 'auth/email-already-in-use') {
      errEl.textContent = 'An account with that email already exists.';
    } else {
      errEl.textContent = e.message || 'Failed to add team member.';
    }
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
      Add &amp; Send Invite`;
  }
}

// ---- Reset password for a team member ----
async function _resetMemberPassword(uid, name, email) {
  const choice = confirm(
    `Reset password for ${name}?\n\n` +
    `OK → Send a "Reset Password" email to ${email}\n` +
    `Cancel → Generate a new temp password instead (no email sent)`
  );

  if (choice) {
    // Send Firebase password reset email
    try {
      await authSendPasswordReset(email);
      toast(`Password reset email sent to ${email}`, 'success');
    } catch (e) {
      toast('Failed to send reset email: ' + (e.message || e), 'error');
    }
  } else {
    // Generate a new temp password and show it to Blake
    try {
      const { tempPassword } = await authSetTempPassword(uid, email, name);
      const msg = `New temp password for ${name}:\n\n${tempPassword}\n\nA password reset email was also sent so they can set their own.`;
      alert(msg);
    } catch (e) {
      toast('Failed: ' + (e.message || e), 'error');
    }
  }
}

async function _saveCommissionRate(uid, rate) {
  if (!_firebaseDb) return;
  const val = parseFloat(rate) || 0;
  await _firebaseDb.collection('admins').doc(uid).update({ commissionRate: val }).catch(() => {});
}

async function _toggleCommissionAccess(uid, enabled) {
  if (!_firebaseDb) return;
  await _firebaseDb.collection('admins').doc(uid).update({ canViewCommissions: !!enabled }).catch(() => {});
  toast(enabled ? 'Commission access granted' : 'Commission access removed', 'success');
}

async function _toggleDashboardSection(uid, key, enabled) {
  if (!_firebaseDb) return;
  const fieldPath = `dashboardSections.${key}`;
  await _firebaseDb.collection('admins').doc(uid).update({ [fieldPath]: !!enabled }).catch(() => {});
}

async function _refreshPendingBadge(count) {
  const badge = document.getElementById('pending-badge');
  if (!badge) return;
  if (count === undefined) {
    const reqs = await getPendingRequests();
    count = reqs.length;
  }
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

// ============================================
// COMMISSIONS SECTION
// ============================================
async function renderCommissionsSection() {
  const wrap = document.getElementById('commissions-content');
  if (!wrap) return;
  wrap.innerHTML = '<p class="a-hint">Loading commissions…</p>';

  if (!canViewCommissions()) {
    // Non-privileged view: just show sales rep assignments on orders
    const orders = getOrders().filter(o => o.salesRepId);
    if (!orders.length) {
      wrap.innerHTML = '<p class="a-hint">No orders with a sales rep assigned yet.</p>';
      return;
    }
    wrap.innerHTML = `
      <div class="team-card">
        <div class="team-card-header"><h3 class="team-card-title">Sales Rep Assignments</h3></div>
        <table class="team-table">
          <thead><tr><th>Order</th><th>Customer</th><th>Sales Rep</th><th>Status</th></tr></thead>
          <tbody>
            ${orders.slice(0, 50).map(o => `
              <tr>
                <td style="font-weight:700">${o.id}</td>
                <td style="color:var(--text-muted);font-size:12px">${o.customerName}</td>
                <td>${o.salesRepName || '—'}</td>
                <td><span class="kb-status-badge status-${o.status}">${o.status}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    return;
  }

  // Full view for authorized users
  const { summary, entries, payments } = await getCommissionSummary();
  const summaryList = Object.values(summary);
  const now = Date.now();
  const twoWeeks = 14 * 24 * 60 * 60 * 1000;

  let html = '';

  if (!summaryList.length) {
    html = '<p class="a-hint">No commissions recorded yet. Assign a sales rep and commission amount when creating orders.</p>';
  } else {
    // ---- Per-rep summary cards ----
    html += `<div class="comm-cards">`;
    summaryList.sort((a, b) => b.balance - a.balance).forEach(s => {
      const isOverdue = s.balance > 0 && s.oldestUnpaidEarnedAt && (now - new Date(s.oldestUnpaidEarnedAt).getTime()) > twoWeeks;
      const daysOwed = s.oldestUnpaidEarnedAt ? Math.floor((now - new Date(s.oldestUnpaidEarnedAt).getTime()) / 86400000) : 0;
      const initials = s.repName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      html += `
      <div class="comm-card${isOverdue ? ' comm-card-overdue' : ''}">
        <div class="comm-card-top">
          <div class="team-member-avatar" style="width:38px;height:38px;font-size:14px">${initials}</div>
          <div>
            <div class="comm-rep-name">${s.repName}</div>
            ${isOverdue ? `<div class="comm-overdue-tag">Owed ${daysOwed}d — overdue</div>` : ''}
          </div>
        </div>
        <div class="comm-stats">
          <div class="comm-stat">
            <div class="comm-stat-label">Total Earned</div>
            <div class="comm-stat-val">$${s.earned.toFixed(2)}</div>
          </div>
          <div class="comm-stat">
            <div class="comm-stat-label">Total Paid</div>
            <div class="comm-stat-val">$${s.paid.toFixed(2)}</div>
          </div>
          <div class="comm-stat comm-stat-balance${s.balance > 0 ? ' owed' : ''}">
            <div class="comm-stat-label">Balance Owed</div>
            <div class="comm-stat-val">$${s.balance.toFixed(2)}</div>
          </div>
        </div>
        <div class="comm-card-footer">
          <span style="font-size:11px;color:var(--text-muted)">${s.earnedCount} earned · ${s.pendingCount} pending</span>
          ${s.balance > 0 ? `<button class="a-btn a-btn-primary a-btn-sm" onclick="openLogPaymentModal('${s.repId}','${s.repName.replace(/'/g,"\\'")}',${s.balance})">Log Payment</button>` : `<span style="font-size:11px;color:var(--accent)">✓ All paid up</span>`}
        </div>
      </div>`;
    });
    html += `</div>`;

    // ---- Commission entries table ----
    const earnedEntries = entries.filter(e => e.status === 'earned' || e.status === 'pending').slice(0, 30);
    if (earnedEntries.length) {
      html += `
      <div class="team-card" style="margin-top:20px">
        <div class="team-card-header"><h3 class="team-card-title">Commission Entries</h3></div>
        <table class="team-table">
          <thead><tr><th>Order</th><th>Sales Rep</th><th>Order Total</th><th>Commission</th><th>Status</th><th>Earned</th></tr></thead>
          <tbody>
            ${earnedEntries.map(e => `
              <tr>
                <td style="font-weight:700">${e.orderId}</td>
                <td>${e.repName}</td>
                <td style="color:var(--text-muted)">$${(e.orderTotal||0).toFixed(2)}</td>
                <td style="font-weight:700;color:var(--accent)">$${e.commissionAmount.toFixed(2)}</td>
                <td><span class="comm-status-badge comm-status-${e.status}">${e.status}</span></td>
                <td style="color:var(--text-muted);font-size:12px">${e.earnedAt ? _relativeTime(e.earnedAt) : '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    }
  }

  // ---- Payment history ----
  if (payments.length) {
    html += `
    <div class="team-card" style="margin-top:20px">
      <div class="team-card-header"><h3 class="team-card-title">Payment History</h3></div>
      <table class="team-table">
        <thead><tr><th>Date</th><th>Sales Rep</th><th>Amount</th><th>Method</th><th>Note</th><th>Paid By</th></tr></thead>
        <tbody>
          ${[...payments].reverse().map(p => `
            <tr>
              <td style="color:var(--text-muted);font-size:12px">${new Date(p.paidAt).toLocaleDateString()}</td>
              <td>${p.repName}</td>
              <td style="font-weight:700;color:var(--accent)">$${p.amount.toFixed(2)}</td>
              <td style="color:var(--text-muted);text-transform:capitalize">${p.method}</td>
              <td style="color:var(--text-muted);font-size:12px">${p.note || '—'}</td>
              <td style="color:var(--text-muted);font-size:12px">${p.paidBy}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  }

  wrap.innerHTML = html;
}

// ---- Log Payment Modal ----
let _lpRepId = null, _lpRepName = null;

function openLogPaymentModal(repId, repName, balance) {
  _lpRepId = repId;
  _lpRepName = repName;
  document.getElementById('lp-rep-name').textContent = repName;
  document.getElementById('lp-amount').value = '';
  document.getElementById('lp-method').value = 'cash';
  document.getElementById('lp-note').value = '';
  document.getElementById('lp-balance').textContent = '$' + parseFloat(balance).toFixed(2);
  document.getElementById('lp-error').textContent = '';
  document.getElementById('lp-submit-btn').disabled = false;
  document.getElementById('lp-submit-btn').textContent = 'Log Payment';
  document.getElementById('log-payment-overlay').classList.add('open');
}

function closeLogPaymentModal() {
  document.getElementById('log-payment-overlay').classList.remove('open');
}

async function submitLogPayment() {
  const amount = parseFloat(document.getElementById('lp-amount').value);
  const method = document.getElementById('lp-method').value;
  const note   = document.getElementById('lp-note').value.trim();
  const errEl  = document.getElementById('lp-error');
  const btn    = document.getElementById('lp-submit-btn');
  errEl.textContent = '';

  if (!amount || amount <= 0) { errEl.textContent = 'Enter a valid payment amount.'; return; }

  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    await logCommissionPayment({ repId: _lpRepId, repName: _lpRepName, amount, method, note });
    toast(`$${amount.toFixed(2)} logged for ${_lpRepName}`, 'success');
    closeLogPaymentModal();
    renderCommissionsSection();
    _refreshCommissionBadge();
  } catch (e) {
    errEl.textContent = e.message || 'Failed to log payment.';
    btn.disabled = false;
    btn.textContent = 'Log Payment';
  }
}

// ---- Sidebar overdue badge ----
async function _refreshCommissionBadge() {
  const link = document.getElementById('sidebar-commissions-link');
  const badge = document.getElementById('comm-overdue-badge');
  if (!link || !canViewCommissions()) return;
  const overdue = await hasOverdueCommissions();
  link.classList.toggle('comm-overdue', overdue);
  if (badge) badge.style.display = overdue ? '' : 'none';
}

function _relativeTime(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ============================================
// PRODUCTS TABLE
// ============================================
function renderProductsTable() {
  const tbody = document.getElementById('products-tbody');
  tbody.innerHTML = '';
  adminProducts.forEach(p => {
    const tr = document.createElement('tr');
    tr.dataset.id = p.id;
    tr.draggable = true;

    const decoLabels = (p.decoration || []).map(d => {
      const dt = getDecoType(d);
      return dt ? `<span class="deco-tag">${dt.label}</span>` : '';
    }).join('');

    const colorCount = (p.colors || []).length;
    const startPrice = getStartingPrice(p);

    tr.innerHTML = `
      <td onclick="event.stopPropagation()">
        <input type="checkbox" class="product-row-cb" ${selectedProductIds.has(p.id) ? 'checked' : ''}
          onchange="toggleSelectProduct('${p.id}', this.checked)">
      </td>
      <td>
        <div class="drag-handle" title="Drag to reorder">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="5" r="1" fill="currentColor"/><circle cx="15" cy="5" r="1" fill="currentColor"/>
            <circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/>
            <circle cx="9" cy="19" r="1" fill="currentColor"/><circle cx="15" cy="19" r="1" fill="currentColor"/>
          </svg>
        </div>
      </td>
      <td>
        <div class="product-name-cell">
          ${(() => {
            const mockupColor = (p.colors || []).find(c => c.mockup);
            return mockupColor
              ? `<img src="${mockupColor.mockup}" class="product-mockup-thumb" alt="${p.name}">`
              : `<div class="product-icon-sm">${ICON_SVG[p.icon] || ICON_SVG.tshirt}</div>`;
          })()}
          <div>
            <div class="product-cell-name">
              ${p.name}
              ${p.popular ? '<span class="badge badge-popular" style="margin-left:6px">Popular</span>' : ''}
              ${!p.visible ? '<span class="badge badge-hidden" style="margin-left:6px">Hidden</span>' : ''}
            </div>
            ${(p.brand || p.styleNumber || p.supplier) ? `<div class="product-cell-meta">${[p.brand, p.styleNumber, p.supplier ? '📦 ' + p.supplier : ''].filter(Boolean).join(' · ')}</div>` : ''}
            <div class="product-cell-desc">${p.description || ''}</div>
          </div>
        </div>
      </td>
      <td><span class="badge badge-category">${formatCategory(p.category)}</span></td>
      <td style="color:${startPrice ? 'var(--text)' : 'var(--text-muted)'}; font-weight:${startPrice ? '700' : '400'}">
        ${startPrice ? '$' + startPrice.toFixed(2) : '—'}
      </td>
      <td>
        <span style="font-size:12px;color:var(--text-muted)">${colorCount} color${colorCount !== 1 ? 's' : ''}</span>
      </td>
      <td><div class="deco-tags">${decoLabels || '<span style="color:var(--text-muted);font-size:12px">None</span>'}</div></td>
      <td>
        <div class="vis-toggle ${p.visible !== false ? 'on' : ''}" onclick="toggleVisibility('${p.id}')" title="${p.visible !== false ? 'Visible' : 'Hidden'}"></div>
      </td>
      <td>
        <div class="row-actions">
          <button class="a-btn a-btn-ghost a-btn-icon a-btn-sm" onclick="openEditProductModal('${p.id}')" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="a-btn a-btn-ghost a-btn-icon a-btn-sm" onclick="confirmDeleteProduct('${p.id}')" title="Delete" style="color:var(--danger)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
  initDragAndDrop();
}

function formatCategory(cat) {
  const map = { tshirts:'T-Shirts', hoodies:'Hoodies', hats:'Hats', polos:'Polos', jackets:'Jackets', other:'Other' };
  return map[cat] || cat;
}

function toggleVisibility(id) {
  const p = adminProducts.find(p => p.id === id);
  if (!p) return;
  p.visible = p.visible === false;
  saveProducts(adminProducts);
  renderProductsTable();
  toast(p.visible ? `"${p.name}" is now visible` : `"${p.name}" hidden from site`, 'success');
}

function confirmDeleteProduct(id) {
  const p = adminProducts.find(p => p.id === id);
  if (!p) return;
  showConfirm(`Delete "${p.name}"? This cannot be undone.`, () => {
    adminProducts = adminProducts.filter(x => x.id !== id);
    saveProducts(adminProducts);
    renderProductsTable();
    toast(`"${p.name}" deleted`, 'success');
  });
}

// ---- Product bulk selection ----
const selectedProductIds = new Set();

function updateBulkBar() {
  const bar = document.getElementById('bulk-actions-bar');
  const countEl = document.getElementById('bulk-selected-count');
  const selectAll = document.getElementById('select-all-products');
  if (!bar) return;
  const n = selectedProductIds.size;
  if (n > 0) {
    bar.style.display = 'flex';
    countEl.textContent = `${n} product${n !== 1 ? 's' : ''} selected`;
  } else {
    bar.style.display = 'none';
  }
  if (selectAll) {
    selectAll.indeterminate = n > 0 && n < adminProducts.length;
    selectAll.checked = n > 0 && n === adminProducts.length;
  }
}

function toggleSelectProduct(id, checked) {
  if (checked) selectedProductIds.add(id);
  else selectedProductIds.delete(id);
  updateBulkBar();
}

function toggleSelectAllProducts(checked) {
  adminProducts.forEach(p => checked ? selectedProductIds.add(p.id) : selectedProductIds.delete(p.id));
  // Update all row checkboxes
  document.querySelectorAll('.product-row-cb').forEach(cb => cb.checked = checked);
  updateBulkBar();
}

function clearProductSelection() {
  selectedProductIds.clear();
  document.querySelectorAll('.product-row-cb').forEach(cb => cb.checked = false);
  updateBulkBar();
}

function bulkAction(action) {
  const ids = [...selectedProductIds];
  if (!ids.length) return;

  if (action === 'delete') {
    showConfirm(`Delete ${ids.length} product${ids.length !== 1 ? 's' : ''}? This cannot be undone.`, () => {
      adminProducts = adminProducts.filter(p => !ids.includes(p.id));
      saveProducts(adminProducts);
      selectedProductIds.clear();
      renderProductsTable();
      toast(`${ids.length} product${ids.length !== 1 ? 's' : ''} deleted`, 'success');
    });
  } else if (action === 'show') {
    ids.forEach(id => {
      const p = adminProducts.find(p => p.id === id);
      if (p) p.visible = true;
    });
    saveProducts(adminProducts);
    selectedProductIds.clear();
    renderProductsTable();
    toast(`${ids.length} product${ids.length !== 1 ? 's' : ''} set to visible`, 'success');
  } else if (action === 'hide') {
    ids.forEach(id => {
      const p = adminProducts.find(p => p.id === id);
      if (p) p.visible = false;
    });
    saveProducts(adminProducts);
    selectedProductIds.clear();
    renderProductsTable();
    toast(`${ids.length} product${ids.length !== 1 ? 's' : ''} hidden`, 'success');
  }
}

// ============================================
// DRAG & DROP REORDER
// ============================================
let dragSrc = null;
function initDragAndDrop() {
  const rows = document.querySelectorAll('#products-tbody tr');
  rows.forEach(row => {
    row.addEventListener('dragstart', e => { dragSrc = row; row.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    row.addEventListener('dragend', () => { row.classList.remove('dragging'); document.querySelectorAll('#products-tbody tr').forEach(r => r.classList.remove('drag-over')); });
    row.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; document.querySelectorAll('#products-tbody tr').forEach(r => r.classList.remove('drag-over')); if (row !== dragSrc) row.classList.add('drag-over'); });
    row.addEventListener('drop', e => {
      e.preventDefault();
      if (dragSrc && row !== dragSrc) {
        const si = adminProducts.findIndex(p => p.id === dragSrc.dataset.id);
        const di = adminProducts.findIndex(p => p.id === row.dataset.id);
        const [m] = adminProducts.splice(si, 1);
        adminProducts.splice(di, 0, m);
        saveProducts(adminProducts);
        renderProductsTable();
        toast('Order saved', 'success');
      }
    });
  });
}

// ============================================
// PRODUCT MODAL — OPEN
// ============================================
function openNewProductModal() {
  editingProductId = null;
  productColors = [];
  document.getElementById('product-modal-title').textContent = 'Add Product';
  document.getElementById('product-form').reset();
  document.getElementById('f-id').value = '';
  document.getElementById('f-visible').checked = true;
  document.getElementById('f-popular').checked = false;
  buildSizesGrid([]);
  buildDecoGrid([]);
  buildLocationsGrid([]);
  renderProductColorsList();
  buildPriceBreaksSection([]);
  document.getElementById('product-modal-overlay').classList.add('open');
}

function openEditProductModal(id) {
  const p = adminProducts.find(p => p.id === id);
  if (!p) return;
  editingProductId = id;
  productColors = JSON.parse(JSON.stringify(p.colors || []));

  document.getElementById('product-modal-title').textContent = 'Edit Product';
  document.getElementById('f-id').value = p.id;
  document.getElementById('f-brand').value = p.brand || '';
  document.getElementById('f-style-number').value = p.styleNumber || '';
  document.getElementById('f-supplier').value = p.supplier || '';
  document.getElementById('f-name').value = p.name || '';
  document.getElementById('f-category').value = p.category || 'tshirts';
  document.getElementById('f-desc').value = p.description || '';
  document.getElementById('f-icon').value = p.icon || 'tshirt';
  document.getElementById('f-blank-cost').value = p.blankCost || '';
  document.getElementById('f-popular').checked = !!p.popular;
  document.getElementById('f-visible').checked = p.visible !== false;

  buildSizesGrid(p.sizes || []);
  buildDecoGrid(p.decoration || []);
  buildLocationsGrid(p.locations || []);
  renderProductColorsList();

  buildPriceBreaksSection(p.decoration || [], p.priceBreaks || {});

  document.getElementById('product-modal-overlay').classList.add('open');
}

function closeProductModal() {
  document.getElementById('product-modal-overlay').classList.remove('open');
  editingProductId = null;
  productColors = [];
}

// ============================================
// FORM BUILDERS
// ============================================
function buildSizesGrid(selectedSizes) {
  const grid = document.getElementById('f-sizes-grid');
  grid.innerHTML = '';
  ALL_SIZES.forEach(size => {
    const checked = selectedSizes.includes(size);
    const lbl = document.createElement('label');
    lbl.className = 'a-checkbox-label' + (checked ? ' checked' : '');
    lbl.innerHTML = `<input type="checkbox" value="${size}" ${checked ? 'checked' : ''}><div class="a-checkbox-dot"></div>${size}`;
    lbl.querySelector('input').addEventListener('change', e => lbl.classList.toggle('checked', e.target.checked));
    grid.appendChild(lbl);
  });
}

function buildDecoGrid(selectedDeco) {
  const grid = document.getElementById('f-deco-grid');
  grid.innerHTML = '';
  ALL_DECORATION_TYPES.forEach(dt => {
    const checked = selectedDeco.includes(dt.id);
    const lbl = document.createElement('label');
    lbl.className = 'a-checkbox-label' + (checked ? ' checked' : '');
    lbl.innerHTML = `
      <input type="checkbox" value="${dt.id}" ${checked ? 'checked' : ''}>
      <div class="a-checkbox-dot"></div>
      <span>${dt.label}</span>
      <span class="deco-min-badge">min ${dt.minQty}</span>`;
    lbl.querySelector('input').addEventListener('change', e => {
      lbl.classList.toggle('checked', e.target.checked);
      rebuildPriceBreaks();
      if (e.target.checked) grid.classList.remove('field-required-error');
    });
    grid.appendChild(lbl);
  });
}

function buildLocationsGrid(selectedLocations) {
  const grid = document.getElementById('f-locations-grid');
  grid.innerHTML = '';
  ALL_LOCATIONS.forEach(loc => {
    const checked = selectedLocations.includes(loc);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'location-toggle' + (checked ? ' active' : '');
    btn.textContent = loc;
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      if (btn.classList.contains('active')) grid.classList.remove('field-required-error');
    });
    grid.appendChild(btn);
  });
}

// ============================================
// PRICE BREAKS
// ============================================
function buildPriceBreaksSection(selectedDeco, existingBreaks = {}) {
  const wrap = document.getElementById('f-price-breaks-wrap');
  wrap.innerHTML = '';

  if (!selectedDeco.length) {
    wrap.innerHTML = '<p class="a-hint" style="padding:4px 0">Select decoration methods above to set fixed pricing.</p>';
    return;
  }

  const blankCost = parseFloat(document.getElementById('f-blank-cost').value) || 0;

  selectedDeco.forEach(decoId => {
    const dt = getDecoType(decoId);
    if (!dt) return;
    const saved = existingBreaks[decoId] || {};
    const hasSomeValues = PRICE_BREAK_TIERS.some(qty => {
      const v = parseFloat(saved[qty]);
      return !isNaN(v) && v > 0;
    });

    const addKey = decoId + ':add';
    const savedAdd = existingBreaks[addKey] || {};
    const hasAddValues = PRICE_BREAK_TIERS.some(qty => {
      const v = parseFloat(savedAdd[qty]);
      return !isNaN(v) && v > 0;
    });

    const section = document.createElement('div');
    section.className = 'price-break-section';

    const cellsHtml = PRICE_BREAK_TIERS.map(qty => {
      const belowMin = qty < dt.minQty;
      const val = !belowMin && saved[qty] != null && saved[qty] !== '' ? parseFloat(saved[qty]).toFixed(2) : '';
      if (belowMin) {
        return `<div class="price-break-cell pb-cell-na">
          <label class="price-break-qty">${qty}+</label>
          <div class="price-break-input-wrap"><span class="pb-na-label">—</span></div>
        </div>`;
      }
      return `<div class="price-break-cell">
        <label class="price-break-qty">${qty}+</label>
        <div class="price-break-input-wrap">
          <span class="price-break-dollar">$</span>
          <input type="number" class="a-input price-break-input"
            data-deco="${decoId}" data-qty="${qty}"
            value="${val}" placeholder="—" step="0.01" min="0">
        </div>
      </div>`;
    }).join('');

    const addCellsHtml = PRICE_BREAK_TIERS.map(qty => {
      const belowMin = qty < dt.minQty;
      const val = !belowMin && savedAdd[qty] != null && savedAdd[qty] !== '' ? parseFloat(savedAdd[qty]).toFixed(2) : '';
      if (belowMin) {
        return `<div class="price-break-cell pb-cell-na">
          <label class="price-break-qty">${qty}+</label>
          <div class="price-break-input-wrap"><span class="pb-na-label">—</span></div>
        </div>`;
      }
      return `<div class="price-break-cell">
        <label class="price-break-qty">${qty}+</label>
        <div class="price-break-input-wrap">
          <span class="price-break-dollar">$</span>
          <input type="number" class="a-input price-break-input"
            data-deco="${addKey}" data-qty="${qty}"
            value="${val}" placeholder="—" step="0.01" min="0">
        </div>
      </div>`;
    }).join('');

    section.innerHTML = `
      <div class="price-break-header">
        <div class="pb-header-left">
          <span class="price-break-name">${dt.label}</span>
          <span class="price-break-min">min ${dt.minQty} pcs</span>
          <span class="${hasSomeValues ? 'pb-set-badge' : 'pb-unset-badge'}">${hasSomeValues ? 'Pricing set' : 'No pricing set'}</span>
        </div>
        <div class="pb-header-actions">
          ${blankCost > 0 ? `<button type="button" class="pb-action-btn pb-suggest-btn" data-deco="${decoId}">Suggest from formula</button>` : ''}
          <button type="button" class="pb-action-btn pb-copy-btn" data-deco="${decoId}">Copy from product</button>
          <button type="button" class="pb-action-btn pb-clear-btn" data-deco="${decoId}">Clear all</button>
        </div>
      </div>
      <div class="price-break-grid">${cellsHtml}</div>
      <div class="pb-addloc-wrap">
        <button type="button" class="pb-addloc-toggle${hasAddValues ? ' pb-addloc-open' : ''}" data-deco="${decoId}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          Additional location fee
          ${hasAddValues ? `<span class="pb-addloc-set-badge">Set</span>` : '<span class="pb-addloc-hint">optional — added per extra location of this method</span>'}
        </button>
        <div class="pb-addloc-body${hasAddValues ? '' : ' pb-addloc-hidden'}">
          <div class="pb-addloc-desc">Fee per piece for each extra location of this method. No blank charge — decoration upcharge only.</div>
          <div class="pb-addloc-actions">
            ${blankCost > 0 ? `<button type="button" class="pb-action-btn pb-suggest-btn" data-deco="${addKey}" data-is-addloc="1">Suggest from formula</button>` : ''}
            <button type="button" class="pb-action-btn pb-clear-btn" data-deco="${addKey}">Clear</button>
          </div>
          <div class="price-break-grid pb-addloc-grid">${addCellsHtml}</div>
        </div>
      </div>
      <div class="pb-copy-overlay" id="pb-copy-overlay-${decoId}" style="display:none"></div>`;
    wrap.appendChild(section);
  });

  // Additional location toggle
  wrap.querySelectorAll('.pb-addloc-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const body = btn.nextElementSibling;
      const isOpen = !body.classList.contains('pb-addloc-hidden');
      body.classList.toggle('pb-addloc-hidden', isOpen);
      btn.classList.toggle('pb-addloc-open', !isOpen);
    });
  });

  // Suggest from formula — fill only empty cells
  // For base price: use calcPriceBreakRows; for :add key: use blankCost × (multiplier - 1)
  wrap.querySelectorAll('.pb-suggest-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.deco; // may be 'screen-printing' or 'screen-printing:add'
      const isAddLoc = !!btn.dataset.isAddloc;
      const baseDecoId = isAddLoc ? key.replace(':add', '') : key;
      const bc = parseFloat(document.getElementById('f-blank-cost').value) || 0;
      if (!bc) return;
      const rows = calcPriceBreakRows(baseDecoId, bc);
      rows.forEach(r => {
        const inp = wrap.querySelector(`.price-break-input[data-deco="${key}"][data-qty="${r.qty}"]`);
        if (!inp || inp.value) return;
        if (isAddLoc) {
          // Additional location fee = blank cost × (multiplier − 1), i.e. decoration upcharge only
          const fee = r.multiplier != null ? bc * (r.multiplier - 1) : null;
          if (fee != null && fee > 0) inp.value = fee.toFixed(2);
        } else {
          if (r.pricePerPiece != null) inp.value = r.pricePerPiece.toFixed(2);
        }
      });
      _updatePricingBadges(wrap);
    });
  });

  // Clear all prices for a deco type
  wrap.querySelectorAll('.pb-clear-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Clear all fixed prices for this decoration type?')) return;
      const decoId = btn.dataset.deco;
      wrap.querySelectorAll(`.price-break-input[data-deco="${decoId}"]`).forEach(inp => { inp.value = ''; });
      _updatePricingBadges(wrap);
    });
  });

  // Copy from another product
  wrap.querySelectorAll('.pb-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => _showCopyFromOverlay(btn.dataset.deco, wrap));
  });

  // Update badge on any input change
  wrap.addEventListener('input', () => _updatePricingBadges(wrap));
}

function _updatePricingBadges(wrap) {
  wrap.querySelectorAll('.price-break-section').forEach(section => {
    const inputs = section.querySelectorAll('.price-break-input');
    const hasValues = [...inputs].some(i => {
      const v = parseFloat(i.value);
      return !isNaN(v) && v > 0;
    });
    const badge = section.querySelector('.pb-set-badge, .pb-unset-badge');
    if (badge) {
      badge.className = hasValues ? 'pb-set-badge' : 'pb-unset-badge';
      badge.textContent = hasValues ? 'Pricing set' : 'No pricing set';
    }
  });
}

function _showCopyFromOverlay(decoId, wrap) {
  wrap.querySelectorAll('.pb-copy-overlay').forEach(o => { o.style.display = 'none'; });
  const overlay = wrap.querySelector(`#pb-copy-overlay-${decoId}`);
  if (!overlay) return;

  const eligible = adminProducts.filter(p => {
    if (p.id === editingProductId) return false;
    const breaks = p.priceBreaks && p.priceBreaks[decoId];
    return breaks && PRICE_BREAK_TIERS.some(qty => { const v = parseFloat(breaks[qty]); return !isNaN(v) && v > 0; });
  });

  if (!eligible.length) {
    showToast('No other products have fixed pricing for this decoration type yet.', 'info');
    return;
  }

  overlay.innerHTML = `
    <div class="pb-copy-panel">
      <div class="pb-copy-header">
        <span>Copy pricing from:</span>
        <button type="button" class="pb-copy-close">✕</button>
      </div>
      <div class="pb-copy-list">
        ${eligible.map(p => {
          const tierCount = PRICE_BREAK_TIERS.filter(qty => { const v = parseFloat(p.priceBreaks[decoId][qty]); return !isNaN(v) && v > 0; }).length;
          return `<button type="button" class="pb-copy-product-btn" data-pid="${p.id}">
            <span class="pb-copy-pname">${p.name}</span>
            <span class="pb-copy-pdetail">${p.brand ? p.brand + ' · ' : ''}${tierCount} tier${tierCount !== 1 ? 's' : ''} set</span>
          </button>`;
        }).join('')}
      </div>
      <label class="pb-copy-overwrite-wrap">
        <input type="checkbox" id="pb-copy-overwrite"> Overwrite existing prices
      </label>
    </div>`;
  overlay.style.display = 'block';

  overlay.querySelector('.pb-copy-close').addEventListener('click', () => { overlay.style.display = 'none'; });

  overlay.querySelectorAll('.pb-copy-product-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const src = adminProducts.find(p => p.id === btn.dataset.pid);
      if (!src?.priceBreaks?.[decoId]) return;
      const overwrite = overlay.querySelector('#pb-copy-overwrite')?.checked;
      PRICE_BREAK_TIERS.forEach(qty => {
        const inp = wrap.querySelector(`.price-break-input[data-deco="${decoId}"][data-qty="${qty}"]`);
        if (!inp) return;
        if (!overwrite && inp.value.trim()) return;
        const v = src.priceBreaks[decoId][qty];
        if (v != null && v !== '') inp.value = parseFloat(v).toFixed(2);
      });
      overlay.style.display = 'none';
      _updatePricingBadges(wrap);
      showToast(`Copied pricing from ${src.name}`, 'success');
    });
  });
}

function rebuildPriceBreaks() {
  const selectedDeco = getCheckedDeco();
  const existingBreaks = collectPriceBreaks();
  buildPriceBreaksSection(selectedDeco, existingBreaks);
}

function getCheckedDeco() {
  return [...document.querySelectorAll('#f-deco-grid input:checked')].map(i => i.value);
}

function collectPriceBreaks() {
  const result = {};
  document.querySelectorAll('.price-break-input').forEach(inp => {
    const deco = inp.dataset.deco;
    const qty = inp.dataset.qty;
    const val = inp.value.trim();
    if (!result[deco]) result[deco] = {};
    if (val) result[deco][qty] = val;
  });
  return result;
}

// ============================================
// PER-PRODUCT COLORS WITH MOCKUPS
// ============================================
function renderProductColorsList() {
  const container = document.getElementById('product-colors-list');
  container.innerHTML = '';

  if (!productColors.length) {
    container.innerHTML = '<div class="colors-empty">No colors added yet. Add your first color below.</div>';
    return;
  }

  productColors.forEach((c, idx) => {
    const row = document.createElement('div');
    row.className = 'product-color-row';
    row.innerHTML = `
      <div class="pcr-swatch" style="background:${c.hex}"></div>
      <div class="pcr-info">
        <span class="pcr-name">${c.name}</span>
        <span class="pcr-hex">${c.hex}</span>
      </div>
      <div class="pcr-mockup-status">
        ${c.mockup
          ? `<img src="${c.mockup}" class="pcr-mockup-thumb" alt="mockup"><span class="pcr-has-mockup">Mockup added</span>`
          : `<span class="pcr-no-mockup">No mockup</span>`}
      </div>
      <div class="pcr-actions">
        <button type="button" class="a-btn a-btn-ghost a-btn-icon a-btn-sm" onclick="editProductColor(${idx})" title="Edit">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button type="button" class="a-btn a-btn-ghost a-btn-icon a-btn-sm" onclick="removeProductColor(${idx})" title="Remove" style="color:var(--danger)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
    container.appendChild(row);
  });
}

function removeProductColor(idx) {
  productColors.splice(idx, 1);
  renderProductColorsList();
}

function editProductColor(idx) {
  const c = productColors[idx];
  openColorEntryForm(c, (updated) => {
    productColors[idx] = updated;
    renderProductColorsList();
  });
}

function addProductColor() {
  openColorEntryForm(null, (newColor) => {
    productColors.push(newColor);
    renderProductColorsList();
  });
}

// Inline color entry panel
let colorEntryCallback = null;
function openColorEntryForm(existing, callback) {
  colorEntryCallback = callback;
  const panel = document.getElementById('color-entry-panel');
  const nameInput = document.getElementById('cep-name');
  const hexInput = document.getElementById('cep-hex');
  const picker = document.getElementById('cep-picker');
  const preview = document.getElementById('cep-mockup-preview');
  const previewImg = document.getElementById('cep-mockup-img');
  const previewName = document.getElementById('cep-mockup-name');

  nameInput.value = existing ? existing.name : '';
  hexInput.value = existing ? existing.hex : '#000000';
  picker.value = existing && /^#[0-9a-f]{6}$/i.test(existing.hex) ? existing.hex : '#000000';

  // Store existing mockup in hidden field
  document.getElementById('cep-mockup-data').value = existing && existing.mockup ? existing.mockup : '';
  document.getElementById('cep-mockup-input').value = '';

  if (existing && existing.mockup) {
    previewImg.src = existing.mockup;
    previewName.textContent = 'Current mockup';
    preview.style.display = 'flex';
  } else {
    preview.style.display = 'none';
  }

  panel.style.display = 'block';
  nameInput.focus();
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeColorEntryForm() {
  document.getElementById('color-entry-panel').style.display = 'none';
  colorEntryCallback = null;
}

function saveColorEntry() {
  const name = document.getElementById('cep-name').value.trim();
  const hex = document.getElementById('cep-hex').value.trim();
  if (!name || !hex) { toast('Enter a name and color', 'error'); return; }

  const btn = document.querySelector('#color-entry-panel .a-btn-primary');

  const finish = () => {
    const storedMockup = document.getElementById('cep-mockup-data').value;
    const color = { name, hex, mockup: storedMockup || null };
    if (colorEntryCallback) colorEntryCallback(color);
    closeColorEntryForm();
    if (btn) { btn.disabled = false; btn.textContent = 'Save Color'; }
  };

  if (_pendingMockupUpload) {
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    _pendingMockupUpload.then(finish).catch(finish);
  } else {
    finish();
  }
}

// ============================================
// SYNC ERROR NOTIFICATION
// ============================================
// Register the sync error handler so Firestore failures surface visibly
_onSyncError = function(docId, err) {
  const banner = document.getElementById('sync-error-banner');
  if (!banner) return;
  banner.style.display = 'flex';
  const detail = document.getElementById('sync-error-detail');
  if (detail) {
    const code = (err && (err.code || err.message)) || 'unknown error';
    detail.textContent = `(${docId}: ${code})`;
  }
};

function dismissSyncError() {
  const banner = document.getElementById('sync-error-banner');
  if (banner) banner.style.display = 'none';
}

// ============================================
// IMAGE COMPRESSION + STORAGE UPLOAD
// ============================================
// Synchronously convert a data URL to a Blob without using fetch().
// fetch(dataUrl) can silently hang in some browsers/CSP contexts.
function _dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(',');
  const mime  = (parts[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
  const bstr  = atob(parts[1]);
  const n     = bstr.length;
  const u8    = new Uint8Array(n);
  for (let i = 0; i < n; i++) u8[i] = bstr.charCodeAt(i);
  return new Blob([u8], { type: mime });
}

function _compressImage(dataUrl, maxDim, quality, callback) {
  const img = new Image();
  img.onload = () => {
    let w = img.width, h = img.height;
    if (w > maxDim || h > maxDim) {
      if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim; }
      else        { w = Math.round(w * maxDim / h); h = maxDim; }
    }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    callback(canvas.toDataURL('image/jpeg', quality));
  };
  img.onerror = () => callback(dataUrl);
  img.src = dataUrl;
}

// Holds the in-flight Storage upload Promise so saveColorEntry can await it
var _pendingMockupUpload = null;

function handleMockupUpload(input) {
  const file = input.files[0];
  if (!file) return;

  document.getElementById('cep-mockup-name').textContent = file.name;
  document.getElementById('cep-mockup-preview').style.display = 'flex';

  const reader = new FileReader();
  reader.onload = e => {
    _compressImage(e.target.result, 800, 0.82, compressedDataUrl => {
      document.getElementById('cep-mockup-img').src = compressedDataUrl;

      if (typeof uploadToStorageWithProgress === 'function' && _firebaseStorage) {
        try {
          const blob     = _dataUrlToBlob(compressedDataUrl);
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const path     = `product_mockups/${Date.now()}_${safeName}`;
          const timeout  = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000));
          _pendingMockupUpload = Promise.race([uploadToStorageWithProgress(blob, path, null), timeout])
            .then(url => {
              document.getElementById('cep-mockup-data').value = url;
              _pendingMockupUpload = null;
            })
            .catch(err => {
              console.error('[Upload] Failed:', err.code || err.message);
              document.getElementById('cep-mockup-data').value = compressedDataUrl;
              _pendingMockupUpload = null;
              if (typeof logAppError === 'function') logAppError('upload_fail', 'Product photo upload failed', { code: err.code || err.message, context: file.name });
            });
        } catch (blobErr) {
          console.error('[Upload] Blob error:', blobErr);
          document.getElementById('cep-mockup-data').value = compressedDataUrl;
          _pendingMockupUpload = null;
        }
      } else {
        document.getElementById('cep-mockup-data').value = compressedDataUrl;
        _pendingMockupUpload = null;
      }
    });
  };
  reader.readAsDataURL(file);
}

// Migrate any colors that still have base64 mockupData to Firebase Storage URLs.
// Returns a Promise<colors> with the updated colors array.
async function _migrateBase64ColorsToStorage(colors) {
  if (!colors || !colors.length) return colors;
  if (!_firebaseStorage) return colors;
  const migrated = [];
  for (const color of colors) {
    if (color.mockupData && color.mockupData.startsWith('data:')) {
      try {
        const blob = _dataUrlToBlob(color.mockupData);
        const path = `product_mockups/migrated_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
        const url  = await uploadToStorageWithProgress(blob, path, null);
        migrated.push({ ...color, mockupData: url });
        console.log('[Migration] Moved base64 photo to Storage for color:', color.name || color.id);
      } catch (err) {
        console.warn('[Migration] Failed to migrate color photo:', color.name, err);
        migrated.push(color); // keep as-is on failure
      }
    } else {
      migrated.push(color);
    }
  }
  return migrated;
}

function removeMockupFromEntry() {
  document.getElementById('cep-mockup-data').value = '';
  document.getElementById('cep-mockup-input').value = '';
  document.getElementById('cep-mockup-preview').style.display = 'none';
}

// ============================================
// SAVE PRODUCT
// ============================================
async function saveProduct(e) {
  e.preventDefault();

  const sizes = [...document.querySelectorAll('#f-sizes-grid input:checked')].map(i => i.value);
  const deco = getCheckedDeco();
  const locations = [...document.querySelectorAll('.location-toggle.active')].map(b => b.textContent);
  const priceBreaks = collectPriceBreaks();

  // Validate required sections
  let valid = true;
  const decoGrid = document.getElementById('f-deco-grid');
  const locGrid  = document.getElementById('f-locations-grid');
  if (!deco.length) {
    decoGrid.classList.add('field-required-error');
    decoGrid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    valid = false;
  } else {
    decoGrid.classList.remove('field-required-error');
  }
  if (!locations.length) {
    locGrid.classList.add('field-required-error');
    if (valid) locGrid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    valid = false;
  } else {
    locGrid.classList.remove('field-required-error');
  }
  if (!valid) return;
  const name = document.getElementById('f-name').value.trim();
  const id = editingProductId || slugify(name);

  // Migrate any existing base64 color photos to Firebase Storage before saving
  let finalColors = productColors;
  const hasBase64 = productColors.some(c => c.mockupData && c.mockupData.startsWith('data:'));
  if (hasBase64 && _firebaseStorage) {
    toast('Migrating photos to cloud — please wait…', 'info');
    try {
      finalColors = await _migrateBase64ColorsToStorage(productColors);
    } catch (err) {
      console.warn('[saveProduct] Migration error:', err);
    }
  }

  const updated = {
    id,
    name,
    brand:        document.getElementById('f-brand').value.trim(),
    styleNumber:  document.getElementById('f-style-number').value.trim(),
    supplier:     document.getElementById('f-supplier').value.trim(),
    category: document.getElementById('f-category').value,
    description: document.getElementById('f-desc').value.trim(),
    icon: document.getElementById('f-icon').value,
    blankCost: parseFloat(document.getElementById('f-blank-cost').value) || 0,
    popular: document.getElementById('f-popular').checked,
    visible: document.getElementById('f-visible').checked,
    sizes,
    decoration: deco,
    locations,
    colors: finalColors,
    priceBreaks,
  };

  if (editingProductId) {
    const idx = adminProducts.findIndex(p => p.id === editingProductId);
    if (idx > -1) adminProducts[idx] = updated;
  } else {
    adminProducts.push(updated);
  }

  const isEdit = !!editingProductId;

  // Save to Firestore and confirm cloud write
  const ts = new Date().toISOString();
  localStorage.setItem('_ts_products', ts);
  localStorage.setItem('insignia_products', JSON.stringify(adminProducts));

  try {
    await _firebaseDb.collection('app_data').doc('products').set({
      data: JSON.stringify(adminProducts),
      updatedAt: ts,
    });
    renderProductsTable();
    closeProductModal();
    toast((isEdit ? 'Product updated' : 'Product added') + ' — saved to cloud ✓', 'success');
  } catch (err) {
    console.warn('[saveProduct] Firestore write failed:', err);
    renderProductsTable();
    closeProductModal();
    toast('Saved locally — cloud sync failed. Check banner for details.', 'error');
    if (typeof _onSyncError === 'function') _onSyncError('products', err);
  }

  logActivity(isEdit ? 'saved_product' : 'saved_product', 'product', updated.id, (isEdit ? 'Updated' : 'Added') + ` "${updated.name}"`);
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
}

// ============================================
// PRICING METRICS
// ============================================
function initPricing() {
  renderPricingTabs();
  if (ALL_DECORATION_TYPES.length) {
    activePricingTab = ALL_DECORATION_TYPES[0].id;
    renderPricingGrid();
  }
}

function renderPricingTabs() {
  const tabsEl = document.getElementById('pricing-tabs');
  if (!tabsEl) return;
  tabsEl.innerHTML = '';
  ALL_DECORATION_TYPES.forEach(dt => {
    const btn = document.createElement('button');
    btn.className = 'pricing-tab' + (activePricingTab === dt.id ? ' active' : '');
    btn.textContent = dt.label;
    btn.onclick = () => {
      activePricingTab = dt.id;
      document.querySelectorAll('.pricing-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      renderPricingGrid();
    };
    tabsEl.appendChild(btn);
  });
}

function renderPricingGrid() {
  const wrap = document.getElementById('pricing-grid-wrap');
  if (!wrap) return;

  const decoId = activePricingTab;
  if (!pricingMetrics[decoId]) {
    // Initialize from defaults if missing
    pricingMetrics[decoId] = JSON.parse(JSON.stringify(DEFAULT_PRICING_METRICS[decoId] || {
      qtys: [12, 24, 36, 48, 72, 144, 288],
      costRanges: [{ minVal: 0, maxVal: 5, label: '$0–$5' }],
      grid: [['']]
    }));
  }

  const m = pricingMetrics[decoId];
  const dt = ALL_DECORATION_TYPES.find(d => d.id === decoId);

  wrap.innerHTML = `
    <div class="pricing-grid-container">
      <div class="pricing-grid-topbar">
        <div class="pricing-grid-title">
          Multiplier Grid — <span>${dt ? dt.label : decoId}</span>
          <span class="pricing-min-badge">Min ${dt ? dt.minQty : '?'} pcs</span>
        </div>
        <div class="pricing-grid-actions">
          <button class="a-btn a-btn-ghost a-btn-sm" onclick="addPriceColumn()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Price Column
          </button>
          <button class="a-btn a-btn-ghost a-btn-sm" onclick="addQtyRow()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Qty Row
          </button>
        </div>
      </div>
      <div class="pricing-table-scroll">
        <table class="pricing-table" id="pricing-table">
          <thead id="pricing-thead"></thead>
          <tbody id="pricing-tbody"></tbody>
        </table>
      </div>
    </div>`;

  renderPricingTableHead();
  renderPricingTableBody();
}

function renderPricingTableHead() {
  const thead = document.getElementById('pricing-thead');
  const m = pricingMetrics[activePricingTab];
  if (!thead || !m) return;

  let html = '<tr><th class="pt-corner">Qty</th>';
  m.costRanges.forEach((r, ci) => {
    html += `
      <th class="pt-col-header">
        <div class="pt-col-inputs">
          <div class="pt-range-row">
            <span class="pt-range-label">from</span>
            <input type="number" class="pt-range-input" value="${r.minVal}" step="0.01" min="0"
              onchange="updateCostRange(${ci}, 'minVal', this.value)"
              title="Min value for this cost column">
          </div>
          <div class="pt-range-row">
            <span class="pt-range-label">to</span>
            <input type="number" class="pt-range-input" value="${r.maxVal === 9999 ? '' : r.maxVal}" step="0.01" min="0"
              placeholder="∞"
              onchange="updateCostRange(${ci}, 'maxVal', this.value || 9999)"
              title="Max value for this cost column">
          </div>
        </div>
        <button class="pt-delete-col" onclick="deletePriceColumn(${ci})" title="Delete column">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </th>`;
  });
  html += '</tr>';
  thead.innerHTML = html;
}

function renderPricingTableBody() {
  const tbody = document.getElementById('pricing-tbody');
  const m = pricingMetrics[activePricingTab];
  if (!tbody || !m) return;

  let html = '';
  m.qtys.forEach((qty, ri) => {
    html += `<tr>
      <td class="pt-qty-cell">
        <input type="number" class="pt-qty-input" value="${qty}" min="1"
          onchange="updateQtyTier(${ri}, this.value)">
        <button class="pt-delete-row" onclick="deleteQtyRow(${ri})" title="Delete row">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </td>`;
    m.costRanges.forEach((r, ci) => {
      const val = m.grid[ri]?.[ci] ?? '';
      const belowMin = ALL_DECORATION_TYPES.find(d => d.id === activePricingTab)?.minQty;
      const disabled = belowMin && qty < belowMin;
      html += `<td class="pt-cell${disabled ? ' pt-disabled' : ''}">
        <input type="number" class="pt-multiplier-input" value="${val}" step="0.01" min="0"
          placeholder="${disabled ? '—' : ''}"
          ${disabled ? 'disabled title="Below minimum qty for this method"' : ''}
          onchange="updateMultiplier(${ri}, ${ci}, this.value)">
      </td>`;
    });
    html += '</tr>';
  });
  tbody.innerHTML = html;
}

// ---- Grid mutations ----
function updateMultiplier(ri, ci, val) {
  const m = pricingMetrics[activePricingTab];
  if (!m.grid[ri]) m.grid[ri] = [];
  m.grid[ri][ci] = val;
  savePricingMetrics(pricingMetrics);
}

function updateCostRange(ci, field, val) {
  const m = pricingMetrics[activePricingTab];
  m.costRanges[ci][field] = parseFloat(val) || 0;
  // Auto-update label
  const r = m.costRanges[ci];
  r.label = `$${r.minVal}–${r.maxVal >= 9999 ? '' : '$' + r.maxVal}`;
  savePricingMetrics(pricingMetrics);
}

function updateQtyTier(ri, val) {
  const m = pricingMetrics[activePricingTab];
  m.qtys[ri] = parseInt(val) || 0;
  // Re-sort rows by qty ascending
  const combined = m.qtys.map((q, i) => ({ qty: q, row: m.grid[i] || [] }));
  combined.sort((a, b) => a.qty - b.qty);
  m.qtys = combined.map(c => c.qty);
  m.grid = combined.map(c => c.row);
  savePricingMetrics(pricingMetrics);
  renderPricingTableBody();
}

function addPriceColumn() {
  const m = pricingMetrics[activePricingTab];
  const lastMax = m.costRanges.length ? m.costRanges[m.costRanges.length - 1].maxVal : 0;
  const newMin = lastMax >= 9999 ? lastMax : lastMax + 0.01;
  m.costRanges.push({ minVal: parseFloat(newMin.toFixed(2)), maxVal: 9999, label: `$${newMin.toFixed(2)}+` });
  m.grid.forEach(row => row.push(''));
  savePricingMetrics(pricingMetrics);
  renderPricingTableHead();
  renderPricingTableBody();
}

function addQtyRow() {
  const m = pricingMetrics[activePricingTab];
  const lastQty = m.qtys.length ? m.qtys[m.qtys.length - 1] : 0;
  m.qtys.push(lastQty + 12);
  m.grid.push(Array(m.costRanges.length).fill(''));
  savePricingMetrics(pricingMetrics);
  renderPricingTableBody();
}

function deletePriceColumn(ci) {
  const m = pricingMetrics[activePricingTab];
  if (m.costRanges.length <= 1) { toast('Need at least one column', 'error'); return; }
  m.costRanges.splice(ci, 1);
  m.grid.forEach(row => row.splice(ci, 1));
  savePricingMetrics(pricingMetrics);
  renderPricingTableHead();
  renderPricingTableBody();
}

function deleteQtyRow(ri) {
  const m = pricingMetrics[activePricingTab];
  if (m.qtys.length <= 1) { toast('Need at least one row', 'error'); return; }
  m.qtys.splice(ri, 1);
  m.grid.splice(ri, 1);
  savePricingMetrics(pricingMetrics);
  renderPricingTableBody();
}

function resetPricingToDefaults() {
  showConfirm('Reset all pricing grids to defaults? Your changes will be lost.', () => {
    pricingMetrics = JSON.parse(JSON.stringify(DEFAULT_PRICING_METRICS));
    savePricingMetrics(pricingMetrics);
    renderPricingGrid();
    toast('Pricing reset to defaults', 'success');
  });
}

// ============================================
// ORDERS
// ============================================
let ordersData = [];
let ordersViewMode = 'kanban';

// ---- Kanban column visibility & named views ----
const KB_VISIBLE_KEY  = 'insignia_kb_visible_cols';
const KB_VIEWS_KEY    = 'insignia_kb_views';
const KB_ACTIVE_VIEW  = 'insignia_kb_active_view';

function getVisibleKbCols() {
  const allColIds = KANBAN_COLUMNS.map(c => c.id);
  try {
    const saved = localStorage.getItem(KB_VISIBLE_KEY);
    if (saved) {
      const cols = JSON.parse(saved);
      // If stored values look like old sub-status IDs, reset to column IDs
      if (cols.some(c => !allColIds.includes(c))) return allColIds.slice();
      return cols;
    }
  } catch(e) {}
  return allColIds.slice();
}
function saveVisibleKbCols(cols) {
  localStorage.setItem(KB_VISIBLE_KEY, JSON.stringify(cols));
}

function getKbViews() {
  try { return JSON.parse(localStorage.getItem(KB_VIEWS_KEY)) || []; } catch(e) { return []; }
}
function saveKbViews(views) {
  localStorage.setItem(KB_VIEWS_KEY, JSON.stringify(views));
}
function getActiveViewId() {
  return localStorage.getItem(KB_ACTIVE_VIEW) || null;
}
function setActiveViewId(id) {
  if (id) localStorage.setItem(KB_ACTIVE_VIEW, id);
  else localStorage.removeItem(KB_ACTIVE_VIEW);
}

function applyKbView(id) {
  const views = getKbViews();
  const view = views.find(v => v.id === id);
  if (!view) return;
  saveVisibleKbCols(view.cols.slice());
  setActiveViewId(id);
  renderKbSavedViews();
  renderKanbanBoard();
  const panel = document.getElementById('kb-cols-panel');
  if (panel) { panel.style.display = 'none'; }
}

function renderKbSavedViews() {
  const wrap = document.getElementById('kb-saved-views');
  if (!wrap) return;
  const views = getKbViews();
  const activeId = getActiveViewId();
  wrap.innerHTML = views.map(v => `
    <button class="kb-saved-view-btn${v.id === activeId ? ' active' : ''}" onclick="applyKbView('${v.id}')">
      ${v.name}
    </button>`).join('');
}

function toggleKbColsPanel() {
  const panel = document.getElementById('kb-cols-panel');
  if (!panel) return;
  if (panel.style.display === 'none') {
    renderKbColsPanel();
    panel.style.display = 'block';
    setTimeout(() => {
      document.addEventListener('click', closeKbColsPanelOutside, { once: true });
    }, 0);
  } else {
    panel.style.display = 'none';
  }
}

function closeKbColsPanelOutside(e) {
  const wrap = document.getElementById('kb-cols-wrap');
  if (wrap && !wrap.contains(e.target)) {
    const panel = document.getElementById('kb-cols-panel');
    if (panel) panel.style.display = 'none';
  } else {
    setTimeout(() => {
      document.addEventListener('click', closeKbColsPanelOutside, { once: true });
    }, 0);
  }
}

function renderKbColsPanel() {
  const panel = document.getElementById('kb-cols-panel');
  if (!panel) return;
  const visible = getVisibleKbCols();
  const views = getKbViews();
  panel.innerHTML = `
    <div class="kb-cols-panel-title">Columns</div>
    ${KANBAN_COLUMNS.map(col => {
      const checked = visible.includes(col.id) ? 'checked' : '';
      return `<label class="kb-col-toggle">
        <input type="checkbox" ${checked} onchange="toggleKbCol('${col.id}', this.checked)">
        <span class="kb-col-dot" style="background:${col.color}"></span>
        ${col.label}
      </label>`;
    }).join('')}
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid #2a2a2a;display:flex;gap:8px">
      <button class="a-btn a-btn-ghost" style="flex:1;font-size:12px" onclick="setAllKbCols(true)">Show All</button>
      <button class="a-btn a-btn-ghost" style="flex:1;font-size:12px" onclick="setAllKbCols(false)">Hide All</button>
    </div>
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid #2a2a2a">
      <div class="kb-cols-panel-title">Save as View</div>
      <div style="display:flex;gap:8px">
        <input class="a-input" id="kb-view-name-input" placeholder="View name…" style="flex:1;height:32px;font-size:13px" onkeydown="if(event.key==='Enter')saveNewKbView()">
        <button class="a-btn a-btn-primary" style="height:32px;padding:0 12px;font-size:13px" onclick="saveNewKbView()">Save</button>
      </div>
    </div>
    ${views.length ? `
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid #2a2a2a">
      <div class="kb-cols-panel-title">Saved Views</div>
      ${views.map(v => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0">
          <span style="font-size:13px;color:var(--text-light)">${v.name}</span>
          <button class="a-btn a-btn-ghost" style="font-size:11px;padding:2px 8px;color:#ef4444" onclick="deleteKbView('${v.id}')">Remove</button>
        </div>`).join('')}
    </div>` : ''}`;
}

function toggleKbCol(sid, isVisible) {
  const cols = getVisibleKbCols();
  if (isVisible && !cols.includes(sid)) cols.push(sid);
  if (!isVisible) { const i = cols.indexOf(sid); if (i !== -1) cols.splice(i, 1); }
  saveVisibleKbCols(cols);
  setActiveViewId(null);
  renderKbSavedViews();
  renderKanbanBoard();
}

function setAllKbCols(show) {
  saveVisibleKbCols(show ? KANBAN_COLUMNS.map(c => c.id) : []);
  setActiveViewId(null);
  renderKbColsPanel();
  renderKbSavedViews();
  renderKanbanBoard();
}

function saveNewKbView() {
  const input = document.getElementById('kb-view-name-input');
  const name = (input ? input.value.trim() : '');
  if (!name) return;
  const views = getKbViews();
  const id = 'kbv-' + Date.now();
  views.push({ id, name, cols: getVisibleKbCols().slice() });
  saveKbViews(views);
  setActiveViewId(id);
  renderKbSavedViews();
  renderKbColsPanel();
}

function deleteKbView(id) {
  const views = getKbViews().filter(v => v.id !== id);
  saveKbViews(views);
  if (getActiveViewId() === id) setActiveViewId(null);
  renderKbSavedViews();
  renderKbColsPanel();
}

function toggleOrdersView(mode) {
  ordersViewMode = mode;
  document.getElementById('orders-list').style.display = mode === 'list' ? 'block' : 'none';
  document.getElementById('kanban-board').style.display = mode === 'kanban' ? 'flex' : 'none';
  const filterWrap = document.getElementById('orders-filter-wrap');
  if (filterWrap) filterWrap.style.display = mode === 'kanban' ? 'none' : '';
  const kbColsWrap = document.getElementById('kb-cols-wrap');
  if (kbColsWrap) kbColsWrap.style.display = mode === 'kanban' ? '' : 'none';
  const savedViews = document.getElementById('kb-saved-views');
  if (savedViews) savedViews.style.display = mode === 'kanban' ? '' : 'none';
  document.getElementById('view-list-btn').classList.toggle('active', mode === 'list');
  document.getElementById('view-kanban-btn').classList.toggle('active', mode === 'kanban');
  if (mode === 'kanban') renderKanbanBoard();
  else renderOrdersList();
}

function renderOrdersList() {
  ordersData = getOrders();
  filterOrders();
}

// ---- Order list grouping helpers ----
function groupOrdersForDisplay(orders) {
  const groupMap = {};
  const result = [];
  const seen = new Set();

  orders.forEach(o => {
    if (o.groupId) {
      if (!groupMap[o.groupId]) groupMap[o.groupId] = [];
      groupMap[o.groupId].push(o);
    }
  });

  orders.forEach(o => {
    if (!o.groupId) {
      result.push({ type: 'single', order: o });
    } else if (!seen.has(o.groupId)) {
      seen.add(o.groupId);
      result.push({ type: 'group', groupId: o.groupId, orders: groupMap[o.groupId] });
    }
  });

  return result;
}

function getGroupDisplayStatus(groupOrders) {
  let minIdx = STATUS_TIMELINE.length;
  let minStatus = groupOrders[0].status;
  groupOrders.forEach(o => {
    const idx = STATUS_TIMELINE.indexOf(o.status);
    if (idx !== -1 && idx < minIdx) { minIdx = idx; minStatus = o.status; }
  });
  return minStatus;
}

function buildOrderRow(o, opts = {}) {
  const si = getStatusInfo(o.status);
  const visible = o.visibleToCustomer !== false;
  const total = o.totalPrice ? `$${parseFloat(o.totalPrice).toFixed(2)}` : '—';
  const indentClass = opts.grouped ? ' order-group-item' : '';
  const archivedClass = o.archived ? ' order-archived' : '';
  return `<div class="order-row${indentClass}${archivedClass}" onclick="openOrderModal('${o.id}')">
    <div class="order-row-main">
      <div class="order-id">${o.id}</div>
      <div class="order-customer">
        ${opts.grouped
          ? `<span class="order-name order-group-item-product">${o.product || '—'}</span>`
          : `<span class="order-name">${o.customerName || '—'}</span>
             <span class="order-email">${o.customerEmail || ''}</span>`}
      </div>
      <div class="order-product">${
        o.decorationGroups && o.decorationGroups.length
          ? o.decorationGroups.flatMap(g => g.items || []).map(it => it.productName).filter(Boolean).join(', ') || '—'
          : (o.product || '—')
      }</div>
      <div class="order-qty">${o.totalQty || 0} pcs</div>
      <div class="order-total">${total}</div>
      <div class="order-date">${formatDate(o.createdAt)}</div>
      <div class="order-status-badge" style="background:${si.color}20;color:${si.color};border:1px solid ${si.color}40">${si.label}</div>
      <div class="order-visibility ${visible ? 'visible' : 'hidden'}" title="${visible ? 'Visible to customer' : 'Hidden from customer'}" onclick="event.stopPropagation();toggleOrderVisibility('${o.id}')">
        ${visible
          ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
          : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        }
      </div>
    </div>
  </div>`;
}

function buildGroupHeaderRow(groupId, orders) {
  const displayStatus = getGroupDisplayStatus(orders);
  const si = getStatusInfo(displayStatus);
  const totalQty = orders.reduce((s, o) => s + (o.totalQty || 0), 0);
  const totalPrice = orders.reduce((s, o) => s + (parseFloat(o.totalPrice) || 0), 0);
  const totalStr = totalPrice > 0 ? `$${totalPrice.toFixed(2)}` : '—';
  const customer = orders[0].customerName || orders[0].customerEmail || '—';
  return `<div class="order-group-header">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
    <span class="order-group-id">${groupId}</span>
    <span class="order-group-customer">${customer}</span>
    <span class="order-group-meta">${orders.length} items · ${totalQty} pcs · ${totalStr}</span>
    <div class="order-status-badge" style="background:${si.color}20;color:${si.color};border:1px solid ${si.color}40;margin-left:auto">${si.label}</div>
  </div>`;
}

function filterOrders() {
  const filter = document.getElementById('orders-status-filter')?.value || 'all';
  const list = document.getElementById('orders-list');
  if (!list) return;

  // Archived view shows only archived; normal view excludes archived
  let pool = showingArchived
    ? ordersData.filter(o => o.archived === true)
    : ordersData.filter(o => !o.archived);

  const filtered = filter === 'all' ? pool : pool.filter(o => o.status === filter);

  if (!filtered.length) {
    list.innerHTML = `<div class="orders-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <p>${showingArchived ? 'No archived orders' : 'No orders found'}</p>
    </div>`;
    return;
  }

  const items = groupOrdersForDisplay(filtered);
  list.innerHTML = items.map(item => {
    if (item.type === 'single') return buildOrderRow(item.order);
    return `<div class="order-group-container">
      ${buildGroupHeaderRow(item.groupId, item.orders)}
      ${item.orders.map(o => buildOrderRow(o, { grouped: true })).join('')}
    </div>`;
  }).join('');
}

function toggleOrderVisibility(id) {
  const orders = getOrders();
  const o = orders.find(x => x.id === id);
  if (!o) return;
  updateOrder(id, { visibleToCustomer: o.visibleToCustomer === false ? true : false });
  ordersData = getOrders();
  if (ordersViewMode === 'kanban') renderKanbanBoard();
  else filterOrders();
  toast(o.visibleToCustomer === false ? 'Order visible to customer' : 'Order hidden from customer');
}

function openOrderModal(id) {
  const orders = getOrders();
  const o = orders.find(x => x.id === id);
  if (!o) return;

  const si = getStatusInfo(o.status);
  const visible = o.visibleToCustomer !== false;
  const total = o.totalPrice ? `$${parseFloat(o.totalPrice).toFixed(2)}` : '—';
  const ppp = o.pricePerPiece ? `$${parseFloat(o.pricePerPiece).toFixed(2)}` : '—';

  const qtyRows = Object.entries(o.quantities || {})
    .filter(([,v]) => v > 0)
    .map(([size, qty]) => `<span class="qty-pill">${size}: ${qty}</span>`).join('');

  document.getElementById('order-modal-title').textContent = `Order ${o.id}`;
  document.getElementById('order-modal-subtitle').textContent = o.customerName || '';
  // Show "Public Review Link" button for orders that are out for approval (or any stage)
  const reviewBtn = document.getElementById('order-review-link-btn');
  reviewBtn.style.display = 'flex';
  reviewBtn.onclick = () => copyApprovalLink(o.id);
  // Build decoration groups section for manual orders
  const hasGroups = o.decorationGroups && o.decorationGroups.length;
  const SIZE_ORDER_MODAL = ['XS','S','M','L','XL','2XL','3XL','4XL','5XL'];
  const groupsSection = hasGroups ? (() => {
    const allSizes = SIZE_ORDER_MODAL.filter(sz =>
      o.decorationGroups.some(g => (g.items || []).some(it => (it.quantities || {})[sz] > 0))
    );
    return o.decorationGroups.map((g, gi) => {
      const decos = g.decos && g.decos.length ? g.decos
        : (g.decorationTypes || []).map((type, i) => ({ type, location: Object.values(g.locations || {})[i] || '' }));
      const decoText = decos.map(d => (d.type || '') + (d.location ? ' · ' + d.location : '')).join(', ') || '—';
      const groupPpp = parseFloat(g.pricePerPiece) || 0;
      const orderPpp = parseFloat(o.pricePerPiece) || 0;
      const itemRows = (g.items || []).map(item => {
        const sizeCells = allSizes.map(sz => {
          const q = (item.quantities || {})[sz];
          return `<td class="odg-sz">${q > 0 ? q : ''}</td>`;
        }).join('');
        const thumb = item.mockup
          ? `<img src="${item.mockup}" class="odg-item-photo" onclick="openPhotoLightbox(this.src)" title="Click to enlarge">`
          : '';
        const itemPpp = parseFloat(item.pricePerPiece) || groupPpp || orderPpp;
        const lineTotal = itemPpp && item.totalQty ? '$' + (itemPpp * item.totalQty).toFixed(2) : '—';
        return `<tr>
          <td class="odg-product"><div class="odg-product-cell">${thumb}<span>${item.productName || '—'}</span></div></td>
          <td class="odg-color"><span class="color-dot" style="background:${item.colorHex || '#888'}"></span>${item.color || '—'}</td>
          ${sizeCells}
          <td class="odg-qty">${item.totalQty || 0}</td>
          <td class="odg-ppp">${itemPpp ? '$' + itemPpp.toFixed(2) : '—'}</td>
          <td class="odg-ltotal">${lineTotal}</td>
        </tr>`;
      }).join('');
      const sizeHeads = allSizes.map(sz => `<th class="odg-sz">${sz}</th>`).join('');
      return `<div class="od-group-block od-group-c${gi % 5}">
        <div class="od-group-header">
          <span class="od-group-label">Group ${gi + 1}</span>
          <span class="od-group-deco">${decoText}</span>
        </div>
        <table class="odg-table">
          <thead><tr>
            <th class="odg-product">Product</th>
            <th class="odg-color">Color</th>
            ${sizeHeads}
            <th class="odg-qty">Qty</th>
            <th class="odg-ppp">Price/Pc</th>
            <th class="odg-ltotal">Total</th>
          </tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>`;
    }).join('');
  })() : '';

  document.getElementById('order-modal-body').innerHTML = `
    <div class="order-detail-grid">
      <div class="order-detail-col">
        <div class="od-section-title">Customer</div>
        <div class="od-field"><span class="od-label">Name</span><span>${o.customerName || '—'}</span></div>
        <div class="od-field"><span class="od-label">Email</span><span>${o.customerEmail || '—'}</span></div>
        <div class="od-field"><span class="od-label">Phone</span><span>${o.customerPhone || '—'}</span></div>
        <div class="od-field"><span class="od-label">Company</span><span>${o.customerCompany || '—'}</span></div>
      </div>
      <div class="order-detail-col">
        <div class="od-section-title">Order Info</div>
        ${!hasGroups ? `
        <div class="od-field"><span class="od-label">Product</span><span>${o.product || '—'}</span></div>
        <div class="od-field"><span class="od-label">Color</span><span>${o.color ? `<span class="color-dot" style="background:${o.colorHex || '#888'}"></span>${o.color}` : '—'}</span></div>
        <div class="od-field"><span class="od-label">Decoration</span><span>${o.decorationType || '—'}</span></div>
        <div class="od-field"><span class="od-label">Location</span><span>${o.decorationLocation || '—'}</span></div>
        <div class="od-field"><span class="od-label">Artwork</span><span>${o.artworkName || '—'}</span></div>` : ''}
        <div class="od-field"><span class="od-label">Quantities</span><span class="qty-pills">${qtyRows || '—'}</span></div>
        <div class="od-field"><span class="od-label">Total Qty</span><span>${o.totalQty || 0} pcs</span></div>
        <div class="od-field"><span class="od-label">Price/Piece</span><span>${ppp}</span></div>
        <div class="od-field"><span class="od-label">Total</span><span style="font-weight:700;color:#00c896">${total}</span></div>
        <div class="od-field"><span class="od-label">Created</span><span>${formatDate(o.createdAt)}</span></div>
      </div>
    </div>
    ${hasGroups ? `
    <div class="od-pricing-section">
      <div class="od-section-title">Pricing</div>
      <div class="od-pricing-rows" id="od-pricing-rows">
        ${o.decorationGroups.map((g, gi) => {
          const decos = g.decos && g.decos.length ? g.decos
            : (g.decorationTypes || []).map((type, i) => ({ type, location: Object.values(g.locations || {})[i] || '' }));
          const decoText = decos.map(d => d.type + (d.location ? ' · ' + d.location : '')).join(', ') || '—';
          const gPpp = g.pricePerPiece || (g.items && g.items[0] && g.items[0].pricePerPiece) || '';
          const gQty = g.totalQty || (g.items || []).reduce((s, it) => s + (it.totalQty || 0), 0);
          const gTotal = gPpp && gQty ? '$' + (gPpp * gQty).toFixed(2) : '';
          return `<div class="od-pricing-row">
            <div class="od-pricing-group-label">
              <span class="od-pricing-group-num">Group ${gi + 1}</span>
              <span class="od-pricing-group-deco">${decoText}</span>
              <span class="od-pricing-group-qty">${gQty} pcs</span>
            </div>
            <div class="od-pricing-inputs">
              <div class="od-pricing-field">
                <label class="od-pricing-field-label">Price / pc</label>
                <input type="number" min="0" step="0.01" class="a-input od-pricing-inp"
                  placeholder="0.00"
                  value="${gPpp || ''}"
                  data-gi="${gi}"
                  oninput="odPricingCalc(this)">
              </div>
              <div class="od-pricing-field">
                <label class="od-pricing-field-label">Line Total</label>
                <div class="od-pricing-total" id="od-prow-total-${gi}">${gTotal || '—'}</div>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="od-pricing-summary">
        <div class="od-pricing-grand">
          <span class="od-pricing-grand-label">Order Total</span>
          <span class="od-pricing-grand-val" id="od-pricing-grand-val">${o.totalPrice ? '$' + parseFloat(o.totalPrice).toFixed(2) : '—'}</span>
        </div>
        <button type="button" class="a-btn a-btn-primary" onclick="savePricingSection('${o.id}')">Save Prices</button>
      </div>
    </div>
    <div class="od-section-title" style="margin-bottom:8px">Products &amp; Decorations</div>${groupsSection}` : ''}

    ${o.declineReason ? `
    <div class="od-decline-banner">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <div>
        <div class="od-decline-title">Customer Declined — Changes Requested</div>
        <div class="od-decline-reason">${o.declineReason}</div>
      </div>
    </div>` : ''}
    ${o.notes ? `<div class="od-notes-block"><div class="od-section-title">Customer Notes</div><p>${o.notes}</p></div>` : ''}

    <div class="od-mockups-section">
      <div class="od-mockups-header">
        <div class="od-section-title" style="margin:0">Mockups</div>
        <label class="a-btn a-btn-ghost a-btn-sm" style="cursor:pointer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Upload Mockup
          <input type="file" accept="image/*" multiple style="display:none" onchange="uploadOrderMockup('${o.id}', this)">
        </label>
      </div>
      <div id="od-mockups-list"></div>
    </div>

    <div class="od-payment-section">
      <div class="od-payment-header">
        <div class="od-payment-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          Payment
        </div>
        ${o.isPaid
          ? `<span class="od-payment-status-paid">&#10003; Paid</span>`
          : o.paymentRequestSentAt
            ? `<span class="od-payment-status-sent">Invoice Sent</span>`
            : `<span class="od-payment-status-pending">Not Sent</span>`}
      </div>
      <div class="od-payment-link-row">
        <input type="url" class="a-input" id="od-payment-link" placeholder="Paste Stripe payment link here…" value="${o.stripePaymentLinkUrl || ''}">
        ${o.stripePaymentLinkUrl ? `<button type="button" class="od-payment-copy-btn" onclick="copyPaymentLink('${o.id}')">Copy</button>` : ''}
      </div>
      <div class="od-payment-actions">
        <button type="button" class="a-btn a-btn-primary a-btn-sm" onclick="savePaymentLink('${o.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Save Link
        </button>
        ${o.stripePaymentLinkUrl && !o.isPaid ? `
        <button type="button" class="a-btn a-btn-ghost a-btn-sm" onclick="markPaymentRequestSent('${o.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          ${o.paymentRequestSentAt ? 'Re-send Notification' : 'Mark Request Sent'}
        </button>` : ''}
        ${o.paymentRequestSentAt && !o.isPaid ? `
        <span class="od-payment-sent-info">Sent ${formatDate(o.paymentRequestSentAt)}</span>` : ''}
        ${o.isPaid && o.paidAt ? `
        <span class="od-payment-sent-info" style="color:#00c896">Paid ${formatDate(o.paidAt)}</span>` : ''}
      </div>
    </div>

    <div class="od-edit-section">
      <div class="form-row" style="margin-bottom:16px">
        <div class="a-form-group">
          <label class="a-label">Status</label>
          <select class="a-select" id="od-status-select">
            ${ORDER_STATUSES.map(s => `<option value="${s.id}" ${s.id === o.status ? 'selected' : ''}>${s.label}</option>`).join('')}
          </select>
        </div>
        <div class="a-form-group">
          <label class="a-label">Tracking Number</label>
          <input class="a-input" id="od-tracking" value="${o.trackingNumber || ''}" placeholder="1Z9999...">
        </div>
      </div>
      <div class="form-row" style="margin-bottom:16px">
        <div class="a-form-group">
          <label class="a-label">In-Hand Date <span style="color:#555;font-weight:400">(optional)</span></label>
          <div class="date-pick-wrap">
            <input class="a-input" type="date" id="od-inhand-date" value="${o.inHandDate || ''}" style="max-width:160px">
            <button type="button" class="date-pick-btn" onclick="openCalPicker('od-inhand-date',this)" title="Pick a date">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </button>
          </div>
          <span class="a-hint">Leave blank for standard production.</span>
        </div>
        <div class="a-form-group" style="justify-content:flex-end;padding-top:28px">
          <label class="toggle-label">
            <input type="checkbox" id="od-is-hard-deadline" ${o.isHardDeadline ? 'checked' : ''}>
            <span class="toggle-track"></span>
            <span style="font-size:13px;color:#aaa">Hard deadline</span>
          </label>
        </div>
      </div>
      <div class="a-form-group" style="margin-bottom:16px">
        <label class="a-label">Customer Note <span style="color:#666;font-weight:400">(shown in portal)</span></label>
        <textarea class="a-input a-textarea" id="od-customer-note" placeholder="Message visible to customer in their portal...">${o.customerNote || ''}</textarea>
      </div>
      <div class="a-form-group" style="margin-bottom:20px">
        <label class="a-label">Internal Notes <span style="color:#666;font-weight:400">(admin only)</span></label>
        <textarea class="a-input a-textarea" id="od-status-notes" placeholder="Internal notes not visible to customer...">${o.statusNotes || ''}</textarea>
      </div>
      <div class="od-toggles-row">
        <label class="toggle-label">
          <input type="checkbox" id="od-visible" ${visible ? 'checked' : ''} onchange="previewVisToggle()">
          <span class="toggle-track"></span>
          <span id="od-vis-text" style="font-size:13px;color:#aaa">${visible ? 'Visible in portal' : 'Hidden from portal'}</span>
        </label>
        <label class="toggle-label">
          <input type="checkbox" id="od-customer-supplied" ${o.customerSuppliedBlanks ? 'checked' : ''}>
          <span class="toggle-track"></span>
          <span style="font-size:13px;color:#aaa">Customer supplied blanks</span>
        </label>
        <label class="toggle-label">
          <input type="checkbox" id="od-is-paid" ${o.isPaid ? 'checked' : ''}>
          <span class="toggle-track"></span>
          <span style="font-size:13px;color:#aaa">Payment received</span>
        </label>
        ${o.salesRepName ? `<div style="font-size:12px;color:var(--text-muted);margin-top:6px">Sales Rep: <strong style="color:var(--text)">${o.salesRepName}</strong></div>` : ''}
      </div>
      <div class="od-edit-footer">
        <div style="display:flex;gap:8px">
          ${!o.archived ? `
          <button class="a-btn a-btn-ghost a-btn-sm" onclick="pushToProduction('${o.id}')" title="Manually add this order to the Production Board">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
            Send to Production
          </button>` : ''}
          <button class="a-btn a-btn-ghost a-btn-sm ${o.archived ? 'a-btn-restore' : 'a-btn-archive'}" onclick="${o.archived ? `restoreOrder('${o.id}')` : `archiveOrder('${o.id}')`}">
            ${o.archived
              ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg> Restore Order`
              : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg> Archive`
            }
          </button>
        </div>
        <div style="display:flex;gap:10px">
          <button class="a-btn a-btn-ghost" onclick="downloadOrderPDF('${o.id}')" title="Download as PDF">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
            Download PDF
          </button>
          <button class="a-btn a-btn-ghost" onclick="openEditOrderModal('${o.id}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit Order
          </button>
          <button class="a-btn a-btn-ghost" onclick="closeOrderModal()">Cancel</button>
          <button class="a-btn a-btn-primary" onclick="saveOrderChanges('${o.id}')">Save Changes</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('order-modal-overlay').classList.add('open');
  _renderOrderMockups(o.id);
}

function downloadOrderPDF(id) {
  const orders = getOrders();
  const o = orders.find(x => x.id === id);
  if (!o) return;

  // ── Helpers ──────────────────────────────────────────────────────────────
  var fmt      = function(v) { return v || '—'; };
  var fmtMoney = function(v) { return (v != null && v !== '') ? '$' + parseFloat(v).toFixed(2) : '$0.00'; };
  var fmtDate  = function(v) { return v ? new Date(v).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }) : '—'; };
  var SIZE_ORDER = ['XS','S','M','L','XL','2XL','3XL','4XL','5XL'];

  // ── Artwork map ───────────────────────────────────────────────────────────
  var artworkMap = {};
  (o.artworkName || '').split('|').forEach(function(part) {
    var i = part.indexOf(':');
    if (i > -1) artworkMap[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  });
  var artworkForLoc = function(loc) { return artworkMap[(loc || '').toLowerCase()] || o.artworkName || ''; };

  // ── Build render groups ───────────────────────────────────────────────────
  var renderGroups;
  if (o.decorationGroups && o.decorationGroups.length) {
    renderGroups = o.decorationGroups.map(function(g) {
      var decos = g.decos && g.decos.length ? g.decos
        : (g.decorationTypes || []).map(function(type, i) {
            return { type: type, typeLabel: type, location: Object.values(g.locations || {})[i] || '' };
          });
      return { items: g.items || [], decos: decos };
    });
  } else {
    var orderDecos = o.decorations && o.decorations.length ? o.decorations
      : o.decorationType
        ? [{ type: o.decorationType, typeLabel: o.decorationType,
             locations: (o.decorationLocation || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean) }]
        : [];
    renderGroups = [{ items: [{
      productId: '',
      productName: o.product || '—',
      color: o.color || '—',
      colorHex: o.colorHex || '',
      quantities: o.quantities || {},
      totalQty: o.totalQty || 0,
      pricePerPiece: o.pricePerPiece,
      totalPrice: o.totalPrice,
      mockup: (o.mockups || [])[0] ? (o.mockups[0].imageData || null) : null,
    }], decos: orderDecos }];
  }

  // ── Sizes used across all items ───────────────────────────────────────────
  var usedSizes = SIZE_ORDER.filter(function(sz) {
    return renderGroups.some(function(g) {
      return g.items.some(function(it) { return (it.quantities || {})[sz] > 0; });
    });
  });

  // ── Totals ────────────────────────────────────────────────────────────────
  var totalQty = renderGroups.reduce(function(s, g) {
    return s + g.items.reduce(function(ss, it) { return ss + (it.totalQty || 0); }, 0);
  }, 0);
  var itemTotal = parseFloat(o.totalPrice) || 0;

  var si      = getStatusInfo(o.status);

  // ── Build groups HTML ─────────────────────────────────────────────────────
  var imprintCount = 0;
  var sizeHeadCells = usedSizes.map(function(sz) { return '<th class="tsz">' + sz + '</th>'; }).join('');
  var colSpan = 4 + usedSizes.length + 4;

  var groupsHtml = renderGroups.map(function(group) {
    var itemRowsHtml = group.items.map(function(item) {
      var sizeCells = usedSizes.map(function(sz) {
        var q = (item.quantities || {})[sz];
        return '<td class="tsz">' + (q > 0 ? q : '') + '</td>';
      }).join('');
      var thumbHtml = item.mockup
        ? '<tr><td colspan="' + colSpan + '" style="padding:4px 10px 10px"><img src="' + item.mockup + '" style="max-width:80px;max-height:80px;border:1px solid #eee;border-radius:4px"></td></tr>'
        : '';
      return '<tr class="irow">'
        + '<td class="tcat"></td>'
        + '<td class="tnum">' + (item.productId || '') + '</td>'
        + '<td class="tcolor">' + fmt(item.color) + '</td>'
        + '<td class="tdesc">' + fmt(item.productName) + '</td>'
        + sizeCells
        + '<td class="tqty">' + (item.totalQty || 0) + '</td>'
        + '<td class="titems">' + (item.totalQty || 0) + '</td>'
        + '<td class="tprice">' + (item.pricePerPiece ? '$' + parseFloat(item.pricePerPiece).toFixed(2) : '—') + '</td>'
        + '<td class="ttotal">' + (item.totalPrice ? '$' + parseFloat(item.totalPrice).toFixed(2) : '—') + '</td>'
        + '</tr>' + thumbHtml;
    }).join('');

    var imprintBoxesHtml = (group.decos || []).map(function(d) {
      imprintCount++;
      var typeLabel = d.typeLabel || d.type || '—';
      var locs = Array.isArray(d.locations) ? d.locations.join(', ') : (d.location || '—');
      var artHtml = '';
      var locArr = Array.isArray(d.locations) ? d.locations : (d.location ? [d.location] : []);
      locArr.forEach(function(loc) {
        var art = artworkForLoc(loc);
        if (art) artHtml += '<div class="imp-art">Artwork (' + loc + '): ' + art + '</div>';
      });
      return '<div class="imprint-box">'
        + '<div class="imp-id">IMPRINT #' + o.id + '-' + imprintCount + '</div>'
        + '<div class="imp-name">' + typeLabel + (locs !== '—' ? ' &middot; ' + locs : '') + '</div>'
        + '<div class="imp-row">Imprint: ' + typeLabel + '</div>'
        + '<div class="imp-row">Location: ' + locs + '</div>'
        + artHtml
        + '</div>';
    }).join('');

    return '<div class="group-block">'
      + '<table class="itable">'
      + '<thead><tr>'
      + '<th class="thcat">Category</th><th class="thnum">Item #</th>'
      + '<th class="thcolor">Color</th><th class="thdesc">Description</th>'
      + sizeHeadCells
      + '<th class="thqty">Quantity</th><th class="thitems">Items</th>'
      + '<th class="thprice">Price</th><th class="thtotal">Total</th>'
      + '</tr></thead>'
      + '<tbody>' + itemRowsHtml + '</tbody>'
      + '</table>'
      + (imprintBoxesHtml ? '<div class="imprint-row">' + imprintBoxesHtml + '</div>' : '')
      + '</div>';
  }).join('');

  // ── Order-level mockups ───────────────────────────────────────────────────
  var mockupsHtml = '';
  var orderMockups = (o.mockups || []).filter(function(m) { return m.imageData; });
  if (orderMockups.length && !renderGroups.some(function(g) { return g.items.some(function(it) { return it.mockup; }); })) {
    mockupsHtml = '<div class="sec-title">Mockups</div><div class="mockup-row">'
      + orderMockups.map(function(m) {
          return '<div class="mockup-block"><img src="' + m.imageData + '" alt=""><div>' + (m.label || '') + '</div></div>';
        }).join('')
      + '</div>';
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  var notesHtml = '';
  if (o.notes) notesHtml += '<div class="sec-title">Customer Notes</div><div class="notes-box">' + o.notes + '</div>';
  if (o.customerNote) notesHtml += '<div class="sec-title">Note to Customer</div><div class="notes-box">' + o.customerNote + '</div>';

  // ── Dates row ─────────────────────────────────────────────────────────────
  var datesRowHtml = '';
  if (o.inHandDate) datesRowHtml += '<div><strong>In-Hand Date:</strong> ' + fmtDate(o.inHandDate) + (o.isHardDeadline ? ' <span style="color:#e55">&#9888; Hard deadline</span>' : '') + '</div>';
  if (o.trackingNumber) datesRowHtml += '<div><strong>Tracking:</strong> ' + o.trackingNumber + '</div>';
  if (o.isPaid) datesRowHtml += '<div style="color:#00a87e;font-weight:700">Payment Received &#10003;</div>';

  // ── CSS ───────────────────────────────────────────────────────────────────
  var css = [
    '* { box-sizing: border-box; margin: 0; padding: 0; }',
    'body { font-family: -apple-system, Helvetica Neue, Arial, sans-serif; font-size: 12px; color: #222; background: #eee; }',
    'a { color: #00a87e; text-decoration: none; }',
    '.noprint { display: flex; justify-content: flex-end; gap: 8px; padding: 10px 16px; background: #fff; border-bottom: 1px solid #ddd; position: sticky; top: 0; z-index: 9; }',
    '.noprint button { padding: 6px 14px; border-radius: 5px; border: 1px solid #ccc; background: #fff; font-size: 12px; font-weight: 600; cursor: pointer; }',
    '.noprint .btn-p { background: #222; color: #fff; border-color: #222; }',
    '.page { background: #fff; max-width: 980px; margin: 20px auto; padding: 40px 44px; border-radius: 4px; }',
    '.inv-hdr { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }',
    '.inv-num { font-size: 26px; font-weight: 900; }',
    '.inv-co { font-size: 13px; color: #666; margin-top: 4px; }',
    '.paid-badge { border: 2px solid #d33; color: #d33; font-weight: 800; font-size: 12px; letter-spacing: .06em; padding: 2px 10px; border-radius: 3px; display: inline-block; }',
    '.thankyou { font-size: 11px; color: #aaa; margin-top: 5px; font-style: italic; }',
    '.co-block { display: grid; grid-template-columns: 76px 1fr 260px; gap: 20px; border: 1px solid #e0e0e0; border-radius: 6px; padding: 18px 20px; margin-bottom: 20px; align-items: start; }',
    '.logo-box { width: 68px; height: 68px; background: #111; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #00c896; font-size: 20px; font-weight: 900; }',
    '.co-info { font-size: 12px; line-height: 1.85; }',
    '.co-info strong { font-size: 13px; display: block; }',
    '.dt-table { width: 100%; border-collapse: collapse; font-size: 12px; }',
    '.dt-table td { padding: 4px 6px; border-bottom: 1px solid #f0f0f0; }',
    '.dt-table td:first-child { color: #888; font-weight: 500; text-align: right; white-space: nowrap; }',
    '.dt-table td:last-child { font-weight: 600; text-align: right; }',
    '.dt-table tr:last-child td { border-bottom: none; }',
    '.cu-block { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }',
    '.cu-title { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: #999; margin-bottom: 7px; }',
    '.cu-col { font-size: 12px; line-height: 1.8; }',
    '.group-block { border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; margin-bottom: 20px; }',
    '.itable { width: 100%; border-collapse: collapse; font-size: 11.5px; }',
    '.itable thead tr { background: #f7f7f7; }',
    '.itable th { padding: 7px 6px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #888; border-bottom: 2px solid #e8e8e8; white-space: nowrap; }',
    '.itable td { padding: 7px 6px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }',
    '.tsz { text-align: center; width: 32px; }',
    '.tqty,.titems { text-align: center; width: 58px; font-weight: 600; }',
    '.tprice,.ttotal { text-align: right; width: 68px; white-space: nowrap; }',
    '.ttotal { font-weight: 700; }',
    '.imprint-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px; background: #f9f9f9; border-top: 1px solid #eee; }',
    '.imprint-box { background: #fff; border: 1px solid #ddd; border-radius: 5px; padding: 9px 13px; min-width: 160px; font-size: 11px; }',
    '.imp-id { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .07em; color: #bbb; margin-bottom: 3px; }',
    '.imp-name { font-weight: 700; font-size: 12px; margin-bottom: 4px; }',
    '.imp-row { color: #555; line-height: 1.65; }',
    '.imp-art { color: #777; line-height: 1.65; font-style: italic; }',
    '.mockup-row { display: flex; flex-wrap: wrap; gap: 14px; margin: 8px 0 16px; }',
    '.mockup-block { text-align: center; font-size: 10px; color: #888; }',
    '.mockup-block img { max-width: 120px; max-height: 120px; border: 1px solid #ddd; border-radius: 4px; display: block; margin-bottom: 4px; }',
    '.sec-title { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: #aaa; margin: 14px 0 5px; }',
    '.notes-box { background: #f9f9f9; border-left: 3px solid #00a87e; padding: 8px 12px; border-radius: 3px; font-size: 12px; line-height: 1.5; margin-bottom: 10px; }',
    '.dates-row { display: flex; flex-wrap: wrap; gap: 20px; font-size: 12px; margin-bottom: 20px; }',
    '.tot-block { display: flex; justify-content: flex-end; margin-bottom: 20px; }',
    '.tot-table { width: 280px; border-collapse: collapse; font-size: 12px; }',
    '.tot-table td { padding: 5px 8px; border-bottom: 1px solid #f0f0f0; }',
    '.tot-table td:first-child { color: #666; }',
    '.tot-table td:last-child { text-align: right; font-weight: 600; }',
    '.tot-due td { font-size: 14px; font-weight: 800; border-top: 2px solid #222; border-bottom: none; padding-top: 8px; }',
    '.tot-out td:last-child { color: ' + (o.isPaid ? '#00a87e' : '#d33') + '; font-weight: 700; }',
    '.pay-block { border-top: 1px solid #eee; padding-top: 14px; }',
    '.pay-title { font-size: 14px; font-weight: 700; margin-bottom: 10px; }',
    '.pay-row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #f5f5f5; }',
    '.pay-amt { font-size: 16px; font-weight: 800; color: #00a87e; }',
    '.pay-date { font-size: 12px; color: #888; }',
    '@media print { .noprint { display: none; } body { background: #fff; } .page { margin: 0; padding: 16mm; max-width: 100%; border-radius: 0; } @page { margin: 0; size: A4; } }'
  ].join('\n');

  // ── Assemble final HTML ───────────────────────────────────────────────────
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">'
    + '<title>Invoice #' + o.id + ' \u2014 Insignia Screen Printing</title>'
    + '<style>' + css + '</style></head><body>'

    + '<div class="noprint">'
    + '<button onclick="window.print()">Print</button>'
    + '<button class="btn-p" onclick="window.print()">Download PDF</button>'
    + '</div>'

    + '<div class="page">'

    + '<div class="inv-hdr">'
    + '<div><div class="inv-num">Invoice #' + o.id + '</div>'
    + '<div class="inv-co">' + fmt(o.customerCompany || o.customerName) + '</div></div>'
    + '<div style="text-align:right">'
    + (o.isPaid ? '<div class="paid-badge">PAID</div><div class="thankyou">Thank you for your business!</div>' : '')
    + '</div></div>'

    + '<div class="co-block">'
    + '<div class="logo-box">ISP</div>'
    + '<div class="co-info"><strong>Insignia Screen Printing</strong>'
    + '61297 390th Ave<br>Zumbro Falls, Minnesota 55991<br>'
    + '507-900-1812<br>'
    + '<a href="https://www.ispclothing.com">https://www.ispclothing.com</a><br>'
    + 'blake@insigniascreenprinting.com</div>'
    + '<table class="dt-table">'
    + '<tr><td>Created</td><td>' + fmtDate(o.createdAt) + '</td></tr>'
    + '<tr><td>Customer Due Date</td><td>' + fmtDate(o.inHandDate) + '</td></tr>'
    + '<tr><td>Invoice Date</td><td>' + fmtDate(o.createdAt) + '</td></tr>'
    + '<tr><td>Payment Due Date</td><td>' + fmtDate(o.inHandDate || o.createdAt) + '</td></tr>'
    + '<tr><td>Total</td><td>' + fmtMoney(itemTotal) + '</td></tr>'
    + '<tr><td>Amount Outstanding</td><td>' + fmtMoney(o.isPaid ? 0 : itemTotal) + '</td></tr>'
    + '</table></div>'

    + '<div class="cu-block">'
    + '<div class="cu-col"><div class="cu-title">Customer Billing</div>'
    + (o.customerCompany ? '<div>' + o.customerCompany + '</div>' : '')
    + '<div>' + fmt(o.customerName) + '</div>'
    + (o.customerPhone ? '<div>' + o.customerPhone + '</div>' : '')
    + (o.customerEmail ? '<div><a href="mailto:' + o.customerEmail + '">' + o.customerEmail + '</a></div>' : '')
    + '</div>'
    + '<div class="cu-col"><div class="cu-title">Customer Shipping</div>'
    + (o.customerCompany ? '<div>' + o.customerCompany + '</div>' : '')
    + '<div>' + fmt(o.customerName) + '</div>'
    + (o.salesRepName ? '<div style="margin-top:5px;color:#888;font-size:11px">Sales Rep: <strong style="color:#222">' + o.salesRepName + '</strong></div>' : '')
    + '</div></div>'

    + groupsHtml
    + mockupsHtml
    + notesHtml

    + (datesRowHtml ? '<div class="dates-row">' + datesRowHtml + '</div>' : '')

    + '<div class="tot-block"><table class="tot-table">'
    + '<tr><td>Total Quantity</td><td>' + totalQty + '</td></tr>'
    + '<tr><td>Item Total</td><td>' + fmtMoney(itemTotal) + '</td></tr>'
    + '<tr><td>Fees Total</td><td>$0.00</td></tr>'
    + '<tr><td>Sub Total</td><td>' + fmtMoney(itemTotal) + '</td></tr>'
    + '<tr><td>Tax</td><td>$0.00</td></tr>'
    + '<tr class="tot-due"><td>Total Due</td><td>' + fmtMoney(itemTotal) + '</td></tr>'
    + (o.isPaid ? '<tr><td>Paid</td><td>' + fmtMoney(itemTotal) + '</td></tr>' : '')
    + '<tr class="tot-out"><td>Amount Outstanding</td><td>' + fmtMoney(o.isPaid ? 0 : itemTotal) + '</td></tr>'
    + '</table></div>'

    + (o.isPaid
        ? '<div class="pay-block"><div class="pay-title">Payments</div>'
          + '<div class="pay-row"><span class="pay-amt">' + fmtMoney(itemTotal) + '</span>'
          + '<span class="pay-date">' + fmtDate(o.updatedAt || o.createdAt) + '</span></div></div>'
        : '')

    + '</div></body></html>';

  var win = window.open('', '_blank', 'width=980,height=820');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(function() { win.print(); }, 700);
}

function previewVisToggle() {
  const cb = document.getElementById('od-visible');
  document.getElementById('od-vis-text').textContent = cb.checked ? 'Visible in portal' : 'Hidden from portal';
}

function saveOrderChanges(id) {
  const status = document.getElementById('od-status-select').value;
  if (status === 'approved') {
    const o = getOrders().find(x => x.id === id);
    if (o && !_isOrderApprovalComplete(o)) {
      toast('Customer must approve all mockups and quote before marking approved', 'error');
      return;
    }
  }
  const tracking = document.getElementById('od-tracking').value.trim();
  const customerNote = document.getElementById('od-customer-note').value.trim();
  const statusNotes = document.getElementById('od-status-notes').value.trim();
  const visible = document.getElementById('od-visible').checked;

  const inHandDate    = document.getElementById('od-inhand-date')?.value || null;
  const isHardDeadline = document.getElementById('od-is-hard-deadline')?.checked || false;
  const customerSuppliedBlanks = document.getElementById('od-customer-supplied')?.checked || false;
  const isPaid = document.getElementById('od-is-paid')?.checked || false;

  const prevOrder = getOrders().find(o => o.id === id);

  updateOrder(id, { status, trackingNumber: tracking, customerNote, statusNotes, visibleToCustomer: visible,
    customerSuppliedBlanks, inHandDate, isHardDeadline, isPaid,
    approvedAt: status === 'approved' ? (prevOrder?.approvedAt || new Date().toISOString()) : undefined,
  });

  // Auto-create production job when approved, then move kanban to Pre-Production
  if (status === 'approved') {
    const updatedOrder = getOrders().find(o => o.id === id);
    if (updatedOrder) {
      ensureProductionJob(updatedOrder);
      updateOrder(id, { status: 'pre-production' });
    }
  }

  // Sync due date to existing production job if present
  const existingJob = getProductionJobs().find(j => j.orderId === id);
  if (existingJob) updateProductionJob(id, { inHandDate, isHardDeadline });
  // Trigger commission earned when order is paid + done
  if (isPaid && status === 'done' && prevOrder && !prevOrder.isPaid && prevOrder.salesRepId && canViewCommissions()) {
    markCommissionEarned(id).then(() => _refreshCommissionBadge()).catch(() => {});
  }

  closeOrderModal();
  ordersData = getOrders();
  if (ordersViewMode === 'kanban') renderKanbanBoard();
  else filterOrders();
  toast('Order updated');
}

function closeOrderModal() {
  document.getElementById('order-modal-overlay').classList.remove('open');
}

// ============================================
// PAYMENTS
// ============================================

function savePaymentLink(orderId) {
  const url = (document.getElementById('od-payment-link')?.value || '').trim();
  updateOrder(orderId, { stripePaymentLinkUrl: url || null });
  openOrderModal(orderId); // re-render to show copy/send buttons
  toast('Payment link saved', 'success');
}

function copyPaymentLink(orderId) {
  const o = getOrders().find(x => x.id === orderId);
  if (!o || !o.stripePaymentLinkUrl) return;
  navigator.clipboard.writeText(o.stripePaymentLinkUrl).then(() => toast('Link copied')).catch(() => {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = o.stripePaymentLinkUrl;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('Link copied');
  });
}

function markPaymentRequestSent(orderId) {
  updateOrder(orderId, { paymentRequestSentAt: new Date().toISOString() });
  openOrderModal(orderId);
  toast('Payment request marked as sent', 'success');
  _refreshUnpaidBadge();
}

function markOrderPaidManual(orderId) {
  const o = getOrders().find(x => x.id === orderId);
  if (!o) return;
  // Toggle paid state
  const nowPaid = !o.isPaid;
  updateOrder(orderId, { isPaid: nowPaid, paidAt: nowPaid ? new Date().toISOString() : null });
  openOrderModal(orderId);
  toast(nowPaid ? 'Order marked as paid' : 'Payment mark removed', 'success');
  ordersData = getOrders();
  if (ordersViewMode === 'kanban') renderKanbanBoard();
  else filterOrders();
  _refreshUnpaidBadge();
}

let _payFilter = 'all';

function setPayFilter(filter, btn) {
  _payFilter = filter;
  document.querySelectorAll('.pay-filter-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderPaymentsSection();
}

function renderPaymentsSection() {
  const tbody = document.getElementById('pay-tbody');
  if (!tbody) return;

  let orders = getOrders().filter(o => !o.archived);

  if (_payFilter === 'paid') {
    orders = orders.filter(o => o.isPaid);
  } else if (_payFilter === 'sent') {
    orders = orders.filter(o => !o.isPaid && o.paymentRequestSentAt);
  } else if (_payFilter === 'unsent') {
    orders = orders.filter(o => !o.isPaid && !o.paymentRequestSentAt);
  } else if (_payFilter === 'unpaid') {
    orders = orders.filter(o => !o.isPaid && o.totalPrice);
  }

  // Sort: unpaid + has total first, then sent, then paid
  orders = [...orders].sort((a, b) => {
    const score = o => o.isPaid ? 2 : o.paymentRequestSentAt ? 1 : 0;
    return score(a) - score(b) || (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#444;font-size:13px">No orders match this filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => {
    const amount = o.totalPrice ? `<span class="pay-amount">$${parseFloat(o.totalPrice).toFixed(2)}</span>` : `<span class="pay-amount-empty">—</span>`;
    let badge = '';
    if (o.isPaid) {
      badge = `<span class="pay-badge pay-badge-paid">&#10003; Paid</span>`;
    } else if (o.paymentRequestSentAt) {
      badge = `<span class="pay-badge pay-badge-sent">Request Sent</span>`;
    } else {
      badge = `<span class="pay-badge pay-badge-unsent">Not Sent</span>`;
    }
    const sentDate = o.paymentRequestSentAt ? formatDate(o.paymentRequestSentAt) : '—';
    const paidDate = o.isPaid && o.paidAt ? formatDate(o.paidAt) : '';

    const copyBtn = o.stripePaymentLinkUrl
      ? `<button class="a-btn a-btn-ghost a-btn-sm" onclick="copyPaymentLink('${o.id}')" title="Copy payment link">
           <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
           Copy Link
         </button>`
      : '';
    const sentBtn = o.stripePaymentLinkUrl && !o.isPaid
      ? `<button class="a-btn a-btn-ghost a-btn-sm" onclick="markPaymentRequestSent('${o.id}');renderPaymentsSection()">
           <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
           ${o.paymentRequestSentAt ? 'Re-mark Sent' : 'Mark Sent'}
         </button>`
      : '';
    const paidBtn = !o.isPaid
      ? `<button class="a-btn a-btn-ghost a-btn-sm" style="color:var(--accent)" onclick="markOrderPaidManual('${o.id}');renderPaymentsSection()">
           <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
           Mark Paid
         </button>`
      : `<button class="a-btn a-btn-ghost a-btn-sm" style="color:#666" onclick="markOrderPaidManual('${o.id}');renderPaymentsSection()">Unmark Paid</button>`;

    return `<tr>
      <td>
        <div style="font-weight:700;font-size:13px">${o.id}</div>
        <div style="font-size:11px;color:#555;margin-top:1px">${getStatusInfo(o.status).label}</div>
      </td>
      <td>
        <div class="pay-customer">${o.customerName || '—'}</div>
        <div class="pay-email">${o.customerEmail || ''}</div>
        ${o.customerCompany ? `<div class="pay-email">${o.customerCompany}</div>` : ''}
      </td>
      <td>${amount}</td>
      <td>${badge}${paidDate ? `<div style="font-size:10px;color:#555;margin-top:3px">Paid ${paidDate}</div>` : ''}</td>
      <td style="color:#666;font-size:12px">${sentDate}</td>
      <td>
        <div class="pay-actions">
          <button class="a-btn a-btn-ghost a-btn-sm" onclick="openOrderModal('${o.id}')">View</button>
          ${copyBtn}
          ${sentBtn}
          ${paidBtn}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function _refreshUnpaidBadge() {
  const badge = document.getElementById('unpaid-badge');
  if (!badge) return;
  const count = getOrders().filter(o => !o.archived && !o.isPaid && o.totalPrice && o.paymentRequestSentAt).length;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

function saveGroupPriceInline(inp) {
  var ppp     = parseFloat(inp.value) || null;
  var orderId = inp.dataset.orderId;
  var groupId = inp.dataset.groupId;
  if (!orderId) return;
  var orders = getOrders();
  var idx    = orders.findIndex(function(o) { return o.id === orderId; });
  if (idx === -1) return;
  var order  = orders[idx];

  // Apply price to the matching decoration group and its items
  var groups = (order.decorationGroups || []).map(function(g, gi) {
    var match = g.id === groupId || String(gi) === String(groupId);
    if (!match) return g;
    var updatedItems = (g.items || []).map(function(item) {
      return Object.assign({}, item, {
        pricePerPiece: ppp,
        totalPrice:    ppp && item.totalQty ? parseFloat((ppp * item.totalQty).toFixed(2)) : null,
      });
    });
    return Object.assign({}, g, { pricePerPiece: ppp, items: updatedItems });
  });

  // Roll up order-level price
  var calcTotal = groups.reduce(function(s, g) {
    return s + (g.items || []).reduce(function(ss, it) { return ss + (it.totalPrice || 0); }, 0);
  }, 0);
  var totalQty = groups.reduce(function(s, g) { return s + (g.totalQty || 0); }, 0);
  var effectiveTotal = calcTotal > 0 ? parseFloat(calcTotal.toFixed(2)) : null;
  var effectivePpp   = effectiveTotal && totalQty
    ? parseFloat((effectiveTotal / totalQty).toFixed(2))
    : ppp;

  orders[idx] = Object.assign({}, order, {
    decorationGroups: groups,
    pricePerPiece:    effectivePpp,
    totalPrice:       effectiveTotal,
    updatedAt:        new Date().toISOString(),
  });

  saveOrders(orders);
  cloudSave('orders', orders);

  // Refresh the item rows in-place so prices appear without closing the modal
  openOrderModal(orderId);
}

// Live-update line total and grand total as user types in the pricing section
function odPricingCalc(inp) {
  var gi  = parseInt(inp.dataset.gi);
  var ppp = parseFloat(inp.value) || 0;
  // Find qty from sibling label
  var row     = inp.closest('.od-pricing-row');
  var qtyEl   = row && row.querySelector('.od-pricing-group-qty');
  var qtyText = qtyEl ? qtyEl.textContent : '0';
  var qty     = parseInt(qtyText) || 0;
  var lineEl  = document.getElementById('od-prow-total-' + gi);
  if (lineEl) lineEl.textContent = ppp && qty ? '$' + (ppp * qty).toFixed(2) : '—';
  // Update grand total from all rows
  var grandVal = 0;
  var allInps = document.querySelectorAll('.od-pricing-inp');
  allInps.forEach(function(inp2) {
    var p2 = parseFloat(inp2.value) || 0;
    var r2 = inp2.closest('.od-pricing-row');
    var qEl2 = r2 && r2.querySelector('.od-pricing-group-qty');
    var q2 = parseInt(qEl2 ? qEl2.textContent : '0') || 0;
    grandVal += p2 * q2;
  });
  var grandEl = document.getElementById('od-pricing-grand-val');
  if (grandEl) grandEl.textContent = grandVal > 0 ? '$' + grandVal.toFixed(2) : '—';
}

function savePricingSection(orderId) {
  var orders = getOrders();
  var idx    = orders.findIndex(function(o) { return o.id === orderId; });
  if (idx === -1) return;
  var order  = orders[idx];
  var inputs = document.querySelectorAll('.od-pricing-inp');
  var groups = (order.decorationGroups || []).map(function(g, gi) {
    var inp = inputs[gi];
    var ppp = inp ? (parseFloat(inp.value) || null) : null;
    if (ppp === null) return g;
    var updatedItems = (g.items || []).map(function(item) {
      return Object.assign({}, item, {
        pricePerPiece: ppp,
        totalPrice:    ppp && item.totalQty ? parseFloat((ppp * item.totalQty).toFixed(2)) : null,
      });
    });
    return Object.assign({}, g, { pricePerPiece: ppp, items: updatedItems });
  });
  var calcTotal = groups.reduce(function(s, g) {
    return s + (g.items || []).reduce(function(ss, it) { return ss + (it.totalPrice || 0); }, 0);
  }, 0);
  var totalQty  = groups.reduce(function(s, g) { return s + (g.totalQty || 0); }, 0);
  var effectiveTotal = calcTotal > 0 ? parseFloat(calcTotal.toFixed(2)) : null;
  var firstPpp = null;
  inputs.forEach(function(i) { if (!firstPpp && i.value) firstPpp = parseFloat(i.value) || null; });
  var effectivePpp = effectiveTotal && totalQty
    ? parseFloat((effectiveTotal / totalQty).toFixed(2)) : firstPpp;
  orders[idx] = Object.assign({}, order, {
    decorationGroups: groups,
    pricePerPiece:    effectivePpp,
    totalPrice:       effectiveTotal,
    updatedAt:        new Date().toISOString(),
  });
  saveOrders(orders);
  cloudSave('orders', orders);
  openOrderModal(orderId);
}

// ---- Order Mockups (admin upload) ----

function _isOrderApprovalComplete(o) {
  const mockups = o.mockups || [];
  if (!mockups.length) return true; // No mockups uploaded — gate not active
  const allApproved = mockups.every(m => o.mockupApprovals?.[m.id]?.status === 'approved');
  const quoteApproved = !o.totalPrice || o.quoteApproved;
  return allApproved && quoteApproved;
}

function _renderOrderMockups(orderId) {
  const el = document.getElementById('od-mockups-list');
  if (!el) return;
  const o = getOrders().find(x => x.id === orderId);
  if (!o) return;
  const mockups = o.mockups || [];
  if (!mockups.length) {
    el.innerHTML = `<p class="od-mockups-empty">No mockups yet. Upload one above.</p>`;
    return;
  }
  el.innerHTML = mockups.map(m => {
    const apv = o.mockupApprovals?.[m.id];
    const badge = apv?.status === 'approved'
      ? `<span class="od-mockup-badge od-mockup-approved">&#10003; Approved by customer</span>`
      : apv?.status === 'declined'
      ? `<span class="od-mockup-badge od-mockup-declined">&#10007; Changes requested${apv.declinedReason ? ': ' + apv.declinedReason : ''}</span>`
      : `<span class="od-mockup-badge od-mockup-pending">Pending customer approval</span>`;
    return `<div class="od-mockup-item">
      <img src="${m.imageData}" class="od-mockup-thumb" onclick="window.open(this.src,'_blank')" title="Click to view full size">
      <div class="od-mockup-footer">
        <input class="a-input od-mockup-label-input" value="${m.label}" placeholder="Label (e.g. Front Print)"
          onblur="updateMockupLabel('${orderId}','${m.id}',this.value)">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
          ${badge}
          <button class="a-btn a-btn-ghost a-btn-icon a-btn-sm" onclick="removeOrderMockup('${orderId}','${m.id}')" title="Remove" style="color:#ef4444;flex-shrink:0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function uploadOrderMockup(orderId, input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const mockupId = 'mock-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      const orders = getOrders();
      const o = orders.find(x => x.id === orderId);
      if (!o) return;
      if (!o.mockups) o.mockups = [];
      const label = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      o.mockups.push({ id: mockupId, label, imageData: e.target.result, uploadedAt: new Date().toISOString() });
      saveOrders(orders);
      _renderOrderMockups(orderId);
      toast('Mockup uploaded', 'success');
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function removeOrderMockup(orderId, mockupId) {
  const orders = getOrders();
  const o = orders.find(x => x.id === orderId);
  if (!o) return;
  o.mockups = (o.mockups || []).filter(m => m.id !== mockupId);
  if (o.mockupApprovals) delete o.mockupApprovals[mockupId];
  saveOrders(orders);
  _renderOrderMockups(orderId);
  toast('Mockup removed', 'success');
}

function updateMockupLabel(orderId, mockupId, label) {
  const orders = getOrders();
  const o = orders.find(x => x.id === orderId);
  if (!o) return;
  const m = (o.mockups || []).find(m => m.id === mockupId);
  if (m) { m.label = label; saveOrders(orders); }
}


function archiveOrder(id) {
  const order = getOrders().find(o => o.id === id);
  if (!order) return;

  // Build the typed-confirmation modal
  const overlay = document.createElement('div');
  overlay.className = 'a-modal-overlay open';
  overlay.id = 'archive-confirm-overlay';
  overlay.innerHTML = `
    <div class="a-modal" style="max-width:420px">
      <div class="a-modal-header">
        <h3 style="color:#f59e0b">Archive Order</h3>
        <button class="a-modal-close" onclick="document.getElementById('archive-confirm-overlay').remove()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="a-modal-body">
        <p style="color:#ccc;font-size:14px;line-height:1.6;margin-bottom:16px">
          Archiving <strong style="color:#e0e0e0">${order.id}</strong> will remove it from all active views and the production board. The order will be stored in the archive and can be restored at any time.
        </p>
        <p style="color:#888;font-size:13px;margin-bottom:10px">Type <strong style="color:#f59e0b;letter-spacing:.05em">archive</strong> to confirm:</p>
        <input id="archive-confirm-input" class="a-input" type="text" placeholder="archive" autocomplete="off"
          oninput="document.getElementById('archive-confirm-btn').disabled = this.value.trim().toLowerCase() !== 'archive'">
      </div>
      <div class="a-modal-footer" style="padding:16px 24px;border-top:1px solid #242424;display:flex;gap:10px;justify-content:flex-end">
        <button class="a-btn a-btn-ghost" onclick="document.getElementById('archive-confirm-overlay').remove()">Cancel</button>
        <button id="archive-confirm-btn" class="a-btn" disabled
          style="background:#a16207;color:#fff;border-color:#a16207;opacity:0.5;transition:opacity .15s"
          onclick="confirmArchiveOrder('${id}')">Archive Order</button>
      </div>
    </div>`;

  // Enable button style when active
  overlay.querySelector('#archive-confirm-input').addEventListener('input', function() {
    const btn = overlay.querySelector('#archive-confirm-btn');
    btn.style.opacity = this.value.trim().toLowerCase() === 'archive' ? '1' : '0.5';
  });

  document.body.appendChild(overlay);
  setTimeout(() => overlay.querySelector('#archive-confirm-input').focus(), 50);
}

function confirmArchiveOrder(id) {
  const input = document.getElementById('archive-confirm-input');
  if (!input || input.value.trim().toLowerCase() !== 'archive') return;

  // Remove from production board
  if (typeof removeProductionJob === 'function') removeProductionJob(id);

  // Mark archived on the order
  updateOrder(id, { archived: true });

  // Close both modals
  document.getElementById('archive-confirm-overlay')?.remove();
  closeOrderModal();

  ordersData = getOrders();
  if (ordersViewMode === 'kanban') renderKanbanBoard();
  else filterOrders();

  // Refresh production board if visible
  if (document.getElementById('production-board-wrap')?.closest('.admin-section')?.classList.contains('active')) {
    renderProductionBoard();
  }

  toast('Order archived and removed from production', 'success');
}

function restoreOrder(id) {
  updateOrder(id, { archived: false });
  closeOrderModal();
  ordersData = getOrders();
  if (ordersViewMode === 'kanban') renderKanbanBoard();
  else filterOrders();
  toast('Order restored', 'success');
}

function toggleArchiveView() {
  showingArchived = !showingArchived;
  const btn = document.getElementById('archived-toggle-btn');
  if (btn) btn.classList.toggle('active', showingArchived);

  // Hide/show controls that don't apply in archive mode
  const filterWrap = document.getElementById('orders-filter-wrap');
  const addBtn = document.getElementById('add-order-btn');
  const viewToggle = document.querySelector('.view-toggle-group');
  if (filterWrap) filterWrap.style.opacity = showingArchived ? '0.4' : '';
  if (addBtn) addBtn.style.display = showingArchived ? 'none' : '';
  if (viewToggle) viewToggle.style.display = showingArchived ? 'none' : '';

  // Always switch to list view for archive
  if (showingArchived) {
    document.getElementById('orders-list').style.display = 'block';
    document.getElementById('kanban-board').style.display = 'none';
  }

  ordersData = getOrders();
  filterOrders();
}

// ---- Manual Order State ----
let manualOrderGroups = [];
let manualOrderCustomer = null; // { name, email, phone, company, isNew, tempPassword, sendEmail }
let _ncTempPassword = ''; // temp password staged for new customer form
let _editingOrderId = null; // when set, saveManualOrder updates existing order instead of creating
let _saveMode = 'exit'; // 'continue' | 'exit'

function triggerSave(mode) {
  _saveMode = mode;
  const form = document.getElementById('add-order-form');
  if (form.requestSubmit) { form.requestSubmit(); }
  else { form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); }
}
let catalogTargetGroupId = null;
let catalogSelectedProduct = null;
let catalogSelectedColor = null;
let catalogEditItemIdx = null; // null = adding new, number = editing existing item index

function openAddOrderModal() {
  document.getElementById('add-order-form').reset();
  manualOrderGroups = [];
  manualOrderCustomer = null;
  addDecoGroup();
  resetCustomerSearch();
  _populateSalesRepDropdown();
  document.getElementById('add-order-modal-overlay').classList.add('open');
}

// ---- Populate sales rep dropdown from team members ----
async function _populateSalesRepDropdown() {
  const sel = document.getElementById('ao-sales-rep');
  if (!sel) return;
  sel.innerHTML = '<option value="">— None —</option>';

  // Show commission field only if authorized
  const commWrap = document.getElementById('ao-commission-wrap');
  if (commWrap) commWrap.style.display = canViewCommissions() ? '' : 'none';

  try {
    const admins = await getAllAdmins();
    admins.filter(a => a.approved !== false).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.uid;
        opt.textContent = a.name || a.email;
        opt.dataset.rate = a.commissionRate || '';
        sel.appendChild(opt);
      });
  } catch (e) { /* offline — leave empty */ }

  sel.addEventListener('change', _onSalesRepChange);
}

function _onSalesRepChange() {
  const sel = document.getElementById('ao-sales-rep');
  const commInput = document.getElementById('ao-commission');
  const hint = document.getElementById('ao-commission-rate-hint');
  const selected = sel.options[sel.selectedIndex];
  const rate = parseFloat(selected && selected.dataset.rate) || 0;

  if (rate > 0 && commInput && canViewCommissions()) {
    // Auto-calculate from price if available
    const price = parseFloat(document.getElementById('ao-price').value) || 0;
    const qty = _getTotalQtyFromGroups();
    const total = price > 0 && qty > 0 ? price * qty : 0;
    if (total > 0) {
      commInput.value = (total * rate / 100).toFixed(2);
      if (hint) hint.textContent = `(${rate}% of $${total.toFixed(2)})`;
    } else {
      commInput.value = '';
      if (hint) hint.textContent = `(${rate}% commission rate)`;
    }
  } else {
    if (commInput) commInput.value = '';
    if (hint) hint.textContent = '';
  }
}

function _getTotalQtyFromGroups() {
  return manualOrderGroups.reduce((sum, g) => {
    return sum + (g.items || []).reduce((s2, item) => {
      return s2 + Object.values(item.quantities || {}).reduce((a, b) => a + b, 0);
    }, 0);
  }, 0);
}

function closeAddOrderModal() {
  resetCustomerSearch();
  manualOrderCustomer = null;
  _editingOrderId = null;
  // Restore modal title + submit button to "create" defaults
  const title = document.querySelector('#add-order-modal-overlay .a-modal-header h3');
  if (title) title.textContent = 'Add Manual Order';
  const submitBtn = document.getElementById('ao-save-exit-btn');
  if (submitBtn) submitBtn.textContent = 'Create Order';
  document.getElementById('add-order-modal-overlay').classList.remove('open');
}

function openEditOrderModal(id) {
  const orders = getOrders();
  const o = orders.find(x => x.id === id);
  if (!o) return;

  // Close the view modal first
  closeOrderModal();

  // Reset form state like openAddOrderModal
  document.getElementById('add-order-form').reset();
  manualOrderGroups = [];
  manualOrderCustomer = null;
  resetCustomerSearch();

  // Mark as editing
  _editingOrderId = id;

  // Update modal title + submit button
  const title = document.querySelector('#add-order-modal-overlay .a-modal-header h3');
  if (title) title.textContent = 'Edit Order — ' + id;
  const submitBtn = document.getElementById('ao-save-exit-btn');
  if (submitBtn) submitBtn.textContent = 'Update Order';

  // Restore decoration groups from saved order
  manualOrderGroups = (o.decorationGroups || []).map(g => {
    let decos = g.decos || null;
    if (!decos) {
      // Migrate old format: {decorationTypes: [], locations: {type: loc}} → decos instances
      const oldTypes = g.decorationTypes || [];
      const oldLocs  = g.locations || {};
      if (!oldLocs || !Object.keys(oldLocs).length) {
        // Even older: single location field
        decos = oldTypes.map(type => ({
          iid: 'di-' + Date.now() + '-' + Math.random().toString(36).slice(2),
          type,
          location: g.location || '',
        }));
      } else {
        decos = oldTypes.map(type => ({
          iid: 'di-' + Date.now() + '-' + Math.random().toString(36).slice(2),
          type,
          location: oldLocs[type] || '',
        }));
      }
    }
    // Restore group-level price from first item (or stored group field)
    const groupPpp = g.pricePerPiece != null
      ? g.pricePerPiece
      : ((g.items && g.items[0] && g.items[0].pricePerPiece != null)
          ? g.items[0].pricePerPiece : null);
    return {
      id:    g.id || ('dg-' + Date.now() + '-' + Math.random().toString(36).slice(2)),
      decos,
      items: (g.items || []).map(item => ({ ...item })),
      pricePerPiece: groupPpp,
    };
  });
  // If no groups, start with one empty
  if (!manualOrderGroups.length) addDecoGroup();

  // Set customer
  manualOrderCustomer = {
    name:    o.customerName  || '',
    email:   o.customerEmail || '',
    phone:   o.customerPhone || '',
    company: o.customerCompany || '',
    isNew:   false,
    sendEmail: false,
  };
  syncCustomerHiddenInputs();

  // Pre-fill order settings
  _populateSalesRepDropdown().then(() => {
    const repSel = document.getElementById('ao-sales-rep');
    if (repSel && o.salesRepId) repSel.value = o.salesRepId;
  });

  const statusSel = document.getElementById('ao-status');
  if (statusSel && o.status) statusSel.value = o.status;

  const priceInp = document.getElementById('ao-price');
  if (priceInp) priceInp.value = o.pricePerPiece != null ? o.pricePerPiece : '';

  const notesInp = document.getElementById('ao-notes');
  if (notesInp) notesInp.value = o.notes || '';

  const csCheck = document.getElementById('ao-customer-supplied');
  if (csCheck) csCheck.checked = !!o.customerSuppliedBlanks;

  const inHandInp = document.getElementById('ao-inhand-date');
  if (inHandInp) inHandInp.value = o.inHandDate || '';

  const hardDeadlineChk = document.getElementById('ao-hard-deadline');
  if (hardDeadlineChk) hardDeadlineChk.checked = !!o.isHardDeadline;

  renderDecoGroups();
  renderSelectedCustomerDisplay();

  document.getElementById('add-order-modal-overlay').classList.add('open');
}

// ---- Decoration Group Helpers ----

// Locations that cannot be used together on the same garment
const LOCATION_CONFLICTS = {
  'Left Chest':        ['Big Front'],
  'Big Front':         ['Left Chest'],
  'Big Back':          ['Upper Back', 'Lower Back'],
  'Upper Back':        ['Big Back'],
  'Lower Back':        ['Big Back'],
  'Left Panel':        ['Left Side of Hat'],
  'Right Panel':       ['Right Side of Hat'],
  'Left Side of Hat':  ['Left Panel'],
  'Right Side of Hat': ['Right Panel'],
};

// Returns all price break rows for a deco type + blank cost using live pricing metrics
function calcPriceBreakRows(decoId, blankCost) {
  const metrics = getPricingMetrics();
  const m = metrics[decoId];
  if (!m || !blankCost || blankCost <= 0) return [];
  const colIdx = m.costRanges.findIndex(r => blankCost >= r.minVal && blankCost <= r.maxVal);
  if (colIdx === -1) return [];
  return m.qtys.map((qty, rowIdx) => {
    const multiplier = parseFloat(m.grid[rowIdx]?.[colIdx]);
    const pricePerPiece = (!isNaN(multiplier) && multiplier > 0) ? blankCost * multiplier : null;
    return { qty, multiplier, pricePerPiece, costRangeLabel: m.costRanges[colIdx].label };
  });
}

// Combined price break rows for multiple decoration types.
// Blank cost counted once; decoration upcharge added for each type.
// Formula per tier: blankCost × (Σmultipliers − (N−1))
function calcCombinedPriceBreakRows(decoIds, blankCost) {
  if (!decoIds.length || !blankCost || blankCost <= 0) return [];
  const allDecoRows = decoIds.map(id => calcPriceBreakRows(id, blankCost));
  const refRows = allDecoRows[0];
  if (!refRows?.length) return [];
  return refRows.map((baseRow, i) => {
    let sumMultipliers = 0;
    for (const decoRows of allDecoRows) {
      const row = decoRows[i];
      if (!row || row.pricePerPiece == null) return { qty: baseRow.qty, pricePerPiece: null };
      sumMultipliers += row.multiplier;
    }
    const combinedMultiplier = sumMultipliers - (decoIds.length - 1);
    return { qty: baseRow.qty, multiplier: combinedMultiplier, pricePerPiece: blankCost * combinedMultiplier };
  });
}

// Returns price rows for a product + deco type combo, preferring fixed pricing over formula.
// locationCounts = { 'screen-printing': 2 } adds extra-location fees for each additional location.
// { rows: [{qty, pricePerPiece}], source: 'fixed'|'formula'|'none' }
function getProductPriceRows(productId, decoIds, locationCounts = {}) {
  const prod = adminProducts.find(p => p.id === productId);
  if (!prod || !decoIds.length) return { rows: [], source: 'none' };
  const blankCost = parseFloat(prod.blankCost) || 0;

  if (prod.priceBreaks) {
    const allHaveFixed = decoIds.every(id => {
      const breaks = prod.priceBreaks[id];
      return breaks && PRICE_BREAK_TIERS.some(qty => {
        const v = parseFloat(breaks[qty]);
        return !isNaN(v) && v > 0;
      });
    });
    if (allHaveFixed) {
      // Apply extra-location fee on top of base price for each deco type
      const priceWithAddLoc = (decoId, base, qty) => {
        const extraLocs = Math.max(0, (locationCounts[decoId] || 1) - 1);
        if (extraLocs === 0) return base;
        const addBreaks = prod.priceBreaks[decoId + ':add'];
        const addPrice = addBreaks ? parseFloat(addBreaks[qty]) : NaN;
        return base + ((!isNaN(addPrice) && addPrice > 0) ? extraLocs * addPrice : 0);
      };

      const rows = PRICE_BREAK_TIERS.map(qty => {
        if (decoIds.length === 1) {
          const base = parseFloat(prod.priceBreaks[decoIds[0]][qty]);
          if (isNaN(base) || base <= 0) return null;
          return { qty, pricePerPiece: priceWithAddLoc(decoIds[0], base, qty) };
        }
        if (blankCost <= 0) return null;
        let sum = 0;
        for (const decoId of decoIds) {
          const base = parseFloat((prod.priceBreaks[decoId] || {})[qty]);
          if (isNaN(base) || base <= 0) return null;
          sum += priceWithAddLoc(decoId, base, qty);
        }
        return { qty, pricePerPiece: Math.max(0, sum - (decoIds.length - 1) * blankCost) };
      }).filter(Boolean);
      if (rows.length > 0) return { rows, source: 'fixed' };
    }
  }

  if (blankCost <= 0) return { rows: [], source: 'none' };
  const rows = calcCombinedPriceBreakRows(decoIds, blankCost);
  return rows.length ? { rows, source: 'formula' } : { rows: [], source: 'none' };
}

// Renders a single combined price break table for a decoration group.
// Prefers fixed per-product pricing; falls back to formula.
function renderGroupPriceTables(group) {
  const decoTypeIds = [...new Set((group.decos || []).map(d => d.type))];
  if (!decoTypeIds.length || !(group.items || []).length) return '';

  // Count how many locations each deco type has in this group
  const locationCounts = {};
  (group.decos || []).forEach(d => { locationCounts[d.type] = (locationCounts[d.type] || 0) + 1; });

  const itemData = group.items.map(item => {
    const { rows, source } = getProductPriceRows(item.productId, decoTypeIds, locationCounts);
    return { name: item.productName, rows, source };
  });

  const hasAnyPricing = itemData.some(i => i.rows.length > 0);
  if (!hasAnyPricing) {
    const decoLabel = decoTypeIds.map(id => ALL_DECORATION_TYPES.find(d => d.id === id)?.label || id).join(' + ');
    return `<div class="apt-no-cost"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Set fixed pricing on products (or add blank cost) to see ${decoLabel} pricing</div>`;
  }

  const currentQty   = getGroupTotal(group);
  const effectiveMin = Math.max(getGroupMinQty(group), getOrderEffectiveMinQty());
  const multi        = itemData.length > 1;

  // Build unified sorted qty list from all items
  const allQtys = [...new Set(itemData.flatMap(i => i.rows.map(r => r.qty)))].sort((a, b) => a - b);

  let currentTierQty = null;
  for (const qty of allQtys) { if (currentQty >= qty) currentTierQty = qty; }
  const currentTierIdx = allQtys.indexOf(currentTierQty);
  const nextTierQty = currentTierIdx >= 0 && currentTierIdx < allQtys.length - 1 ? allQtys[currentTierIdx + 1] : null;

  const decoLabel = decoTypeIds.map(id => ALL_DECORATION_TYPES.find(d => d.id === id)?.label || id).join(' + ');

  // Source badge — fixed pricing or formula fallback
  const allFixed    = itemData.every(i => i.source === 'fixed' || i.rows.length === 0);
  const anyFixed    = itemData.some(i => i.source === 'fixed');
  const anyFormula  = itemData.some(i => i.source === 'formula');
  const sourceBadge = allFixed && anyFixed
    ? `<span class="apt-source-badge apt-source-fixed">Fixed pricing</span>`
    : anyFixed && anyFormula
      ? `<span class="apt-source-badge apt-source-mixed">Mixed (fixed + formula)</span>`
      : `<span class="apt-source-badge apt-source-formula">Formula pricing — set fixed prices on products</span>`;

  const headCols = multi
    ? itemData.map(ic => `<th class="apt-th">${ic.name}<br><span class="apt-item-src">${ic.source}</span></th>`).join('')
    : `<th class="apt-th">Price/pc</th><th class="apt-th apt-th-total"></th>`;

  const rows = allQtys.map(qty => {
    const isCurrent  = qty === currentTierQty && currentQty > 0;
    const isBelowMin = qty < effectiveMin;
    if (multi) {
      const cells = itemData.map(ic => {
        const row   = ic.rows.find(r => r.qty === qty);
        const price = row?.pricePerPiece;
        return `<td class="apt-price${isCurrent ? ' apt-current' : ''}">${price != null ? '$' + price.toFixed(2) : '—'}</td>`;
      }).join('');
      return `<tr class="apt-row${isCurrent ? ' apt-row-current' : ''}${isBelowMin ? ' apt-row-dim' : ''}">
        <td class="apt-qty${isCurrent ? ' apt-qty-current' : ''}">${qty}+${isBelowMin ? `<span class="apt-min-flag"> min</span>` : ''}</td>${cells}</tr>`;
    } else {
      const row      = itemData[0].rows.find(r => r.qty === qty);
      const price    = row?.pricePerPiece;
      const estTotal = isCurrent && price != null && currentQty > 0 ? `$${(price * currentQty).toFixed(2)} est.` : '';
      const nextNote = isCurrent && nextTierQty ? `<span class="apt-next-note">${nextTierQty - currentQty} more → ${nextTierQty}+</span>` : '';
      return `<tr class="apt-row${isCurrent ? ' apt-row-current' : ''}${isBelowMin ? ' apt-row-dim' : ''}">
        <td class="apt-qty${isCurrent ? ' apt-qty-current' : ''}">${qty}+ pcs${isBelowMin ? `<span class="apt-min-flag"> min</span>` : ''}</td>
        <td class="apt-price${isCurrent ? ' apt-current' : ''}">${price != null ? '$' + price.toFixed(2) + '/pc' : '—'}</td>
        <td class="apt-total">${estTotal}${nextNote}</td>
      </tr>`;
    }
  }).join('');

  return `<div class="ao-price-table-wrap">
    <div class="ao-price-table-title"><span>${decoLabel}</span>${sourceBadge}</div>
    <div class="apt-scroll">
      <table class="ao-price-table">
        <thead><tr><th class="apt-th apt-th-qty">Qty</th>${headCols}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function decoTypeOptions() {
  return ALL_DECORATION_TYPES
    .map(d => `<option value="${d.id}">${d.label} (min ${d.minQty})</option>`)
    .join('');
}

function getGroupTotal(group) {
  return group.items.reduce((s, it) => s + (it.totalQty || 0), 0);
}

function getDecoMinQty(decoTypeId) {
  const dt = ALL_DECORATION_TYPES.find(d => d.id === decoTypeId);
  return dt ? dt.minQty : 0;
}

// Returns the highest minQty across all deco types in a group
function getGroupMinQty(group) {
  return (group.decos || []).reduce((max, d) => Math.max(max, getDecoMinQty(d.type)), 0);
}

// Returns the highest minQty enforced across all groups in the order
function getOrderEffectiveMinQty() {
  return manualOrderGroups.reduce((max, g) => Math.max(max, getGroupMinQty(g)), 0);
}

function getPriceBreakTierLabel(qty, group) {
  const groupMin      = getGroupMinQty(group);
  const effectiveMin  = getOrderEffectiveMinQty();
  const enforcedMin   = Math.max(groupMin, effectiveMin);

  if (qty === 0) return '0 pcs added';
  if (enforcedMin > 0 && qty < enforcedMin) {
    const reason = effectiveMin > groupMin
      ? `another group requires ${effectiveMin}`
      : `minimum for selected decoration`;
    return `${qty} pcs — <strong style="color:#ef4444">Below minimum (need ${enforcedMin} — ${reason})</strong>`;
  }
  const tiers = PRICE_BREAK_TIERS;
  let hit = null;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (qty >= tiers[i]) { hit = tiers[i]; break; }
  }
  if (!hit) return `${qty} pcs`;
  const next = tiers[tiers.indexOf(hit) + 1];
  return next
    ? `${qty} pcs — <strong>${hit}+ price break</strong> · ${next - qty} more for ${next}+ tier`
    : `${qty} pcs — <strong>${hit}+ price break</strong> · max tier`;
}

// Returns locations available for a specific decoration instance (by iid).
// Excludes locations already assigned to OTHER instances within the SAME group only.
// Different groups are fully independent — all locations are available in each group.
function getAvailableLocations(currentGroupId, currentIid) {
  const usedByOthers = [];
  const currentGroup = manualOrderGroups.find(g => g.id === currentGroupId);
  if (currentGroup) {
    (currentGroup.decos || []).forEach(d => {
      if (d.location && d.iid !== currentIid) {
        usedByOthers.push(d.location);
      }
    });
  }

  const blocked = new Set();
  usedByOthers.forEach(loc => {
    blocked.add(loc);
    (LOCATION_CONFLICTS[loc] || []).forEach(c => blocked.add(c));
  });

  return ALL_LOCATIONS.filter(loc => !blocked.has(loc));
}

function addDecoGroup() {
  const id = 'dg-' + Date.now();
  manualOrderGroups.push({ id, decos: [], items: [] });
  renderDecoGroups();
}

function removeDecoGroup(id) {
  manualOrderGroups = manualOrderGroups.filter(g => g.id !== id);
  renderDecoGroups();
}

function addDecoTypeToGroup(groupId, dtId) {
  if (!dtId) return;
  const g = manualOrderGroups.find(g => g.id === groupId);
  if (g) {
    if (!g.decos) g.decos = [];
    g.decos.push({ iid: 'di-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), type: dtId, location: '' });
    renderDecoGroups();
  }
}

function removeDecoInstanceFromGroup(groupId, iid) {
  const g = manualOrderGroups.find(g => g.id === groupId);
  if (g) {
    g.decos = (g.decos || []).filter(d => d.iid !== iid);
    renderDecoGroups();
  }
}

function updateGroupLocation(groupId, iid, val) {
  const g = manualOrderGroups.find(g => g.id === groupId);
  if (g) {
    const d = (g.decos || []).find(d => d.iid === iid);
    if (d) d.location = val;
    renderDecoGroups();
  }
}

function removeItemFromGroup(groupId, idx) {
  const g = manualOrderGroups.find(g => g.id === groupId);
  if (g) { g.items.splice(idx, 1); renderDecoGroups(); }
}

// Calculate a {qty: price} map for a group's decoration types + first item's blank cost.
// Returns {} if data is unavailable.
function _groupTierPriceMap(group) {
  const decoTypeIds = [...new Set((group.decos || []).map(d => d.type))];
  if (!decoTypeIds.length || !(group.items || []).length) return {};
  const locationCounts = {};
  (group.decos || []).forEach(d => { locationCounts[d.type] = (locationCounts[d.type] || 0) + 1; });
  const refItem = group.items.find(item => {
    const { rows } = getProductPriceRows(item.productId, decoTypeIds, locationCounts);
    return rows.length > 0;
  });
  if (!refItem) return {};
  const { rows } = getProductPriceRows(refItem.productId, decoTypeIds, locationCounts);
  const map = {};
  rows.forEach(r => { if (r.pricePerPiece != null) map[r.qty] = r.pricePerPiece; });
  return map;
}

function buildGroupBreakNudge(group) {
  const total = getGroupTotal(group);
  const tiers = PRICE_BREAK_TIERS;
  const arrowSvg = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>`;
  const checkSvg = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>`;
  const tagSvg   = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`;

  const priceMap = _groupTierPriceMap(group);

  let currentTier = null;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (total >= tiers[i]) { currentTier = tiers[i]; break; }
  }
  const currentIdx = currentTier != null ? tiers.indexOf(currentTier) : -1;
  const nextTier = currentIdx >= 0 && currentIdx < tiers.length - 1 ? tiers[currentIdx + 1] : null;

  if (total === 0) {
    const chips = tiers.map(t => {
      const p = priceMap[t];
      const priceStr = p != null ? ` — <em>$${p.toFixed(2)}/pc</em>` : '';
      return `<span class="ao-tier-chip">${t}+ pcs${priceStr}</span>`;
    }).join('');
    return `<div class="ao-item-break-nudge ao-ibn-preview">
      ${tagSvg}
      <span><strong>Price break tiers:</strong> ${chips}</span>
    </div>`;
  }
  const nextPriceStr = nextTier && priceMap[nextTier] != null ? ` ($${priceMap[nextTier].toFixed(2)}/pc)` : '';
  if (currentTier === null) {
    const needed = tiers[0] - total;
    return `<div class="ao-item-break-nudge ao-ibn-below">
      ${arrowSvg}
      <span>Group: <strong>${total} pcs</strong> — <strong>${needed} more</strong> reaches the <strong>${tiers[0]}+ price break</strong>${nextPriceStr}</span>
    </div>`;
  }
  if (nextTier) {
    const needed = nextTier - total;
    return `<div class="ao-item-break-nudge ao-ibn-next">
      ${arrowSvg}
      <span>Group: <strong>${total} pcs</strong> (${currentTier}+ tier) — add <strong>${needed} more</strong> to reach <strong>${nextTier}+ price break</strong>${nextPriceStr}</span>
    </div>`;
  }
  return `<div class="ao-item-break-nudge ao-ibn-max">
    ${checkSvg}
    <span>Group: <strong>${total} pcs</strong> — at max price break tier (<strong>${tiers[tiers.length - 1]}+</strong>) ✓</span>
  </div>`;
}

function renderDecoGroups() {
  const wrap = document.getElementById('ao-deco-groups');
  if (!wrap) return;
  wrap.innerHTML = manualOrderGroups.map((group, gi) => {
    const total = getGroupTotal(group);
    const decos = group.decos || [];
    const breakNudge = buildGroupBreakNudge(group);

    const items = group.items.map((item, idx) => {
      const thumb = item.mockup
        ? `<img class="ao-item-thumb" src="${item.mockup}" alt="">`
        : `<div class="ao-item-thumb-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.86H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.86l.58-3.57a2 2 0 00-1.34-2.23z"/></svg></div>`;
      const ppp = group.pricePerPiece || item.pricePerPiece || 0;
      const lineTotal = ppp && item.totalQty > 0 ? (ppp * item.totalQty) : 0;
      const priceHtml = ppp
        ? `<div class="ao-item-price">
            <span class="ao-item-ppp">$${parseFloat(ppp).toFixed(2)}/pc</span>
            ${lineTotal ? `<span class="ao-item-ltotal">= $${lineTotal.toFixed(2)}</span>` : ''}
          </div>`
        : '';
      const mockupUploadBtn = `<label class="ao-item-mockup-btn" title="Upload mockup">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        ${item.mockup ? 'Replace' : 'Mockup'}
        <input type="file" accept="image/*" style="display:none" onchange="uploadItemMockup('${group.id}',${idx},this)">
      </label>
      ${item.mockup ? `<button type="button" class="ao-item-mockup-clear" title="Remove mockup" onclick="clearItemMockup('${group.id}',${idx})">✕</button>` : ''}`;
      return `<div class="ao-group-item-wrap">
        <div class="ao-group-item">
          ${thumb}
          <div class="ao-item-info">
            <div class="ao-item-name">${item.productName}</div>
            <div class="ao-item-meta">${item.color}${Object.keys(item.quantities||{}).length ? ' · ' + Object.entries(item.quantities).filter(([,v])=>v>0).map(([k,v])=>`${k}:${v}`).join(', ') : ''}</div>
          </div>
          <div class="ao-item-qty${item.totalQty === 0 ? ' ao-item-qty-tbd' : ''}">${item.totalQty > 0 ? item.totalQty + ' pcs' : 'qty TBD'}</div>
          ${priceHtml}
          ${mockupUploadBtn}
          <button type="button" class="a-btn a-btn-ghost ao-item-edit-btn" onclick="editItemInGroup('${group.id}',${idx})" title="Edit quantities">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button type="button" class="a-modal-close" style="margin-left:2px" onclick="removeItemFromGroup('${group.id}',${idx})">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        ${breakNudge}
      </div>`;
    }).join('');

    return `<div class="ao-deco-group" id="aogrp-${group.id}">
      <div class="ao-group-header-top">
        <span class="ao-group-num">Group ${gi + 1}</span>
        ${manualOrderGroups.length > 1
          ? `<button type="button" class="a-btn a-btn-ghost" style="padding:3px 10px;font-size:12px;color:#ef4444" onclick="removeDecoGroup('${group.id}')">Remove</button>`
          : ''}
      </div>
      <div class="ao-deco-type-list">
        ${decos.map(d => {
          const dt = ALL_DECORATION_TYPES.find(x => x.id === d.type);
          if (!dt) return '';
          const availLocs = getAvailableLocations(group.id, d.iid);
          const locOpts = `<option value="">— Location —</option>` +
            availLocs.map(loc => `<option value="${loc}" ${loc === d.location ? 'selected' : ''}>${loc}</option>`).join('') +
            (d.location && !availLocs.includes(d.location) ? `<option value="${d.location}" selected>${d.location} ⚠</option>` : '');
          return `<div class="ao-deco-type-entry">
            <span class="ao-deco-tag">
              ${dt.label}
              <button type="button" onclick="removeDecoInstanceFromGroup('${group.id}','${d.iid}')">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </span>
            <select class="a-select ao-deco-loc-select" onchange="updateGroupLocation('${group.id}','${d.iid}',this.value)">
              ${locOpts}
            </select>
          </div>`;
        }).join('')}
        <div class="ao-deco-add-row">
          <select class="a-select ao-deco-add-select" onchange="addDecoTypeToGroup('${group.id}',this.value);this.value=''">
            <option value="">+ Add Decoration Type…</option>
            ${decoTypeOptions()}
          </select>
        </div>
      </div>
      ${items}
      <button type="button" class="ao-add-product-btn" onclick="openCatalog('${group.id}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Product from Catalog
      </button>
      <div class="ao-group-footer">
        ${renderGroupPriceTables(group)}
        <div class="ao-group-price-row">
          <label class="ao-group-price-label">Price / pc for this group</label>
          <div class="ao-group-price-inputs">
            <input type="number" min="0" step="0.01" class="a-input ao-group-price-inp"
              placeholder="0.00"
              value="${group.pricePerPiece != null ? group.pricePerPiece : ''}"
              oninput="setGroupPrice('${group.id}', this.value)">
            ${total > 0 && group.pricePerPiece > 0
              ? `<span class="ao-group-price-calc">= $${(group.pricePerPiece * total).toFixed(2)} total (${total} pcs)</span>`
              : ''}
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function setGroupPrice(groupId, val) {
  var g = manualOrderGroups.find(function(g) { return g.id === groupId; });
  if (!g) return;
  g.pricePerPiece = parseFloat(val) || null;
  // Update only the calc span — do NOT call renderDecoGroups() here or the input loses focus
  var grpEl = document.getElementById('aogrp-' + groupId);
  if (!grpEl) return;
  var calcSpan = grpEl.querySelector('.ao-group-price-calc');
  var total = getGroupTotal(g);
  var ppp   = g.pricePerPiece;
  if (total > 0 && ppp > 0) {
    var calcText = '= $' + (ppp * total).toFixed(2) + ' total (' + total + ' pcs)';
    if (calcSpan) {
      calcSpan.textContent = calcText;
    } else {
      var inp = grpEl.querySelector('.ao-group-price-inp');
      if (inp) {
        var newSpan = document.createElement('span');
        newSpan.className = 'ao-group-price-calc';
        newSpan.textContent = calcText;
        inp.parentNode.insertBefore(newSpan, inp.nextSibling);
      }
    }
  } else {
    if (calcSpan) calcSpan.remove();
  }
  // Update per-item price + total displays in the group without re-rendering
  grpEl.querySelectorAll('.ao-group-item').forEach(function(itemEl, idx) {
    var item = g.items[idx];
    if (!item) return;
    var priceDiv = itemEl.querySelector('.ao-item-price');
    if (ppp) {
      var lt = ppp && item.totalQty > 0 ? '$' + (ppp * item.totalQty).toFixed(2) : '';
      var html = '<span class="ao-item-ppp">$' + parseFloat(ppp).toFixed(2) + '/pc</span>'
        + (lt ? '<span class="ao-item-ltotal">= ' + lt + '</span>' : '');
      if (priceDiv) {
        priceDiv.innerHTML = html;
      } else {
        var qtyDiv = itemEl.querySelector('.ao-item-qty');
        if (qtyDiv) {
          var div = document.createElement('div');
          div.className = 'ao-item-price';
          div.innerHTML = html;
          qtyDiv.insertAdjacentElement('afterend', div);
        }
      }
    } else {
      if (priceDiv) priceDiv.remove();
    }
  });
}

function uploadItemMockup(groupId, itemIdx, input) {
  var file = input.files[0];
  if (!file) return;
  var g = manualOrderGroups.find(function(g) { return g.id === groupId; });
  if (!g || !g.items[itemIdx]) return;

  // Show uploading state on the label
  var label = input.parentElement;
  var origText = label.childNodes[2] ? label.childNodes[2].textContent.trim() : 'Mockup';
  if (label.childNodes[2]) label.childNodes[2].textContent = ' Uploading…';

  var storageRef = _firebaseStorage.ref('order-mockups/' + groupId + '-' + itemIdx + '-' + Date.now() + '-' + file.name);
  storageRef.put(file).then(function(snap) {
    return snap.ref.getDownloadURL();
  }).then(function(url) {
    g.items[itemIdx].mockup = url;
    renderDecoGroups();
    toast('Mockup uploaded', 'success');
  }).catch(function(err) {
    console.error('Mockup upload failed', err);
    toast('Upload failed — ' + err.message, 'error');
    if (label.childNodes[2]) label.childNodes[2].textContent = ' ' + origText;
  });
}

function clearItemMockup(groupId, itemIdx) {
  var g = manualOrderGroups.find(function(g) { return g.id === groupId; });
  if (!g || !g.items[itemIdx]) return;
  g.items[itemIdx].mockup = null;
  renderDecoGroups();
}

// ---- Product Catalog ----
function openCatalog(groupId) {
  catalogTargetGroupId = groupId;
  catalogSelectedProduct = null;
  catalogSelectedColor = null;
  catalogEditItemIdx = null;
  document.getElementById('catalog-overlay').classList.add('open');
  document.getElementById('catalog-search').value = '';
  document.getElementById('catalog-footer').style.display = 'none';
  document.getElementById('catalog-config-empty').style.display = 'flex';
  document.getElementById('catalog-config-form').style.display = 'none';
  const addBtn = document.getElementById('catalog-add-btn');
  if (addBtn) addBtn.textContent = 'Add to Group';
  renderCatalogGrid('');
}

function editItemInGroup(groupId, itemIdx) {
  const g = manualOrderGroups.find(g => g.id === groupId);
  if (!g) return;
  const item = g.items[itemIdx];
  if (!item) return;

  catalogTargetGroupId = groupId;
  catalogEditItemIdx = itemIdx;

  // Pre-select product and color from the item
  const products = getProducts();
  catalogSelectedProduct = products.find(p => p.id === item.productId) || null;
  if (catalogSelectedProduct) {
    catalogSelectedColor = (catalogSelectedProduct.colors || []).find(c => c.name === item.color) || null;
  }

  document.getElementById('catalog-overlay').classList.add('open');
  document.getElementById('catalog-search').value = '';
  const addBtn = document.getElementById('catalog-add-btn');
  if (addBtn) addBtn.textContent = 'Update Quantities';

  renderCatalogGrid('');
  if (catalogSelectedProduct) {
    renderCatalogConfig();
    // Pre-fill existing quantities
    Object.entries(item.quantities).forEach(([size, qty]) => {
      const inp = document.querySelector(`.catalog-size-input[data-size="${size}"]`);
      if (inp) { inp.value = qty; }
    });
    updateCatalogQtyPreview();
  }
}

function closeCatalog() {
  document.getElementById('catalog-overlay').classList.remove('open');
  catalogTargetGroupId = null;
  catalogSelectedProduct = null;
  catalogSelectedColor = null;
  catalogEditItemIdx = null;
}

function renderCatalogGrid(filter) {
  const products = getProducts().filter(p => p.available !== false);
  const q = (filter || '').toLowerCase();
  const filtered = q ? products.filter(p => p.name.toLowerCase().includes(q)) : products;
  const grid = document.getElementById('catalog-grid');
  if (!grid) return;
  grid.innerHTML = filtered.map(p => {
    const firstColor = (p.colors || [])[0];
    const mockup = firstColor && firstColor.mockup
      ? `<img class="catalog-card-img" src="${firstColor.mockup}" alt="${p.name}">`
      : `<div class="catalog-card-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.86H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.86l.58-3.57a2 2 0 00-1.34-2.23z"/></svg></div>`;
    const swatches = (p.colors || []).slice(0, 8).map(c =>
      `<span class="catalog-card-dot" style="background:${c.hex || '#888'}" title="${c.name}"></span>`
    ).join('');
    const isSelected = catalogSelectedProduct && catalogSelectedProduct.id === p.id;
    return `<div class="catalog-card${isSelected ? ' selected' : ''}" onclick="selectCatalogProduct('${p.id}')">
      ${mockup}
      <div class="catalog-card-name">${p.name}</div>
      <div class="catalog-card-swatches">${swatches}</div>
    </div>`;
  }).join('');
  if (!filtered.length) grid.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:20px">No products found.</div>';
}

function selectCatalogProduct(productId) {
  const products = getProducts();
  catalogSelectedProduct = products.find(p => p.id === productId);
  if (!catalogSelectedProduct) return;
  catalogSelectedColor = (catalogSelectedProduct.colors || [])[0] || null;
  renderCatalogGrid(document.getElementById('catalog-search').value);
  renderCatalogConfig();
}

function selectCatalogColor(colorName) {
  if (!catalogSelectedProduct) return;
  catalogSelectedColor = (catalogSelectedProduct.colors || []).find(c => c.name === colorName) || null;
  renderCatalogConfig();
}

function renderCatalogConfig() {
  const empty = document.getElementById('catalog-config-empty');
  const form  = document.getElementById('catalog-config-form');
  const footer = document.getElementById('catalog-footer');
  if (!catalogSelectedProduct) {
    empty.style.display = 'flex';
    form.style.display = 'none';
    footer.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '14px';
  footer.style.display = 'flex';

  const p = catalogSelectedProduct;
  const colors = p.colors || [];
  const sizes = p.sizes && p.sizes.length ? p.sizes : ALL_SIZES;

  const mockupImg = catalogSelectedColor && catalogSelectedColor.mockup
    ? `<img class="catalog-mockup-preview" src="${catalogSelectedColor.mockup}" alt="${p.name}">`
    : '';

  const colorOpts = colors.map(c =>
    `<div class="catalog-color-opt${catalogSelectedColor && catalogSelectedColor.name === c.name ? ' selected' : ''}" onclick="selectCatalogColor('${c.name.replace(/'/g,"\\'")}')">
      <div class="catalog-color-swatch" style="background:${c.hex || '#888'}"></div>
      <div class="catalog-color-name">${c.name}</div>
    </div>`
  ).join('');

  const sizeInputs = sizes.map(sz =>
    `<div class="catalog-size-cell">
      <div class="catalog-size-label">${sz}</div>
      <input class="a-input catalog-size-input" type="number" min="0" placeholder="0" data-size="${sz}" oninput="updateCatalogQtyPreview()">
    </div>`
  ).join('');

  form.innerHTML = `
    <div>
      <div class="catalog-config-title">${p.name}</div>
    </div>
    ${mockupImg}
    ${colors.length ? `<div>
      <div class="catalog-config-label">Color</div>
      <div class="catalog-color-grid">${colorOpts}</div>
    </div>` : ''}
    <div class="catalog-bulk-qty-row">
      <label class="catalog-config-label" style="margin-bottom:6px">Bulk / One-Size Qty <span style="font-weight:400;color:var(--text-muted)">(optional — for hats or items without sizes)</span></label>
      <input class="a-input catalog-size-input" type="number" min="0" placeholder="0" data-size="Qty" style="max-width:120px" oninput="updateCatalogQtyPreview()">
    </div>
    <div>
      <div class="catalog-config-label">Quantities by Size <span style="font-weight:400;color:var(--text-muted)">(optional)</span></div>
      <div class="catalog-size-grid">${sizeInputs}</div>
    </div>
    <div class="catalog-qty-line" id="catalog-qty-preview">Total: <strong>0 pcs</strong></div>
    <div id="catalog-price-preview"></div>`;

  renderCatalogPricePreview();

  updateCatalogQtyPreview();
}

function updateCatalogQtyPreview() {
  const inputs = document.querySelectorAll('.catalog-size-input');
  let total = 0;
  inputs.forEach(inp => { total += parseInt(inp.value) || 0; });
  const preview = document.getElementById('catalog-qty-preview');
  if (preview) preview.innerHTML = `Total: <strong>${total} pcs</strong>`;
  const summary = document.getElementById('catalog-footer-summary');
  if (summary && catalogSelectedProduct) {
    const g = manualOrderGroups.find(g => g.id === catalogTargetGroupId);
    const groupTotal = g ? getGroupTotal(g) + total : total;
    summary.innerHTML = `${total} pcs added · Group total: <strong>${groupTotal} pcs</strong>`;
  }
  renderCatalogPricePreview(total);
}

function renderCatalogPricePreview(currentQty) {
  const el = document.getElementById('catalog-price-preview');
  if (!el || !catalogSelectedProduct) return;

  const p = catalogSelectedProduct;
  const blankCost = parseFloat(p.blankCost) || 0;
  const group = manualOrderGroups.find(g => g.id === catalogTargetGroupId);
  const decoTypeIds = group ? [...new Set((group.decos || []).map(d => d.type))] : [];

  if (!decoTypeIds.length) {
    el.innerHTML = `<div class="cpp-hint">Add a decoration type to the group to see pricing</div>`;
    return;
  }
  if (blankCost <= 0) {
    el.innerHTML = `<div class="cpp-hint">Set a blank cost on this product to see pricing</div>`;
    return;
  }

  const qty = currentQty !== undefined ? currentQty : 0;

  const tables = decoTypeIds.map(decoId => {
    const dt = ALL_DECORATION_TYPES.find(d => d.id === decoId);
    if (!dt) return '';
    const rows = calcPriceBreakRows(decoId, blankCost);
    if (!rows.length) return '';

    // Find active tier
    let activeTierQty = null;
    for (let i = 0; i < rows.length; i++) {
      if (qty >= rows[i].qty) activeTierQty = rows[i].qty;
    }
    const activeTierIdx = rows.findIndex(r => r.qty === activeTierQty);
    const nextTier = activeTierIdx >= 0 && activeTierIdx < rows.length - 1 ? rows[activeTierIdx + 1].qty : null;

    const rowsHtml = rows.map(row => {
      const isCurrent = row.qty === activeTierQty && qty > 0;
      const isBelowMin = row.qty < dt.minQty;
      const price = row.pricePerPiece;
      const total = isCurrent && price !== null && qty > 0 ? `= $${(price * qty).toFixed(2)}` : '';
      const nextNote = isCurrent && nextTier ? ` · ${nextTier - qty} more for ${nextTier}+ tier` : '';
      return `<div class="cpp-row${isCurrent ? ' cpp-current' : ''}${isBelowMin ? ' cpp-dim' : ''}">
        <span class="cpp-qty">${row.qty}+ pcs</span>
        <span class="cpp-price">${price !== null ? '$' + price.toFixed(2) + '/pc' : '—'}</span>
        <span class="cpp-total">${total}${nextNote}</span>
      </div>`;
    }).join('');

    return `<div class="cpp-section">
      <div class="cpp-deco-label">${dt.label}</div>
      ${rowsHtml}
    </div>`;
  }).join('');

  el.innerHTML = `<div class="catalog-price-preview"><div class="cpp-title">Price Breaks</div>${tables}</div>`;
}

function addProductToGroup() {
  if (!catalogSelectedProduct || !catalogTargetGroupId) return;
  const inputs = document.querySelectorAll('.catalog-size-input');
  const quantities = {};
  let totalQty = 0;
  inputs.forEach(inp => {
    const v = parseInt(inp.value) || 0;
    if (v > 0) { quantities[inp.dataset.size] = v; totalQty += v; }
  });
  const g = manualOrderGroups.find(g => g.id === catalogTargetGroupId);
  if (!g) return;

  const itemData = {
    productId:   catalogSelectedProduct.id,
    productName: catalogSelectedProduct.name,
    color:       catalogSelectedColor ? catalogSelectedColor.name : '',
    colorHex:    catalogSelectedColor ? (catalogSelectedColor.hex || '') : '',
    mockup:      catalogSelectedColor ? (catalogSelectedColor.mockup || null) : null,
    quantities,
    totalQty,
  };

  if (catalogEditItemIdx !== null) {
    // Update existing item
    g.items[catalogEditItemIdx] = itemData;
  } else {
    g.items.push(itemData);
  }

  closeCatalog();
  renderDecoGroups();
}

function saveManualOrder(e) {
  e.preventDefault();
  const name    = document.getElementById('ao-name').value.trim();
  const email   = document.getElementById('ao-email').value.trim().toLowerCase();
  const phone   = document.getElementById('ao-phone').value.trim();
  const company = document.getElementById('ao-company').value.trim();
  const price   = parseFloat(document.getElementById('ao-price').value) || null;
  const status  = document.getElementById('ao-status').value;
  const notes   = document.getElementById('ao-notes').value.trim();
  const customerSuppliedBlanks = document.getElementById('ao-customer-supplied')?.checked || false;
  const inHandDate   = document.getElementById('ao-inhand-date')?.value || null;
  const isHardDeadline = document.getElementById('ao-hard-deadline')?.checked || false;

  // Validate customer is selected
  if (!manualOrderCustomer) {
    alert('Please search for and select a customer, or create a new one.');
    return;
  }

  // Validate at least one product exists
  const totalItems = manualOrderGroups.reduce((s, g) => s + g.items.length, 0);
  if (totalItems === 0) {
    alert('Please add at least one product to the order.');
    return;
  }

  // Build decorationGroups
  const decorationGroups = manualOrderGroups
    .filter(g => g.items.length > 0)
    .map(g => {
      const decos = g.decos || [];
      // Backward-compat fields for production board and older readers
      const decorationTypes = [...new Set(decos.map(d => d.type))];
      const locations = Object.fromEntries(decos.filter(d => d.location).map(d => [d.type, d.location]));
      return {
        id:              g.id,
        decos,                          // new format: [{iid, type, location}]
        decorationTypes,                // unique types for pricing / production
        locations,                      // backward compat: {type: lastLocation}
        location:        decos[0]?.location || '',
        items:           g.items,
        totalQty:        getGroupTotal(g),
      };
    });

  // Per-group price from the group price inputs (stored in manualOrderGroups[].pricePerPiece)
  manualOrderGroups.forEach(function(mg) {
    if (!mg.pricePerPiece) return;
    var dg = decorationGroups.find(function(g) { return g.id === mg.id; });
    if (!dg) return;
    dg.pricePerPiece = mg.pricePerPiece;  // persist on the group object
    dg.items.forEach(function(item) {
      item.pricePerPiece = mg.pricePerPiece;
      item.totalPrice    = parseFloat((mg.pricePerPiece * item.totalQty).toFixed(2));
    });
  });

  // Auto-calculate per-item price — prefers fixed pricing, falls back to formula
  if (!price) {
    decorationGroups.forEach(g => {
      if (g.pricePerPiece) return;
      const decoTypeIds = g.decorationTypes || [];
      if (!decoTypeIds.length) return;
      const locCounts = {};
      (g.decos || []).forEach(d => { locCounts[d.type] = (locCounts[d.type] || 0) + 1; });
      g.items.forEach(item => {
        const { rows } = getProductPriceRows(item.productId, decoTypeIds, locCounts);
        if (!rows.length) return;
        let activeRow = null;
        for (const row of rows) { if (g.totalQty >= row.qty) activeRow = row; }
        if (activeRow && activeRow.pricePerPiece != null) {
          item.pricePerPiece = parseFloat(activeRow.pricePerPiece.toFixed(2));
          item.totalPrice    = parseFloat((activeRow.pricePerPiece * item.totalQty).toFixed(2));
        }
      });
    });
  }

  // Store tier price ladder on each group so approval page can display dollar amounts
  decorationGroups.forEach(g => {
    const decoTypeIds = g.decorationTypes || [];
    if (!decoTypeIds.length) return;
    const locCounts = {};
    (g.decos || []).forEach(d => { locCounts[d.type] = (locCounts[d.type] || 0) + 1; });
    const refItem = (g.items || []).find(item => {
      const { rows } = getProductPriceRows(item.productId, decoTypeIds, locCounts);
      return rows.length > 0;
    });
    if (!refItem) return;
    const { rows } = getProductPriceRows(refItem.productId, decoTypeIds, locCounts);
    if (rows.length) {
      g.tierPrices = {};
      rows.forEach(r => { if (r.pricePerPiece != null) g.tierPrices[r.qty] = r.pricePerPiece; });
    }
  });

  // Flatten all decoration types across all groups for production board
  const decorationTypes = [...new Set(decorationGroups.flatMap(g => g.decorationTypes))];

  // Top-level summary fields (first group, first item for compat)
  const firstItem = decorationGroups[0]?.items[0] || {};
  const totalQty  = decorationGroups.reduce((s, g) => s + g.totalQty, 0);

  // Roll up effective price — manual override takes precedence, otherwise sum item totals
  const calcItemTotal = decorationGroups.reduce((s, g) =>
    s + g.items.reduce((ss, it) => ss + (it.totalPrice || 0), 0), 0);
  const effectiveTotal = price ? parseFloat((price * totalQty).toFixed(2))
    : (calcItemTotal > 0 ? parseFloat(calcItemTotal.toFixed(2)) : null);
  // Also capture first group's direct price as last-resort fallback (handles zero-qty case)
  const firstGroupPpp  = manualOrderGroups.find(mg => mg.pricePerPiece)?.pricePerPiece || null;
  const effectivePpp   = price
    || (effectiveTotal && totalQty ? parseFloat((effectiveTotal / totalQty).toFixed(2)) : null)
    || firstGroupPpp;
  const allSizes  = {};
  decorationGroups.forEach(g => g.items.forEach(it =>
    Object.entries(it.quantities).forEach(([sz, qty]) => { allSizes[sz] = (allSizes[sz] || 0) + qty; })
  ));

  const salesRepId   = document.getElementById('ao-sales-rep').value || null;
  const salesRepName = salesRepId ? (document.getElementById('ao-sales-rep').selectedOptions[0]?.text || null) : null;

  const orders = getOrders();

  if (_editingOrderId) {
    // ---- UPDATE existing order ----
    const idx = orders.findIndex(x => x.id === _editingOrderId);
    if (idx === -1) { alert('Order not found.'); return; }
    const existing = orders[idx];
    const updatedOrder = {
      ...existing,
      customerEmail:        email,
      customerName:         name,
      customerPhone:        phone,
      customerCompany:      company,
      product:              firstItem.productName || existing.product || '',
      color:                firstItem.color || existing.color || '',
      quantities:           allSizes,
      totalQty,
      decorationType:       decorationTypes[0] || '',
      decorationTypes,
      decorationGroups,
      notes,
      customerSuppliedBlanks,
      inHandDate:           inHandDate || null,
      isHardDeadline,
      status,
      pricePerPiece:        effectivePpp,
      totalPrice:           effectiveTotal,
      salesRepId,
      salesRepName,
      updatedAt:            new Date().toISOString(),
    };
    orders[idx] = updatedOrder;
    saveOrders(orders);
    ordersData = getOrders();
    const editedId = _editingOrderId;
    if (ordersViewMode === 'kanban') renderKanbanBoard();
    else filterOrders();
    logActivity('edited_order', 'order', editedId, `Edited order ${editedId} for ${name}`);
    if (_saveMode === 'continue') {
      toast('Saved — ' + editedId, 'success');
    } else {
      closeAddOrderModal();
      manualOrderCustomer = null;
      toast('Order updated — ' + editedId, 'success');
    }
    return;
  }

  // ---- CREATE new order ----
  const ref = 'INS-' + Date.now().toString().slice(-6);
  const order = {
    id:                   ref,
    customerEmail:        email,
    customerName:         name,
    customerPhone:        phone,
    customerCompany:      company,
    product:              firstItem.productName || '',
    color:                firstItem.color || '',
    quantities:           allSizes,
    totalQty,
    decorationType:       decorationTypes[0] || '',
    decorationTypes,
    decorationGroups,
    notes,
    statusNotes:          '',
    customerNote:         '',
    trackingNumber:       '',
    source:               'manual',
    customerSuppliedBlanks,
    inHandDate:           inHandDate || null,
    isHardDeadline,
    status,
    visibleToCustomer:    true,
    pricePerPiece:        effectivePpp,
    totalPrice:           effectiveTotal,
    isPaid:               false,
    salesRepId,
    salesRepName,
    createdAt:            new Date().toISOString(),
    updatedAt:            new Date().toISOString(),
  };

  orders.unshift(order);
  saveOrders(orders);
  ordersData = getOrders();
  if (ordersViewMode === 'kanban') renderKanbanBoard();
  else filterOrders();
  toast('Order created — ' + ref, 'success');
  logActivity('created_order', 'order', ref, `Created order ${ref} for ${name}`);
  if (typeof fireOrderEvent === 'function') fireOrderEvent('order_created', order, null);

  if (_saveMode === 'continue') {
    // Stay in modal, switch to edit mode so further saves update the same order
    _editingOrderId = ref;
    const t = document.querySelector('#add-order-modal-overlay .a-modal-header h3');
    if (t) t.textContent = 'Edit Order — ' + ref;
    const eb = document.getElementById('ao-save-exit-btn');
    if (eb) eb.textContent = 'Update Order';
    return;
  }
  closeAddOrderModal();

  // Save commission entry if sales rep tagged and we can see commission amounts
  if (order.salesRepId && canViewCommissions()) {
    const commAmt = parseFloat(document.getElementById('ao-commission').value) || 0;
    const sel = document.getElementById('ao-sales-rep');
    const rate = parseFloat(sel.options[sel.selectedIndex]?.dataset.rate) || 0;
    if (commAmt > 0) {
      saveCommissionEntry({
        orderId: ref,
        repId: order.salesRepId,
        repName: order.salesRepName,
        commissionAmount: commAmt,
        commissionRate: rate,
        orderTotal: order.totalPrice || 0,
      }).catch(e => console.warn('[Commissions] Save failed', e));
    }
  }

  // Auto-send portal access email if toggled
  if (manualOrderCustomer && manualOrderCustomer.sendEmail && manualOrderCustomer.tempPassword) {
    sendPortalAccessEmail(manualOrderCustomer.email, manualOrderCustomer.name, manualOrderCustomer.tempPassword);
  }
  manualOrderCustomer = null;
}

// ============================================
// CUSTOMER SEARCH (Manual Order)
// ============================================

function resetCustomerSearch() {
  manualOrderCustomer = null;
  _ncTempPassword = '';
  const searchArea = document.getElementById('ao-customer-search-area');
  const selectedDisplay = document.getElementById('ao-customer-selected-display');
  const newForm = document.getElementById('ao-new-customer-form');
  const inp = document.getElementById('ao-customer-search-input');
  if (searchArea) searchArea.style.display = 'block';
  if (selectedDisplay) { selectedDisplay.style.display = 'none'; selectedDisplay.innerHTML = ''; }
  if (newForm) newForm.style.display = 'none';
  if (inp) inp.value = '';
  hideCustomerDropdown();
  ['ao-name','ao-email','ao-phone','ao-company'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function searchCustomerInput(val) {
  const q = (val || '').trim();
  if (q.length < 2) { hideCustomerDropdown(); return; }
  const results = searchAccounts(q);
  renderCustomerDropdown(results, q);
}

function hideCustomerDropdown() {
  const dd = document.getElementById('ao-cust-dropdown');
  if (dd) dd.style.display = 'none';
}

function renderCustomerDropdown(results, query) {
  const dd = document.getElementById('ao-cust-dropdown');
  if (!dd) return;

  const items = results.slice(0, 8).map(a => {
    const fullName = [a.firstName, a.lastName].filter(Boolean).join(' ');
    const meta = [a.company, a.phone].filter(Boolean).join(' · ');
    return `<div class="ao-cust-result" onclick="selectCustomerFromSearch('${a.email.replace(/'/g,"\\'")}')">
      <div class="ao-cust-result-name">${fullName || a.email}</div>
      <div class="ao-cust-result-meta">${a.email}${meta ? ' · ' + meta : ''}</div>
    </div>`;
  }).join('');

  dd.innerHTML = items + `<div class="ao-cust-create-row" onclick="initNewCustomerForm()">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    Create new customer${query ? ' for "' + query + '"' : ''}
  </div>`;
  dd.style.display = 'block';
}

function selectCustomerFromSearch(email) {
  const acct = getAccountByEmail(email);
  if (!acct) return;
  const fullName = [acct.firstName, acct.lastName].filter(Boolean).join(' ');
  manualOrderCustomer = {
    name:    fullName || acct.email,
    email:   acct.email,
    phone:   acct.phone || '',
    company: acct.company || '',
    isNew:   false,
    tempPassword: acct.tempPassword || null,
    sendEmail: false,
  };
  syncCustomerHiddenInputs();
  hideCustomerDropdown();
  renderSelectedCustomerDisplay();
}

function initNewCustomerForm() {
  hideCustomerDropdown();
  const searchArea  = document.getElementById('ao-customer-search-area');
  const newForm     = document.getElementById('ao-new-customer-form');
  const pwPreview   = document.getElementById('ao-nc-pw-preview');
  const pwVal       = document.getElementById('ao-nc-pw-val');
  const alreadyTag  = document.getElementById('ao-nc-already-exists');
  if (searchArea) searchArea.style.display = 'none';
  if (newForm)    newForm.style.display = 'block';

  // Pre-fill name from search input if it looks like a name (not email)
  const searchVal = (document.getElementById('ao-customer-search-input') || {}).value || '';
  if (searchVal && !searchVal.includes('@')) {
    const parts = searchVal.trim().split(' ');
    const firstEl = document.getElementById('ao-nc-first');
    const lastEl  = document.getElementById('ao-nc-last');
    if (firstEl) firstEl.value = parts[0] || '';
    if (lastEl)  lastEl.value  = parts.slice(1).join(' ') || '';
  }

  // Pre-generate temp password
  _ncTempPassword = generateTempPassword();
  if (pwVal) pwVal.textContent = _ncTempPassword;
  if (pwPreview) pwPreview.style.display = 'flex';
  if (alreadyTag) alreadyTag.style.display = 'none';

  // Watch email input to check if account already exists
  const emailInp = document.getElementById('ao-nc-email');
  if (emailInp) {
    emailInp.oninput = () => {
      const e = emailInp.value.trim().toLowerCase();
      const exists = e.includes('@') && !!getAccountByEmail(e);
      if (alreadyTag) alreadyTag.style.display = exists ? 'inline' : 'none';
      if (pwPreview) pwPreview.style.display = exists ? 'none' : 'flex';
    };
  }
}

function cancelNewCustomer() {
  const searchArea = document.getElementById('ao-customer-search-area');
  const newForm    = document.getElementById('ao-new-customer-form');
  if (searchArea) searchArea.style.display = 'block';
  if (newForm)    newForm.style.display = 'none';
  ['ao-nc-first','ao-nc-last','ao-nc-email','ao-nc-phone','ao-nc-company'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function confirmNewCustomer() {
  const firstName = (document.getElementById('ao-nc-first')?.value || '').trim();
  const lastName  = (document.getElementById('ao-nc-last')?.value  || '').trim();
  const email     = (document.getElementById('ao-nc-email')?.value || '').trim().toLowerCase();
  const phone     = (document.getElementById('ao-nc-phone')?.value || '').trim();
  const company   = (document.getElementById('ao-nc-company')?.value || '').trim();
  const sendEmail = document.getElementById('ao-nc-send-email')?.checked || false;

  if (!firstName) { alert('First name is required.'); return; }
  if (!email)     { alert('Email is required.'); return; }

  const result = adminCreateAccount({ firstName, lastName, email, phone, company, tempPassword: _ncTempPassword });
  if (!result.ok) { alert(result.error); return; }

  const tempPw = result.alreadyExists ? result.user.tempPassword : _ncTempPassword;
  manualOrderCustomer = {
    name:         [firstName, lastName].filter(Boolean).join(' '),
    email,
    phone,
    company,
    isNew:        !result.alreadyExists,
    tempPassword: tempPw,
    sendEmail,
  };
  syncCustomerHiddenInputs();
  renderSelectedCustomerDisplay();

  // Hide new customer form
  const newForm = document.getElementById('ao-new-customer-form');
  if (newForm) newForm.style.display = 'none';

  toast('Customer ' + (result.alreadyExists ? 'found' : 'created') + ' — ' + email, 'success');
}

function syncCustomerHiddenInputs() {
  if (!manualOrderCustomer) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('ao-name',    manualOrderCustomer.name);
  set('ao-email',   manualOrderCustomer.email);
  set('ao-phone',   manualOrderCustomer.phone);
  set('ao-company', manualOrderCustomer.company);
}

function renderSelectedCustomerDisplay() {
  const area    = document.getElementById('ao-customer-search-area');
  const display = document.getElementById('ao-customer-selected-display');
  if (!display || !manualOrderCustomer) return;
  if (area) area.style.display = 'none';
  display.style.display = 'block';

  const c = manualOrderCustomer;
  const meta = [c.email, c.phone, c.company].filter(Boolean).join(' · ');
  const hasTempPw = c.tempPassword;

  display.innerHTML = `
    <div class="ao-cust-selected-card">
      <div class="ao-cust-selected-info">
        <div class="ao-cust-selected-name">${c.name}</div>
        <div class="ao-cust-selected-meta">${meta}</div>
        ${hasTempPw ? `<div class="ao-cust-pw-badge">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Temp password: <strong>${c.tempPassword}</strong> <span style="color:var(--text-muted);font-weight:400">(not yet changed by customer)</span>
        </div>` : ''}
      </div>
      <button type="button" class="a-btn a-btn-ghost" style="font-size:12px;padding:4px 12px" onclick="resetCustomerSearch()">Change</button>
    </div>
    <div class="ao-cust-email-row">
      <label class="ao-cust-send-toggle">
        <input type="checkbox" id="ao-send-email-toggle" ${c.sendEmail ? 'checked' : ''} onchange="manualOrderCustomer.sendEmail=this.checked;renderSendEmailBtn()">
        <span class="toggle-track"></span>
        <span>Send portal access email to customer</span>
      </label>
      <button type="button" class="a-btn a-btn-ghost ao-send-email-btn" id="ao-send-email-btn" onclick="triggerPortalAccessEmail()" style="${c.sendEmail ? '' : 'display:none'}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        Send Now
      </button>
    </div>`;
}

function renderSendEmailBtn() {
  const btn = document.getElementById('ao-send-email-btn');
  if (!btn || !manualOrderCustomer) return;
  btn.style.display = manualOrderCustomer.sendEmail ? '' : 'none';
}

function triggerPortalAccessEmail() {
  if (!manualOrderCustomer) return;
  const pw = manualOrderCustomer.tempPassword;
  if (!pw) {
    alert('No temp password on file — customer may have already set their own password.');
    return;
  }
  sendPortalAccessEmail(manualOrderCustomer.email, manualOrderCustomer.name, pw);
}

function sendPortalAccessEmail(email, name, tempPassword) {
  const portalUrl = (typeof EMAIL_CONFIG !== 'undefined' && EMAIL_CONFIG.portalUrl)
    ? EMAIL_CONFIG.portalUrl
    : window.location.origin + '/portal.html';

  // Try EmailJS
  if (typeof emailjs !== 'undefined' &&
      typeof EMAIL_CONFIG !== 'undefined' &&
      EMAIL_CONFIG.emailjsPublicKey &&
      EMAIL_CONFIG.emailjsServiceId &&
      EMAIL_CONFIG.emailjsTemplateId) {
    emailjs.init(EMAIL_CONFIG.emailjsPublicKey);
    emailjs.send(EMAIL_CONFIG.emailjsServiceId, EMAIL_CONFIG.emailjsTemplateId, {
      to_email:       email,
      customer_name:  name,
      temp_password:  tempPassword,
      portal_url:     portalUrl,
    }).then(() => {
      toast('Portal access email sent to ' + email, 'success');
    }).catch(err => {
      console.warn('[EmailJS] Send failed:', err);
      _fallbackMailto(email, name, tempPassword, portalUrl);
    });
    return;
  }

  // Fallback: open mailto
  _fallbackMailto(email, name, tempPassword, portalUrl);
}

function _fallbackMailto(email, name, tempPassword, portalUrl) {
  const subject = 'Your Insignia Screen Printing Portal Access';
  const body = `Hi ${name},\n\nYou now have access to the Insignia order portal where you can track all of your orders.\n\nPortal link: ${portalUrl}\nEmail: ${email}\nPassword: ${tempPassword}\n\nYou can update your password after your first login.\n\nThanks,\nInsignia Screen Printing`;
  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailto, '_blank');
  toast('Email client opened — review and send the email', 'success');
}

// ============================================
// CUSTOMERS SECTION
// ============================================

// Auto-create a thin profile for any order email that has no account yet
function _syncCustomersFromOrders() {
  const orders = getOrders();
  const accounts = getAccounts();
  const emailSet = new Set(accounts.map(a => a.email));
  let changed = false;
  orders.forEach(o => {
    const e = (o.customerEmail || '').toLowerCase().trim();
    if (!e || emailSet.has(e)) return;
    const parts = (o.customerName || '').trim().split(' ');
    accounts.push({
      email: e,
      firstName: parts[0] || '',
      lastName:  parts.slice(1).join(' ') || '',
      phone:     o.customerPhone || '',
      company:   o.customerCompany || '',
      isVip:     false,
      notes:     '',
      passwordHash: '',
      createdAt: o.createdAt || new Date().toISOString(),
      fromOrder: true,
    });
    emailSet.add(e);
    changed = true;
  });
  if (changed) saveAccounts(accounts);
}

function renderCustomersSection() {
  _syncCustomersFromOrders();
  const wrap = document.getElementById('customers-content');
  if (!wrap) return;

  const accounts  = getAccounts();
  const orders    = getOrders();
  const catalogs  = getCatalogs();

  // Count orders per email
  const orderCount = {};
  orders.forEach(o => {
    const e = (o.customerEmail || '').toLowerCase();
    if (e) orderCount[e] = (orderCount[e] || 0) + 1;
  });

  const vipCount  = accounts.filter(a => a.isVip).length;
  const catCount  = catalogs.length;
  const searchId  = 'cust-search-' + Date.now();

  const rows = accounts.map(a => {
    const fullName = [a.firstName, a.lastName].filter(Boolean).join(' ') || '—';
    const cnt   = orderCount[a.email] || 0;
    const cat   = catalogs.find(c => c.customerEmail === a.email);
    const catBadge = cat
      ? `<button class="a-btn a-btn-ghost a-btn-sm" style="color:#f59e0b" onclick="openCatalogEditor('${a.email}')">
           <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
           ${cat.items.length} item${cat.items.length !== 1 ? 's' : ''}
         </button>`
      : `<button class="a-btn a-btn-ghost a-btn-sm" onclick="openCatalogEditor('${a.email}')">Create Catalog</button>`;
    return `
      <tr class="cust-row" data-email="${a.email}" data-name="${fullName.toLowerCase()}" data-company="${(a.company||'').toLowerCase()}">
        <td class="cust-td">
          <div class="cust-name">${fullName}</div>
          ${a.company ? `<div class="cust-company">${a.company}</div>` : ''}
        </td>
        <td class="cust-td"><a href="mailto:${a.email}" class="cust-email-link" onclick="event.stopPropagation()">${a.email}</a></td>
        <td class="cust-td">${a.phone || '—'}</td>
        <td class="cust-td" style="text-align:center">${cnt > 0 ? `<span class="cust-order-count">${cnt}</span>` : '—'}</td>
        <td class="cust-td" style="text-align:center">
          ${a.isVip ? '<span class="cust-vip-badge">VIP</span>' : ''}
        </td>
        <td class="cust-td">${catBadge}</td>
        <td class="cust-td">
          <div style="display:flex;gap:6px;justify-content:flex-end">
            <button class="a-btn a-btn-ghost a-btn-icon a-btn-sm" onclick="openAddCustomerModal('${a.email}')" title="Edit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="a-btn a-btn-ghost a-btn-icon a-btn-sm" onclick="confirmDeleteCustomer('${a.email}')" title="Delete" style="color:#ef4444">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <div class="cust-stats-row">
      <div class="cust-stat"><span class="cust-stat-val">${accounts.length}</span><span class="cust-stat-label">Total Customers</span></div>
      <div class="cust-stat"><span class="cust-stat-val" style="color:#f59e0b">${vipCount}</span><span class="cust-stat-label">VIP</span></div>
      <div class="cust-stat"><span class="cust-stat-val" style="color:#a855f7">${catCount}</span><span class="cust-stat-label">With Catalog</span></div>
    </div>
    <div class="cust-search-wrap">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input class="a-input" id="${searchId}" placeholder="Search by name, email, or company…" oninput="filterCustomers(this.value)">
    </div>
    <div class="cust-table-wrap">
      <table class="cust-table" id="cust-table">
        <thead>
          <tr>
            <th class="cust-th">Name</th>
            <th class="cust-th">Email</th>
            <th class="cust-th">Phone</th>
            <th class="cust-th" style="text-align:center">Orders</th>
            <th class="cust-th" style="text-align:center">VIP</th>
            <th class="cust-th">Catalog</th>
            <th class="cust-th"></th>
          </tr>
        </thead>
        <tbody id="cust-tbody">${rows || '<tr><td colspan="7" style="text-align:center;padding:32px;color:#555">No customers yet — they\'ll appear here once orders are placed.</td></tr>'}</tbody>
      </table>
    </div>`;
}

function filterCustomers(query) {
  const q = (query || '').toLowerCase().trim();
  document.querySelectorAll('#cust-tbody .cust-row').forEach(row => {
    const match = !q
      || row.dataset.name.includes(q)
      || row.dataset.email.includes(q)
      || row.dataset.company.includes(q);
    row.style.display = match ? '' : 'none';
  });
}

function openAddCustomerModal(emailToEdit) {
  const acct = emailToEdit ? getAccountByEmail(emailToEdit) : null;
  document.getElementById('add-customer-title').textContent = acct ? 'Edit Customer' : 'Add Customer';
  document.getElementById('cust-edit-email-orig').value = emailToEdit || '';
  document.getElementById('cust-first').value   = acct ? (acct.firstName || '') : '';
  document.getElementById('cust-last').value    = acct ? (acct.lastName  || '') : '';
  document.getElementById('cust-email').value   = acct ? acct.email : '';
  document.getElementById('cust-phone').value   = acct ? (acct.phone   || '') : '';
  document.getElementById('cust-company').value = acct ? (acct.company || '') : '';
  document.getElementById('cust-notes').value   = acct ? (acct.notes   || '') : '';
  document.getElementById('cust-vip').checked   = acct ? !!acct.isVip : false;
  document.getElementById('cust-save-result').style.display = 'none';
  document.getElementById('cust-email').disabled = !!acct; // lock email on edit
  document.getElementById('add-customer-overlay').style.display = 'flex';
}

function closeAddCustomerModal() {
  document.getElementById('add-customer-overlay').style.display = 'none';
}

function saveCustomerForm() {
  const origEmail = document.getElementById('cust-edit-email-orig').value;
  const email     = (document.getElementById('cust-email').value || '').trim().toLowerCase();
  if (!email) { alert('Email is required.'); return; }

  const accts = getAccounts();
  const idx   = accts.findIndex(a => a.email === (origEmail || email));
  const now   = new Date().toISOString();
  const data  = {
    email,
    firstName: document.getElementById('cust-first').value.trim(),
    lastName:  document.getElementById('cust-last').value.trim(),
    phone:     document.getElementById('cust-phone').value.trim(),
    company:   document.getElementById('cust-company').value.trim(),
    notes:     document.getElementById('cust-notes').value.trim(),
    isVip:     document.getElementById('cust-vip').checked,
  };

  if (idx >= 0) {
    accts[idx] = { ...accts[idx], ...data, updatedAt: now };
  } else {
    accts.push({ ...data, passwordHash: '', tempPassword: generateTempPassword(), createdAt: now });
  }
  saveAccounts(accts);

  const res = document.getElementById('cust-save-result');
  res.textContent = idx >= 0 ? 'Customer updated.' : 'Customer added.';
  res.style.display = 'block';
  setTimeout(() => { closeAddCustomerModal(); renderCustomersSection(); }, 800);
}

function confirmDeleteCustomer(email) {
  if (!confirm(`Delete customer profile for ${email}?\n\nThis only removes their profile — it does NOT delete their orders.`)) return;
  const accts = getAccounts().filter(a => a.email !== email);
  saveAccounts(accts);
  renderCustomersSection();
  toast('Customer profile removed', 'success');
}

// ============================================
// CATALOG EDITOR
// ============================================

let _catalogEditorEmail = null;
let _catalogEditorItems = [];   // working copy

function openCatalogEditor(email) {
  _catalogEditorEmail = email;
  const acct = getAccountByEmail(email);
  const name = acct ? [acct.firstName, acct.lastName].filter(Boolean).join(' ') : email;

  // Get or create catalog
  let cat = getCatalogByEmail(email);
  if (!cat) cat = upsertCatalog(email, name);
  _catalogEditorItems = (cat.items || []).map(i => {
    const m = { ...i };
    // Migrate old single-value fields to arrays
    if (!Array.isArray(m.decorationTypes)) {
      m.decorationTypes = m.decorationType ? [m.decorationType] : [];
      delete m.decorationType;
    }
    if (!Array.isArray(m.locations)) {
      m.locations = m.decorationLocation ? [m.decorationLocation] : [];
      delete m.decorationLocation;
    }
    if (!m.priceBreaks) {
      m.priceBreaks = {};
    } else {
      // Migrate old nested format { decoId: { qty: price } } → flat { qty: price }
      const keys = Object.keys(m.priceBreaks);
      if (keys.length && isNaN(keys[0])) m.priceBreaks = {};
    }
    return m;
  });

  document.getElementById('catalog-editor-title').textContent = `VIP Catalog — ${name}`;
  document.getElementById('catalog-editor-sub').textContent   = email;

  const deleteBtn = document.getElementById('catalog-delete-btn');
  if (deleteBtn) deleteBtn.style.display = cat.items.length > 0 ? 'inline-flex' : 'none';

  // Portal link
  const linkWrap = document.getElementById('catalog-portal-link');
  if (linkWrap) {
    const base = window.location.href.replace(/[^/]*$/, '');
    const url  = base + 'portal.html';
    linkWrap.innerHTML = `<span style="font-size:11px;color:#555">Customer portal:</span>
      <a href="${url}" target="_blank" style="font-size:11px;color:var(--accent);text-decoration:none">${url}</a>`;
  }

  _renderCatalogEditorItems();
  const overlay = document.getElementById('catalog-editor-overlay');
  overlay.style.display = 'flex';
}

function closeCatalogEditor() {
  document.getElementById('catalog-editor-overlay').style.display = 'none';
  _catalogEditorEmail = null;
  _catalogEditorItems = [];
}

function _renderCatalogEditorItems() {
  const body = document.getElementById('catalog-editor-body');
  if (!body) return;

  if (!_catalogEditorItems.length) {
    body.innerHTML = `<div class="catalog-empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
      <p>No products added yet.<br>Click <strong>Add Products</strong> below to get started.</p>
    </div>`;
    return;
  }

  body.innerHTML = `<div class="catalog-items-list">
    ${_catalogEditorItems.map((item, idx) => {
      const img = item.mockup
        ? `<img src="${item.mockup}" alt="${item.productName}" class="ci-thumb">`
        : `<div class="ci-thumb ci-thumb-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.86H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.86l.58-3.57a2 2 0 00-1.34-2.23z"/></svg></div>`;

      const decoTypes = item.decorationTypes || [];
      const locations = item.locations || [];
      const remainingDecos = ALL_DECORATION_TYPES.filter(d => !decoTypes.includes(d.id));
      const remainingLocs  = ALL_LOCATIONS.filter(l => !locations.includes(l));

      const decoTypeTags = decoTypes.map(dtId => {
        const dt = ALL_DECORATION_TYPES.find(d => d.id === dtId);
        return dt ? `<span class="ci-tag">${dt.label}<button type="button" onclick="removeCatalogItemDecoType(${idx},'${dtId}')"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></span>` : '';
      }).join('');
      const decoAddSel = remainingDecos.length
        ? `<select class="ci-tag-add-select" onchange="addCatalogItemDecoType(${idx},this.value);this.value=''"><option value="">+ Add type…</option>${remainingDecos.map(d=>`<option value="${d.id}">${d.label}</option>`).join('')}</select>`
        : '';

      const locationTags = locations.map(loc =>
        `<span class="ci-tag">${loc}<button type="button" onclick="removeCatalogItemLocation(${idx},'${loc.replace(/'/g,"\\'")}')"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></span>`
      ).join('');
      const locAddSel = remainingLocs.length
        ? `<select class="ci-tag-add-select" onchange="addCatalogItemLocation(${idx},this.value);this.value=''"><option value="">+ Add location…</option>${remainingLocs.map(l=>`<option value="${l}">${l}</option>`).join('')}</select>`
        : '';

      // Single combined price break table for all decoration types
      const prod = adminProducts.find(p => p.id === item.productId);
      const blankCost = prod ? (parseFloat(prod.blankCost) || 0) : 0;

      const priceTables = (() => {
        if (!decoTypes.length) return '';
        const autoRows = blankCost > 0 ? calcCombinedPriceBreakRows(decoTypes, blankCost) : [];
        const tiers = autoRows.length ? autoRows.map(r => r.qty) : PRICE_BREAK_TIERS;
        const minQty = Math.max(...decoTypes.map(id => ALL_DECORATION_TYPES.find(d => d.id === id)?.minQty || 1));
        const decoLabel = decoTypes.map(id => ALL_DECORATION_TYPES.find(d => d.id === id)?.label || id).join(' + ');
        const titleNote = decoTypes.length > 1
          ? ` <span class="ci-pb-hint">— blank + ${decoTypes.length} decoration upcharges combined</span>`
          : ` <span class="ci-pb-hint">— leave blank for auto-calculated price</span>`;
        const rows = tiers.map(qty => {
          const autoPrice  = autoRows.find(r => r.qty === qty)?.pricePerPiece;
          const savedPrice = item.priceBreaks?.[qty]; // flat storage
          const val = savedPrice != null ? savedPrice.toFixed(2) : '';
          const ph  = autoPrice  != null ? autoPrice.toFixed(2)  : 'Custom';
          const dim = qty < minQty;
          return `<tr class="${dim ? 'ci-pb-dim' : ''}">
            <td class="ci-pb-qty">${qty}+${dim ? ` <span class="ci-pb-min">min ${minQty}</span>` : ''}</td>
            <td class="ci-pb-price"><div class="ci-pb-input-wrap"><span class="ci-pb-dollar">$</span>
              <input class="ci-pb-input" type="number" step="0.01" min="0" value="${val}" placeholder="${ph}"
                onchange="updateCatalogPriceBreak(${idx},${qty},this.value)">
            </div></td>
          </tr>`;
        }).join('');
        return `<div class="ci-pb-table-wrap">
          <div class="ci-pb-title">${decoLabel} Pricing${titleNote}</div>
          <table class="ci-pb-table">
            <thead><tr><th class="ci-pb-th">Qty</th><th class="ci-pb-th">Price/pc</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
      })();

      return `<div class="catalog-item-row">
        <div class="ci-row-top">
          ${img}
          <div class="ci-info">
            <div class="ci-name">${item.productName}</div>
            ${item.colorName ? `<div class="ci-color"><span class="ci-color-dot" style="background:${item.colorHex||'#888'}"></span>${item.colorName}</div>` : ''}
            ${item.notes ? `<div class="ci-notes">${item.notes}</div>` : ''}
          </div>
          <button class="a-btn a-btn-ghost a-btn-icon a-btn-sm" onclick="removeCatalogItem(${idx})" title="Remove" style="color:#ef4444;flex-shrink:0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="ci-row-deco">
          <div class="ci-deco-row-group">
            <span class="ci-deco-row-label">Decoration Types</span>
            <div class="ci-tag-row">${decoTypeTags}${decoAddSel}</div>
          </div>
          <div class="ci-deco-row-group">
            <span class="ci-deco-row-label">Locations</span>
            <div class="ci-tag-row">${locationTags}${locAddSel}</div>
          </div>
          <div class="ci-deco-row-group">
            <span class="ci-deco-row-label">Customer Mockup</span>
            <label class="ci-mockup-upload">
              ${item.mockup ? `<span class="ci-mockup-uploaded">&#10003; Uploaded</span>` : `<span class="ci-mockup-placeholder">Choose image…</span>`}
              <input type="file" accept="image/*" style="display:none" onchange="updateCatalogItemMockup(${idx},this)">
            </label>
          </div>
        </div>
        ${priceTables ? `<div class="ci-row-prices">${priceTables}</div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

function addCatalogItemDecoType(idx, dtId) {
  if (!dtId || idx < 0 || idx >= _catalogEditorItems.length) return;
  const item = _catalogEditorItems[idx];
  if (!Array.isArray(item.decorationTypes)) item.decorationTypes = [];
  if (!item.decorationTypes.includes(dtId)) { item.decorationTypes.push(dtId); _renderCatalogEditorItems(); }
}

function removeCatalogItemDecoType(idx, dtId) {
  if (idx < 0 || idx >= _catalogEditorItems.length) return;
  const item = _catalogEditorItems[idx];
  item.decorationTypes = (item.decorationTypes || []).filter(d => d !== dtId);
  _renderCatalogEditorItems();
}

function addCatalogItemLocation(idx, loc) {
  if (!loc || idx < 0 || idx >= _catalogEditorItems.length) return;
  const item = _catalogEditorItems[idx];
  if (!Array.isArray(item.locations)) item.locations = [];
  if (!item.locations.includes(loc)) { item.locations.push(loc); _renderCatalogEditorItems(); }
}

function removeCatalogItemLocation(idx, loc) {
  if (idx < 0 || idx >= _catalogEditorItems.length) return;
  const item = _catalogEditorItems[idx];
  item.locations = (item.locations || []).filter(l => l !== loc);
  _renderCatalogEditorItems();
}

function updateCatalogPriceBreak(idx, qty, val) {
  if (idx < 0 || idx >= _catalogEditorItems.length) return;
  const item = _catalogEditorItems[idx];
  if (!item.priceBreaks) item.priceBreaks = {};
  item.priceBreaks[qty] = val !== '' ? parseFloat(val) : null;
}

function updateCatalogItemMockup(idx, input) {
  if (idx < 0 || idx >= _catalogEditorItems.length) return;
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { _catalogEditorItems[idx].mockup = e.target.result; _renderCatalogEditorItems(); };
  reader.readAsDataURL(file);
}

function removeCatalogItem(idx) {
  _catalogEditorItems.splice(idx, 1);
  _renderCatalogEditorItems();
}

function saveCatalogEdits() {
  if (!_catalogEditorEmail) return;
  const acct = getAccountByEmail(_catalogEditorEmail);
  const name = acct ? [acct.firstName, acct.lastName].filter(Boolean).join(' ') : _catalogEditorEmail;
  const cat  = upsertCatalog(_catalogEditorEmail, name);
  saveCatalogItems(cat.id, _catalogEditorItems);
  closeCatalogEditor();
  renderCustomersSection();
  toast('Catalog saved', 'success');
}

function confirmDeleteCatalog() {
  if (!confirm('Delete this catalog? This cannot be undone.')) return;
  const cat = getCatalogByEmail(_catalogEditorEmail);
  if (cat) deleteCatalog(cat.id);
  closeCatalogEditor();
  renderCustomersSection();
  toast('Catalog deleted', 'success');
}

// ---- Product picker ----
// ---- Catalog product picker state ----
let _cpProduct = null;
let _cpConfig  = { colorId: '', colorName: '', colorHex: '', mockup: '', decorationTypes: [], locations: [] };

function openCatalogProductPicker() {
  _cpProduct = null;
  _cpConfig  = { colorId: '', colorName: '', colorHex: '', mockup: '', decorationTypes: [], locations: [] };
  const overlay = document.getElementById('catalog-picker-overlay');
  overlay.style.display = 'flex';
  document.getElementById('catalog-picker-search').value = '';
  document.getElementById('cp-footer').style.display = 'none';
  _renderCatalogPickerGrid('');
  _renderCpConfig();
}

function closeCatalogProductPicker() {
  document.getElementById('catalog-picker-overlay').style.display = 'none';
}

function filterCatalogPicker(q) {
  _renderCatalogPickerGrid(q);
}

function _renderCatalogPickerGrid(query) {
  const grid = document.getElementById('catalog-picker-grid');
  if (!grid) return;
  const q = (query || '').toLowerCase().trim();
  const products = getProducts().filter(p =>
    !q || p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)
  );
  if (!products.length) {
    grid.innerHTML = `<p style="text-align:center;color:#555;padding:24px">No products found.</p>`;
    return;
  }
  grid.innerHTML = products.map(p => {
    const firstColor = (p.colors || [])[0];
    const img = firstColor?.mockup
      ? `<img src="${firstColor.mockup}" alt="${p.name}" class="cp-card-img">`
      : `<div class="cp-card-img cp-card-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.86H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.86l.58-3.57a2 2 0 00-1.34-2.23z"/></svg></div>`;
    const sel = _cpProduct && _cpProduct.id === p.id;
    return `<div class="cp-card${sel ? ' cp-card-selected' : ''}" onclick="_cpSelectProduct('${p.id}')">
      ${img}
      <div class="cp-card-name">${p.name}</div>
      <div class="cp-card-category">${p.category || ''}</div>
    </div>`;
  }).join('');
}

function _cpSelectProduct(productId) {
  const p = getProducts().find(p => p.id === productId);
  if (!p) return;
  _cpProduct = p;
  _cpConfig  = { colorId: '', colorName: '', colorHex: '', mockup: '', decorationTypes: [], locations: [] };
  // Auto-select if only one color
  if ((p.colors || []).length === 1) {
    const c = p.colors[0];
    _cpConfig.colorId = c.id || c.name;
    _cpConfig.colorName = c.name;
    _cpConfig.colorHex  = c.hex || '';
    _cpConfig.mockup    = c.mockup || '';
  }
  _renderCatalogPickerGrid(document.getElementById('catalog-picker-search').value || '');
  _renderCpConfig();
  document.getElementById('cp-footer').style.display = 'flex';
}

function _cpSelectColor(colorId, colorName, colorHex, mockup) {
  _cpConfig.colorId   = colorId;
  _cpConfig.colorName = colorName;
  _cpConfig.colorHex  = colorHex;
  _cpConfig.mockup    = mockup;
  _renderCpConfig();
}

function _cpToggleDecoType(dtId) {
  const i = _cpConfig.decorationTypes.indexOf(dtId);
  if (i === -1) _cpConfig.decorationTypes.push(dtId);
  else _cpConfig.decorationTypes.splice(i, 1);
  _renderCpConfig();
}

function _cpToggleLocation(loc) {
  const i = _cpConfig.locations.indexOf(loc);
  if (i === -1) _cpConfig.locations.push(loc);
  else _cpConfig.locations.splice(i, 1);
  _renderCpConfig();
}

function _renderCpConfig() {
  const panel = document.getElementById('cp-config-panel');
  if (!panel) return;

  if (!_cpProduct) {
    panel.innerHTML = `<div class="cp-config-empty">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
      <p>Select a product from the list to configure it</p>
    </div>`;
    return;
  }

  const p = _cpProduct;
  const colors = p.colors || [];

  // Color preview
  const previewImg = _cpConfig.mockup
    ? `<img src="${_cpConfig.mockup}" class="cp-preview-img">`
    : '';

  // Color swatches
  const colorSection = colors.length ? `
    <div class="cp-config-section">
      <div class="cp-config-label">Color <span class="cp-config-required">*</span></div>
      <div class="cp-color-row">
        ${colors.map(c => {
          const cid = c.id || c.name;
          const sel = _cpConfig.colorId === cid;
          return `<button class="cp-color-btn${sel ? ' cp-color-btn-sel' : ''}"
            style="background:${c.hex||'#888'}" title="${c.name}"
            onclick="_cpSelectColor('${(cid).replace(/'/g,"\\'")}','${c.name.replace(/'/g,"\\'")}','${c.hex||''}','${(c.mockup||'').replace(/'/g,"\\'")}')">
            ${sel ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
          </button>`;
        }).join('')}
      </div>
      ${_cpConfig.colorName ? `<div style="font-size:11px;color:#888;margin-top:4px">${_cpConfig.colorName}</div>` : ''}
    </div>` : '';

  // Decoration types — only those the product supports
  const allowedDecos = (p.decoration || []).map(id => ALL_DECORATION_TYPES.find(d => d.id === id)).filter(Boolean);
  const decoSection = allowedDecos.length ? `
    <div class="cp-config-section">
      <div class="cp-config-label">Decoration Types <span class="cp-config-required">*</span></div>
      <div class="cp-checkbox-list">
        ${allowedDecos.map(dt => {
          const chk = _cpConfig.decorationTypes.includes(dt.id);
          return `<label class="cp-checkbox-item${chk ? ' checked' : ''}">
            <input type="checkbox" ${chk ? 'checked' : ''} onchange="_cpToggleDecoType('${dt.id}')">
            <span>${dt.label}</span>
            <span class="cp-min-badge">min ${dt.minQty}</span>
          </label>`;
        }).join('')}
      </div>
    </div>` : `<div class="cp-config-section"><p style="font-size:12px;color:#555">No decoration types configured for this product.</p></div>`;

  // Locations — product-specific list, fall back to ALL_LOCATIONS
  const allowedLocs = (p.locations && p.locations.length) ? p.locations : ALL_LOCATIONS;
  const locSection = `
    <div class="cp-config-section">
      <div class="cp-config-label">Decoration Locations <span class="cp-config-required">*</span></div>
      <div class="cp-checkbox-list">
        ${allowedLocs.map(loc => {
          const chk = _cpConfig.locations.includes(loc);
          return `<label class="cp-checkbox-item${chk ? ' checked' : ''}">
            <input type="checkbox" ${chk ? 'checked' : ''} onchange="_cpToggleLocation('${loc.replace(/'/g,"\\'")}')">
            <span>${loc}</span>
          </label>`;
        }).join('')}
      </div>
    </div>`;

  panel.innerHTML = `
    <div class="cp-config-product-name">${p.name}</div>
    ${previewImg}
    ${colorSection}
    ${decoSection}
    ${locSection}
  `;
}

function confirmAddProductToCatalog() {
  if (!_cpProduct) return;
  if (!_cpConfig.colorId && (_cpProduct.colors || []).length) {
    toast('Please select a color', 'error'); return;
  }
  if (!_cpConfig.decorationTypes.length) {
    toast('Please select at least one decoration type', 'error'); return;
  }
  if (!_cpConfig.locations.length) {
    toast('Please select at least one location', 'error'); return;
  }
  _catalogEditorItems.push({
    productId:      _cpProduct.id,
    productName:    _cpProduct.name,
    colorId:        _cpConfig.colorId,
    colorName:      _cpConfig.colorName,
    colorHex:       _cpConfig.colorHex,
    mockup:         _cpConfig.mockup,
    decorationTypes: [..._cpConfig.decorationTypes],
    locations:       [..._cpConfig.locations],
    priceBreaks:    {},
    notes: '',
  });
  _renderCatalogEditorItems();
  closeCatalogProductPicker();
  toast(`${_cpProduct.name}${_cpConfig.colorName ? ' · ' + _cpConfig.colorName : ''} added`, 'success');
  document.getElementById('catalog-delete-btn').style.display = 'inline-flex';
}

// ============================================
// KANBAN BOARD
// ============================================
let kbDraggingId = null;
let _kbColSort = {}; // colId → 'date-desc' | 'date-asc' | 'status'
let _prodSort = null;  // production board: colId being grouped by, or null for default

function kbSetColSort(colId, mode) {
  _kbColSort[colId] = mode;
  renderKanbanBoard();
}

function renderKanbanBoard() {
  const board = document.getElementById('kanban-board');
  if (!board) return;
  ordersData = getOrders().filter(o => !o.archived);

  // Build groups map
  const groupMap = {};
  ordersData.forEach(o => {
    if (o.groupId) {
      if (!groupMap[o.groupId]) groupMap[o.groupId] = [];
      groupMap[o.groupId].push(o);
    }
  });

  // Returns kb items (singles + groups) that belong in a given kanban column
  function getKbItemsForColumn(col) {
    const subStatusIds = new Set(col.subStatuses.map(s => s.id));
    const singles = ordersData.filter(o => !o.groupId && subStatusIds.has(o.status));
    const groups = [];
    const seen = new Set();
    ordersData.forEach(o => {
      if (o.groupId && !seen.has(o.groupId)) {
        const gOrders = groupMap[o.groupId];
        const gStatus = getGroupDisplayStatus(gOrders);
        if (subStatusIds.has(gStatus)) {
          seen.add(o.groupId);
          groups.push({ type: 'group', groupId: o.groupId, orders: gOrders });
        }
      }
    });
    return [
      ...singles.map(o => ({ type: 'single', order: o })),
      ...groups,
    ];
  }

  const visibleCols = getVisibleKbCols();
  board.innerHTML = KANBAN_COLUMNS.filter(col => visibleCols.includes(col.id)).map(col => {
    let items = getKbItemsForColumn(col);

    // Sort items per column setting
    const sortMode = _kbColSort[col.id] || 'date-desc';
    const getDate = item => item.type === 'single' ? (item.order.createdAt || '') : (item.orders[0].createdAt || '');
    const getStatus = item => item.type === 'single' ? item.order.status : getGroupDisplayStatus(item.orders);
    if (sortMode === 'date-desc') {
      items = [...items].sort((a, b) => getDate(b).localeCompare(getDate(a)));
    } else if (sortMode === 'date-asc') {
      items = [...items].sort((a, b) => getDate(a).localeCompare(getDate(b)));
    } else if (sortMode === 'status') {
      const ssOrder = col.subStatuses.map(s => s.id);
      items = [...items].sort((a, b) => ssOrder.indexOf(getStatus(a)) - ssOrder.indexOf(getStatus(b)));
    }

    const cards = items.map(item => {
      if (item.type === 'single') return buildKbCard(item.order, col);
      return buildKbGroupCard(item.groupId, item.orders, col);
    }).join('');

    const sm = sortMode;
    const sortSelect = `<select class="kb-sort-select" onchange="kbSetColSort('${col.id}',this.value)" onclick="event.stopPropagation()">
      <option value="date-desc" ${sm==='date-desc'?'selected':''}>Newest</option>
      <option value="date-asc"  ${sm==='date-asc' ?'selected':''}>Oldest</option>
      <option value="status"    ${sm==='status'   ?'selected':''}>By Status</option>
    </select>`;

    return `
      <div class="kb-column">
        <div class="kb-col-header" style="border-top:3px solid ${col.color}">
          <div class="kb-col-header-left">
            <span class="kb-col-title">${col.label}</span>
            <span class="kb-col-count" style="background:${col.color}22;color:${col.color}">${items.length}</span>
          </div>
          ${sortSelect}
        </div>
        <div class="kb-col-body" data-col="${col.id}"
          ondragover="kbDragOver(event)"
          ondrop="kbDrop(event)"
          ondragleave="kbDragLeave(event)">
          ${cards}
          ${!items.length ? '<div class="kb-empty-col">Drop here</div>' : ''}
        </div>
      </div>`;
  }).join('');
}

function buildKbCard(o, col) {
  const si = getStatusInfo(o.status);
  const total = o.totalPrice ? `$${parseFloat(o.totalPrice).toFixed(2)}` : '';
  const sourceTag = o.source === 'catalog-reorder'
    ? `<span class="kb-tag kb-tag-reorder">Reorder</span>`
    : o.source === 'manual'
      ? `<span class="kb-tag kb-tag-lead">Manual</span>`
      : o.source === 'web-submission'
        ? `<span class="kb-tag kb-tag-lead">Lead</span>`
        : `<span class="kb-tag kb-tag-online">Online</span>`;

  // Sub-status quick-change — native select, no custom dropdown needed
  const currentCol = getStatusColumn(o.status);
  const ssOptions = currentCol.subStatuses.map(ss =>
    `<option value="${ss.id}" ${ss.id === o.status ? 'selected' : ''}>${ss.label}</option>`
  ).join('');

  return `
    <div class="kb-card" draggable="true" data-id="${o.id}"
      style="border-left-color:${si.color}"
      ondragstart="kbDragStart(event)"
      ondragend="kbDragEnd(event)"
      onclick="openOrderModal('${o.id}')">
      <div class="kb-card-top">
        <span class="kb-card-id">${o.id}</span>
        ${sourceTag}
        ${o.isPaid ? `<span class="kb-paid-badge"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>Paid</span>` : o.paymentRequestSentAt ? `<span class="kb-invoice-badge">Invoiced</span>` : ''}
      </div>
      ${o.customerCompany ? `<div class="kb-card-company">${o.customerCompany}</div>` : ''}
      <div class="kb-card-customer">${o.customerName || o.customerEmail || '—'}</div>
      ${total ? `<div class="kb-card-total">${total}</div>` : ''}
      <select class="kb-ss-select" style="color:${si.color};border-color:${si.color}40;background:${si.color}18"
        onchange="kbQuickStatus('${o.id}',this.value)"
        onclick="event.stopPropagation()"
        ondragstart="event.stopPropagation()">
        ${ssOptions}
      </select>
      ${(() => {
        if (!o.inHandDate) return '';
        const today = new Date(); today.setHours(0,0,0,0);
        const due = new Date(o.inHandDate + 'T12:00:00');
        const diff = Math.round((due - today) / 86400000);
        let color, label;
        if (diff < 0)      { color = '#ef4444'; label = `OVERDUE · Due ${formatDate(o.inHandDate)}`; }
        else if (diff <= 3){ color = '#ef4444'; label = `Due ${formatDate(o.inHandDate)} · ${diff}d`; }
        else if (diff <= 7){ color = '#f97316'; label = `Due ${formatDate(o.inHandDate)} · ${diff}d`; }
        else if (diff <= 30){ color = '#f59e0b'; label = `Due ${formatDate(o.inHandDate)}`; }
        else               { color = '#777';    label = `Due ${formatDate(o.inHandDate)}`; }
        const weight = diff <= 7 ? 'font-weight:700;' : '';
        return `<div class="kb-card-due" style="color:${color};${weight}">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${label}
        </div>`;
      })()}
      <div class="kb-card-date">Created ${formatDate(o.createdAt)}</div>
    </div>`;
}

function buildKbGroupCard(groupId, orders, col) {
  const displayStatus = getGroupDisplayStatus(orders);
  const si = getStatusInfo(displayStatus);
  const totalPrice = orders.reduce((s, o) => s + (parseFloat(o.totalPrice) || 0), 0);
  const firstOrder = orders[0];
  const customer = firstOrder.customerName || firstOrder.customerEmail || '—';
  const company  = firstOrder.customerCompany || '';
  return `
    <div class="kb-card kb-group-card" draggable="true" data-group="${groupId}"
      style="border-left-color:${si.color}"
      ondragstart="kbDragStart(event)"
      ondragend="kbDragEnd(event)"
      onclick="openGroupModal('${groupId}')">
      <div class="kb-card-top">
        <span class="kb-card-id">${groupId}</span>
        <span class="kb-tag kb-tag-group">${orders.length} items</span>
      </div>
      ${company ? `<div class="kb-card-company">${company}</div>` : ''}
      <div class="kb-card-customer">${customer}</div>
      ${totalPrice > 0 ? `<div class="kb-card-total">$${totalPrice.toFixed(2)}</div>` : ''}
      <div class="kb-card-date">Created ${formatDate(firstOrder.createdAt)}</div>
    </div>`;
}

let kbDraggingGroup = null;

function kbDragStart(e) {
  kbDraggingId = e.currentTarget.dataset.id || null;
  kbDraggingGroup = e.currentTarget.dataset.group || null;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function kbDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.kb-col-body').forEach(c => c.classList.remove('drag-over'));
  kbDraggingGroup = null;
}

function kbDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function kbDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('drag-over');
  }
}

const PROD_TRIGGER_STATUSES = new Set(['approved', 'pre-production', 'in-production', 'done']);

function _autoPushProduction(orderId, newStatus) {
  if (!PROD_TRIGGER_STATUSES.has(newStatus)) return;
  if (typeof ensureProductionJob !== 'function') return;
  const order = getOrders().find(o => o.id === orderId);
  if (!order) return;
  ensureProductionJob(order);
}

function kbDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const colId = e.currentTarget.dataset.col;
  if (!colId) return;
  const col = KANBAN_COLUMNS.find(c => c.id === colId);
  if (!col) return;
  const newStatus = col.subStatuses[0].id; // default to first sub-status of target column

  if (kbDraggingGroup) {
    const groupOrders = getOrders().filter(o => o.groupId === kbDraggingGroup);
    const approvedAt = PROD_TRIGGER_STATUSES.has(newStatus) ? new Date().toISOString() : undefined;
    groupOrders.forEach(o => updateOrder(o.id, {
      status: newStatus,
      ...(approvedAt && !o.approvedAt ? { approvedAt } : {}),
    }));
    if (PROD_TRIGGER_STATUSES.has(newStatus)) {
      groupOrders.forEach(o => _autoPushProduction(o.id, newStatus));
    }
    ordersData = getOrders();
    kbDraggingGroup = null;
    renderKanbanBoard();
    toast(`Group moved to ${col.label}`, 'success');
  } else if (kbDraggingId) {
    const draggingId = kbDraggingId;
    const prevOrder = getOrders().find(o => o.id === draggingId);
    updateOrder(draggingId, {
      status: newStatus,
      ...(PROD_TRIGGER_STATUSES.has(newStatus) && !prevOrder?.approvedAt ? { approvedAt: new Date().toISOString() } : {}),
    });
    _autoPushProduction(draggingId, newStatus);
    kbDraggingId = null;
    renderKanbanBoard();
    toast(`Moved to ${col.label}`, 'success');
  }
}

function kbQuickStatus(orderId, newStatus) {
  if (newStatus === 'approved') {
    const o = getOrders().find(x => x.id === orderId);
    if (o && !_isOrderApprovalComplete(o)) {
      toast('Customer must approve all mockups and quote before marking approved', 'error');
      return;
    }
  }
  const prevOrder = getOrders().find(o => o.id === orderId);
  updateOrder(orderId, {
    status: newStatus,
    ...(PROD_TRIGGER_STATUSES.has(newStatus) && !prevOrder?.approvedAt ? { approvedAt: new Date().toISOString() } : {}),
  });
  _autoPushProduction(orderId, newStatus);
  ordersData = getOrders();
  renderKanbanBoard();
  const si = getStatusInfo(newStatus);
  toast(`Status → ${si.label}`, 'success');
}

function copyApprovalLink(id) {
  const base = window.location.href.replace(/[^/]*$/, '');
  const url = base + 'approval.html?id=' + id;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => toast('Review link copied to clipboard', 'success'));
  } else {
    prompt('Copy this link and send to customer:', url);
  }
}

function openGroupModal(groupId) {
  const orders = getOrders().filter(o => o.groupId === groupId);
  if (!orders.length) return;

  const displayStatus = getGroupDisplayStatus(orders);
  const si = getStatusInfo(displayStatus);
  const customer = orders[0].customerName || orders[0].customerEmail || '—';
  const totalQty = orders.reduce((s, o) => s + (o.totalQty || 0), 0);
  const totalPrice = orders.reduce((s, o) => s + (parseFloat(o.totalPrice) || 0), 0);

  const itemRows = orders.map(o => {
    const osi = getStatusInfo(o.status);
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #222;">
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;color:#666;font-weight:700">${o.id}</div>
        <div style="font-size:14px;font-weight:600;color:#e0e0e0">${o.product || '—'}</div>
        <div style="font-size:12px;color:#888">${o.color || ''} · ${o.totalQty || 0} pcs</div>
      </div>
      <div class="order-status-badge" style="background:${osi.color}20;color:${osi.color};border:1px solid ${osi.color}40">${osi.label}</div>
      <button class="a-btn a-btn-ghost a-btn-sm" onclick="closeGroupModal();openOrderModal('${o.id}')">View</button>
    </div>`;
  }).join('');

  document.getElementById('order-modal-title').textContent = `Group ${groupId}`;
  document.getElementById('order-modal-subtitle').textContent = customer;
  document.getElementById('order-review-link-btn').style.display = 'none';

  document.getElementById('order-modal-body').innerHTML = `
    <div style="display:flex;gap:20px;margin-bottom:20px;flex-wrap:wrap">
      <div style="background:#161616;border:1px solid #222;border-radius:8px;padding:12px 20px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:#e0e0e0">${orders.length}</div>
        <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.06em">Items</div>
      </div>
      <div style="background:#161616;border:1px solid #222;border-radius:8px;padding:12px 20px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:#e0e0e0">${totalQty}</div>
        <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.06em">Total Pcs</div>
      </div>
      ${totalPrice > 0 ? `<div style="background:#161616;border:1px solid #222;border-radius:8px;padding:12px 20px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:#00c896">$${totalPrice.toFixed(2)}</div>
        <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.06em">Total</div>
      </div>` : ''}
    </div>
    <div style="font-size:12px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Items in this group</div>
    ${itemRows}
    <div style="margin-top:20px">
      <div style="font-size:12px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Move entire group to</div>
      <select id="group-move-status" class="a-input a-input-sm" style="width:220px">
        ${STATUS_TIMELINE.map(sid => {
          const ssi = getStatusInfo(sid);
          return `<option value="${sid}" ${sid === displayStatus ? 'selected' : ''}>${ssi.label}</option>`;
        }).join('')}
      </select>
      <button class="a-btn a-btn-primary a-btn-sm" style="margin-left:8px" onclick="moveGroupToStatus('${groupId}')">Move All</button>
    </div>`;

  document.getElementById('order-modal-footer').innerHTML = `
    <button class="a-btn a-btn-ghost" onclick="closeGroupModal()">Close</button>`;

  document.getElementById('order-modal').classList.add('open');
}

function closeGroupModal() {
  document.getElementById('order-modal').classList.remove('open');
}

function moveGroupToStatus(groupId) {
  const newStatus = document.getElementById('group-move-status')?.value;
  if (!newStatus) return;
  const orders = getOrders().filter(o => o.groupId === groupId);
  orders.forEach(o => updateOrder(o.id, { status: newStatus }));
  ordersData = getOrders();
  const si = getStatusInfo(newStatus);
  toast(`Group moved to ${si.label}`, 'success');
  closeGroupModal();
  if (ordersViewMode === 'kanban') renderKanbanBoard();
  else filterOrders();
}

function pushToProduction(id) {
  const order = getOrders().find(o => o.id === id);
  if (!order) return;
  // Stamp customerSuppliedBlanks from current checkbox state before pushing
  order.customerSuppliedBlanks = document.getElementById('od-customer-supplied')?.checked || order.customerSuppliedBlanks || false;
  // Check if already on board (including as a group member)
  const existing = getProductionJobs().find(j =>
    j.orderId === id || (j.memberOrderIds && j.memberOrderIds.includes(id))
  );
  if (existing) {
    toast('Already on production board — ' + id);
    closeOrderModal();
    return;
  }
  ensureProductionJob(order);
  updateOrder(id, { status: 'pre-production' });
  closeOrderModal();
  ordersData = getOrders();
  toast('Added to production board — ' + id, 'success');
}

// ============================================
// PRODUCTION BOARD
// ============================================
function setProdSort(colId) {
  _prodSort = (_prodSort === colId) ? null : colId;
  renderProductionBoard();
}

function renderProductionBoard() {
  const wrap = document.getElementById('production-board-wrap');
  if (!wrap) return;

  const jobs = getProductionJobs();

  if (!jobs.length) {
    wrap.innerHTML = `<div class="prod-empty">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
      <p>No jobs in production yet.<br>Orders move here automatically when marked <strong>Approved</strong>.</p>
    </div>`;
    return;
  }

  const defaultSort = (a, b) => {
    if (a.isHardDeadline && b.isHardDeadline) return new Date(a.inHandDate) - new Date(b.inHandDate);
    if (a.isHardDeadline) return -1;
    if (b.isHardDeadline) return 1;
    if (a.approvedAt && b.approvedAt) return new Date(a.approvedAt) - new Date(b.approvedAt);
    if (a.approvedAt) return -1;
    if (b.approvedAt) return 1;
    return 0;
  };

  const sortJobs = list => {
    if (_prodSort) {
      const col = PROD_COLUMNS.find(c => c.id === _prodSort);
      if (col) {
        const statusOrder = col.statuses.map(s => s.id);
        return list.slice().sort((a, b) => {
          const aApplies = col.alwaysShow || (col.decoIds || []).some(d => a.decorationTypes.includes(d));
          const bApplies = col.alwaysShow || (col.decoIds || []).some(d => b.decorationTypes.includes(d));
          if (!aApplies && !bApplies) return defaultSort(a, b);
          if (!aApplies) return 1;
          if (!bApplies) return -1;
          const aStatus = a.progress[_prodSort] || col.defaultStatus;
          const bStatus = b.progress[_prodSort] || col.defaultStatus;
          const aIdx = statusOrder.indexOf(aStatus);
          const bIdx = statusOrder.indexOf(bStatus);
          const idxDiff = (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
          return idxDiff !== 0 ? idxDiff : defaultSort(a, b);
        });
      }
    }
    return list.slice().sort(defaultSort);
  };

  const activeJobs = sortJobs(jobs.filter(j => getMasterStatus(j) !== 'done'));
  const doneJobs   = sortJobs(jobs.filter(j => getMasterStatus(j) === 'done'));

  const sortIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>`;
  const clearIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  const headerCells = `
    <th class="pj-th pj-sticky pj-th-job">Job</th>
    <th class="pj-th pj-th-date">Approved</th>
    <th class="pj-th pj-th-date">Expected Due</th>
    <th class="pj-th pj-th-qty">Qty</th>
    ${PROD_COLUMNS.map(col => {
      const isActive = _prodSort === col.id;
      return `<th class="pj-th pj-th-col${isActive ? ' pj-th-sorted' : ''}">
        <div class="pj-col-header">
          <span>${col.label}</span>
          <button class="pj-sort-btn${isActive ? ' active' : ''}" onclick="setProdSort('${col.id}')" title="${isActive ? 'Clear sort' : 'Group by status'}">${isActive ? clearIcon : sortIcon}</button>
        </div>
      </th>`;
    }).join('')}
    <th class="pj-th pj-th-actions"></th>`;

  const makeTable = rows => `
    <div class="prod-table-scroll">
      <table class="prod-table">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  let html = '';

  if (activeJobs.length) {
    let tableBody = '';
    if (_prodSort) {
      const col = PROD_COLUMNS.find(c => c.id === _prodSort);
      if (col) {
        const colSpan = 5 + PROD_COLUMNS.length;
        let lastGroupKey = null;
        activeJobs.forEach(job => {
          const applies = col.alwaysShow || (col.decoIds || []).some(d => job.decorationTypes.includes(d));
          const statusId = applies ? (job.progress[_prodSort] || col.defaultStatus) : '__na__';
          if (statusId !== lastGroupKey) {
            const si = applies ? getProdStatusInfo(col.id, statusId) : null;
            const label = si ? si.label : 'N/A';
            const color = si ? si.color : '#555';
            tableBody += `<tr class="pj-group-divider"><td colspan="${colSpan}"><span class="pj-group-label" style="background:${color}22;color:${color};border-left:3px solid ${color}">${col.label}: ${label}</span></td></tr>`;
            lastGroupKey = statusId;
          }
          tableBody += buildProdRow(job);
        });
      } else {
        tableBody = activeJobs.map(j => buildProdRow(j)).join('');
      }
    } else {
      tableBody = activeJobs.map(j => buildProdRow(j)).join('');
    }
    html += makeTable(tableBody);
  } else {
    html += `<div class="prod-empty" style="padding:32px">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      <p>All active jobs are complete.</p>
    </div>`;
  }

  if (doneJobs.length) {
    html += `
      <div class="prod-done-section">
        <button class="prod-done-toggle" onclick="this.closest('.prod-done-section').classList.toggle('open')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00c896" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          Done — ${doneJobs.length} completed job${doneJobs.length !== 1 ? 's' : ''}
        </button>
        <div class="prod-done-body">
          ${makeTable(doneJobs.map(j => buildProdRow(j)).join(''))}
        </div>
      </div>`;
  }

  wrap.innerHTML = html;
}

function buildProdRow(job) {
  const colCells = PROD_COLUMNS.map(col => {
    const applies = col.alwaysShow || (col.decoIds || []).some(d => job.decorationTypes.includes(d));
    if (!applies) {
      return `<td class="pj-td pj-na">—</td>`;
    }
    const currentStatus = job.progress[col.id] || col.defaultStatus;
    const si = getProdStatusInfo(col.id, currentStatus);
    const options = col.statuses.map(s =>
      `<option value="${s.id}" ${s.id === currentStatus ? 'selected' : ''}>${s.label}</option>`
    ).join('');
    return `<td class="pj-td">
      <select class="pj-select" style="border-color:${si.color};color:${si.color}"
        onchange="updateProdProgress('${job.orderId}','${col.id}',this.value,this)">
        ${options}
      </select>
    </td>`;
  }).join('');

  const decoTags = job.decorationTypes.map(dt => {
    const found = ALL_DECORATION_TYPES.find(d => d.id === dt);
    return found ? `<span class="pj-deco-tag">${found.label}</span>` : '';
  }).join('');

  const urgency = (typeof getJobUrgency === 'function') ? getJobUrgency(job) : null;
  const urgencyClass = urgency ? ` pj-row-${urgency}` : '';

  // Approved date cell
  const approvedCell = job.approvedAt
    ? `<td class="pj-td pj-td-date">${formatDate(job.approvedAt)}</td>`
    : `<td class="pj-td pj-na">—</td>`;

  // Due date cell
  let dueCellContent;
  if (job.inHandDate && job.isHardDeadline) {
    const daysLeft = Math.ceil((new Date(job.inHandDate) - new Date()) / 864e5);
    const dueColor = urgency === 'red' ? '#ef4444' : urgency === 'yellow' ? '#eab308' : '#ccc';
    const daysLabel = daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`;
    dueCellContent = `
      <div style="font-size:12px;font-weight:700;color:${dueColor}">${formatDate(job.inHandDate)}</div>
      <div style="font-size:10px;color:${dueColor};margin-top:2px">${daysLabel}</div>
      <div style="font-size:9px;color:#555;margin-top:2px;text-transform:uppercase;letter-spacing:.04em">Hard Deadline</div>`;
  } else if (job.approvedAt && typeof getJobProductionWindow === 'function') {
    const w = getJobProductionWindow(job.decorationTypes);
    const maxEnd = new Date(new Date(job.approvedAt).getTime() + w.max * 864e5);
    const daysLeft = Math.ceil((maxEnd - new Date()) / 864e5);
    const dueColor = urgency === 'red' ? '#ef4444' : urgency === 'yellow' ? '#eab308' : '#6b7280';
    const daysLabel = daysLeft < 0
      ? `${Math.abs(daysLeft)}d overdue`
      : daysLeft === 0 ? 'Due today'
      : `${daysLeft}d left`;
    dueCellContent = `
      <div style="font-size:12px;font-weight:700;color:${urgency ? dueColor : '#ccc'}">${formatDate(maxEnd.toISOString())}</div>
      <div style="font-size:10px;color:${dueColor};margin-top:2px;font-weight:${urgency ? '700' : '400'}">${daysLabel}</div>
      <div style="font-size:9px;color:#555;margin-top:2px;text-transform:uppercase;letter-spacing:.04em">Expected · ${w.label}</div>`;
  } else {
    dueCellContent = `<span style="font-size:11px;color:#444">—</span>`;
  }

  // For grouped jobs, list each product separately in the job cell
  const productLines = job.products && job.products.length > 1
    ? job.products.map(p => `<div class="pj-group-product">↳ ${p.product}${p.color ? ` · ${p.color}` : ''} <span style="color:#555">${p.qty} pcs</span></div>`).join('')
    : `<div class="pj-job-product">${job.product}${job.color ? ` · ${job.color}` : ''}</div>`;

  const masterStatus = (typeof getMasterStatus === 'function') ? getMasterStatus(job) : 'pre-production';
  const masterBadge = {
    'pre-production': { label: 'Pre-Production', color: '#6366f1' },
    'in-production':  { label: 'In Production',  color: '#f97316' },
    'done':           { label: 'Done',            color: '#00c896' },
  }[masterStatus] || { label: masterStatus, color: '#555' };

  return `<tr class="pj-row${urgencyClass}${masterStatus === 'done' ? ' pj-row-done' : ''}" id="pj-row-${job.orderId}">
    <td class="pj-td pj-sticky pj-td-job">
      <div class="pj-master-status" style="background:${masterBadge.color}22;color:${masterBadge.color};border:1px solid ${masterBadge.color}44">${masterBadge.label}</div>
      <div class="pj-job-id">${job.groupId ? job.groupId : job.orderId}</div>
      <div class="pj-job-customer">${job.customerName || job.customerEmail || '—'}</div>
      ${productLines}
      ${decoTags ? `<div class="pj-deco-tags">${decoTags}</div>` : ''}
      ${job.customerSuppliedBlanks ? `<span class="pj-supplied-badge">Customer Blanks</span>` : ''}
    </td>
    ${approvedCell}
    <td class="pj-td pj-td-date">${dueCellContent}</td>
    <td class="pj-td pj-td-qty">${job.totalQty}</td>
    ${colCells}
    <td class="pj-td pj-td-actions">
      <button class="a-btn a-btn-ghost a-btn-icon a-btn-sm" onclick="openOrderModal('${job.orderId}')" title="View order">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
    </td>
  </tr>`;
}

function updateProdProgress(orderId, colId, newStatus, selectEl) {
  const job = getProductionJobs().find(j => j.orderId === orderId);
  if (!job) return;

  const progress = { ...job.progress, [colId]: newStatus };
  updateProductionJob(orderId, { progress });

  // Update select color immediately without full re-render
  const si = getProdStatusInfo(colId, newStatus);
  selectEl.style.borderColor = si.color;
  selectEl.style.color = si.color;

  // Recalculate master status on the updated job
  const updatedJob = { ...job, progress };
  const master = getMasterStatus(updatedJob);
  const prevMaster = getMasterStatus(job);

  if (master !== prevMaster) {
    // Update the master status badge in the sticky cell without full re-render
    const badge = document.querySelector(`#pj-row-${orderId} .pj-master-status`);
    const badgeDefs = {
      'pre-production': { label: 'Pre-Production', color: '#6366f1' },
      'in-production':  { label: 'In Production',  color: '#f97316' },
      'done':           { label: 'Done',            color: '#00c896' },
    };
    const bd = badgeDefs[master] || { label: master, color: '#555' };
    if (badge) {
      badge.textContent = bd.label;
      badge.style.background = bd.color + '22';
      badge.style.color = bd.color;
      badge.style.borderColor = bd.color + '44';
    }

    // Always mirror master status → kanban status for every transition
    const kanbanStatusMap = {
      'pre-production': 'pre-production',
      'in-production':  'in-production',
      'done':           'done',
    };
    const newKanbanStatus = kanbanStatusMap[master];
    if (newKanbanStatus) {
      const orderIds = updatedJob.memberOrderIds || [updatedJob.orderId];
      orderIds.forEach(oid => updateOrder(oid, { status: newKanbanStatus }));

      ordersData = getOrders();
      if (ordersViewMode === 'kanban') renderKanbanBoard();
      else filterOrders();
    }

    // Track doneAt timestamp for KPI duration calculations
    if (master === 'done' && !job.doneAt) {
      updateProductionJob(orderId, { progress, doneAt: new Date().toISOString() });
    } else if (master !== 'done' && job.doneAt) {
      updateProductionJob(orderId, { progress, doneAt: null });
    }

    if (master === 'done') {
      renderProductionBoard();
      toast('All steps complete — order moved to Done!', 'success');
    } else {
      renderProductionBoard();
      const labels = { 'pre-production': 'Pre-Production', 'in-production': 'In Production' };
      toast(`Master status updated to ${labels[master] || master}`, 'success');
    }
  }
}

// ============================================
// OPERATIONS ALERTS — Daily Focus Report
// ============================================

// How long an order can sit in each status before triggering an alert
const OPS_THRESHOLDS = {
  'new-lead':                    { maxHours: 24,  label: 'New lead not yet followed up',          severity: 'critical' },
  'proposal-needed':             { maxHours: 24,  label: 'Proposal not yet written',              severity: 'critical' },
  'proposal-sent':               { maxHours: 72,  label: 'Proposal sent — no response yet',       severity: 'warning'  },
  'proposal-revisions-needed':   { maxHours: 24,  label: 'Proposal revisions not yet sent',       severity: 'warning'  },
  'mockups-needed':              { maxHours: 48,  label: 'Mockup not started',                    severity: 'critical' },
  'mockups-ready-to-send':       { maxHours: 24,  label: 'Mockup ready — not sent to customer',   severity: 'warning'  },
  'mockups-sent':                { maxHours: 72,  label: 'Mockup sent — awaiting approval',       severity: 'warning'  },
  'mockup-revisions-needed':     { maxHours: 48,  label: 'Revision requested — not completed',    severity: 'warning'  },
  'out-for-approval':            { maxHours: 96,  label: 'Awaiting customer final approval',      severity: 'warning'  },
  'declined-need-adjustments':   { maxHours: 24,  label: 'Declined — adjustments not yet made',  severity: 'critical' },
  'pre-production':              { maxHours: 48,  label: 'Pre-production stalled',                severity: 'warning'  },
};

function getOperationsAlerts() {
  const now = new Date();
  const msPerHour = 3600000;
  const msPerDay = 864e5;
  const alerts = { critical: [], warning: [] };

  // Stage-stale alerts from orders
  const activeOrders = getOrders().filter(o =>
    !['archived', 'done', 'complete'].includes((o.status || '').toLowerCase())
  );

  activeOrders.forEach(o => {
    const threshold = OPS_THRESHOLDS[o.status];
    if (!threshold) return;
    const since = new Date(o.updatedAt || o.createdAt || 0);
    const hoursStale = (now - since) / msPerHour;
    if (hoursStale < threshold.maxHours) return;

    const daysStale = Math.floor(hoursStale / 24);
    const timeLabel = daysStale >= 1
      ? `${daysStale}d ${Math.floor(hoursStale % 24)}h`
      : `${Math.floor(hoursStale)}h`;

    alerts[threshold.severity].push({
      orderId:      o.id,
      customerName: o.customerName || o.customerEmail || 'Unknown',
      label:        threshold.label,
      timeStale:    timeLabel,
      status:       o.status,
    });
  });

  // Production job deadline alerts
  const jobs = typeof getProductionJobs === 'function' ? getProductionJobs() : [];
  jobs.filter(j => getMasterStatus(j) !== 'done').forEach(job => {
    if (!job.approvedAt) return;
    const w = getJobProductionWindow(job.decorationTypes);
    const approvedDate = new Date(job.approvedAt);
    const minEnd = new Date(approvedDate.getTime() + w.min * msPerDay);
    const maxEnd = new Date(approvedDate.getTime() + w.max * msPerDay);
    const daysLeft = Math.ceil((maxEnd - now) / msPerDay);

    if (now > maxEnd) {
      const overBy = Math.abs(daysLeft);
      alerts.critical.push({
        orderId:      job.orderId,
        customerName: job.customerName || job.customerEmail || 'Unknown',
        label:        `Production overdue by ${overBy} day${overBy !== 1 ? 's' : ''}`,
        timeStale:    `${overBy}d over`,
        status:       'production',
      });
    } else if (now > minEnd) {
      alerts.warning.push({
        orderId:      job.orderId,
        customerName: job.customerName || job.customerEmail || 'Unknown',
        label:        `Approaching production deadline — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`,
        timeStale:    `${daysLeft}d left`,
        status:       'production',
      });
    }
  });

  return alerts;
}

function renderAlertReport() {
  const el = document.getElementById('kpi-alert-report');
  if (!el) return;
  const alerts = getOperationsAlerts();
  const total = alerts.critical.length + alerts.warning.length;

  if (total === 0) {
    el.innerHTML = `<div class="ops-all-good">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      All caught up — no items need attention right now
    </div>`;
    return;
  }

  const makeCard = a => `
    <div class="ops-alert-card" onclick="openOrderModal('${a.orderId}')">
      <div class="ops-alert-left">
        <div class="ops-alert-id">${a.orderId}</div>
        <div class="ops-alert-customer">${a.customerName}</div>
        <div class="ops-alert-label">${a.label}</div>
      </div>
      <div class="ops-alert-time">${a.timeStale}</div>
    </div>`;

  let html = `<div class="ops-report-wrap">
    <div class="ops-report-header">
      <span class="ops-report-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        Today's Focus
      </span>
      <div class="ops-chips">
        ${alerts.critical.length ? `<span class="ops-chip ops-chip-crit">${alerts.critical.length} Critical</span>` : ''}
        ${alerts.warning.length  ? `<span class="ops-chip ops-chip-warn">${alerts.warning.length} Need Attention</span>` : ''}
      </div>
    </div>`;

  if (alerts.critical.length) {
    html += `<div class="ops-group ops-group-crit">
      <div class="ops-group-label">
        <span class="ops-dot ops-dot-crit"></span> Critical
      </div>
      ${alerts.critical.map(makeCard).join('')}
    </div>`;
  }

  if (alerts.warning.length) {
    html += `<div class="ops-group ops-group-warn">
      <div class="ops-group-label">
        <span class="ops-dot ops-dot-warn"></span> Needs Attention
      </div>
      ${alerts.warning.map(makeCard).join('')}
    </div>`;
  }

  html += `</div>`;
  el.innerHTML = html;
}

// ============================================
// ERROR LOG
// ============================================
function renderErrorLog() {
  var el = document.getElementById('kpi-error-log');
  if (!el) return;
  if (!_firebaseDb) { el.innerHTML = ''; return; }

  el.innerHTML = '<div class="err-log-loading">Loading error log…</div>';

  _firebaseDb.collection('app_errors')
    .where('resolved', '==', false)
    .get()
    .then(function (snap) {
      var errors = [];
      snap.forEach(function (doc) {
        errors.push(Object.assign({ _id: doc.id }, doc.data()));
      });

      // Sort newest first
      errors.sort(function (a, b) {
        return (b.timestamp || '').localeCompare(a.timestamp || '');
      });

      if (!errors.length) {
        el.innerHTML = '';
        return;
      }

      var TYPE_LABELS = {
        sync_fail:          'Sync Failure',
        upload_fail:        'Upload Failure',
        js_error:           'JS Error',
        promise_rejection:  'Unhandled Error',
        save_fail:          'Save Failure',
        order_fail:         'Order Error',
      };

      var PAGE_LABELS = {
        index:      'Public Website',
        portal:     'Customer Portal',
        admin:      'Admin',
        'lp-tshirts': 'T-Shirt Landing Page',
        approval:   'Approval Page',
      };

      function timeAgo(ts) {
        if (!ts) return '';
        var diff = (Date.now() - new Date(ts).getTime()) / 1000;
        if (diff < 60)   return Math.round(diff) + 's ago';
        if (diff < 3600) return Math.round(diff / 60) + 'm ago';
        if (diff < 86400) return Math.round(diff / 3600) + 'h ago';
        return Math.round(diff / 86400) + 'd ago';
      }

      var rows = errors.map(function (e) {
        var typeLabel = TYPE_LABELS[e.type] || e.type || 'Error';
        var pageLabel = PAGE_LABELS[e.page] || e.page || '—';
        return '<div class="err-log-row" id="err-row-' + e._id + '">' +
          '<div class="err-log-main">' +
            '<div class="err-log-top">' +
              '<span class="err-log-type">' + typeLabel + '</span>' +
              '<span class="err-log-page">' + pageLabel + '</span>' +
              (e.email ? '<span class="err-log-email">' + e.email + '</span>' : '') +
              '<span class="err-log-time">' + timeAgo(e.timestamp) + '</span>' +
            '</div>' +
            '<div class="err-log-msg">' + (e.message || '—') + '</div>' +
            (e.code ? '<div class="err-log-code">' + e.code + '</div>' : '') +
            (e.context ? '<details class="err-log-details"><summary>Details</summary><pre>' + e.context + '</pre></details>' : '') +
          '</div>' +
          '<button class="err-log-resolve" onclick="resolveError(\'' + e._id + '\')">Resolve</button>' +
        '</div>';
      }).join('');

      el.innerHTML = '<div class="err-log-wrap">' +
        '<div class="err-log-header">' +
          '<div class="err-log-header-left">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
            'System Errors' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            '<span class="err-log-badge">' + errors.length + ' unresolved</span>' +
            '<button class="err-log-resolve-all" onclick="resolveAllErrors()">Resolve All</button>' +
          '</div>' +
        '</div>' +
        '<div class="err-log-list">' + rows + '</div>' +
      '</div>';
    })
    .catch(function (err) {
      console.warn('[ErrorLog] Could not load errors:', err);
      el.innerHTML = '';
    });
}

function resolveError(docId) {
  var row = document.getElementById('err-row-' + docId);
  if (row) { row.style.opacity = '0.4'; row.style.pointerEvents = 'none'; }
  resolveAppError(docId).then(function () {
    if (row) row.remove();
    // If list is now empty, clear the whole section
    var list = document.querySelector('.err-log-list');
    if (list && !list.children.length) {
      var el = document.getElementById('kpi-error-log');
      if (el) el.innerHTML = '';
    }
  });
}

function resolveAllErrors() {
  var rows = document.querySelectorAll('.err-log-row');
  rows.forEach(function (row) {
    var id = row.id.replace('err-row-', '');
    resolveAppError(id);
  });
  var el = document.getElementById('kpi-error-log');
  if (el) el.innerHTML = '';
}

// ============================================
// DUE DATE TRACKER
// ============================================

// Returns the remaining high-level pipeline stages for an order
function _getDueTrackerSteps(order) {
  const PHASES = [
    { id: 'proposal',   label: 'Proposal',       statuses: ['new-lead','proposal-needed','proposal-sent','proposal-revisions-needed'] },
    { id: 'artwork',    label: 'Artwork',         statuses: ['mockups-needed','mockups-ready-to-send','mockups-sent','mockup-revisions-needed'] },
    { id: 'approval',   label: 'Final Approval',  statuses: ['out-for-approval','declined-need-adjustments'] },
    { id: 'approved',   label: 'Approved',        statuses: ['approved'] },
    { id: 'production', label: 'Production',      statuses: ['pre-production','in-production'] },
    { id: 'done',       label: 'Done',            statuses: ['done'] },
  ];
  const idx = PHASES.findIndex(p => p.statuses.includes(order.status || ''));
  const current = idx === -1 ? 0 : idx;
  return PHASES.slice(current + 1); // phases still ahead
}

// Returns specific blockers for an order (things that need action)
function _getDueTrackerBlockers(order) {
  const blockers = [];
  const status = order.status || '';

  // No price set yet
  if (!order.pricePerPiece && !order.totalPrice) {
    blockers.push({ label: 'No price set', sev: 'warn' });
  }

  // Price set but customer hasn't approved quote
  const postQuoteStatuses = ['out-for-approval','approved','pre-production','in-production','done'];
  if ((order.pricePerPiece || order.totalPrice) && !order.quoteApproved && postQuoteStatuses.includes(status)) {
    blockers.push({ label: 'Quote awaiting customer approval', sev: 'warn' });
  }

  // No mockups uploaded when they should be
  const mockupStatuses = ['mockups-sent','out-for-approval','approved','pre-production','in-production'];
  if (mockupStatuses.includes(status) && (!order.mockups || order.mockups.length === 0)) {
    blockers.push({ label: 'No mockups uploaded', sev: 'crit' });
  }

  // Mockups uploaded but not fully approved
  if (order.mockups && order.mockups.length > 0) {
    const approvals = order.mockupApprovals || {};
    const pending = order.mockups.filter(m => !approvals[m.id] || approvals[m.id].status !== 'approved').length;
    if (pending > 0) {
      blockers.push({ label: `${pending} mockup${pending > 1 ? 's' : ''} awaiting customer approval`, sev: 'warn' });
    }
    const declined = order.mockups.filter(m => approvals[m.id]?.status === 'declined').length;
    if (declined > 0) {
      blockers.push({ label: `${declined} mockup${declined > 1 ? 's' : ''} declined — revisions needed`, sev: 'crit' });
    }
  }

  // Customer declined adjustments needed
  if (status === 'declined-need-adjustments') {
    blockers.push({ label: 'Customer declined — adjustments requested', sev: 'crit' });
  }

  return blockers;
}

// ============================================
// WEBSITE ANALYTICS
// ============================================
function openAnalyticsOverlay() {
  const overlay = document.getElementById('analytics-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  const body = document.getElementById('analytics-overlay-body');
  if (body) body.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">Loading analytics…</div>';
  renderWebsiteAnalytics();
}

function closeAnalyticsOverlay() {
  const overlay = document.getElementById('analytics-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const lb = document.getElementById('photo-lightbox');
    if (lb && lb.style.display !== 'none') { closePhotoLightbox(); return; }
    const overlay = document.getElementById('analytics-overlay');
    if (overlay && overlay.style.display !== 'none') closeAnalyticsOverlay();
  }
});

function openPhotoLightbox(src) {
  document.getElementById('photo-lightbox-img').src = src;
  document.getElementById('photo-lightbox').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closePhotoLightbox() {
  document.getElementById('photo-lightbox').style.display = 'none';
  document.getElementById('photo-lightbox-img').src = '';
  document.body.style.overflow = '';
}

function renderWebsiteAnalytics() {
  const el = document.getElementById('analytics-overlay-body');
  if (!el) return;

  el.innerHTML = `<div class="wa-wrap">
    <div class="wa-header">
      <div class="wa-title-row">
        <h3 class="wa-title">Website Analytics</h3>
        <span class="wa-subtitle">Live visitor & checkout data</span>
      </div>
    </div>
    <div class="wa-loading">Loading analytics…</div>
  </div>`;

  if (!_firebaseDb) {
    el.querySelector('.wa-loading').textContent = 'Firebase not connected.';
    return;
  }

  let analytics = {};
  let abandoned = [];
  let pending = 2;

  function renderAll() {
    const today = new Date().toISOString().slice(0, 10);
    const daily = analytics.dailyStats || {};

    // Compute rolling windows
    function sumDays(n) {
      let views = 0, sessions = 0;
      for (let i = 0; i < n; i++) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        const s = daily[d] || { views: 0, sessions: 0 };
        views    += s.views;
        sessions += s.sessions;
      }
      return { views, sessions };
    }

    const d1  = sumDays(1);
    const d7  = sumDays(7);
    const d30 = sumDays(30);

    const pageStats = analytics.pageStats || {};
    const pageNames = { home: 'Home', index: 'Home', portal: 'Order Portal', 'lp-tshirts': 'T-Shirt LP', approval: 'Approval' };
    const pageRows = Object.entries(pageStats)
      .sort((a, b) => b[1] - a[1])
      .map(([page, count]) => `<div class="wa-page-row">
        <span class="wa-page-name">${pageNames[page] || page}</span>
        <div class="wa-page-bar-wrap"><div class="wa-page-bar" style="width:${Math.min(100, Math.round(count / (analytics.totalViews || 1) * 100))}%"></div></div>
        <span class="wa-page-count">${count.toLocaleString()}</span>
      </div>`).join('');

    // Abandoned checkouts — filter out ones without any contact info
    const abn = abandoned.filter(r => !r.placed);
    const abnWithContact = abn.filter(r => r.contact && (r.contact.email || r.contact.phone || r.contact.fname));

    const abnRows = abn.length ? abn.map(r => {
      const hasContact = r.contact && (r.contact.email || r.contact.fname);
      const name   = (r.contact && (r.contact.fname || r.contact.lname)) ? `${r.contact.fname || ''} ${r.contact.lname || ''}`.trim() : '—';
      const email  = (r.contact && r.contact.email)  || '—';
      const phone  = (r.contact && r.contact.phone)  || '—';
      const stepLabels = ['', 'Color', 'Decoration', 'Sizes', 'Artwork', 'Your Info', 'Review'];
      const stepLabel  = stepLabels[r.lastStep] || `Step ${r.lastStep}`;
      const daysAgo = Math.floor((Date.now() - new Date(r.lastSeenAt)) / 86400000);
      const timeLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`;
      const decoLabel = (r.decorations || []).map(d => d.typeLabel || d.type).join(', ') || '—';
      return `<div class="wa-abn-row${hasContact ? '' : ' wa-abn-no-contact'}">
        <div class="wa-abn-main">
          <div class="wa-abn-info">
            <span class="wa-abn-name">${name}</span>
            ${email !== '—' ? `<a class="wa-abn-email" href="mailto:${email}">${email}</a>` : `<span class="wa-abn-na">No email captured</span>`}
            ${phone !== '—' ? `<span class="wa-abn-phone">${phone}</span>` : ''}
          </div>
          <div class="wa-abn-detail">
            <span class="wa-abn-product">${r.productName || r.product || '—'}${r.color ? ` · ${r.color}` : ''}</span>
            <span class="wa-abn-deco">${decoLabel}</span>
          </div>
        </div>
        <div class="wa-abn-meta">
          <span class="wa-abn-step">Left at: ${stepLabel}</span>
          <span class="wa-abn-time">${timeLabel}</span>
          ${email !== '—' ? `<button class="wa-abn-copy" onclick="navigator.clipboard.writeText('${email}').then(()=>toast('Email copied','success'))" title="Copy email">Copy Email</button>` : ''}
        </div>
      </div>`;
    }).join('') : `<div class="wa-abn-empty">No abandoned checkouts recorded yet.</div>`;

    el.innerHTML = `<div class="wa-wrap">
      <div class="wa-header">
        <div class="wa-title-row">
          <h3 class="wa-title">Website Analytics</h3>
          <span class="wa-subtitle">Admin only · Live data from Firestore</span>
        </div>
      </div>

      <div class="wa-stats-grid">
        <div class="wa-stat-card">
          <div class="wa-stat-label">Today</div>
          <div class="wa-stat-main">${d1.views.toLocaleString()}</div>
          <div class="wa-stat-sub">${d1.sessions} unique session${d1.sessions !== 1 ? 's' : ''}</div>
        </div>
        <div class="wa-stat-card">
          <div class="wa-stat-label">Last 7 Days</div>
          <div class="wa-stat-main">${d7.views.toLocaleString()}</div>
          <div class="wa-stat-sub">${d7.sessions} unique sessions</div>
        </div>
        <div class="wa-stat-card">
          <div class="wa-stat-label">Last 30 Days</div>
          <div class="wa-stat-main">${d30.views.toLocaleString()}</div>
          <div class="wa-stat-sub">${d30.sessions} unique sessions</div>
        </div>
        <div class="wa-stat-card">
          <div class="wa-stat-label">All Time</div>
          <div class="wa-stat-main">${(analytics.totalViews || 0).toLocaleString()}</div>
          <div class="wa-stat-sub">${(analytics.totalSessions || 0).toLocaleString()} total sessions</div>
        </div>
      </div>

      ${pageRows ? `<div class="wa-pages">
        <div class="wa-section-label">Page Breakdown</div>
        ${pageRows}
      </div>` : ''}

      <div class="wa-abn-section">
        <div class="wa-abn-header">
          <div>
            <div class="wa-section-label">Abandoned Checkouts</div>
            <span class="wa-abn-count-badge">${abn.length} active · ${abnWithContact.length} with contact info</span>
          </div>
        </div>
        <div class="wa-abn-list">${abnRows}</div>
      </div>
    </div>`;
  }

  _firebaseDb.collection('app_data').doc('analytics').get()
    .then(doc => {
      if (doc.exists) { try { analytics = JSON.parse(doc.data().data || '{}'); } catch (e) {} }
      if (--pending === 0) renderAll();
    }).catch(() => { if (--pending === 0) renderAll(); });

  _firebaseDb.collection('app_data').doc('abandoned_checkouts').get()
    .then(doc => {
      if (doc.exists) { try { abandoned = JSON.parse(doc.data().data || '[]'); } catch (e) {} }
      abandoned = abandoned.filter(r => !r.placed);
      if (--pending === 0) renderAll();
    }).catch(() => { if (--pending === 0) renderAll(); });
}

function renderDueDateTracker() {
  const el = document.getElementById('kpi-due-tracker');
  if (!el) return;

  const today = new Date(); today.setHours(0,0,0,0);

  // Active orders with a due date (exclude done + archived)
  const orders = getOrders().filter(o =>
    o.inHandDate && !o.archived && o.status !== 'done'
  );

  if (!orders.length) { el.innerHTML = ''; return; }

  // Sort: overdue first, then by closest due date
  orders.sort((a, b) => new Date(a.inHandDate) - new Date(b.inHandDate));

  const overdue  = orders.filter(o => new Date(o.inHandDate + 'T12:00:00') < today);
  const dueSoon  = orders.filter(o => { const d = new Date(o.inHandDate + 'T12:00:00'); return d >= today && Math.round((d-today)/86400000) <= 7; });
  const upcoming = orders.filter(o => Math.round((new Date(o.inHandDate + 'T12:00:00') - today) / 86400000) > 7);

  const summaryChips = [
    overdue.length  ? `<span class="ddt-chip ddt-chip-overdue">${overdue.length} Overdue</span>` : '',
    dueSoon.length  ? `<span class="ddt-chip ddt-chip-soon">${dueSoon.length} Due within 7 days</span>` : '',
    upcoming.length ? `<span class="ddt-chip ddt-chip-upcoming">${upcoming.length} Upcoming</span>` : '',
  ].filter(Boolean).join('');

  const makeRow = o => {
    const due     = new Date(o.inHandDate + 'T12:00:00');
    const diff    = Math.round((due - today) / 86400000);
    const isOver  = diff < 0;
    const isSoon  = !isOver && diff <= 3;
    const isWarn  = !isOver && !isSoon && diff <= 7;

    const urgColor = isOver ? '#ef4444' : isSoon ? '#ef4444' : isWarn ? '#f97316' : '#f59e0b';
    const urgLabel = isOver ? `${Math.abs(diff)}d overdue` : diff === 0 ? 'Due today' : `${diff}d left`;

    const si = getStatusInfo(o.status);
    const steps   = _getDueTrackerSteps(o);
    const blockers = _getDueTrackerBlockers(o);

    const stepChips = steps.map(s =>
      `<span class="ddt-step">${s.label}</span>`
    ).join('<span class="ddt-arrow">›</span>');

    const blockerChips = blockers.map(b =>
      `<span class="ddt-blocker ddt-blocker-${b.sev}">${b.label}</span>`
    ).join('');

    return `<div class="ddt-row" onclick="openOrderModal('${o.id}')">
      <div class="ddt-urgency" style="border-left-color:${urgColor}">
        <div class="ddt-days" style="color:${urgColor}">${urgLabel}</div>
        <div class="ddt-date">${formatDate(o.inHandDate)}</div>
        ${o.isHardDeadline ? `<div class="ddt-hard-tag">Hard deadline</div>` : ''}
      </div>
      <div class="ddt-info">
        <div class="ddt-id">${o.id}</div>
        <div class="ddt-customer">${o.customerName || o.customerEmail || '—'}</div>
      </div>
      <div class="ddt-status">
        <span class="ddt-status-badge" style="color:${si.color};background:${si.color}18;border-color:${si.color}40">${si.label}</span>
      </div>
      <div class="ddt-pipeline">
        ${steps.length ? stepChips : '<span class="ddt-pipeline-done">In production / final stage</span>'}
      </div>
      ${blockerChips ? `<div class="ddt-blockers">${blockerChips}</div>` : ''}
    </div>`;
  };

  el.innerHTML = `<div class="ddt-wrap">
    <div class="ddt-header">
      <span class="ddt-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Due Date Tracker
      </span>
      <div class="ddt-chips">${summaryChips}</div>
    </div>
    <div class="ddt-list">
      ${orders.map(makeRow).join('')}
    </div>
  </div>`;
}

// ============================================
// KPI DASHBOARD
// ============================================
let kpiPeriod = '30d';
let kpiCustomFrom = null;
let kpiCustomTo = null;

function setKpiPeriod(period) {
  kpiPeriod = period;
  document.querySelectorAll('.kpi-period-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.period === period);
  });
  const customRow = document.getElementById('kpi-custom-range');
  if (customRow) customRow.style.display = period === 'custom' ? 'flex' : 'none';
  if (period !== 'custom') renderKpiDashboard();
}

function applyKpiCustomRange() {
  const from = document.getElementById('kpi-from').value;
  const to = document.getElementById('kpi-to').value;
  if (!from || !to) return;
  kpiCustomFrom = new Date(from + 'T00:00:00');
  kpiCustomTo = new Date(to + 'T23:59:59');
  renderKpiDashboard();
}

function getKpiDateRange() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from, to, label;
  if (kpiPeriod === 'today') {
    from = today;
    to = new Date(today.getTime() + 86400000 - 1);
    label = 'Today';
  } else if (kpiPeriod === '7d') {
    from = new Date(today.getTime() - 6 * 86400000);
    to = new Date(today.getTime() + 86400000 - 1);
    label = 'Last 7 Days';
  } else if (kpiPeriod === '30d') {
    from = new Date(today.getTime() - 29 * 86400000);
    to = new Date(today.getTime() + 86400000 - 1);
    label = 'Last 30 Days';
  } else if (kpiPeriod === 'ytd') {
    from = new Date(now.getFullYear(), 0, 1);
    to = new Date(today.getTime() + 86400000 - 1);
    label = 'Year to Date (' + now.getFullYear() + ')';
  } else if (kpiPeriod === 'lastyear') {
    from = new Date(now.getFullYear() - 1, 0, 1);
    to = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
    label = 'Last Year (' + (now.getFullYear() - 1) + ')';
  } else if (kpiPeriod === 'custom' && kpiCustomFrom && kpiCustomTo) {
    from = kpiCustomFrom;
    to = kpiCustomTo;
    const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    label = fmt(from) + ' — ' + fmt(to);
  } else {
    from = new Date(today.getTime() - 29 * 86400000);
    to = new Date(today.getTime() + 86400000 - 1);
    label = 'Last 30 Days';
  }
  return { from, to, label };
}

// Returns true if the current admin user has a given dashboard section enabled.
// Super admin always sees everything. Defaults: alerts/kpi/dueTracker=true, analytics=false.
function _isDashSectionOn(key) {
  const profile = (typeof getCurrentAdminProfile === 'function') ? getCurrentAdminProfile() : null;
  if (!profile) return true;
  if (profile.role === 'super_admin') return true;
  const sections = profile.dashboardSections || {};
  const defaults = { alerts: true, kpi: true, analytics: false, dueTracker: true };
  return key in sections ? !!sections[key] : (defaults[key] !== false);
}

function renderKpiDashboard() {
  if (_isDashSectionOn('alerts'))     { renderAlertReport(); renderErrorLog(); }
  // Show analytics button in period bar if analytics section is enabled
  const analyticsBtn = document.getElementById('kpi-analytics-open-btn');
  if (analyticsBtn) analyticsBtn.style.display = _isDashSectionOn('analytics') ? '' : 'none';
  if (_isDashSectionOn('kpi')) {
    try { _renderKpiDashboard(); } catch(err) {
      console.error('[KPI] Render error:', err);
      const grid = document.getElementById('kpi-grid');
      if (grid) grid.innerHTML = `<div style="color:#ef4444;padding:20px;font-size:13px">Dashboard error: ${err.message}</div>`;
    }
  } else {
    const grid = document.getElementById('kpi-grid');
    if (grid) grid.innerHTML = '';
    const lbl = document.getElementById('kpi-period-label');
    if (lbl) lbl.textContent = '';
  }
  if (_isDashSectionOn('dueTracker')) renderDueDateTracker();
}
function _renderKpiDashboard() {
  const { from, to, label } = getKpiDateRange();
  const labelEl = document.getElementById('kpi-period-label');
  if (labelEl) labelEl.textContent = label;

  const allOrders = getOrders();
  const allJobs = getProductionJobs ? getProductionJobs() : [];

  // Filter orders created within range
  const inRange = allOrders.filter(o => {
    const d = new Date(o.createdAt || o.date || 0);
    return d >= from && d <= to;
  });

  // --- 1. Total Leads / Orders ---
  const totalLeads = inRange.length;

  // --- 2. Conversion Rate ---
  const approvedStatuses = ['approved', 'in-production', 'pre-production', 'done', 'complete'];
  const converted = inRange.filter(o => approvedStatuses.includes((o.status || '').toLowerCase())).length;
  const archived = inRange.filter(o => (o.status || '').toLowerCase() === 'archived').length;
  const convRate = totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : 0;

  // --- 3. Total Sales (approved+ orders) ---
  const salesOrders = inRange.filter(o => approvedStatuses.includes((o.status || '').toLowerCase()));
  const totalSales = salesOrders.reduce((sum, o) => {
    const val = parseFloat(o.totalPrice || o.total || o.price || 0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  // --- 4. Contribution Margin ---
  const totalCOGS = salesOrders.reduce((sum, o) => {
    let cogs = 0;
    const groups = o.decorationGroups || [];
    if (groups.length > 0) {
      groups.forEach(g => {
        (g.items || []).forEach(item => {
          const prod = adminProducts.find(p => p.id === item.productId);
          const cost = parseFloat(prod && prod.blankCost ? prod.blankCost : 0);
          const qty = Object.values(item.sizes || item.quantities || {}).reduce((s, q) => s + (parseInt(q) || 0), 0);
          cogs += cost * qty;
        });
      });
    } else {
      const prod = adminProducts.find(p => p.id === o.productId);
      const cost = parseFloat(prod && prod.blankCost ? prod.blankCost : 0);
      const qty = parseInt(o.quantity || o.qty || 0);
      cogs += cost * qty;
    }
    return sum + cogs;
  }, 0);
  const contribMargin = totalSales - totalCOGS;
  const marginPct = totalSales > 0 ? Math.round((contribMargin / totalSales) * 100) : 0;

  // --- 5. Avg Quote → Approved duration ---
  const quoteToApproved = [];
  inRange.forEach(o => {
    if (!approvedStatuses.includes((o.status || '').toLowerCase())) return;
    const created = new Date(o.createdAt || o.date || 0);
    const approved = new Date(o.approvedAt || o.updatedAt || 0);
    if (approved > created) {
      quoteToApproved.push((approved - created) / 86400000);
    }
  });
  const avgQuoteToApproved = quoteToApproved.length > 0
    ? (quoteToApproved.reduce((a, b) => a + b, 0) / quoteToApproved.length)
    : null;

  // --- 6. Avg Pre-Production → Done duration ---
  const prodDurations = [];
  allJobs.forEach(job => {
    if (!job.doneAt) return;
    const started = new Date(job.startedAt || job.createdAt || 0);
    const done = new Date(job.doneAt);
    if (done > started) {
      const order = allOrders.find(o => o.id === job.orderId);
      if (!order) return;
      const orderCreated = new Date(order.createdAt || order.date || 0);
      if (orderCreated >= from && orderCreated <= to) {
        prodDurations.push((done - started) / 86400000);
      }
    }
  });
  const avgProdDuration = prodDurations.length > 0
    ? (prodDurations.reduce((a, b) => a + b, 0) / prodDurations.length)
    : null;

  // --- Render ---
  const fmt$ = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDays = n => n === null ? '—' : n.toFixed(1) + ' days';

  const cards = [
    {
      label: 'Total Leads / Orders',
      value: totalLeads,
      sub: archived > 0 ? archived + ' archived (lost)' : 'in selected period',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
      accent: '#60a5fa',
    },
    {
      label: 'Conversion Rate',
      value: convRate + '%',
      sub: converted + ' of ' + totalLeads + ' converted',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
      accent: convRate >= 50 ? '#34d399' : convRate >= 25 ? '#fbbf24' : '#f87171',
    },
    {
      label: 'Total Sales',
      value: fmt$(totalSales),
      sub: salesOrders.length + ' approved orders',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
      accent: '#34d399',
    },
    {
      label: 'Contribution Margin',
      value: fmt$(contribMargin),
      sub: marginPct + '% margin' + (totalCOGS === 0 ? ' (add cost/unit to products for accuracy)' : ''),
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
      accent: contribMargin >= 0 ? '#34d399' : '#f87171',
    },
    {
      label: 'Avg Time: Quote → Approved',
      value: fmtDays(avgQuoteToApproved),
      sub: quoteToApproved.length + ' orders measured',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      accent: '#a78bfa',
    },
    {
      label: 'Avg Time: Pre-Prod → Done',
      value: fmtDays(avgProdDuration),
      sub: prodDurations.length + ' jobs measured',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>',
      accent: '#fb923c',
    },
  ];

  const grid = document.getElementById('kpi-grid');
  if (!grid) return;
  grid.innerHTML = cards.map(c => `
    <div class="kpi-card">
      <div class="kpi-card-icon" style="color:${c.accent}">${c.icon}</div>
      <div class="kpi-card-body">
        <div class="kpi-card-label">${c.label}</div>
        <div class="kpi-card-value" style="color:${c.accent}">${c.value}</div>
        <div class="kpi-card-sub">${c.sub}</div>
      </div>
    </div>
  `).join('');
}

// ============================================
// CONFIRM DIALOG
// ============================================
function showConfirm(message, onOk) {
  document.getElementById('confirm-message').textContent = message;
  confirmCallback = onOk;
  document.getElementById('confirm-overlay').classList.add('open');
  document.getElementById('confirm-ok-btn').onclick = () => { const cb = confirmCallback; closeConfirm(); if (cb) cb(); };
}
function closeConfirm() {
  document.getElementById('confirm-overlay').classList.remove('open');
  confirmCallback = null;
}

// ============================================
// TOAST
// ============================================
function toast(msg, type = 'success') {
  const el = document.getElementById('a-toast');
  el.textContent = msg;
  el.className = `a-toast ${type} show`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ============================================
// MOBILE SIDEBAR
// ============================================
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar) return;
  const isOpen = sidebar.classList.contains('open');
  if (isOpen) {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
  } else {
    sidebar.classList.add('open');
    overlay.classList.add('visible');
  }
}
function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('visible');
}

// ============================================
// CALENDAR PICKER
// ============================================
const _CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
let _calTarget = null;
let _calYear   = null;
let _calMonth  = null;

function openCalPicker(inputId, triggerEl) {
  _calTarget = document.getElementById(inputId);
  if (!_calTarget) return;

  const val = _calTarget.value; // YYYY-MM-DD or ''
  const base = val ? new Date(val + 'T12:00:00') : new Date();
  _calYear  = base.getFullYear();
  _calMonth = base.getMonth();

  _renderCalGrid();

  const popup = document.getElementById('cal-picker-popup');
  popup.style.display = 'block';

  // Position below the trigger button, flip up if near bottom of viewport
  const rect = triggerEl.getBoundingClientRect();
  const popupH = 280;
  const spaceBelow = window.innerHeight - rect.bottom;
  if (spaceBelow < popupH && rect.top > popupH) {
    popup.style.top  = (rect.top + window.scrollY - popupH - 4) + 'px';
  } else {
    popup.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
  }
  popup.style.left = Math.min(rect.left + window.scrollX, window.innerWidth - 270) + 'px';

  setTimeout(() => document.addEventListener('click', _calOutside), 0);
}

function _calOutside(e) {
  const popup = document.getElementById('cal-picker-popup');
  if (popup && popup.contains(e.target)) return; // click inside — keep open
  popup.style.display = 'none';
  document.removeEventListener('click', _calOutside);
}

function calNav(dir) {
  _calMonth += dir;
  if (_calMonth > 11) { _calMonth = 0; _calYear++; }
  if (_calMonth < 0)  { _calMonth = 11; _calYear--; }
  _renderCalGrid();
}

function calGoToday() {
  const t = new Date();
  _calYear = t.getFullYear();
  _calMonth = t.getMonth();
  calPickDay(t.getDate());
}

function calClear() {
  if (_calTarget) {
    _calTarget.value = '';
    _calTarget.dispatchEvent(new Event('change', { bubbles: true }));
  }
  document.getElementById('cal-picker-popup').style.display = 'none';
  document.removeEventListener('click', _calOutside);
}

function calPickDay(d) {
  if (!_calTarget) return;
  const mm = String(_calMonth + 1).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  _calTarget.value = `${_calYear}-${mm}-${dd}`;
  _calTarget.dispatchEvent(new Event('change', { bubbles: true }));
  document.getElementById('cal-picker-popup').style.display = 'none';
  document.removeEventListener('click', _calOutside);
}

function _renderCalGrid() {
  const label = document.getElementById('cal-month-label');
  const grid  = document.getElementById('cal-grid');
  if (!label || !grid) return;

  label.textContent = _CAL_MONTHS[_calMonth] + ' ' + _calYear;

  const firstDow    = new Date(_calYear, _calMonth, 1).getDay();
  const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();

  // Selected date
  let selY = null, selM = null, selD = null;
  if (_calTarget && _calTarget.value) {
    const p = _calTarget.value.split('-');
    selY = parseInt(p[0]); selM = parseInt(p[1]) - 1; selD = parseInt(p[2]);
  }

  // Today
  const now = new Date();
  const todY = now.getFullYear(), todM = now.getMonth(), todD = now.getDate();

  let html = '';
  for (let i = 0; i < firstDow; i++) html += '<div class="cal-cell cal-cell-empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const isSel   = d === selD && _calMonth === selM && _calYear === selY;
    const isToday = d === todD && _calMonth === todM && _calYear === todY;
    html += `<div class="cal-cell${isSel ? ' cal-selected' : ''}${isToday ? ' cal-today' : ''}" onclick="calPickDay(${d})">${d}</div>`;
  }
  grid.innerHTML = html;
}

// ============================================
// BOOT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  // Color entry panel pickers sync
  const picker = document.getElementById('cep-picker');
  const hexInput = document.getElementById('cep-hex');
  if (picker && hexInput) {
    picker.addEventListener('input', () => { hexInput.value = picker.value; });
    hexInput.addEventListener('input', () => {
      if (/^#[0-9a-f]{6}$/i.test(hexInput.value)) picker.value = hexInput.value;
    });
  }

  initAuth(
    // Authenticated + approved
    (profile) => {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('admin-app').style.display = 'grid';
      renderCurrentUser(profile);
      // Show Team link for super admin + check pending requests
      if (typeof isSuperAdmin === 'function' && isSuperAdmin()) {
        const teamLink = document.getElementById('sidebar-team-link');
        if (teamLink) teamLink.style.display = '';
        _refreshPendingBadge();
        const sysLink = document.getElementById('sidebar-sysoverview-link');
        if (sysLink) sysLink.style.display = '';
        const autoLink = document.getElementById('sidebar-automations-link');
        if (autoLink) autoLink.style.display = '';
        const payLink = document.getElementById('sidebar-payments-link');
        if (payLink) payLink.style.display = '';
        _refreshUnpaidBadge();
      }
      if (typeof canViewCommissions === 'function' && canViewCommissions()) {
        const commLink = document.getElementById('sidebar-commissions-link');
        if (commLink) commLink.style.display = '';
        _refreshCommissionBadge();
      }
      if (typeof initCloudSync === 'function') {
        initCloudSync(() => initAdmin());
      } else {
        initAdmin();
      }
    },
    // Not authed or not approved
    (status) => {
      if (status === 'pending') showPendingView();
      else if (status === 'rejected') showRejectedView();
      else showLoginView();
    }
  );

  const overlay = document.getElementById('product-modal-overlay');
  if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeProductModal(); });

  const cOverlay = document.getElementById('confirm-overlay');
  if (cOverlay) cOverlay.addEventListener('click', e => { if (e.target === cOverlay) closeConfirm(); });

  const orderOverlay = document.getElementById('order-modal-overlay');
  if (orderOverlay) orderOverlay.addEventListener('click', e => { if (e.target === orderOverlay) closeOrderModal(); });

  const addOrderOverlay = document.getElementById('add-order-modal-overlay');
  if (addOrderOverlay) addOrderOverlay.addEventListener('click', e => { if (e.target === addOrderOverlay) closeAddOrderModal(); });

  const addMemberOverlay = document.getElementById('add-member-overlay');
  if (addMemberOverlay) addMemberOverlay.addEventListener('click', e => { if (e.target === addMemberOverlay) closeAddMemberModal(); });

  const logPaymentOverlay = document.getElementById('log-payment-overlay');
  if (logPaymentOverlay) logPaymentOverlay.addEventListener('click', e => { if (e.target === logPaymentOverlay) closeLogPaymentModal(); });
});
