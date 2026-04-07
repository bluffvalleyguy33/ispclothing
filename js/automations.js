// ============================================================
// AUTOMATIONS ENGINE
// ============================================================
// Handles CRUD, trigger dispatch, and action execution.
// Email sent via EmailJS (same as portal access emails).
// Stored in Firestore at app_data/automations via cloudSave.
// ============================================================

var _automationExecuting = false; // guard against infinite loops

// ---- Trigger event constants ----
var AUTO_EVENTS = [
  { id: 'order_created',           label: 'New order created' },
  { id: 'status_changed',          label: 'Order status changed' },
  { id: 'payment_marked_received', label: 'Payment marked received' },
];

// ---- Action type constants ----
var AUTO_ACTIONS = [
  { id: 'send_email',          label: 'Send email' },
  { id: 'show_toast',          label: 'Show in-app notification' },
  { id: 'auto_advance_status', label: 'Auto-move order to status' },
  { id: 'webhook',             label: 'Send webhook (coming soon)', disabled: true },
];

// ---- Order statuses for dropdowns ----
var AUTO_STATUSES = [
  { id: 'new-lead',              label: 'New Lead' },
  { id: 'quote',                 label: 'Quote' },
  { id: 'mockups-needed',        label: 'Mockups Needed' },
  { id: 'mockups-sent',          label: 'Mockups Sent' },
  { id: 'out-for-approval',      label: 'Out for Approval' },
  { id: 'approved',              label: 'Approved' },
  { id: 'pre-production',        label: 'Pre-Production' },
  { id: 'in-production',         label: 'In Production' },
  { id: 'done',                  label: 'Done' },
];

// ---- Default automations seeded on first load ----
var DEFAULT_AUTOMATIONS = [
  {
    id: 'auto_mockups_sent',
    name: 'Notify customer: mockups ready',
    description: 'Emails the customer when their mockups are sent for review.',
    enabled: false,
    trigger: { event: 'status_changed', conditions: { toStatus: 'mockups-sent' } },
    action: {
      type: 'send_email',
      params: {
        to: 'customer',
        subject: 'Your mockups are ready for review — Order {{orderId}}',
        body: 'Hi {{customerName}},\n\nGreat news! Your mockups for order {{orderId}} are ready for review.\n\nLog in to your portal to view and approve them:\n{{portalUrl}}\n\nIf you have any questions, just reply to this email.\n\nThanks,\nInsignia Screen Printing',
      },
    },
    lastRan: null, runCount: 0, createdAt: new Date().toISOString(),
  },
  {
    id: 'auto_out_for_approval',
    name: 'Notify customer: quote ready for approval',
    description: 'Emails the customer their approval link when the order is sent for final approval.',
    enabled: false,
    trigger: { event: 'status_changed', conditions: { toStatus: 'out-for-approval' } },
    action: {
      type: 'send_email',
      params: {
        to: 'customer',
        subject: 'Your quote is ready for approval — Order {{orderId}}',
        body: 'Hi {{customerName}},\n\nYour quote for order {{orderId}} is ready for your final approval.\n\nPlease review and approve here:\n{{portalUrl}}\n\nThis approval confirms you are happy with the mockups and pricing before we begin production.\n\nThanks,\nInsignia Screen Printing',
      },
    },
    lastRan: null, runCount: 0, createdAt: new Date().toISOString(),
  },
  {
    id: 'auto_in_production',
    name: 'Notify customer: order in production',
    description: 'Emails the customer when their order enters production.',
    enabled: false,
    trigger: { event: 'status_changed', conditions: { toStatus: 'in-production' } },
    action: {
      type: 'send_email',
      params: {
        to: 'customer',
        subject: 'Your order is now in production — Order {{orderId}}',
        body: 'Hi {{customerName}},\n\nExciting! Your order {{orderId}} has entered production.\n\nYou can track progress in your portal:\n{{portalUrl}}\n\nWe\'ll notify you when it\'s ready.\n\nThanks,\nInsignia Screen Printing',
      },
    },
    lastRan: null, runCount: 0, createdAt: new Date().toISOString(),
  },
  {
    id: 'auto_done',
    name: 'Notify customer: order complete',
    description: 'Emails the customer when their order is finished.',
    enabled: false,
    trigger: { event: 'status_changed', conditions: { toStatus: 'done' } },
    action: {
      type: 'send_email',
      params: {
        to: 'customer',
        subject: 'Your order is complete! — Order {{orderId}}',
        body: 'Hi {{customerName}},\n\nYour order {{orderId}} is complete and ready!\n\nThank you for choosing Insignia Screen Printing. We hope to work with you again soon.\n\nView your order details:\n{{portalUrl}}\n\nThanks,\nInsignia Screen Printing',
      },
    },
    lastRan: null, runCount: 0, createdAt: new Date().toISOString(),
  },
  {
    id: 'auto_new_lead_toast',
    name: 'Alert admin: new web lead',
    description: 'Shows an in-app notification when a new online order comes in.',
    enabled: true,
    trigger: { event: 'order_created', conditions: { source: 'web-submission' } },
    action: {
      type: 'show_toast',
      params: { message: 'New web lead: {{customerName}} ({{orderId}})', type: 'success' },
    },
    lastRan: null, runCount: 0, createdAt: new Date().toISOString(),
  },
  {
    id: 'auto_payment_toast',
    name: 'Alert admin: payment received',
    description: 'Shows an in-app notification when payment is marked received on an order.',
    enabled: true,
    trigger: { event: 'payment_marked_received', conditions: {} },
    action: {
      type: 'show_toast',
      params: { message: 'Payment received for {{orderId}} — {{customerName}}', type: 'success' },
    },
    lastRan: null, runCount: 0, createdAt: new Date().toISOString(),
  },
];

