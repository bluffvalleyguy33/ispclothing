/* ============================================
   INSIGNIA — Orders Data Layer
   Shared between admin.html and portal.html
   ============================================ */

const ORDER_STATUSES = [
  { id: 'new-lead',          label: 'New Lead',                color: '#6366f1', desc: 'Lead received — needs a discovery session.' },
  { id: 'proposal-sent',     label: 'Proposal Sent',           color: '#a855f7', desc: 'Proposal has been sent to the customer.' },
  { id: 'mockups-needed',    label: 'Mockups Needed',          color: '#f59e0b', desc: 'Ready to create digital mockups.' },
  { id: 'mockups-ready',     label: 'Mockups Ready',           color: '#eab308', desc: 'Mockups complete — ready to send.' },
  { id: 'mockups-sent',      label: 'Mockups Sent',            color: '#f97316', desc: 'Mockups have been sent for your review.' },
  { id: 'revisions-needed',  label: 'Revisions Needed',        color: '#ef4444', desc: 'Mockup changes have been requested.' },
  { id: 'out-for-approval',  label: 'Out for Approval',        color: '#06b6d4', desc: 'Final mockup sent — awaiting your approval.' },
  { id: 'declined',          label: 'Declined — Attention Needed', color: '#ef4444', desc: 'Changes requested — we\'ll be in touch shortly.' },
  { id: 'approved',          label: 'Approved',                color: '#00c896', desc: 'Approved — your order is moving into production.' },
  { id: 'ordering-needed',   label: 'Ordering Needed',         color: '#3b82f6', desc: 'Blanks and supplies are being ordered.' },
  { id: 'scheduling-needed', label: 'Scheduling Needed',       color: '#8b5cf6', desc: 'Your order is being scheduled for production.' },
  { id: 'pre-production',    label: 'Pre-Production',          color: '#8b5cf6', desc: 'Order is staged and being prepared for production.' },
  { id: 'in-production',     label: 'In Production',           color: '#f97316', desc: 'Your order is being printed or decorated.' },
  { id: 'done',              label: 'Done — Contact Customer', color: '#00c896', desc: 'Order complete. We\'ll be reaching out shortly!' },
];

// Full pipeline — all 14 stages
const STATUS_TIMELINE = [
  'new-lead','proposal-sent','mockups-needed','mockups-ready',
  'mockups-sent','revisions-needed','out-for-approval','declined','approved',
  'ordering-needed','scheduling-needed','pre-production','in-production','done'
];

// Subset shown to customers in the portal (skips internal lead/proposal stages)
const CUSTOMER_TIMELINE = [
  'mockups-needed','mockups-sent','out-for-approval','approved','in-production','done'
];

function getOrders() {
  try {
    const saved = localStorage.getItem('insignia_orders');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return [];
}

function saveOrders(orders) {
  localStorage.setItem('insignia_orders', JSON.stringify(orders));
}

function createOrder(wizardData) {
  const ref = 'INS-' + Date.now().toString().slice(-6);
  const totalQty = Object.values(wizardData.quantities || {}).reduce((a, b) => a + b, 0);
  const order = {
    id: ref,
    customerEmail:   (wizardData.contact?.email || '').toLowerCase().trim(),
    customerName:    ((wizardData.contact?.fname || '') + ' ' + (wizardData.contact?.lname || '')).trim(),
    customerPhone:   wizardData.contact?.phone || '',
    customerCompany: wizardData.contact?.company || '',
    product:         wizardData.product?.name || '',
    productId:       wizardData.product?.id || '',
    color:           wizardData.color?.name || '',
    colorHex:        wizardData.color?.hex || '',
    quantities:      wizardData.quantities || {},
    totalQty,
    decorationType:  wizardData.decorationType || '',
    decorationLocation: wizardData.decorationLocation || '',
    artworkName:     wizardData.artworkName || '',
    notes:           wizardData.contact?.notes || '',
    statusNotes:     '',   // admin-facing note
    customerNote:    '',   // shown in portal
    trackingNumber:  '',
    decorations:     wizardData.decorations || [],
    inHandDate:      wizardData.inHandDate || null,
    isHardDeadline:  wizardData.isHardDeadline || false,
    source:          wizardData.source || 'online',
    groupId:         wizardData.groupId || null,
    status:          wizardData.source === 'web-submission' ? 'new-lead' : 'mockups-needed',
    visibleToCustomer: true,
    pricePerPiece:   wizardData.pricePerPiece || null,
    totalPrice:      wizardData.totalPrice || null,
    createdAt:       new Date().toISOString(),
    updatedAt:       new Date().toISOString(),
  };
  const orders = getOrders();
  orders.unshift(order);
  saveOrders(orders);
  return order;
}

function updateOrder(id, changes) {
  const orders = getOrders();
  const idx = orders.findIndex(o => o.id === id);
  if (idx === -1) return null;
  orders[idx] = { ...orders[idx], ...changes, updatedAt: new Date().toISOString() };
  saveOrders(orders);
  return orders[idx];
}

function getOrdersByEmail(email) {
  const e = (email || '').toLowerCase().trim();
  return getOrders().filter(o => o.customerEmail === e && o.visibleToCustomer !== false);
}

function getStatusInfo(id) {
  return ORDER_STATUSES.find(s => s.id === id) || ORDER_STATUSES[0];
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
