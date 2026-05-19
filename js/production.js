/* ============================================
   INSIGNIA — Production Board Data Layer
   ============================================ */

const PROD_JOBS_KEY = 'insignia_production';

const PROD_COLUMNS = [
  {
    id: 'blanks',
    label: 'Blanks',
    alwaysShow: true,
    defaultStatus: 'needs-ordering',
    statuses: [
      { id: 'needs-ordering',       label: 'Needs Ordering',       color: '#f59e0b' },
      { id: 'partially-ordered',    label: 'Partially Ordered',    color: '#eab308' },
      { id: 'in-transit',           label: 'In Transit',           color: '#3b82f6' },
      { id: 'partially-checked-in', label: 'Partially Checked In', color: '#06b6d4' },
      { id: 'checking-in',          label: 'Checking In',          color: '#8b5cf6' },
      { id: 'customer-supplied',    label: 'Customer Supplied',    color: '#00c896' },
      { id: 'received',             label: 'Received',             color: '#00c896' },
      { id: 'supplier-issues',      label: 'Supplier Issues',      color: '#ef4444' },
    ],
  },
  {
    id: 'screen-printing',
    label: 'Screen Printing',
    decoIds: ['screen-printing'],
    defaultStatus: 'need-screens',
    statuses: [
      { id: 'need-screens',  label: 'Need Screens',  color: '#f59e0b' },
      { id: 'screens-ready', label: 'Screens Ready', color: '#06b6d4' },
      { id: 'in-production', label: 'In Production', color: '#f97316' },
      { id: 'done',          label: 'Done',          color: '#00c896' },
    ],
  },
  {
    id: 'transfers',
    label: 'Transfers',
    decoIds: ['transfers'],
    defaultStatus: 'need-ordering',
    statuses: [
      { id: 'need-ordering', label: 'Need Ordering', color: '#f59e0b' },
      { id: 'in-transit',    label: 'In Transit',    color: '#3b82f6' },
      { id: 'received',      label: 'Received',      color: '#06b6d4' },
      { id: 'in-production', label: 'In Production', color: '#f97316' },
      { id: 'done',          label: 'Done',          color: '#00c896' },
    ],
  },
  {
    id: 'embroidery',
    label: 'Embroidery',
    decoIds: ['embroidery'],
    defaultStatus: 'needs-digitizing',
    statuses: [
      { id: 'needs-digitizing',       label: 'Needs Digitizing',       color: '#f59e0b' },
      { id: 'digitizing-in-progress', label: 'Digitizing in Progress', color: '#eab308' },
      { id: 'file-ready',             label: 'File Ready',             color: '#06b6d4' },
      { id: 'file-issue',             label: 'File Issue',             color: '#ef4444' },
      { id: 'in-production',          label: 'In Production',          color: '#f97316' },
      { id: 'done',                   label: 'Done',                   color: '#00c896' },
    ],
  },
  {
    id: 'digital-print',
    label: 'Digital Print',
    decoIds: ['digital-print'],
    defaultStatus: 'needs-ordering',
    statuses: [
      { id: 'needs-ordering',    label: 'Needs Ordering',    color: '#f59e0b' },
      { id: 'waiting-approval',  label: 'Waiting for Approval', color: '#eab308' },
      { id: 'in-production',     label: 'In Production',     color: '#f97316' },
      { id: 'done',              label: 'Done',              color: '#00c896' },
    ],
  },
  {
    id: 'patch',
    label: 'Patch',
    decoIds: ['embroidery-patch', 'woven-patch', 'printed-patch', 'pvc-patch'],
    defaultStatus: 'needs-ordering',
    statuses: [
      { id: 'needs-ordering',         label: 'Needs Ordering',          color: '#f59e0b' },
      { id: 'waiting-approval',       label: 'Waiting for Approval',    color: '#eab308' },
      { id: 'in-production',          label: 'In Production',           color: '#f97316' },
      { id: 'in-transit',             label: 'In Transit',              color: '#3b82f6' },
      { id: 'received-apply-needed',  label: 'Received / Apply Needed', color: '#06b6d4' },
      { id: 'done',                   label: 'Done',                    color: '#00c896' },
    ],
  },
  {
    id: 'promo',
    label: 'Promo',
    decoIds: ['promo'],
    defaultStatus: 'order-promo',
    statuses: [
      { id: 'order-promo',       label: 'Order Promo',          color: '#f59e0b' },
      { id: 'waiting-approval',  label: 'Waiting for Approval', color: '#eab308' },
      { id: 'in-production',     label: 'In Production',        color: '#f97316' },
      { id: 'in-transit',        label: 'In Transit',           color: '#3b82f6' },
      { id: 'received',          label: 'Received',             color: '#06b6d4' },
      { id: 'done',              label: 'Done',                 color: '#00c896' },
    ],
  },
  {
    id: 'dye-sub',
    label: 'Dye Sub',
    decoIds: ['dye-sub'],
    defaultStatus: 'order-jerseys',
    statuses: [
      { id: 'order-jerseys',     label: 'Order Jerseys',        color: '#f59e0b' },
      { id: 'waiting-approval',  label: 'Waiting for Approval', color: '#eab308' },
      { id: 'in-production',     label: 'In Production',        color: '#f97316' },
      { id: 'in-transit',        label: 'In Transit',           color: '#3b82f6' },
      { id: 'received',          label: 'Received',             color: '#06b6d4' },
      { id: 'done',              label: 'Done',                 color: '#00c896' },
    ],
  },
  {
    id: 'laser-engraving',
    label: 'Laser Engraving',
    decoIds: ['laser-engraving'],
    defaultStatus: 'needs-engraving',
    statuses: [
      { id: 'needs-engraving',   label: 'Needs Engraving',     color: '#f59e0b' },
      { id: 'waiting-supplies',  label: 'Waiting on Supplies', color: '#eab308' },
      { id: 'in-production',     label: 'In Production',       color: '#f97316' },
      { id: 'done',              label: 'Done',                color: '#00c896' },
    ],
  },
  {
    id: 'decals',
    label: 'Decals',
    decoIds: ['decals'],
    defaultStatus: 'needs-ordering',
    statuses: [
      { id: 'needs-ordering',    label: 'Needs Ordering',       color: '#f59e0b' },
      { id: 'waiting-approval',  label: 'Waiting for Approval', color: '#eab308' },
      { id: 'in-production',     label: 'In Production',        color: '#f97316' },
      { id: 'done',              label: 'Done',                 color: '#00c896' },
    ],
  },
];