// ---- CRUD ----
function getAutomations() {
  try {
    var saved = localStorage.getItem('insignia_automations');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return [];
}

function saveAutomations(automations) {
  localStorage.setItem('insignia_automations', JSON.stringify(automations));
  if (typeof cloudSave === 'function') cloudSave('automations', automations);
}

function initAutomations() {
  if (typeof cloudLoad !== 'function') {
    if (!getAutomations().length) saveAutomations(DEFAULT_AUTOMATIONS);
    return;
  }
  cloudLoad('automations', function(data) {
    if (!data || !data.length) {
      saveAutomations(DEFAULT_AUTOMATIONS);
    } else {
      localStorage.setItem('insignia_automations', JSON.stringify(data));
    }
  });
}

// ---- Trigger dispatch ----
function fireOrderEvent(eventType, order, prevOrder) {
  if (_automationExecuting) return;
  var automations = getAutomations().filter(function(a) {
    return a.enabled && a.trigger.event === eventType;
  });
  automations.forEach(function(auto) {
    if (!matchesConditions(auto.trigger.conditions, order, prevOrder)) return;
    _automationExecuting = true;
    try {
      executeAutomation(auto, order, prevOrder);
    } finally {
      _automationExecuting = false;
    }
    // Update stats
    var all = getAutomations();
    var idx = all.findIndex(function(a) { return a.id === auto.id; });
    if (idx !== -1) {
      all[idx].lastRan  = new Date().toISOString();
      all[idx].runCount = (all[idx].runCount || 0) + 1;
      saveAutomations(all);
    }
  });
}

function matchesConditions(conditions, order, prevOrder) {
  if (!conditions) return true;
  if (conditions.toStatus && order.status !== conditions.toStatus) return false;
  if (conditions.fromStatus && (!prevOrder || prevOrder.status !== conditions.fromStatus)) return false;
  if (conditions.source && order.source !== conditions.source) return false;
  return true;
}

// ---- Action execution ----
function executeAutomation(auto, order, prevOrder) {
  var p    = auto.action.params || {};
  var vars = buildTemplateVars(order);

  switch (auto.action.type) {
    case 'send_email': {
      var toEmail = resolveRecipient(p.to, p.customTo, order);
      if (!toEmail) {
        if (typeof toast === 'function') toast('Automation "' + auto.name + '": no recipient email found', 'error');
        return;
      }
      sendAutomationEmail(toEmail, interpolate(p.subject || '', vars), interpolate(p.body || '', vars));
      break;
    }
    case 'show_toast': {
      if (typeof toast === 'function') toast(interpolate(p.message || '', vars), p.type || 'success');
      break;
    }
    case 'auto_advance_status': {
      if (!p.targetStatus) return;
      if (typeof updateOrder === 'function') updateOrder(order.id, { status: p.targetStatus });
      break;
    }
  }
}

function buildTemplateVars(order) {
  var portalUrl = (typeof EMAIL_CONFIG !== 'undefined' && EMAIL_CONFIG.portalUrl)
    ? EMAIL_CONFIG.portalUrl
    : window.location.origin + '/portal.html';
  var statusLabel = '';
  if (typeof ORDER_STATUSES !== 'undefined') {
    var s = ORDER_STATUSES.find(function(x) { return x.id === order.status; });
    statusLabel = s ? s.label : (order.status || '');
  }
  return {
    orderId:       order.id || '—',
    customerName:  order.customerName || 'Customer',
    customerEmail: order.customerEmail || '',
    customerPhone: order.customerPhone || '',
    customerCompany: order.customerCompany || '',
    status:        order.status || '',
    statusLabel:   statusLabel,
    orderTotal:    order.totalPrice ? '$' + parseFloat(order.totalPrice).toFixed(2) : '—',
    salesRepName:  order.salesRepName || '',
    portalUrl:     portalUrl,
    createdAt:     order.createdAt ? order.createdAt.slice(0, 10) : '',
  };
}

function interpolate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, function(_, key) {
    return vars[key] !== undefined ? vars[key] : '{{' + key + '}}';
  });
}

