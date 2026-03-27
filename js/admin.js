/* ============================================
   INSIGNIA ADMIN — Dashboard Logic
   ============================================ */

const ADMIN_PASSWORD = 'insignia2025';

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
// AUTH
// ============================================
function doLogin() {
  const pw = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  if (pw === ADMIN_PASSWORD) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-app').style.display = 'grid';
    sessionStorage.setItem('insignia_admin', '1');
    initAdmin();
  } else {
    errEl.classList.add('visible');
    document.getElementById('login-password').value = '';
    document.getElementById('login-password').focus();
  }
}

function doLogout() {
  sessionStorage.removeItem('insignia_admin');
  location.reload();
}

// ============================================
// INIT
// ============================================
function initAdmin() {
  adminProducts = getProducts();
  pricingMetrics = getPricingMetrics();
  renderProductsTable();
  renderOrdersList();
  initPricing();
  initSidebarNav();
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
    });
  });
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
    btn.addEventListener('click', () => btn.classList.toggle('active'));
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
    wrap.innerHTML = '<p class="a-hint" style="padding:4px 0">Select decoration methods above to enter pricing.</p>';
    return;
  }

  selectedDeco.forEach(decoId => {
    const dt = getDecoType(decoId);
    if (!dt) return;
    const saved = existingBreaks[decoId] || {};

    const section = document.createElement('div');
    section.className = 'price-break-section';
    section.innerHTML = `
      <div class="price-break-header">
        <span class="price-break-name">${dt.label}</span>
        <span class="price-break-min">Min. ${dt.minQty} pcs</span>
      </div>
      <div class="price-break-grid">
        ${PRICE_BREAK_TIERS.map(qty => `
          <div class="price-break-cell">
            <label class="price-break-qty">${qty} pcs</label>
            <div class="price-break-input-wrap">
              <span class="price-break-dollar">$</span>
              <input
                type="number"
                class="a-input price-break-input"
                data-deco="${decoId}"
                data-qty="${qty}"
                value="${saved[qty] || ''}"
                placeholder="—"
                step="0.01"
                min="0"
                ${qty < dt.minQty ? 'disabled title="Below minimum for this method"' : ''}
              >
            </div>
          </div>`).join('')}
      </div>`;
    wrap.appendChild(section);
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

  const storedMockup = document.getElementById('cep-mockup-data').value;
  const color = { name, hex, mockup: storedMockup || null };

  if (colorEntryCallback) colorEntryCallback(color);
  closeColorEntryForm();
}

function handleMockupUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    toast('Image too large. Please use an image under 2MB.', 'error');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    const data = e.target.result;
    document.getElementById('cep-mockup-data').value = data;
    document.getElementById('cep-mockup-img').src = data;
    document.getElementById('cep-mockup-name').textContent = file.name;
    document.getElementById('cep-mockup-preview').style.display = 'flex';
  };
  reader.readAsDataURL(file);
}

function removeMockupFromEntry() {
  document.getElementById('cep-mockup-data').value = '';
  document.getElementById('cep-mockup-input').value = '';
  document.getElementById('cep-mockup-preview').style.display = 'none';
}