// ---- Standard production windows (days) ----
const STANDARD_PRODUCTION_DAYS = {
  'screen-printing':   { min: 14, max: 21, label: '2–3 weeks' },
  'embroidery':        { min: 14, max: 21, label: '2–3 weeks' },
  'leather-patch':     { min:  7, max: 14, label: '1–2 weeks' },
  'laser-engraving':   { min: 14, max: 21, label: '2–3 weeks' },
  'woven-patch':       { min: 35, max: 42, label: '5–6 weeks' },
  'embroidery-patch':  { min: 35, max: 42, label: '5–6 weeks' },
  'pvc-patch':         { min: 35, max: 42, label: '5–6 weeks' },
  'printed-patch':     { min: 35, max: 42, label: '5–6 weeks' },
  _default:            { min: 14, max: 21, label: '2–3 weeks' },
};

// Returns the longest production window across all decoration types
function getJobProductionWindow(decoTypes) {
  if (!decoTypes || !decoTypes.length) return STANDARD_PRODUCTION_DAYS._default;
  let best = { min: 0, max: 0, label: '' };
  decoTypes.forEach(dt => {
    const w = STANDARD_PRODUCTION_DAYS[dt] || STANDARD_PRODUCTION_DAYS._default;
    if (w.max > best.max) best = w;
  });
  return best.max > 0 ? best : STANDARD_PRODUCTION_DAYS._default;
}

// Returns 'pre-production' | 'in-production' | 'done'
// Blanks column is intentionally excluded from the done check —
// completion is determined by the decoration/work columns only.
function getMasterStatus(job) {
  // New model — roll up across per-decoration-group tasks.
  // The order is only Done when every group task is Done.
  if (job.groupTasks && job.groupTasks.length) {
    const real = job.groupTasks.filter(t =>
      PROD_COLUMNS.some(col => !col.alwaysShow && (col.decoIds || []).some(d => (t.decorationTypes || []).includes(d)))
    );
    if (!real.length) return 'pre-production';
    const statuses = real.map(getGroupTaskStatus);
    if (statuses.every(s => s === 'done')) return 'done';
    if (statuses.some(s => s !== 'pre-production')) return 'in-production';
    return 'pre-production';
  }

  // Legacy fallback — old flat per-job progress
  const progress = job.progress || {};
  const decoCols = PROD_COLUMNS.filter(col =>
    !col.alwaysShow && (col.decoIds || []).some(d => (job.decorationTypes || []).includes(d))
  );
  if (!decoCols.length) return 'pre-production';
  if (decoCols.every(col => (progress[col.id] || col.defaultStatus) === 'done')) return 'done';
  if (decoCols.some(col => progress[col.id] === 'in-production')) return 'in-production';
  return 'pre-production';
}

