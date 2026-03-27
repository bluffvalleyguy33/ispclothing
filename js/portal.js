/* ============================================
   INSIGNIA — Customer Portal Logic
   ============================================ */

let portalEmail = '';
let portalOrders = [];

// ============================================
// AUTH
// ============================================
function portalLogin() {
  const email = document.getElementById('portal-email').value.trim().toLowerCase();
  const errEl = document.getElementById('portal-error');

  if (!email) {
    errEl.classList.add('visible');
    errEl.textContent = 'Please enter your email address.';
    return;
  }

  const orders = getOrdersByEmail(email);
  if (!orders.length) {
    errEl.classList.add('visible');
    errEl.textContent = 'No orders found for that email. Please check your spelling or contact us.';
    return;
  }

  errEl.classList.remove('visible');
  portalEmail = email;
  portalOrders = orders;
  sessionStorage.setItem('portal_email', email);

  document.getElementById('portal-login').style.display = 'none';
  document.getElementById('portal-app').style.display = 'block';
  document.getElementById('ph-email-label').textContent = email;

  renderOrders();
}

function portalLogout() {
  sessionStorage.removeItem('portal_email');
  sessionStorage.removeItem('insignia_user');
  portalEmail = '';
  portalOrders = [];
  document.getElementById('portal-app').style.display = 'none';
  document.getElementById('portal-login').style.display = 'flex';
  document.getElementById('portal-email').value = '';
}

// ============================================
// RENDER ORDERS
// ============================================
function renderOrders() {
  const list = document.getElementById('portal-orders-list');

  if (!portalOrders.length) {
    list.innerHTML = `
      <div class="p-orders-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <h3>No orders yet</h3>
        <p>When you place an order it will appear here.<br>You can track its status every step of the way.</p>
      </div>`;
    return;
  }

  list.innerHTML = portalOrders.map(o => buildOrderCard(o)).join('');
}