function resolveRecipient(toType, customTo, order) {
  if (toType === 'customer')  return order.customerEmail || null;
  if (toType === 'sales_rep') return order.salesRepEmail || null;
  if (toType === 'custom')    return customTo || null;
  return customTo || null;
}

function sendAutomationEmail(toEmail, subject, body) {
  if (typeof emailjs !== 'undefined' &&
      typeof EMAIL_CONFIG !== 'undefined' &&
      EMAIL_CONFIG.emailjsPublicKey &&
      EMAIL_CONFIG.emailjsServiceId &&
      EMAIL_CONFIG.emailjsTemplateId) {
    emailjs.init(EMAIL_CONFIG.emailjsPublicKey);
    emailjs.send(EMAIL_CONFIG.emailjsServiceId, EMAIL_CONFIG.emailjsTemplateId, {
      to_email:      toEmail,
      customer_name: '',
      temp_password: '',
      portal_url:    body,   // body sent through portal_url field for generic use
      subject_line:  subject,
    }).then(function() {
      if (typeof toast === 'function') toast('Automation email sent to ' + toEmail, 'success');
    }).catch(function(err) {
      console.warn('[Automations] Email send failed:', err);
      if (typeof toast === 'function') toast('Automation email failed: ' + (err.text || err.message || err), 'error');
    });
  } else {
    // Fallback: open mailto
    var mailto = 'mailto:' + encodeURIComponent(toEmail)
      + '?subject=' + encodeURIComponent(subject)
      + '&body=' + encodeURIComponent(body);
    window.open(mailto, '_blank');
  }
}

// ---- Admin UI ----
function renderAutomationsSection() {
  var wrap = document.getElementById('automations-list');
  if (!wrap) return;
  var automations = getAutomations();

  if (!automations.length) {
    wrap.innerHTML = '<p class="a-hint" style="padding:24px 0">No automations yet. Click "+ New Automation" to create one.</p>';
    return;
  }

  wrap.innerHTML = automations.map(function(auto) {
    var triggerLabel = _autoTriggerLabel(auto.trigger);
    var actionLabel  = _autoActionLabel(auto.action);
    var lastRan = auto.lastRan
      ? 'Last ran ' + _autoTimeAgo(auto.lastRan) + ' · ' + (auto.runCount || 0) + ' runs'
      : 'Never ran';

    return '<div class="auto-card' + (auto.enabled ? '' : ' auto-card-disabled') + '" data-id="' + auto.id + '">'
      + '<div class="auto-card-header">'
        + '<label class="auto-toggle-label" onclick="event.stopPropagation()">'
          + '<input type="checkbox" class="auto-toggle-inp" ' + (auto.enabled ? 'checked' : '') + ' onchange="toggleAutomation(\'' + auto.id + '\',this.checked)">'
          + '<span class="auto-toggle-track"></span>'
        + '</label>'
        + '<div class="auto-card-title-wrap">'
          + '<div class="auto-card-name">' + auto.name + '</div>'
          + '<div class="auto-card-desc">' + auto.description + '</div>'
        + '</div>'
        + '<div class="auto-card-btns">'
          + '<button class="a-btn a-btn-ghost a-btn-sm" onclick="runAutomationNow(\'' + auto.id + '\')">Test</button>'
          + '<button class="a-btn a-btn-ghost a-btn-sm" onclick="openEditAutomationModal(\'' + auto.id + '\')">Edit</button>'
          + '<button class="a-btn a-btn-ghost a-btn-sm" style="color:#ef4444" onclick="deleteAutomation(\'' + auto.id + '\')">Delete</button>'
        + '</div>'
      + '</div>'
      + '<div class="auto-card-pipeline">'
        + '<span class="auto-pill auto-pill-trigger">' + triggerLabel + '</span>'
        + '<span class="auto-pipeline-arrow">→</span>'
        + '<span class="auto-pill auto-pill-action">' + actionLabel + '</span>'
      + '</div>'
      + '<div class="auto-card-footer">' + lastRan + '</div>'
    + '</div>';
  }).join('');
}