// Migrate an older job (flat progress) to the per-group task model in place.
function migrateJobGroupTasks(job, order) {
  if (job.groupTasks && job.groupTasks.length) return job;
  if (order) {
    job.groupTasks = buildGroupTasks(order);
  } else {
    job.groupTasks = [{
      gid: 'main',
      productSummary: `${job.product || 'Product'}${job.color ? ' · ' + job.color : ''} ×${job.totalQty || 0}`,
      locationSummary: '',
      decorationTypes: job.decorationTypes || [],
      qty: job.totalQty || 0,
      progress: {},
    }];
  }
  // Carry any old flat progress (except blanks) into matching task columns
  const oldProg = job.progress || {};
  const oldBlanks = oldProg.blanks || 'needs-ordering';
  job.groupTasks.forEach(t => {
    Object.keys(oldProg).forEach(k => {
      if (k !== 'blanks' && k in t.progress) t.progress[k] = oldProg[k];
    });
    if (!t.blanksStatus) t.blanksStatus = oldBlanks;
    if (!t.items) t.items = [];
  });
  return job;
}

// Returns 'red', 'yellow', or null based on deadline proximity
function getJobUrgency(job) {
  const now = new Date();
  const msPerDay = 864e5;

  if (job.inHandDate && job.isHardDeadline) {
    const due = new Date(job.inHandDate);
    const daysLeft = (due - now) / msPerDay;
    if (daysLeft < 2)  return 'red';
    if (daysLeft < 5)  return 'yellow';
    return null;
  }

  // Standard production — warn when we're past the min window, critical past the max
  if (!job.approvedAt) return null;
  const window = getJobProductionWindow(job.decorationTypes);
  const approvedDate = new Date(job.approvedAt);
  const minEnd = new Date(approvedDate.getTime() + window.min * msPerDay);
  const maxEnd = new Date(approvedDate.getTime() + window.max * msPerDay);
  if (now > maxEnd) return 'red';
  if (now > minEnd) return 'yellow';
  return null;
}

// ---- Helpers ----
function getOrderDecoTypes(order) {
  // New multi-group orders store a flat decorationTypes array
  if (order.decorationTypes && order.decorationTypes.length) return order.decorationTypes;
  // Online store orders store decorations array
  if (order.decorations && order.decorations.length) return order.decorations.map(d => d.type);
  // Legacy single decoration type
  if (order.decorationType) return [order.decorationType];
  return [];
}

function getProdStatusInfo(colId, statusId) {
  const col = PROD_COLUMNS.find(c => c.id === colId);
  if (!col) return { label: statusId, color: '#555' };
  return col.statuses.find(s => s.id === statusId) || { label: statusId, color: '#555' };
}

// ---- Per-decoration-group production tasks ----

// Decoration types for a single decoration group
function getGroupDecoTypes(g) {
  if (g.decorationTypes && g.decorationTypes.length) return [...new Set(g.decorationTypes)];
  if (g.decos && g.decos.length) return [...new Set(g.decos.map(d => d.type).filter(Boolean))];
  if (g.decorationType) return [g.decorationType];
  return [];
}