function buildOrderCard(o) {
  const si = getStatusInfo(o.status);
  const tl = CUSTOMER_TIMELINE;
  const statusIdx = tl.indexOf(o.status) !== -1 ? tl.indexOf(o.status) : -1;

  const total = o.totalPrice ? `$${parseFloat(o.totalPrice).toFixed(2)}` : '—';
  const qty = o.totalQty ? `${o.totalQty} pcs` : '';

  // Look up production master status if a job exists for this order
  let masterStatusHtml = '';
  if (typeof getProductionJobs === 'function' && typeof getMasterStatus === 'function') {
    const jobs = getProductionJobs();
    const job = jobs.find(j => j.orderId === o.id || (j.memberOrderIds && j.memberOrderIds.includes(o.id)));
    if (job) {
      const master = getMasterStatus(job);
      const defs = {
        'pre-production': { label: 'Getting Ready',  color: '#6366f1', icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>` },
        'in-production':  { label: 'In Production',  color: '#f97316', icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>` },
        'done':           { label: 'Production Complete', color: '#00c896', icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>` },
      };
      const d = defs[master];
      if (d) {
        masterStatusHtml = `<div class="p-master-status" style="background:${d.color}18;color:${d.color};border:1px solid ${d.color}35">
          ${d.icon} ${d.label}
        </div>`;
      }
    }
  }

  // Timeline
  const timelineHtml = tl.map((sid, i) => {
    const isDone = statusIdx >= 0 ? i < statusIdx : false;
    const isActive = i === statusIdx;
    const cls = isDone ? 'done' : isActive ? 'active' : '';
    const label = getStatusInfo(sid).label;
    const lineHtml = i < tl.length - 1
      ? `<div class="p-tl-line ${isDone ? 'done' : ''}"></div>`
      : '';
    return `<div class="p-tl-step ${cls}">
      <div class="p-tl-dot"><div class="p-tl-dot-inner"></div></div>
      <div class="p-tl-label">${label}</div>
    </div>${lineHtml}`;
  }).join('');

  const noteHtml = o.customerNote
    ? `<div class="p-card-note">
        <div class="p-card-note-label">Update from Insignia</div>
        ${o.customerNote}
      </div>`
    : '';

  return `<div class="p-order-card" onclick="openDrawer('${o.id}')">
    <div class="p-card-top">
      <div class="p-card-left">
        <div class="p-card-ref">${o.id}</div>
        <div class="p-card-product">${o.product || 'Custom Order'}</div>
        <div class="p-card-meta">${o.decorationType || ''} · ${formatDate(o.createdAt)}</div>
      </div>
      <div class="p-card-right">
        <div class="p-card-status-badge" style="background:${si.color}20;color:${si.color};border:1px solid ${si.color}40">${si.label}</div>
        ${total !== '—' ? `<div class="p-card-price">${total}</div>` : ''}
        ${qty ? `<div class="p-card-qty">${qty}</div>` : ''}
      </div>
    </div>
    <div class="p-timeline">
      <div class="p-timeline-track">${timelineHtml}</div>
    </div>
    ${masterStatusHtml}
    ${noteHtml}
  </div>`;
}

// ============================================
// ORDER DETAIL DRAWER
// ============================================
function openDrawer(id) {
  // Refresh orders in case status changed
  const freshOrders = getOrdersByEmail(portalEmail);
  const o = freshOrders.find(x => x.id === id);
  if (!o) return;

  const si = getStatusInfo(o.status);
  const total = o.totalPrice ? `$${parseFloat(o.totalPrice).toFixed(2)}` : '—';
  const ppp = o.pricePerPiece ? `$${parseFloat(o.pricePerPiece).toFixed(2)}` : '—';

  const qtyChips = Object.entries(o.quantities || {})
    .filter(([,v]) => v > 0)
    .map(([size, qty]) => `<span class="p-qty-chip">${size}: ${qty}</span>`)
    .join('');

  const trackingHtml = o.trackingNumber
    ? `<div class="p-tracking-box">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        <div>
          <div class="p-tracking-label">Tracking Number</div>
          <div class="p-tracking-num">${o.trackingNumber}</div>
        </div>
      </div>`
    : '';

  const noteHtml = o.customerNote
    ? `<div class="p-detail-note"><strong>Update from Insignia</strong>${o.customerNote}</div>`
    : '';

  const colorHtml = o.color
    ? `<span class="p-color-swatch"><span class="p-color-dot" style="background:${o.colorHex || '#888'}"></span>${o.color}</span>`
    : '—';

  document.getElementById('p-drawer-title').textContent = o.product || 'Custom Order';
  document.getElementById('p-drawer-id').textContent = o.id;

  document.getElementById('p-drawer-body').innerHTML = `
    <div class="p-detail-section">
      <div style="display:inline-flex;align-items:center;gap:8px;background:${si.color}18;border:1px solid ${si.color}35;padding:8px 14px;border-radius:8px;margin-bottom:16px">
        <span style="width:8px;height:8px;border-radius:50%;background:${si.color};display:inline-block;flex-shrink:0"></span>
        <span style="font-size:13px;font-weight:700;color:${si.color}">${si.label}</span>
        <span style="font-size:12px;color:#888"> — ${si.desc}</span>
      </div>
    </div>

    ${trackingHtml}
    ${noteHtml}

    <div class="p-detail-section">
      <div class="p-detail-title">Order Details</div>
      <div class="p-detail-row"><span class="p-detail-key">Product</span><span class="p-detail-val">${o.product || '—'}</span></div>
      <div class="p-detail-row"><span class="p-detail-key">Color</span><span class="p-detail-val">${colorHtml}</span></div>
      <div class="p-detail-row"><span class="p-detail-key">Decoration</span><span class="p-detail-val">${o.decorationType || '—'}</span></div>
      <div class="p-detail-row"><span class="p-detail-key">Location</span><span class="p-detail-val">${o.decorationLocation || '—'}</span></div>
      ${o.artworkName ? `<div class="p-detail-row"><span class="p-detail-key">Artwork</span><span class="p-detail-val">${o.artworkName}</span></div>` : ''}
      <div class="p-detail-row">
        <span class="p-detail-key">Quantities</span>
        <span class="p-detail-val"><div class="p-qty-chips">${qtyChips || o.totalQty + ' pcs'}</div></span>
      </div>
      <div class="p-detail-row"><span class="p-detail-key">Total Qty</span><span class="p-detail-val">${o.totalQty || '—'} pcs</span></div>
    </div>

    <div class="p-detail-section">
      <div class="p-detail-title">Pricing</div>
      <div class="p-detail-row"><span class="p-detail-key">Price / Piece</span><span class="p-detail-val">${ppp}</span></div>
      <div class="p-detail-row"><span class="p-detail-key">Order Total</span><span class="p-detail-val" style="color:#00c896;font-size:16px">${total}</span></div>
      <div class="p-detail-row"><span class="p-detail-key">Order Date</span><span class="p-detail-val">${formatDate(o.createdAt)}</span></div>
    </div>

    ${o.notes ? `<div class="p-detail-section">
      <div class="p-detail-title">Your Notes</div>
      <p style="font-size:13px;color:#aaa;line-height:1.6">${o.notes}</p>
    </div>` : ''}

    <div style="padding:20px 0;border-top:1px solid #1a1a1a;margin-top:8px;text-align:center">
      <p style="font-size:12px;color:#555;line-height:1.6">Questions? Reach out to us at<br><a href="mailto:info@insigniaprint.com" style="color:var(--accent);text-decoration:none">info@insigniaprint.com</a></p>
    </div>
  `;

  document.getElementById('p-drawer-overlay').classList.add('open');
}

function closeDrawer() {
  document.getElementById('p-drawer-overlay').classList.remove('open');
}

// ============================================
// BOOT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  // Check portal session OR account session
  const portalSaved = sessionStorage.getItem('portal_email');
  const acctSaved   = sessionStorage.getItem('insignia_user');
  const savedEmail  = portalSaved || acctSaved;

  if (savedEmail) {
    const orders = getOrdersByEmail(savedEmail);
    if (orders.length) {
      portalEmail = savedEmail;
      portalOrders = orders;
      sessionStorage.setItem('portal_email', savedEmail);
      document.getElementById('portal-login').style.display = 'none';
      document.getElementById('portal-app').style.display = 'block';
      document.getElementById('ph-email-label').textContent = savedEmail;
      renderOrders();
    } else {
      // Pre-fill email from account even if no orders yet
      const emailInput = document.getElementById('portal-email');
      if (emailInput) emailInput.value = savedEmail;
    }
  }

  document.getElementById('portal-email')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') portalLogin();
  });
});
