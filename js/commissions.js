/* ============================================
   INSIGNIA — Commission Tracking
   ============================================ */

const COMMISSION_COLLECTION = 'commission_data';

// ---- Permission check ----
function canViewCommissions() {
  const profile = getCurrentAdminProfile();
  if (!profile) return false;
  return profile.email === SUPER_ADMIN_EMAIL || profile.canViewCommissions === true;
}

// ---- Internal: read entries ----
async function getCommissionEntries() {
  if (!_firebaseDb) return [];
  try {
    const snap = await _firebaseDb.collection(COMMISSION_COLLECTION).doc('entries').get();
    if (!snap.exists) return [];
    return JSON.parse(snap.data().data || '[]');
  } catch (e) {
    console.warn('[Commissions] getCommissionEntries failed', e);
    return [];
  }
}

// ---- Internal: write entries ----
async function _saveCommissionEntries(entries) {
  if (!_firebaseDb) return;
  await _firebaseDb.collection(COMMISSION_COLLECTION).doc('entries')
    .set({ data: JSON.stringify(entries), updatedAt: new Date().toISOString() });
}

// ---- Save / update commission entry for an order ----
async function saveCommissionEntry({ orderId, repId, repName, commissionAmount, commissionRate, orderTotal }) {
  const entries = await getCommissionEntries();
  const idx = entries.findIndex(e => e.orderId === orderId);
  const now = new Date().toISOString();
  const entry = {
    orderId,
    repId,
    repName,
    commissionAmount: parseFloat(commissionAmount) || 0,
    commissionRate: parseFloat(commissionRate) || 0,
    orderTotal: parseFloat(orderTotal) || 0,
    status: idx >= 0 ? entries[idx].status : 'pending',
    earnedAt: idx >= 0 ? entries[idx].earnedAt : null,
    createdAt: idx >= 0 ? entries[idx].createdAt : now,
    updatedAt: now,
  };
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  await _saveCommissionEntries(entries);
}

// ---- Mark commission as earned (call when order is paid) ----
async function markCommissionEarned(orderId) {
  const entries = await getCommissionEntries();
  const idx = entries.findIndex(e => e.orderId === orderId);
  if (idx >= 0 && entries[idx].status === 'pending') {
    entries[idx].status = 'earned';
    entries[idx].earnedAt = new Date().toISOString();
    entries[idx].updatedAt = new Date().toISOString();
    await _saveCommissionEntries(entries);
  }
}

// ---- Delete commission entry (when sales rep removed from order) ----
async function deleteCommissionEntry(orderId) {
  const entries = await getCommissionEntries();
  const filtered = entries.filter(e => e.orderId !== orderId);
  if (filtered.length !== entries.length) await _saveCommissionEntries(filtered);
}

// ---- Get payment history ----
async function getCommissionPayments() {
  if (!_firebaseDb) return [];
  try {
    const snap = await _firebaseDb.collection(COMMISSION_COLLECTION).doc('payments').get();
    if (!snap.exists) return [];
    return JSON.parse(snap.data().data || '[]');
  } catch (e) {
    console.warn('[Commissions] getCommissionPayments failed', e);
    return [];
  }
}

// ---- Log a payout ----
async function logCommissionPayment({ repId, repName, amount, method, note }) {
  const payments = await getCommissionPayments();
  const profile = getCurrentAdminProfile();
  payments.push({
    id: 'PAY-' + Date.now(),
    repId,
    repName,
    amount: parseFloat(amount),
    method: method || 'other',
    note: note || '',
    paidBy: profile ? (profile.name || profile.email) : '',
    paidAt: new Date().toISOString(),
  });
  await _firebaseDb.collection(COMMISSION_COLLECTION).doc('payments')
    .set({ data: JSON.stringify(payments), updatedAt: new Date().toISOString() });
  logActivity('logged_commission_payment', 'commission', repId,
    `Paid ${repName} $${parseFloat(amount).toFixed(2)} via ${method}`);
}

// ---- Per-rep summary ----
async function getCommissionSummary() {
  const [entries, payments] = await Promise.all([getCommissionEntries(), getCommissionPayments()]);
  const summary = {};

  entries.forEach(e => {
    if (!summary[e.repId]) {
      summary[e.repId] = {
        repId: e.repId, repName: e.repName,
        earned: 0, paid: 0, balance: 0,
        pendingCount: 0, earnedCount: 0,
        oldestUnpaidEarnedAt: null,
        entries: [],
      };
    }
    const s = summary[e.repId];
    s.entries.push(e);
    if (e.status === 'earned') {
      s.earned += e.commissionAmount;
      s.earnedCount++;
      if (e.earnedAt && (!s.oldestUnpaidEarnedAt || e.earnedAt < s.oldestUnpaidEarnedAt)) {
        s.oldestUnpaidEarnedAt = e.earnedAt;
      }
    } else if (e.status === 'pending') {
      s.pendingCount++;
    }
  });

  payments.forEach(p => {
    if (summary[p.repId]) summary[p.repId].paid += p.amount;
  });

  Object.values(summary).forEach(s => {
    s.balance = Math.max(0, s.earned - s.paid);
    // If balance is 0, no unpaid commissions
    if (s.balance <= 0) s.oldestUnpaidEarnedAt = null;
  });

  return { summary, entries, payments };
}

// ---- Check overdue (any rep owed for 2+ weeks) ----
async function hasOverdueCommissions() {
  if (!canViewCommissions()) return false;
  try {
    const { summary } = await getCommissionSummary();
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    return Object.values(summary).some(s =>
      s.balance > 0 && s.oldestUnpaidEarnedAt && new Date(s.oldestUnpaidEarnedAt).getTime() < cutoff
    );
  } catch (e) { return false; }
}