// Build the production sub-tasks for an order — one per decoration group.
// Each task carries its own progress object (per-column status).
function buildGroupTasks(order) {
  const tasks = [];
  const decoCols = PROD_COLUMNS.filter(c => !c.alwaysShow);
  const groups = (order.decorationGroups && order.decorationGroups.length) ? order.decorationGroups : null;
  const orderCS = !!order.customerSuppliedBlanks;

  if (groups) {
    groups.forEach((g, gi) => {
      const decoTypes = getGroupDecoTypes(g);
      const itemsRaw = g.items || [];
      // Slim per-item copy on the task so the production board can show
      // per-size quantities, supplier lookups, and customer-supplied state
      const items = itemsRaw.map(it => ({
        productId:        it.productId || '',
        productName:      it.productName || '',
        color:            it.color || '',
        colorHex:         it.colorHex || '',
        quantities:       { ...(it.quantities || {}) },
        totalQty:         it.totalQty || 0,
        customerSupplied: !!it.customerSupplied || orderCS,
      }));
      const productSummary = items.length
        ? items.map(it => `${it.productName || 'Product'}${it.color ? ' · ' + it.color : ''} ×${it.totalQty || 0}`).join(', ')
        : (order.product || 'Product');
      const locs = (g.decos && g.decos.length)
        ? [...new Set(g.decos.map(d => d.location).filter(Boolean))]
        : (g.location ? [g.location] : []);
      const qty = items.length ? items.reduce((s, it) => s + (it.totalQty || 0), 0) : (g.totalQty || 0);
      const progress = {};
      decoCols.forEach(col => {
        if ((col.decoIds || []).some(did => decoTypes.includes(did))) progress[col.id] = col.defaultStatus;
      });
      const allCS = items.length > 0 && items.every(it => it.customerSupplied);
      tasks.push({
        gid:             g.id || ('g' + gi),
        productSummary,
        locationSummary: locs.join(', '),
        decorationTypes: decoTypes,
        qty,
        items,
        progress,
        blanksStatus:    allCS ? 'customer-supplied' : 'needs-ordering',
      });
    });
  } else {
    const decoTypes = getOrderDecoTypes(order);
    const progress = {};
    decoCols.forEach(col => {
      if ((col.decoIds || []).some(did => decoTypes.includes(did))) progress[col.id] = col.defaultStatus;
    });
    const synthItem = {
      productId:        order.productId || '',
      productName:      order.product || 'Product',
      color:            order.color || '',
      colorHex:         order.colorHex || '',
      quantities:       { ...(order.quantities || {}) },
      totalQty:         order.totalQty || 0,
      customerSupplied: orderCS,
    };
    tasks.push({
      gid:             'main',
      productSummary:  `${order.product || 'Product'}${order.color ? ' · ' + order.color : ''} ×${order.totalQty || 0}`,
      locationSummary: order.decorationLocation || '',
      decorationTypes: decoTypes,
      qty:             order.totalQty || 0,
      items:           [synthItem],
      progress,
      blanksStatus:    orderCS ? 'customer-supplied' : 'needs-ordering',
    });
  }
  return tasks;
}

// Status of a single group task: 'pre-production' | 'in-production' | 'done'
function getGroupTaskStatus(task) {
  const decoCols = PROD_COLUMNS.filter(col =>
    !col.alwaysShow && (col.decoIds || []).some(d => (task.decorationTypes || []).includes(d))
  );
  if (!decoCols.length) return 'done'; // nothing to decorate — not a blocker
  const prog = task.progress || {};
  if (decoCols.every(col => (prog[col.id] || col.defaultStatus) === 'done')) return 'done';
  if (decoCols.some(col => (prog[col.id] || col.defaultStatus) !== col.defaultStatus)) return 'in-production';
  return 'pre-production';
}