function _autoTriggerLabel(trigger) {
  var ev = AUTO_EVENTS.find(function(e) { return e.id === trigger.event; });
  var base = ev ? ev.label : trigger.event;
  var c = trigger.conditions || {};
  if (c.toStatus) {
    var s = AUTO_STATUSES.find(function(x) { return x.id === c.toStatus; });
    base += ' → ' + (s ? s.label : c.toStatus);
  }
  if (c.source) base += ' (source: ' + c.source + ')';
  return base;
}

function _autoActionLabel(action) {
  var at = AUTO_ACTIONS.find(function(a) { return a.id === action.type; });
  var base = at ? at.label : action.type;
  var p = action.params || {};
  if (action.type === 'send_email') {
    base += ' to ' + (p.to === 'customer' ? 'customer' : p.to === 'sales_rep' ? 'sales rep' : (p.customTo || 'custom'));
  }
  if (action.type === 'auto_advance_status' && p.targetStatus) {
    var s = AUTO_STATUSES.find(function(x) { return x.id === p.targetStatus; });
    base += ': ' + (s ? s.label : p.targetStatus);
  }
  if (action.type === 'show_toast') base += ': "' + (p.message || '').slice(0, 40) + '"';
  return base;
}

function _autoTimeAgo(isoString) {
  var diff = Date.now() - new Date(isoString).getTime();
  var mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + 'm ago';
  var hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}

// ---- Toggle / Delete ----
function toggleAutomation(id, enabled) {
  var all = getAutomations();
  var idx = all.findIndex(function(a) { return a.id === id; });
  if (idx === -1) return;
  all[idx].enabled = enabled;
  saveAutomations(all);
  renderAutomationsSection();
  if (typeof toast === 'function') toast(all[idx].name + (enabled ? ' enabled' : ' disabled'), 'success');
}

function deleteAutomation(id) {
  var all  = getAutomations();
  var auto = all.find(function(a) { return a.id === id; });
  if (!auto) return;
  if (!confirm('Delete automation "' + auto.name + '"? This cannot be undone.')) return;
  saveAutomations(all.filter(function(a) { return a.id !== id; }));
  renderAutomationsSection();
  if (typeof toast === 'function') toast('Automation deleted', 'success');
}

// ---- Test run ----
function runAutomationNow(id) {
  var auto   = getAutomations().find(function(a) { return a.id === id; });
  if (!auto) return;
  var orders = typeof getOrders === 'function' ? getOrders() : [];
  var order  = orders[0];
  if (!order) {
    if (typeof toast === 'function') toast('No orders to test against', 'error');
    return;
  }
  if (!confirm('Test "' + auto.name + '" against the most recent order (' + order.id + ')?\n\nThis will fire the action for real.')) return;
  executeAutomation(auto, order, null);
}

// ---- Edit / New modal ----
function openNewAutomationModal() {
  _openAutomationModal(null);
}

function openEditAutomationModal(id) {
  var auto = getAutomations().find(function(a) { return a.id === id; });
  if (!auto) return;
  _openAutomationModal(auto);
}

