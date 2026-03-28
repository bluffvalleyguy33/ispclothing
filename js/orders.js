/* ============================================
   INSIGNIA — Orders Data Layer
   Shared between admin.html and portal.html
   ============================================ */

// ---- Kanban column + sub-status structure ----
const KANBAN_COLUMNS = [
  {
    id: 'new-lead',
    label: 'New Lead',
    color: '#6366f1',
    subStatuses: [
      { id: 'new-lead',                  label: 'New Lead',                  color: '#6366f1', desc: 'Lead received — needs a discovery session.' },
      { id: 'proposal-needed',           label: 'Proposal Needed',           color: '#818cf8', desc: 'Lead qualified — proposal needs to be written.' },
      { id: 'proposal-sent',             label: 'Proposal Sent',             color: '#a855f7', desc: 'Proposal has been sent to the customer.' },
      { id: 'proposal-revisions-needed', label: 'Proposal Revisions Needed', color: '#c084fc', desc: 'Customer requested changes to the proposal.' },
    ],
  },
  {
    id: 'artwork',
    label: 'Artwork',
    color: '#f59e0b',
    subStatuses: [
      { id: 'mockups-needed',          label: 'Mockups Needed',          color: '#f59e0b', desc: 'Ready to create digital mockups.' },
      { id: 'mockups-ready-to-send',   label: 'Mockups Ready to Send',   color: '#eab308', desc: 'Mockups complete — ready to send to customer.' },
      { id: 'mockups-sent',            label: 'Mockups Sent',            color: '#f97316', desc: 'Mockups have been sent for your review.' },
      { id: 'mockup-revisions-needed', label: 'Mockup Revisions Needed', color: '#ef4444', desc: 'Mockup changes have been requested.' },
    ],
  },
  {
    id: 'final-approval',
    label: 'Final Approval',
    color: '#06b6d4',
    subStatuses: [
      { id: 'out-for-approval',          label: 'Out for Final Approval',      color: '#06b6d4', desc: 'Final mockup sent — awaiting your approval.' },
      { id: 'declined-need-adjustments', label: 'Declined — Need Adjustments', color: '#ef4444', desc: 'Changes requested — we\'ll be in touch shortly.' },
    ],
  },
  {
    id: 'approved',
    label: 'Approved',
    color: '#00c896',
    subStatuses: [
      { id: 'approved', label: 'Approved', color: '#00c896', desc: 'Approved — your order is moving into production.' },
    ],
  },
  {
    id: 'pre-production',
    label: 'Pre-Production',
    color: '#8b5cf6',
    subStatuses: [
      { id: 'pre-production', label: 'Pre-Production', color: '#8b5cf6', desc: 'Order is staged and being prepared for production.' },
    ],
  },
  {
    id: 'in-production',
    label: 'In Production',
    color: '#f97316',
    subStatuses: [
      { id: 'in-production', label: 'In Production', color: '#f97316', desc: 'Your order is being printed or decorated.' },
    ],
  },
  {
    id: 'done',
    label: 'Done — Contact Customer',
    color: '#00c896',
    subStatuses: [
      { id: 'done', label: 'Done — Contact Customer', color: '#00c896', desc: 'Order complete. We\'ll be reaching out shortly!' },
    ],
  },
];

// Flat list of all statuses (derived from KANBAN_COLUMNS for backward compat)
const ORDER_STATUSES = KANBAN_COLUMNS.flatMap(col => col.subStatuses);

// Full pipeline in order
const STATUS_TIMELINE = ORDER_STATUSES.map(s => s.id);

// Subset shown to customers in the portal (skips internal lead/proposal/artwork stages)
const CUSTOMER_TIMELINE = [
  'mockups-needed','mockups-sent','out-for-approval','approved','in-production','done'
];

// ---- Migrate old status IDs to new ones ----
function migrateOrderStatuses() {
  const map = {
    'ordering-needed':   'pre-production',
    'scheduling-needed': 'pre-production',
    'mockups-ready':     'mockups-ready-to-send',
    'revisions-needed':  'mockup-revisions-needed',
    'declined':          'declined-need-adjustments',
  };
  const orders = getOrders();
  let changed = false;
  orders.forEach(o => {
    if (map[o.status]) {
      o.status = map[o.status];
      o.updatedAt = new Date().toISOString();
      changed = true;
    }
  });
  if (changed) saveOrders(orders);
}

// ---- Find which kanban column a status belongs to ----
function getStatusColumn(statusId) {
  return KANBAN_COLUMNS.find(col => col.subStatuses.some(s => s.id === statusId)) || KANBAN_COLUMNS[0];
}

function getOrders() {
  try {
    const saved = localStorage.getItem('insignia_orders');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return [];
}

function saveOrders(orders) {
  localStorage.setItem('insignia_orders', JSON.stringify(orders));
  if (typeof cloudSave === 'function') cloudSave('orders', orders);
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
    status:          (wizardData.source === 'web-submission' || wizardData.source === 'catalog-reorder') ? 'new-lead' : 'mockups-needed',
    isReorder:       wizardData.source === 'catalog-reorder' ? true : undefined,
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