// ---- CRUD ----
function getProductionJobs() {
  try {
    const saved = localStorage.getItem(PROD_JOBS_KEY);
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return [];
}

function saveProductionJobs(jobs) {
  localStorage.setItem(PROD_JOBS_KEY, JSON.stringify(jobs));
  if (typeof cloudSave === 'function') cloudSave('production', jobs);
}

function ensureProductionJob(order) {
  const jobs = getProductionJobs();

  // Already on the board (either as primary order or as a group member)
  if (jobs.find(j => j.orderId === order.id || (j.memberOrderIds && j.memberOrderIds.includes(order.id)))) return;

  // If this order belongs to a group, check if the group's job already exists
  if (order.groupId) {
    const groupJobIdx = jobs.findIndex(j => j.groupId === order.groupId);
    if (groupJobIdx !== -1) {
      const gj = jobs[groupJobIdx];
      const newDecoTypes = getOrderDecoTypes(order);
      const merged = [...new Set([...gj.decorationTypes, ...newDecoTypes])];

      // Merge new decoration columns into progress
      const progress = { ...gj.progress };
      PROD_COLUMNS.filter(c => !c.alwaysShow).forEach(col => {
        if (!(col.id in progress)) {
          const applies = (col.decoIds || []).some(did => newDecoTypes.includes(did));
          if (applies) progress[col.id] = col.defaultStatus;
        }
      });

      const products = [...(gj.products || []), {
        orderId: order.id, product: order.product || '', color: order.color || '', qty: order.totalQty || 0,
      }];

      jobs[groupJobIdx] = {
        ...gj,
        decorationTypes: merged,
        totalQty: (gj.totalQty || 0) + (order.totalQty || 0),
        memberOrderIds: [...(gj.memberOrderIds || [gj.orderId]), order.id],
        products,
        progress,
        groupTasks: [...(gj.groupTasks || []), ...buildGroupTasks(order)],
        updatedAt: new Date().toISOString(),
      };
      saveProductionJobs(jobs);
      return;
    }
  }

  const decoTypes = getOrderDecoTypes(order);
  const progress = {};

  progress.blanks = order.customerSuppliedBlanks ? 'customer-supplied' : 'needs-ordering';

  PROD_COLUMNS.filter(c => !c.alwaysShow).forEach(col => {
    const applies = (col.decoIds || []).some(did => decoTypes.includes(did));
    if (applies) progress[col.id] = col.defaultStatus;
  });

  // Build products list — from decorationGroups if present, else from groupId, else single
  let products = null;
  if (order.decorationGroups && order.decorationGroups.length) {
    const allItems = order.decorationGroups.flatMap(g => g.items || []);
    if (allItems.length > 1) {
      products = allItems.map(it => ({
        orderId: order.id,
        product: it.productName || '',
        color:   it.color || '',
        qty:     it.totalQty || 0,
      }));
    }
  } else if (order.groupId) {
    products = [{ orderId: order.id, product: order.product || '', color: order.color || '', qty: order.totalQty || 0 }];
  }

  const isGroup = !!order.groupId;
  jobs.unshift({
    orderId:               order.id,
    groupId:               order.groupId || null,
    memberOrderIds:        isGroup ? [order.id] : null,
    products,
    customerName:          order.customerName || '',
    customerEmail:         order.customerEmail || '',
    product:               order.product || '',
    color:                 order.color || '',
    totalQty:              order.totalQty || 0,
    decorationTypes:       decoTypes,
    customerSuppliedBlanks: order.customerSuppliedBlanks || false,
    approvedAt:            order.approvedAt || new Date().toISOString(),
    inHandDate:            order.inHandDate || null,
    isHardDeadline:        order.isHardDeadline || false,
    progress,
    groupTasks:            buildGroupTasks(order),
    createdAt:             new Date().toISOString(),
    updatedAt:             new Date().toISOString(),
  });
  saveProductionJobs(jobs);
}

function updateProductionJob(orderId, changes) {
  const jobs = getProductionJobs();
  const idx = jobs.findIndex(j => j.orderId === orderId);
  if (idx === -1) return;
  jobs[idx] = { ...jobs[idx], ...changes, updatedAt: new Date().toISOString() };
  saveProductionJobs(jobs);
}

// Removes the production job for a given order ID.
// Handles grouped jobs: if the order is a member (not the primary), removes just
// that member; if it's the last member the whole job is removed.
function removeProductionJob(orderId) {
  let jobs = getProductionJobs();

  // Direct match (primary orderId)
  const directIdx = jobs.findIndex(j => j.orderId === orderId);
  if (directIdx !== -1) {
    jobs.splice(directIdx, 1);
    saveProductionJobs(jobs);
    return;
  }

  // Group member match
  const groupIdx = jobs.findIndex(j => j.memberOrderIds && j.memberOrderIds.includes(orderId));
  if (groupIdx !== -1) {
    const gj = jobs[groupIdx];
    const remaining = (gj.memberOrderIds || []).filter(id => id !== orderId);
    if (remaining.length === 0) {
      jobs.splice(groupIdx, 1);
    } else {
      jobs[groupIdx] = {
        ...gj,
        memberOrderIds: remaining,
        products: (gj.products || []).filter(p => p.orderId !== orderId),
        totalQty: (gj.products || []).filter(p => p.orderId !== orderId).reduce((s, p) => s + (p.qty || 0), 0),
        updatedAt: new Date().toISOString(),
      };
    }
    saveProductionJobs(jobs);
  }
}