function _openAutomationModal(auto) {
  var overlay = document.getElementById('automation-modal-overlay');
  if (!overlay) return;

  var isNew   = !auto;
  var data    = auto || {
    id: 'auto_' + Date.now(),
    name: '', description: '', enabled: true,
    trigger: { event: 'status_changed', conditions: {} },
    action: { type: 'send_email', params: { to: 'customer', subject: '', body: '' } },
    lastRan: null, runCount: 0, createdAt: new Date().toISOString(),
  };

  document.getElementById('auto-modal-title').textContent = isNew ? 'New Automation' : 'Edit Automation';
  document.getElementById('auto-modal-id').value          = data.id;
  document.getElementById('auto-name-inp').value          = data.name;
  document.getElementById('auto-desc-inp').value          = data.description;
  document.getElementById('auto-event-sel').value         = data.trigger.event;
  document.getElementById('auto-to-status-sel').value     = data.trigger.conditions.toStatus || '';
  document.getElementById('auto-from-status-sel').value   = data.trigger.conditions.fromStatus || '';
  document.getElementById('auto-action-type-sel').value   = data.action.type;

  var p = data.action.params || {};
  document.getElementById('auto-email-to-sel').value      = p.to || 'customer';
  document.getElementById('auto-email-custom').value      = p.customTo || '';
  document.getElementById('auto-email-subject').value     = p.subject || '';
  document.getElementById('auto-email-body').value        = p.body || '';
  document.getElementById('auto-toast-msg').value         = p.message || '';
  document.getElementById('auto-toast-type-sel').value    = p.type || 'success';
  document.getElementById('auto-advance-status-sel').value = p.targetStatus || '';

  _autoUpdateModalVisibility();
  overlay.classList.add('open');
}

function _autoUpdateModalVisibility() {
  var event      = document.getElementById('auto-event-sel').value;
  var actionType = document.getElementById('auto-action-type-sel').value;
  var toVal      = document.getElementById('auto-email-to-sel').value;

  // Condition fields
  document.getElementById('auto-cond-status-row').style.display =
    event === 'status_changed' ? '' : 'none';

  // Action fields
  document.getElementById('auto-action-email').style.display =
    actionType === 'send_email' ? '' : 'none';
  document.getElementById('auto-action-toast').style.display =
    actionType === 'show_toast' ? '' : 'none';
  document.getElementById('auto-action-advance').style.display =
    actionType === 'auto_advance_status' ? '' : 'none';

  // Custom email field
  document.getElementById('auto-email-custom-row').style.display =
    toVal === 'custom' ? '' : 'none';
}

function saveAutomationFromModal() {
  var id   = document.getElementById('auto-modal-id').value;
  var name = document.getElementById('auto-name-inp').value.trim();
  if (!name) { if (typeof toast === 'function') toast('Please enter a name', 'error'); return; }

  var event      = document.getElementById('auto-event-sel').value;
  var toStatus   = document.getElementById('auto-to-status-sel').value;
  var fromStatus = document.getElementById('auto-from-status-sel').value;
  var actionType = document.getElementById('auto-action-type-sel').value;
  var emailTo    = document.getElementById('auto-email-to-sel').value;
  var customTo   = document.getElementById('auto-email-custom').value.trim();
  var subject    = document.getElementById('auto-email-subject').value.trim();
  var body       = document.getElementById('auto-email-body').value.trim();
  var toastMsg   = document.getElementById('auto-toast-msg').value.trim();
  var toastType  = document.getElementById('auto-toast-type-sel').value;
  var targetSt   = document.getElementById('auto-advance-status-sel').value;

  var conditions = {};
  if (toStatus)   conditions.toStatus   = toStatus;
  if (fromStatus) conditions.fromStatus = fromStatus;

  var params = {};
  if (actionType === 'send_email')          { params = { to: emailTo, customTo: customTo, subject: subject, body: body }; }
  if (actionType === 'show_toast')          { params = { message: toastMsg, type: toastType }; }
  if (actionType === 'auto_advance_status') { params = { targetStatus: targetSt }; }

  var all = getAutomations();
  var idx = all.findIndex(function(a) { return a.id === id; });
  var updated = {
    id:          id,
    name:        name,
    description: document.getElementById('auto-desc-inp').value.trim(),
    enabled:     idx !== -1 ? all[idx].enabled : true,
    trigger:     { event: event, conditions: conditions },
    action:      { type: actionType, params: params },
    lastRan:     idx !== -1 ? all[idx].lastRan  : null,
    runCount:    idx !== -1 ? all[idx].runCount : 0,
    createdAt:   idx !== -1 ? all[idx].createdAt : new Date().toISOString(),
  };

  if (idx !== -1) { all[idx] = updated; }
  else            { all.push(updated); }

  saveAutomations(all);
  renderAutomationsSection();
  document.getElementById('automation-modal-overlay').classList.remove('open');
  if (typeof toast === 'function') toast('Automation saved', 'success');
}

function closeAutomationModal() {
  var overlay = document.getElementById('automation-modal-overlay');
  if (overlay) overlay.classList.remove('open');
}