// ============================================
// SAVE PRODUCT
// ============================================
function saveProduct(e) {
  e.preventDefault();

  const sizes = [...document.querySelectorAll('#f-sizes-grid input:checked')].map(i => i.value);
  const deco = getCheckedDeco();
  const locations = [...document.querySelectorAll('.location-toggle.active')].map(b => b.textContent);
  const priceBreaks = collectPriceBreaks();
  const name = document.getElementById('f-name').value.trim();
  const id = editingProductId || slugify(name);

  const updated = {
    id,
    name,
    brand:        document.getElementById('f-brand').value.trim(),
    styleNumber:  document.getElementById('f-style-number').value.trim(),
    category: document.getElementById('f-category').value,
    description: document.getElementById('f-desc').value.trim(),
    icon: document.getElementById('f-icon').value,
    blankCost: parseFloat(document.getElementById('f-blank-cost').value) || 0,
    popular: document.getElementById('f-popular').checked,
    visible: document.getElementById('f-visible').checked,
    sizes,
    decoration: deco,
    locations,
    colors: productColors,
    priceBreaks,
  };

  if (editingProductId) {
    const idx = adminProducts.findIndex(p => p.id === editingProductId);
    if (idx > -1) adminProducts[idx] = updated;
  } else {
    adminProducts.push(updated);
  }

  saveProducts(adminProducts);
  renderProductsTable();
  closeProductModal();
  toast(editingProductId ? 'Product updated' : 'Product added', 'success');
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
let ordersViewMode = 'list';

function toggleOrdersView(mode) {
  ordersViewMode = mode;
  document.getElementById('orders-list').style.display = mode === 'list' ? 'block' : 'none';
  document.getElementById('kanban-board').style.display = mode === 'kanban' ? 'flex' : 'none';
  const filterWrap = document.getElementById('orders-filter-wrap');
  if (filterWrap) filterWrap.style.display = mode === 'kanban' ? 'none' : '';
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
      <div class="order-product">${o.product || '—'}</div>
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
        <div class="od-field"><span class="od-label">Product</span><span>${o.product || '—'}</span></div>
        <div class="od-field"><span class="od-label">Color</span><span>${o.color ? `<span class="color-dot" style="background:${o.colorHex || '#888'}"></span>${o.color}` : '—'}</span></div>
        <div class="od-field"><span class="od-label">Decoration</span><span>${o.decorationType || '—'}</span></div>
        <div class="od-field"><span class="od-label">Location</span><span>${o.decorationLocation || '—'}</span></div>
        <div class="od-field"><span class="od-label">Artwork</span><span>${o.artworkName || '—'}</span></div>
        <div class="od-field"><span class="od-label">Quantities</span><span class="qty-pills">${qtyRows || '—'}</span></div>
        <div class="od-field"><span class="od-label">Total Qty</span><span>${o.totalQty || 0} pcs</span></div>
        <div class="od-field"><span class="od-label">Price/Piece</span><span>${ppp}</span></div>
        <div class="od-field"><span class="od-label">Total</span><span style="font-weight:700;color:#00c896">${total}</span></div>
        <div class="od-field"><span class="od-label">Created</span><span>${formatDate(o.createdAt)}</span></div>
      </div>
    </div>

    ${o.declineReason ? `
    <div class="od-decline-banner">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <div>
        <div class="od-decline-title">Customer Declined — Changes Requested</div>
        <div class="od-decline-reason">${o.declineReason}</div>
      </div>
    </div>` : ''}
    ${o.notes ? `<div class="od-notes-block"><div class="od-section-title">Customer Notes</div><p>${o.notes}</p></div>` : ''}

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
          <input class="a-input" type="date" id="od-inhand-date" value="${o.inHandDate || ''}" style="max-width:180px">
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
          <button class="a-btn a-btn-ghost" onclick="closeOrderModal()">Cancel</button>
          <button class="a-btn a-btn-primary" onclick="saveOrderChanges('${o.id}')">Save Changes</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('order-modal-overlay').classList.add('open');
}

function previewVisToggle() {
  const cb = document.getElementById('od-visible');
  document.getElementById('od-vis-text').textContent = cb.checked ? 'Visible in portal' : 'Hidden from portal';
}

function saveOrderChanges(id) {
  const status = document.getElementById('od-status-select').value;
  const tracking = document.getElementById('od-tracking').value.trim();
  const customerNote = document.getElementById('od-customer-note').value.trim();
  const statusNotes = document.getElementById('od-status-notes').value.trim();
  const visible = document.getElementById('od-visible').checked;

  const inHandDate    = document.getElementById('od-inhand-date')?.value || null;
  const isHardDeadline = document.getElementById('od-is-hard-deadline')?.checked || false;
  const customerSuppliedBlanks = document.getElementById('od-customer-supplied')?.checked || false;

  updateOrder(id, { status, trackingNumber: tracking, customerNote, statusNotes, visibleToCustomer: visible,
    customerSuppliedBlanks, inHandDate, isHardDeadline,
    approvedAt: status === 'approved' ? (getOrders().find(o=>o.id===id)?.approvedAt || new Date().toISOString()) : undefined,
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
  closeOrderModal();
  ordersData = getOrders();
  if (ordersViewMode === 'kanban') renderKanbanBoard();
  else filterOrders();
  toast('Order updated');
}

function closeOrderModal() {
  document.getElementById('order-modal-overlay').classList.remove('open');
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

function openAddOrderModal() {
  document.getElementById('add-order-form').reset();
  document.getElementById('add-order-modal-overlay').classList.add('open');
}

function closeAddOrderModal() {
  document.getElementById('add-order-modal-overlay').classList.remove('open');
}

function saveManualOrder(e) {
  e.preventDefault();
  const name = document.getElementById('ao-name').value.trim();
  const email = document.getElementById('ao-email').value.trim().toLowerCase();
  const phone = document.getElementById('ao-phone').value.trim();
  const company = document.getElementById('ao-company').value.trim();
  const product = document.getElementById('ao-product').value.trim();
  const color = document.getElementById('ao-color').value.trim();
  const qty = parseInt(document.getElementById('ao-qty').value) || 0;
  const deco = document.getElementById('ao-deco').value;
  const price = parseFloat(document.getElementById('ao-price').value) || null;
  const status = document.getElementById('ao-status').value;
  const notes = document.getElementById('ao-notes').value.trim();
  const customerSuppliedBlanks = document.getElementById('ao-customer-supplied')?.checked || false;

  const ref = 'INS-' + Date.now().toString().slice(-6);
  const order = {
    id: ref,
    customerEmail: email,
    customerName: name,
    customerPhone: phone,
    customerCompany: company,
    product,
    color,
    quantities: { 'N/A': qty },
    totalQty: qty,
    decorationType: deco,
    notes,
    statusNotes: '',
    customerNote: '',
    trackingNumber: '',
    source: 'web-submission',
    customerSuppliedBlanks,
    status,
    visibleToCustomer: true,
    pricePerPiece: price,
    totalPrice: price ? price * qty : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const orders = getOrders();
  orders.unshift(order);
  saveOrders(orders);
  ordersData = getOrders();
  closeAddOrderModal();
  if (ordersViewMode === 'kanban') renderKanbanBoard();
  else filterOrders();
  toast('Order created — ' + ref, 'success');
}

// ============================================
// KANBAN BOARD
// ============================================
let kbDraggingId = null;

function renderKanbanBoard() {
  const board = document.getElementById('kanban-board');
  if (!board) return;
  ordersData = getOrders().filter(o => !o.archived);

  // Build groups: each entry is either a single order or a group of orders
  // A group occupies the column of its "earliest" (worst) status
  const groupMap = {};
  ordersData.forEach(o => {
    if (o.groupId) {
      if (!groupMap[o.groupId]) groupMap[o.groupId] = [];
      groupMap[o.groupId].push(o);
    }
  });

  // Returns the kb items (single or group) that belong in a given status column
  function getKbItemsForColumn(sid) {
    const singles = ordersData.filter(o => !o.groupId && o.status === sid);
    const groups = [];
    const seen = new Set();
    ordersData.forEach(o => {
      if (o.groupId && !seen.has(o.groupId)) {
        const gOrders = groupMap[o.groupId];
        const gStatus = getGroupDisplayStatus(gOrders);
        if (gStatus === sid) {
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

  board.innerHTML = STATUS_TIMELINE.map(sid => {
    const si = getStatusInfo(sid);
    const items = getKbItemsForColumn(sid);
    const cards = items.map(item => {
      if (item.type === 'single') return buildKbCard(item.order, si);
      return buildKbGroupCard(item.groupId, item.orders, si);
    }).join('');
    return `
      <div class="kb-column">
        <div class="kb-col-header" style="border-top:3px solid ${si.color}">
          <span class="kb-col-title">${si.label}</span>
          <span class="kb-col-count" style="background:${si.color}22;color:${si.color}">${items.length}</span>
        </div>
        <div class="kb-col-body" data-status="${sid}"
          ondragover="kbDragOver(event)"
          ondrop="kbDrop(event)"
          ondragleave="kbDragLeave(event)">
          ${cards}
          ${!items.length ? '<div class="kb-empty-col">Drop here</div>' : ''}
        </div>
      </div>`;
  }).join('');
}

function buildKbCard(o, si) {
  const total = o.totalPrice ? `$${parseFloat(o.totalPrice).toFixed(2)}` : '';
  const sourceTag = o.source === 'web-submission'
    ? `<span class="kb-tag kb-tag-lead">Lead</span>`
    : `<span class="kb-tag kb-tag-online">Online</span>`;
  return `
    <div class="kb-card" draggable="true" data-id="${o.id}"
      style="border-left-color:${si.color}"
      ondragstart="kbDragStart(event)"
      ondragend="kbDragEnd(event)"
      onclick="openOrderModal('${o.id}')">
      <div class="kb-card-top">
        <span class="kb-card-id">${o.id}</span>
        ${sourceTag}
      </div>
      <div class="kb-card-customer">${o.customerName || o.customerEmail || '—'}</div>
      ${o.product ? `<div class="kb-card-product">${o.product}${o.totalQty ? ` · ${o.totalQty} pcs` : ''}</div>` : ''}
      ${total ? `<div class="kb-card-total">${total}</div>` : ''}
      <div class="kb-card-date">${formatDate(o.createdAt)}</div>
    </div>`;
}

function buildKbGroupCard(groupId, orders, si) {
  const totalQty = orders.reduce((s, o) => s + (o.totalQty || 0), 0);
  const totalPrice = orders.reduce((s, o) => s + (parseFloat(o.totalPrice) || 0), 0);
  const customer = orders[0].customerName || orders[0].customerEmail || '—';
  const productList = orders.map(o => `<div class="kb-group-product">↳ ${o.product || '—'}${o.totalQty ? ` · ${o.totalQty} pcs` : ''}</div>`).join('');
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
      <div class="kb-card-customer">${customer}</div>
      ${productList}
      ${totalPrice > 0 ? `<div class="kb-card-total">$${totalPrice.toFixed(2)}</div>` : ''}
      <div class="kb-card-date">${totalQty} pcs total · ${formatDate(orders[0].createdAt)}</div>
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

function kbDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const newStatus = e.currentTarget.dataset.status;
  if (!newStatus) return;

  if (kbDraggingGroup) {
    // Move all orders in the group to the new status
    const groupOrders = getOrders().filter(o => o.groupId === kbDraggingGroup);
    groupOrders.forEach(o => updateOrder(o.id, { status: newStatus }));
    ordersData = getOrders();
    kbDraggingGroup = null;
    renderKanbanBoard();
    const si = getStatusInfo(newStatus);
    toast(`Group moved to ${si.label}`, 'success');
  } else if (kbDraggingId) {
    updateOrder(kbDraggingId, { status: newStatus });
    kbDraggingId = null;
    renderKanbanBoard();
    const si = getStatusInfo(newStatus);
    toast(`Moved to ${si.label}`, 'success');
  }
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

  const sortJobs = list => list.sort((a, b) => {
    if (a.isHardDeadline && b.isHardDeadline) return new Date(a.inHandDate) - new Date(b.inHandDate);
    if (a.isHardDeadline) return -1;
    if (b.isHardDeadline) return 1;
    if (a.approvedAt && b.approvedAt) return new Date(a.approvedAt) - new Date(b.approvedAt);
    if (a.approvedAt) return -1;
    if (b.approvedAt) return 1;
    return 0;
  });

  const activeJobs = sortJobs(jobs.filter(j => getMasterStatus(j) !== 'done'));
  const doneJobs   = sortJobs(jobs.filter(j => getMasterStatus(j) === 'done'));

  const headerCells = `
    <th class="pj-th pj-sticky pj-th-job">Job</th>
    <th class="pj-th pj-th-date">Approved</th>
    <th class="pj-th pj-th-date">Due Date</th>
    <th class="pj-th pj-th-qty">Qty</th>
    ${PROD_COLUMNS.map(col => `<th class="pj-th pj-th-col">${col.label}</th>`).join('')}
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
    html += makeTable(activeJobs.map(j => buildProdRow(j)).join(''));
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
    const dueColor = urgency === 'red' ? '#ef4444' : urgency === 'yellow' ? '#eab308' : '#555';
    dueCellContent = `
      <div style="font-size:11px;font-weight:600;color:#666">Standard</div>
      <div style="font-size:10px;color:${dueColor};margin-top:2px">${w.label}</div>
      ${urgency ? `<div style="font-size:10px;color:${dueColor};margin-top:2px">${daysLeft < 0 ? Math.abs(daysLeft)+'d over' : daysLeft+'d left'}</div>` : ''}`;
  } else {
    dueCellContent = `<span style="font-size:11px;color:#444">Standard</span>`;
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

  if (sessionStorage.getItem('insignia_admin') === '1') {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-app').style.display = 'grid';
    initAdmin();
  }

  const overlay = document.getElementById('product-modal-overlay');
  if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeProductModal(); });

  const cOverlay = document.getElementById('confirm-overlay');
  if (cOverlay) cOverlay.addEventListener('click', e => { if (e.target === cOverlay) closeConfirm(); });

  const orderOverlay = document.getElementById('order-modal-overlay');
  if (orderOverlay) orderOverlay.addEventListener('click', e => { if (e.target === orderOverlay) closeOrderModal(); });

  const addOrderOverlay = document.getElementById('add-order-modal-overlay');
  if (addOrderOverlay) addOrderOverlay.addEventListener('click', e => { if (e.target === addOrderOverlay) closeAddOrderModal(); });
});
