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
  const password = document.getElementById('portal-password') ? document.getElementById('portal-password').value : '';
  const errEl = document.getElementById('portal-error');

  if (!email) {
    errEl.classList.add('visible');
    errEl.textContent = 'Please enter your email address.';
    return;
  }

  // If an account exists for this email, require password
  const acct = typeof getAccountByEmail === 'function' ? getAccountByEmail(email) : null;
  if (acct) {
    if (!password) {
      errEl.classList.add('visible');
      errEl.textContent = 'Please enter your password.';
      document.getElementById('portal-password-wrap').style.display = 'block';
      return;
    }
    const result = loginAccount(email, password);
    if (!result.ok) {
      errEl.classList.add('visible');
      errEl.textContent = result.error;
      return;
    }
  }

  // Allow access if they have orders OR a valid account
  const orders = getOrdersByEmail(email);
  if (!orders.length && !acct) {
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
  const nameEl = document.getElementById('ph-email-label');
  if (nameEl) nameEl.textContent = acct ? (acct.firstName + (acct.lastName ? ' ' + acct.lastName : '')) : email;

  renderOrders();
  renderCatalog();
  renderPortalUserInfo(acct);
}

function portalLogout() {
  sessionStorage.removeItem('portal_email');
  sessionStorage.removeItem('insignia_user');
  logoutAccount();
  portalEmail = '';
  portalOrders = [];
  document.getElementById('portal-app').style.display = 'none';
  document.getElementById('portal-login').style.display = 'flex';
  document.getElementById('portal-email').value = '';
}

// ============================================
// RENDER ORDERS
// ============================================
function renderPortalUserInfo(acct) {
  // Add account info and change-password link to header if logged in with account
  const userEl = document.getElementById('ph-user');
  if (!userEl || !acct) return;
  const existing = document.getElementById('ph-change-pw-btn');
  if (!existing) {
    const btn = document.createElement('button');
    btn.id = 'ph-change-pw-btn';
    btn.className = 'p-btn p-btn-ghost p-btn-sm';
    btn.textContent = 'Change Password';
    btn.style.marginRight = '8px';
    btn.onclick = () => showChangePasswordModal();
    userEl.insertBefore(btn, userEl.querySelector('button'));
  }
}

function showChangePasswordModal() {
  let modal = document.getElementById('portal-pw-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'portal-pw-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center';
    modal.innerHTML = `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:28px;width:100%;max-width:400px;margin:16px">
      <h3 style="margin:0 0 18px;font-size:17px">Change Password</h3>
      <div id="portal-pw-error" style="color:#ef4444;font-size:13px;margin-bottom:10px;display:none"></div>
      <input type="password" id="portal-pw-new" class="p-input" placeholder="New password (min 6 chars)" style="margin-bottom:10px">
      <input type="password" id="portal-pw-confirm" class="p-input" placeholder="Confirm new password" style="margin-bottom:16px">
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="p-btn p-btn-ghost" onclick="document.getElementById('portal-pw-modal').remove()">Cancel</button>
        <button class="p-btn p-btn-primary" onclick="submitPasswordChange()">Update Password</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
  document.getElementById('portal-pw-new').focus();
}

function submitPasswordChange() {
  const newPw  = document.getElementById('portal-pw-new').value;
  const conf   = document.getElementById('portal-pw-confirm').value;
  const errEl  = document.getElementById('portal-pw-error');
  errEl.style.display = 'none';
  if (newPw.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.style.display = 'block'; return; }
  if (newPw !== conf)   { errEl.textContent = 'Passwords do not match.'; errEl.style.display = 'block'; return; }
  const result = updateAccountPassword(portalEmail, newPw);
  if (!result.ok) { errEl.textContent = result.error; errEl.style.display = 'block'; return; }
  document.getElementById('portal-pw-modal').remove();
  alert('Password updated successfully!');
}

function renderCatalog() {
  const section = document.getElementById('portal-catalog-section');
  const grid    = document.getElementById('portal-catalog-grid');
  if (!section || !grid) return;
  if (typeof getCatalogByEmail !== 'function') return;

  const cat = getCatalogByEmail(portalEmail);
  if (!cat || !cat.items || !cat.items.length) { section.style.display = 'none'; return; }

  section.style.display = 'block';
  grid.innerHTML = cat.items.map(item => {
    const price = item.customPrice != null
      ? `<div class="pc-price">$${parseFloat(item.customPrice).toFixed(2)}<span class="pc-price-unit">/pc</span></div>`
      : '';
    const img = item.mockup
      ? `<img src="${item.mockup}" alt="${item.productName}" class="pc-card-img">`
      : `<div class="pc-card-img pc-card-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.86H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.86l.58-3.57a2 2 0 00-1.34-2.23z"/></svg></div>`;
    return `<div class="pc-card">
      ${img}
      <div class="pc-card-body">
        <div class="pc-card-name">${item.productName}</div>
        ${item.colorName ? `<div class="pc-card-color"><span class="pc-color-dot" style="background:${item.colorHex||'#888'}"></span>${item.colorName}</div>` : ''}
        ${price}
        ${item.notes ? `<div class="pc-card-notes">${item.notes}</div>` : ''}
      </div>
      <button class="p-btn p-btn-primary pc-reorder-btn" onclick="openReorderModal('${item.productName.replace(/'/g,"\\'")}','${(item.colorName||'').replace(/'/g,"\\'")}')">Reorder</button>
    </div>`;
  }).join('');
}

function openReorderModal(productName, colorName) {
  const item = colorName ? `${productName} — ${colorName}` : productName;
  let modal = document.getElementById('portal-reorder-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'portal-reorder-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:28px;width:100%;max-width:400px">
    <h3 style="margin:0 0 8px;font-size:17px">Reorder Request</h3>
    <p style="font-size:13px;color:#888;margin:0 0 16px;line-height:1.6">Ready to reorder <strong style="color:#fff">${item}</strong>? Reach out and we'll get it going.</p>
    <div style="background:#111;border:1px solid #222;border-radius:10px;padding:14px 16px;margin-bottom:20px">
      <div style="font-size:12px;color:#555;margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">Contact Us</div>
      <a href="mailto:blake@insigniascreenprinting.com" style="display:block;font-size:14px;color:var(--accent);text-decoration:none;margin-bottom:4px">blake@insigniascreenprinting.com</a>
      <a href="tel:+1" style="display:block;font-size:13px;color:#888;text-decoration:none">Call or text to get started</a>
    </div>
    <button class="p-btn p-btn-primary" style="width:100%" onclick="document.getElementById('portal-reorder-modal').remove()">Done</button>
  </div>`;
  modal.style.display = 'flex';
}

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
  function bootPortal() {
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
        renderCatalog();
      } else {
        // Pre-fill email from account even if no orders yet
        const emailInput = document.getElementById('portal-email');
        if (emailInput) emailInput.value = savedEmail;
      }
    }

    document.getElementById('portal-email')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') portalLogin();
    });
  }

  if (typeof initCloudSync === 'function') {
    initCloudSync(() => bootPortal());
  } else {
    bootPortal();
  }
});
