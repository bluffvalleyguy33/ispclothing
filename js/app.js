/* ============================================
   INSIGNIA SCREEN PRINTING — App Logic
   ============================================ */

let PRODUCTS;
let COLORS;

const DECO_DESCRIPTIONS = {
  'screen-printing':       'Bold, vibrant ink pressed directly into fabric. Best for solid colors.',
  'digital-print':         'Full color printing. Great for detailed designs and gradients.',
  'embroidery':            'Premium stitched logo. Professional, durable, and long lasting.',
  'embroidery-patch':      'Embroidered patch sewn or ironed on. Versatile and removable.',
  'woven-patch':           'Tightly woven patch with fine detail. Clean, professional finish.',
  'printed-patch':         'Full color printed patch. Great for complex artwork.',
  'leather-patch':         'Genuine leather patch with debossed or laser engraved logo.',
  'printed-leather-patch': 'Full color printed faux leather patch. Premium textured look.',
};

// ---- Wizard State ----
const wizard = {
  product: null,
  color: null,
  quantities: {},
  // Multi-decoration: array of {type, typeLabel, minQty, locations[]}
  decorations: [],
  // Builder state (in-progress, not yet confirmed)
  _buildType: null,
  _buildLocations: [],
  artworks: {},               // keyed by location name: { fileName, needsHelp, preview }
  contact: {},
  currentStep: 1,
  totalSteps: 6,
};

// ---- Decoration Helpers ----

// Locations in the same group are mutually exclusive across the whole garment
const LOCATION_GROUPS = [
  ['Left Chest', 'Big Front'],
  ['Big Back', 'Upper Back', 'Lower Back'],
];

function getAllSelectedLocations() {
  return wizard.decorations.flatMap(d => d.locations);
}

// Returns a Set of all locations that are blocked — either directly used or
// zone-blocked because another location in the same group is already used.
function getBlockedLocations() {
  const confirmed = getAllSelectedLocations();
  const blocked   = new Set(confirmed);
  for (const group of LOCATION_GROUPS) {
    if (group.some(l => confirmed.includes(l))) {
      group.forEach(l => blocked.add(l));
    }
  }
  return blocked;
}

function getEffectiveMinQty() {
  if (!wizard.decorations.length) return getMinQtyForProduct(wizard.product);
  return Math.max(...wizard.decorations.map(d => d.minQty || 0));
}

// ---- SVG Icons ----
const ICONS = {
  tshirt: `<svg viewBox="0 0 80 80" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M52 8L60 8 76 24 62 30 62 72 18 72 18 30 4 24 20 8 28 8C28 18 36 24 40 24C44 24 52 18 52 8Z"/></svg>`,
  hoodie: `<svg viewBox="0 0 80 80" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M28 8C28 8 24 22 20 26L4 26 4 38 18 34 18 72 62 72 62 34 76 38 76 26 60 26C56 22 52 8 52 8C48 14 44 18 40 20C36 18 32 14 28 8ZM32 10C34 16 38 20 40 20C42 20 46 16 48 10"/></svg>`,
  hat:    `<svg viewBox="0 0 80 50" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><ellipse cx="40" cy="44" rx="38" ry="6"/><path d="M14 44 Q8 22 40 10 Q72 22 66 44Z"/></svg>`,
  polo:   `<svg viewBox="0 0 80 80" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M52 8L60 8 76 24 62 30 62 72 18 72 18 30 4 24 20 8 28 8C28 8 32 20 40 20 48 20 52 8 52 8Z"/><rect x="36" y="8" width="8" height="16" rx="2"/></svg>`,
  check:  `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
  upload: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  close:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  arrow:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`,
};

// ============================================
// PRODUCTS
// ============================================
function renderProducts(containerId = 'products-grid') {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = '';

  PRODUCTS.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.category = p.category;
    card.dataset.id = p.id;

    const colors = p.colors || [];
    const firstMockup = colors.find(c => c.mockup)?.mockup;
    const startPrice = getStartingPrice(p);
    const shownColors = colors.slice(0, 7);
    const extraCount = colors.length - shownColors.length;
    const colorDots = shownColors.map(c =>
      `<span class="color-dot" style="background:${c.hex}" title="${c.name}"></span>`
    ).join('') + (extraCount > 0 ? `<span class="color-more">+${extraCount}</span>` : '');
    const minQty = getMinQtyForProduct(p);

    card.innerHTML = `
      <div class="product-image" id="card-img-${p.id}">
        ${firstMockup
          ? `<img src="${firstMockup}" alt="${p.name}" style="width:100%;height:100%;object-fit:contain;padding:16px">`
          : `<span class="product-icon" style="color:#fff">${ICONS[p.icon] || ICONS.tshirt}</span>`}
        ${p.popular ? '<span class="product-badge">Popular</span>' : ''}
      </div>
      <div class="product-body">
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${p.description}</div>
        <div class="product-colors">${colorDots || '<span style="font-size:11px;color:#666">Colors TBD</span>'}</div>
        <div class="product-footer">
          <div class="product-price">
            ${startPrice
              ? `<strong>$${startPrice.toFixed(2)}</strong><br><span>starting ea / ${minQty} min</span>`
              : `<span style="color:#666">Contact for pricing</span>`}
          </div>
          <button class="btn btn-primary btn-sm" onclick="openWizard('${p.id}'); event.stopPropagation();">
            Order Now
          </button>
        </div>
      </div>
    `;
    card.addEventListener('click', () => openWizard(p.id));
    grid.appendChild(card);
  });
}

// ---- Filter Tabs ----
function initFilters() {
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const cat = tab.dataset.category;
      document.querySelectorAll('.product-card').forEach(card => {
        card.classList.toggle('hidden', cat !== 'all' && card.dataset.category !== cat);
      });
    });
  });
}

// ============================================
// WIZARD
// ============================================
function openWizard(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  wizard.product = product;
  wizard.color = null;
  wizard.quantities = {};
  wizard.decorations = [];
  wizard._buildType = null;
  wizard._buildLocations = [];
  wizard.artworks = {};
  wizard.contact = {};
  wizard.currentStep = 1;

  buildWizard();

  const overlay = document.getElementById('order-overlay');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeWizard() {
  // If they got past step 1 but didn't place an order, record the abandon
  if (wizard.product && wizard.currentStep > 1) _saveAbandon();
  document.getElementById('order-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function buildWizard() {
  const modal = document.getElementById('wizard-modal');
  if (!modal) return;
  const p = wizard.product;

  modal.innerHTML = `
    <div class="modal-header">
      <span class="modal-title">Configure Your Order</span>
      <button class="modal-close" onclick="closeWizard()">${ICONS.close}</button>
    </div>
    <div class="wizard-progress" id="wizard-progress"></div>
    <div class="wizard-body">
      <div class="wizard-product-summary">
        <div class="wizard-product-thumb" id="wizard-thumb">${ICONS[p.icon] || ICONS.tshirt}</div>
        <div class="wizard-product-info">
          <h4>${p.name}</h4>
          <p id="wizard-product-sub">${getStartingPrice(p) ? 'Starting at $' + getStartingPrice(p).toFixed(2) + ' ea' : 'Contact for pricing'}</p>
        </div>
      </div>
      ${renderStep1()}
      ${renderStep2()}
      ${renderStep3()}
      ${renderStep4()}
      ${renderStep5()}
      ${renderStep6()}
    </div>
    <div class="wizard-footer">
      <div class="wizard-footer-left" id="wizard-step-label">Step 1 of 6</div>
      <div class="wizard-footer-right">
        <button class="btn btn-ghost" id="btn-back" onclick="wizardBack()">Back</button>
        <button class="btn btn-primary" id="btn-next" onclick="wizardNext()">Next Step</button>
      </div>
    </div>
  `;

  updateProgress();
  updateStepVisibility();
  prefillContactFromAccount();
}

// ---- Step Renderers ----
function renderStep1() {
  const p = wizard.product;
  const colors = p.colors || [];
  if (!colors.length) {
    return `<div class="step-content" data-step="1">
      <div class="step-heading">Choose Color</div>
      <p class="step-sub">Colors for this product haven't been set up yet. We'll confirm your color preference after you submit.</p>
    </div>`;
  }
  const colorOptions = colors.map((c, i) =>
    `<div class="color-option" onclick="selectColor('${c.name}', '${c.hex}', '${c.mockup ? i : ''}', this)">
      <div class="color-swatch" style="background:${c.hex}"></div>
      <span>${c.name}</span>
    </div>`
  ).join('');
  return `
    <div class="step-content" data-step="1">
      <div class="step-heading">Choose Color</div>
      <p class="step-sub">Pick the garment color you'd like to order.</p>
      <div class="wizard-mockup-preview" id="wizard-mockup-preview" style="display:none">
        <img id="wizard-mockup-img" src="" alt="Color preview">
      </div>
      <div class="color-grid">${colorOptions}</div>
    </div>`;
}

function renderStep2() {
  const p = wizard.product;
  const availableTypes = ALL_DECORATION_TYPES.filter(d => (p.decoration || []).includes(d.id));
  const decoOptionsHtml = availableTypes.map(d =>
    `<div class="deco-option" data-deco="${d.id}" onclick="selectBuildType('${d.id}', this)">
      <h4>${d.label}</h4>
      <p>${DECO_DESCRIPTIONS[d.id] || ''}</p>
      <span class="deco-min-pill">Min ${d.minQty} pcs</span>
    </div>`
  ).join('') || '<p style="color:#666;font-size:13px">No decoration methods configured for this product.</p>';

  return `
    <div class="step-content" data-step="2">
      <div class="step-heading">Decoration</div>
      <p class="step-sub">Add one or more decoration methods. Each method gets one placement location. Front and back zones are exclusive — picking Left Chest blocks Big Front, and vice versa.</p>

      <!-- Confirmed decoration entries -->
      <div id="deco-entries-list"></div>

      <!-- Builder -->
      <div class="deco-builder" id="deco-builder">
        <div class="deco-builder-label" id="deco-builder-label">Choose a decoration method</div>
        <div class="deco-grid">${decoOptionsHtml}</div>
        <div id="builder-location-section" style="display:none">
          <div class="builder-loc-heading">
            Placement Location
            <span class="builder-loc-hint">Select one location for this decoration</span>
          </div>
          <div class="location-grid" id="builder-location-grid"></div>
        </div>
        <button class="deco-add-entry-btn" id="deco-add-entry-btn" style="display:none" onclick="addDecorationEntry()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add This Decoration
        </button>
      </div>

      <!-- Min qty summary -->
      <div class="deco-min-summary" id="deco-min-summary" style="display:none"></div>
    </div>`;
}

function renderStep3() {
  const p = wizard.product;
  const minQty = getMinQtyForProduct(p);
  const sizeInputs = p.sizes.map(s =>
    `<div class="size-item">
      <div class="size-label">${s}</div>
      <input type="number" class="size-input" data-size="${s}" min="0" placeholder="0" oninput="updateQtyTotal()">
    </div>`
  ).join('');
  return `
    <div class="step-content" data-step="3">
      <div class="step-heading">Sizes & Quantities</div>
      <p class="step-sub" id="sizes-step-sub">Enter how many of each size. Minimum ${minQty} total pieces.</p>
      <div class="size-grid">${sizeInputs}</div>
      <div class="qty-summary">
        <div class="qty-total">Total: <span id="qty-total-num">0</span> pieces</div>
        <div class="qty-warning" id="qty-warning">Minimum ${minQty} pieces required</div>
        <div id="qty-break-nudge" class="qty-break-nudge"></div>
      </div>
    </div>`;
}

function renderStep4() {
  return `
    <div class="step-content" data-step="4">
      <div class="step-heading">Upload Artwork</div>
      <p class="step-sub">Upload artwork for each placement location. Every location requires a file upload <em>or</em> an assistance request.</p>
      <div id="artwork-locations-wrap">
        <p style="color:#555;font-size:13px;text-align:center;padding:20px">Complete Step 2 to configure placement locations.</p>
      </div>
    </div>`;
}

function renderStep5() {
  const user = (typeof getLoggedInUser === 'function') ? getLoggedInUser() : null;
  const accountSection = user
    ? `<div class="wizard-account-note">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        Signed in as <strong>${user.firstName} ${user.lastName}</strong> — info pre-filled below
      </div>`
    : `<div class="wizard-auth-prompt">
        <div class="wizard-auth-prompt-text">
          <strong>Save your info &amp; track orders</strong>
          <span>Sign in or create a free account for easy order tracking.</span>
        </div>
        <div class="wizard-auth-prompt-btns">
          <button type="button" class="btn btn-ghost btn-sm" onclick="openAuthModal('login')">Sign In</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="openAuthModal('register')">Register</button>
        </div>
      </div>`;

  return `
    <div class="step-content" data-step="5">
      <div class="step-heading">Your Info</div>
      ${accountSection}
      <p class="step-sub">We'll use this to send your proof and invoice.</p>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">First Name *</label>
          <input class="form-input" id="c-fname" type="text" placeholder="John" oninput="saveContact()">
        </div>
        <div class="form-group">
          <label class="form-label">Last Name *</label>
          <input class="form-input" id="c-lname" type="text" placeholder="Smith" oninput="saveContact()">
        </div>
        <div class="form-group">
          <label class="form-label">Email Address *</label>
          <input class="form-input" id="c-email" type="email" placeholder="john@company.com" oninput="saveContact()">
        </div>
        <div class="form-group">
          <label class="form-label">Phone Number *</label>
          <input class="form-input" id="c-phone" type="tel" placeholder="(555) 000-0000" oninput="saveContact()">
        </div>
        <div class="form-group full">
          <label class="form-label">Company / Organization</label>
          <input class="form-input" id="c-company" type="text" placeholder="Acme Co. (optional)" oninput="saveContact()">
        </div>
        <div class="form-group full">
          <label class="form-label">Order Notes</label>
          <textarea class="form-textarea" id="c-notes" placeholder="Any special instructions, deadlines, or details..." oninput="saveContact()"></textarea>
        </div>
      </div>

      <div class="inhand-section">
        <div class="form-label" style="margin-bottom:12px">When do you need these by?</div>
        <div class="delivery-opts">
          <label class="delivery-opt active" id="do-standard-lbl" onclick="updateDeliveryOption('standard')">
            <input type="radio" name="delivery-type" value="standard" checked style="display:none">
            <div class="do-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div>
              <div class="do-title">Standard Production</div>
              <div class="do-sub" id="do-std-timeline">Loading timeline…</div>
            </div>
          </label>
          <label class="delivery-opt" id="do-hard-lbl" onclick="updateDeliveryOption('hard')">
            <input type="radio" name="delivery-type" value="hard" style="display:none">
            <div class="do-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div>
              <div class="do-title">I have a specific in-hand date</div>
              <div class="do-sub">Rush options available — we'll confirm feasibility</div>
            </div>
          </label>
        </div>
        <div id="delivery-date-wrap" style="display:none;margin-top:14px">
          <input class="form-input" type="date" id="c-inhand-date" style="max-width:220px" onchange="checkDeadlineWarning()">
          <div class="delivery-warning" id="delivery-warning" style="display:none"></div>
        </div>
      </div>
    </div>`;
}

function renderStep6() {
  return `
    <div class="step-content" data-step="6">
      <div class="step-heading">Review Order</div>
      <p class="step-sub">Everything look good? Add to cart, then place your order when ready.</p>
      <div id="review-content"></div>
      <div class="review-note">
        <strong>What happens next?</strong> After placing your order, we'll review your artwork, prepare a digital proof, and send it within <strong>1–2 business days</strong>. Payment is processed upon proof approval.
      </div>
    </div>`;
}

// ---- Wizard Interactions ----
function selectColor(name, hex, colorIdx, el) {
  document.querySelectorAll('.color-option .color-swatch').forEach(s => s.classList.remove('selected'));
  el.querySelector('.color-swatch').classList.add('selected');
  wizard.color = { name, hex };

  const colors = wizard.product.colors || [];
  const colorObj = colorIdx !== '' ? colors[parseInt(colorIdx)] : null;
  const mockupPreview = document.getElementById('wizard-mockup-preview');
  const mockupImg = document.getElementById('wizard-mockup-img');
  if (mockupPreview && mockupImg) {
    if (colorObj && colorObj.mockup) {
      mockupImg.src = colorObj.mockup;
      mockupPreview.style.display = 'flex';
    } else {
      mockupPreview.style.display = 'none';
    }
  }
  const thumb = document.getElementById('wizard-thumb');
  if (thumb && colorObj && colorObj.mockup) {
    thumb.innerHTML = `<img src="${colorObj.mockup}" alt="${name}" style="width:100%;height:100%;object-fit:contain;border-radius:6px">`;
  }
}

function updateQtyTotal() {
  const inputs = document.querySelectorAll('.size-input');
  let total = 0;
  wizard.quantities = {};
  inputs.forEach(inp => {
    const qty = parseInt(inp.value) || 0;
    if (qty > 0) wizard.quantities[inp.dataset.size] = qty;
    total += qty;
  });
  const totalEl = document.getElementById('qty-total-num');
  const warningEl = document.getElementById('qty-warning');
  if (totalEl) totalEl.textContent = total;
  if (warningEl) warningEl.classList.toggle('hidden', total >= wizard.product.minQty);
  _updateBreakNudge(total);
}

function _updateBreakNudge(total) {
  const el = document.getElementById('qty-break-nudge');
  if (!el) return;
  const tiers = PRICE_BREAK_TIERS;
  const arrowSvg = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>`;
  const checkSvg = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>`;
  const tagSvg   = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`;

  // Pull price breaks for the first selected decoration type
  const selectedDecoType = wizard.decorations && wizard.decorations[0] && wizard.decorations[0].type;
  const decoBreaks = selectedDecoType && wizard.product && wizard.product.priceBreaks
    ? (wizard.product.priceBreaks[selectedDecoType] || null) : null;

  let currentTier = null;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (total >= tiers[i]) { currentTier = tiers[i]; break; }
  }
  const currentIdx = currentTier != null ? tiers.indexOf(currentTier) : -1;
  const nextTier = currentIdx >= 0 && currentIdx < tiers.length - 1 ? tiers[currentIdx + 1] : null;

  if (total === 0) {
    el.className = 'qty-break-nudge qbn-preview';
    el.innerHTML = tagSvg + '<span><strong>Price break tiers:</strong> '
      + tiers.map(function(t) {
          const p = decoBreaks && decoBreaks[t] != null ? decoBreaks[t] : null;
          const priceStr = p != null ? ` — <em>$${parseFloat(p).toFixed(2)}/pc</em>` : '';
          return `<span class="qbn-tier-chip">${t}+ pcs${priceStr}</span>`;
        }).join('')
      + '</span>';
    return;
  }
  if (currentTier === null) {
    const needed = tiers[0] - total;
    const nextPriceStr = decoBreaks && decoBreaks[tiers[0]] != null ? ` ($${parseFloat(decoBreaks[tiers[0]]).toFixed(2)}/pc)` : '';
    el.className = 'qty-break-nudge qbn-below';
    el.innerHTML = `${arrowSvg}<span>Add <strong>${needed} more</strong> to reach the <strong>${tiers[0]}+ price break</strong>${nextPriceStr}</span>`;
    return;
  }
  if (nextTier) {
    const needed = nextTier - total;
    const nextPriceStr = decoBreaks && decoBreaks[nextTier] != null ? ` ($${parseFloat(decoBreaks[nextTier]).toFixed(2)}/pc)` : '';
    el.className = 'qty-break-nudge qbn-next';
    el.innerHTML = `${arrowSvg}<span>At <strong>${currentTier}+ price break</strong> — add <strong>${needed} more</strong> to reach the <strong>${nextTier}+ tier</strong>${nextPriceStr}</span>`;
    return;
  }
  el.className = 'qty-break-nudge qbn-max';
  el.innerHTML = `${checkSvg}<span>You're at the <strong>max price break tier (${tiers[tiers.length - 1]}+)</strong> ✓</span>`;
}

// ---- Decoration Builder ----
function selectBuildType(id, el) {
  // Prevent picking a type when all locations are blocked
  const blocked     = getBlockedLocations();
  const productLocs = wizard.product.locations || [];
  const available   = productLocs.filter(l => !blocked.has(l));
  if (!available.length) {
    showToast('All locations are taken. Remove an existing decoration to free up a location.', 'error');
    return;
  }

  document.querySelectorAll('#deco-builder .deco-option').forEach(d => d.classList.remove('selected'));
  el.classList.add('selected');
  wizard._buildType      = id;
  wizard._buildLocations = [];
  renderBuilderLocations();
  document.getElementById('builder-location-section').style.display = 'block';
  document.getElementById('deco-add-entry-btn').style.display = 'none';

  const dt = ALL_DECORATION_TYPES.find(d => d.id === id);
  const label = document.getElementById('deco-builder-label');
  if (label && dt) label.textContent = `${dt.label} — select one placement location`;
}

function renderBuilderLocations() {
  const grid = document.getElementById('builder-location-grid');
  if (!grid) return;
  const blocked    = getBlockedLocations();   // confirmed + zone-blocked
  const productLocs = wizard.product.locations || [];
  const selected   = wizard._buildLocations[0] || null; // single-select

  grid.innerHTML = productLocs.map(l => {
    const isSelected = selected === l;
    const isBlocked  = blocked.has(l);

    // Find why it's blocked (for tooltip)
    const confirmedLocs = getAllSelectedLocations();
    const directlyUsed  = confirmedLocs.includes(l);
    const zoneBlocked   = !directlyUsed && isBlocked;
    const zoneGroup     = LOCATION_GROUPS.find(g => g.includes(l) && g.some(gl => confirmedLocs.includes(gl)));
    const zoneConflict  = zoneGroup ? zoneGroup.find(gl => confirmedLocs.includes(gl)) : null;
    const takenTitle    = directlyUsed
      ? 'Already assigned to another decoration'
      : zoneConflict
        ? `Zone conflict — ${zoneConflict} is already on this garment`
        : '';

    if (isBlocked) {
      return `<div class="location-option location-taken" title="${takenTitle}">
        ${l}
        <span class="loc-taken-label">${zoneConflict ? 'Zone taken' : 'Taken'}</span>
      </div>`;
    }
    if (isSelected) {
      return `<div class="location-option selected" data-loc="${l}">
        <span class="loc-check-icon"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></span>
        ${l}
        <button class="loc-remove-btn" onclick="event.stopPropagation();removeBuildLocation('${l}')" title="Change">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
    }
    // Unselected + available
    return `<div class="location-option" data-loc="${l}" onclick="addBuildLocation('${l}')">
      ${selected ? '' : '+ '}${l}
    </div>`;
  }).join('');
}

function addBuildLocation(loc) {
  // Single-select: replace any existing selection
  wizard._buildLocations = [loc];
  renderBuilderLocations();
  if (wizard._buildType) {
    document.getElementById('deco-add-entry-btn').style.display = 'flex';
  }
}

function removeBuildLocation(loc) {
  wizard._buildLocations = [];
  renderBuilderLocations();
  document.getElementById('deco-add-entry-btn').style.display = 'none';
}

function addDecorationEntry() {
  if (!wizard._buildType) { showToast('Please select a decoration method', 'error'); return; }
  if (!wizard._buildLocations.length) { showToast('Please select at least one location for this decoration', 'error'); return; }

  const dt = ALL_DECORATION_TYPES.find(d => d.id === wizard._buildType);
  wizard.decorations.push({
    type:      wizard._buildType,
    typeLabel: dt?.label || wizard._buildType,
    minQty:    dt?.minQty || 0,
    locations: [...wizard._buildLocations],
  });

  // Reset builder
  wizard._buildType = null;
  wizard._buildLocations = [];
  document.querySelectorAll('#deco-builder .deco-option').forEach(d => d.classList.remove('selected'));
  document.getElementById('builder-location-section').style.display = 'none';
  document.getElementById('deco-add-entry-btn').style.display = 'none';
  const label = document.getElementById('deco-builder-label');
  if (label) label.textContent = 'Add another decoration method (optional)';

  renderDecoEntriesList();
  updateDecoMinSummary();
}

function removeDecorationEntry(idx) {
  const removed = wizard.decorations.splice(idx, 1)[0];
  // Clear any artworks for the removed entry's locations
  (removed?.locations || []).forEach(loc => { delete wizard.artworks[loc]; });
  renderDecoEntriesList();
  updateDecoMinSummary();
  renderBuilderLocations(); // locations may now be available again
}

function renderDecoEntriesList() {
  const list = document.getElementById('deco-entries-list');
  if (!list) return;
  if (!wizard.decorations.length) { list.innerHTML = ''; return; }

  list.innerHTML = wizard.decorations.map((d, i) => `
    <div class="deco-entry-card">
      <div class="deco-entry-header">
        <div class="deco-entry-title">
          <span class="deco-entry-type">${d.typeLabel}</span>
          <span class="deco-entry-min-badge">Min ${d.minQty} pcs</span>
        </div>
        <button class="deco-entry-remove" onclick="removeDecorationEntry(${i})" title="Remove">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="deco-entry-locs">
        ${d.locations.map(l => `<span class="deco-entry-loc">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 13 8 13s8-7.75 8-13a8 8 0 0 0-8-8z"/></svg>
          ${l}
        </span>`).join('')}
      </div>
    </div>`
  ).join('');
}

function updateDecoMinSummary() {
  const el = document.getElementById('deco-min-summary');
  if (!el) return;
  if (!wizard.decorations.length) { el.style.display = 'none'; return; }

  const minQty = getEffectiveMinQty();
  const highestDeco = wizard.decorations.find(d => d.minQty === minQty);
  el.style.display = 'flex';
  el.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    Minimum order: <strong>${minQty} pieces</strong>
    ${wizard.decorations.length > 1 ? `<span style="color:#555">(set by ${highestDeco?.typeLabel})</span>` : ''}`;
}

function updateSizesMinQty() {
  const minQty = getEffectiveMinQty();
  const decoNames = wizard.decorations.map(d => d.typeLabel).join(' + ');
  const sub  = document.getElementById('sizes-step-sub');
  const warn = document.getElementById('qty-warning');
  if (sub)  sub.textContent  = `Enter how many of each size. Minimum ${minQty} pieces${decoNames ? ` for ${decoNames}` : ''}.`;
  if (warn) warn.textContent = `Minimum ${minQty} pieces required`;
  wizard.quantities = {};
  document.querySelectorAll('.size-input').forEach(inp => inp.value = '');
  const totalEl = document.getElementById('qty-total-num');
  if (totalEl) totalEl.textContent = '0';
}

function saveContact() {
  wizard.contact = {
    fname:   document.getElementById('c-fname')?.value   || '',
    lname:   document.getElementById('c-lname')?.value   || '',
    email:   document.getElementById('c-email')?.value   || '',
    phone:   document.getElementById('c-phone')?.value   || '',
    company: document.getElementById('c-company')?.value || '',
    notes:   document.getElementById('c-notes')?.value   || '',
  };
  const hardRadio = document.getElementById('do-hard-lbl');
  wizard.isHardDeadline = hardRadio?.classList.contains('active') || false;
  wizard.inHandDate = wizard.isHardDeadline
    ? (document.getElementById('c-inhand-date')?.value || null)
    : null;
}

function updateDeliveryOption(type) {
  wizard.isHardDeadline = type === 'hard';
  document.getElementById('do-standard-lbl')?.classList.toggle('active', type === 'standard');
  document.getElementById('do-hard-lbl')?.classList.toggle('active', type === 'hard');
  const wrap = document.getElementById('delivery-date-wrap');
  if (wrap) wrap.style.display = type === 'hard' ? 'block' : 'none';
  if (type !== 'hard') wizard.inHandDate = null;
  updateStandardTimeline();
}

function updateStandardTimeline() {
  const el = document.getElementById('do-std-timeline');
  if (!el) return;
  const decoTypes = (wizard.decorations || []).map(d => d.type);
  if (typeof getJobProductionWindow === 'function' && decoTypes.length) {
    const w = getJobProductionWindow(decoTypes);
    el.textContent = `Est. ${w.label} from approval`;
  } else {
    el.textContent = 'Timeline confirmed after artwork review';
  }
}

function checkDeadlineWarning() {
  const dateInput = document.getElementById('c-inhand-date');
  const warning   = document.getElementById('delivery-warning');
  if (!dateInput || !warning) return;
  wizard.inHandDate = dateInput.value || null;
  if (!dateInput.value) { warning.style.display = 'none'; return; }

  const decoTypes = (wizard.decorations || []).map(d => d.type);
  const w = (typeof getJobProductionWindow === 'function' && decoTypes.length)
    ? getJobProductionWindow(decoTypes)
    : null;
  if (!w) { warning.style.display = 'none'; return; }

  const selected = new Date(dateInput.value + 'T12:00:00');
  const earliest = new Date(Date.now() + w.min * 864e5);

  if (selected < earliest) {
    warning.style.display = 'flex';
    warning.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:1px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span>This date falls within our standard ${w.label} production window. A team member will contact you to confirm if a rush is possible.</span>`;
  } else {
    warning.style.display = 'none';
  }
}

// ---- Artwork per Location ----
function renderArtworkLocations() {
  const wrap = document.getElementById('artwork-locations-wrap');
  if (!wrap) return;

  const allLocs = getAllSelectedLocations();
  if (!allLocs.length) {
    wrap.innerHTML = '<p style="color:#555;font-size:13px;text-align:center;padding:20px">No locations selected. Go back to Step 2 to add decoration methods and locations.</p>';
    return;
  }

  wrap.innerHTML = allLocs.map(loc => {
    const art = wizard.artworks[loc] || {};
    const hasFile    = !!art.fileName;
    const needsHelp  = !!art.needsHelp;
    const locId = loc.replace(/\W+/g, '_');

    const statusBadge = hasFile
      ? `<span class="artwork-status-badge ready">File ready</span>`
      : needsHelp
        ? `<span class="artwork-status-badge help">Assistance requested</span>`
        : `<span class="artwork-status-badge required">Required</span>`;

    const uploadZone = (!hasFile && !needsHelp) ? `
      <div class="artwork-upload-zone" id="auz-${locId}" onclick="document.getElementById('af-${locId}').click()">
        <input type="file" id="af-${locId}" class="artwork-file-input" data-location="${loc}"
               accept=".ai,.eps,.pdf,.png,.jpg,.jpeg,.svg"
               onchange="handleArtworkFile(this, '${loc}')">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <p>Drop file here or click to browse</p>
        <span class="artwork-file-types">AI · EPS · PDF · PNG · SVG</span>
      </div>
      <div class="artwork-divider"><span>or</span></div>
      <button class="artwork-help-btn" onclick="requestArtworkHelp('${loc}')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        I don't have artwork — Need design assistance
      </button>` : '';

    const filePreview = hasFile ? `
      <div class="artwork-file-preview">
        ${art.preview ? `<img src="${art.preview}" alt="preview">` : `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00c896" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`}
        <div class="artwork-file-info">
          <p class="artwork-file-name">${art.fileName}</p>
          <button class="artwork-remove-btn" onclick="removeArtworkFile('${loc}')">Remove &amp; replace</button>
        </div>
      </div>` : '';

    const helpSelected = needsHelp ? `
      <div class="artwork-help-selected">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <div>
          <p>Artwork assistance requested</p>
          <span>We'll help you create or source the perfect design.</span>
        </div>
        <button class="artwork-undo-btn" onclick="undoArtworkHelp('${loc}')">Undo</button>
      </div>` : '';

    return `
      <div class="artwork-panel ${hasFile ? 'has-file' : needsHelp ? 'needs-help' : ''}" data-location="${loc}">
        <div class="artwork-panel-header">
          <div class="artwork-panel-loc">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 13 8 13s8-7.75 8-13a8 8 0 0 0-8-8z"/></svg>
            ${loc}
          </div>
          ${statusBadge}
        </div>
        <div class="artwork-panel-body">
          ${uploadZone}
          ${filePreview}
          ${helpSelected}
        </div>
      </div>`;
  }).join('');

  initArtworkZones();
}

function initArtworkZones() {
  document.querySelectorAll('.artwork-upload-zone').forEach(zone => {
    zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const loc = zone.closest('.artwork-panel')?.dataset.location;
      if (e.dataTransfer.files.length && loc) processArtworkFile(e.dataTransfer.files[0], loc);
    });
  });
}

function handleArtworkFile(input, loc) {
  if (input.files.length) processArtworkFile(input.files[0], loc);
}

function processArtworkFile(file, loc) {
  if (!wizard.artworks[loc]) wizard.artworks[loc] = {};
  wizard.artworks[loc].fileName  = file.name;
  wizard.artworks[loc].needsHelp = false;

  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = e => {
      wizard.artworks[loc].preview = e.target.result;
      renderArtworkLocations();
    };
    reader.readAsDataURL(file);
  } else {
    wizard.artworks[loc].preview = null;
    renderArtworkLocations();
  }
}

function removeArtworkFile(loc) {
  wizard.artworks[loc] = {};
  renderArtworkLocations();
}

function requestArtworkHelp(loc) {
  if (!wizard.artworks[loc]) wizard.artworks[loc] = {};
  wizard.artworks[loc].needsHelp = true;
  wizard.artworks[loc].fileName  = '';
  renderArtworkLocations();
}

function undoArtworkHelp(loc) {
  wizard.artworks[loc] = {};
  renderArtworkLocations();
}

// ---- Review Content ----
function buildReview() {
  const reviewEl = document.getElementById('review-content');
  if (!reviewEl) return;

  const p = wizard.product;
  const qtyBreakdown = Object.entries(wizard.quantities).map(([s, q]) => `${s}: ${q}`).join(', ');
  const totalQty = Object.values(wizard.quantities).reduce((a, b) => a + b, 0);
  // Combined pricing: blank cost counted once + upcharge for each decoration type
  const decoIds = wizard.decorations.map(d => d.type).filter(Boolean);
  const pricePerPiece = (typeof calcCombinedPricePerPiece === 'function' && p.blankCost && decoIds.length)
    ? calcCombinedPricePerPiece(p.blankCost, decoIds, totalQty)
    : null;
  const totalEstimate = pricePerPiece ? pricePerPiece * totalQty : null;

  const pricingHtml = pricePerPiece ? `
    <div class="review-pricing-box">
      <div class="review-pricing-row"><span>Est. Price Per Piece</span><strong>$${pricePerPiece.toFixed(2)}</strong></div>
      <div class="review-pricing-row"><span>Total (${totalQty} pcs)</span><strong class="review-total">$${totalEstimate.toFixed(2)}</strong></div>
      <p class="review-pricing-note">Final pricing confirmed after artwork review.${decoIds.length > 1 ? ` Includes upcharges for all ${decoIds.length} decoration types.` : ''}</p>
    </div>` : '';

  const decoReviewRows = wizard.decorations.map(d =>
    `<div class="review-row">
      <span class="label">${d.typeLabel}</span>
      <span class="value">${d.locations.join(', ')}</span>
    </div>`
  ).join('');

  const artworkRows = getAllSelectedLocations().map(loc => {
    const art = wizard.artworks[loc] || {};
    const val = art.needsHelp ? 'Need design assistance' : (art.fileName || 'Not uploaded');
    return `<div class="review-row"><span class="label">${loc}</span><span class="value">${val}</span></div>`;
  }).join('');

  reviewEl.innerHTML = `
    ${pricingHtml}
    <div class="review-section">
      <h4>Product</h4>
      <div class="review-row"><span class="label">Item</span><span class="value">${p.name}</span></div>
      <div class="review-row"><span class="label">Color</span>
        <span class="value" style="display:flex;align-items:center;gap:8px;justify-content:flex-end;">
          ${wizard.color ? `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${wizard.color.hex};border:1px solid rgba(255,255,255,0.2)"></span>${wizard.color.name}` : '—'}
        </span>
      </div>
      <div class="review-row"><span class="label">Sizes</span><span class="value">${qtyBreakdown || '—'}</span></div>
      <div class="review-row"><span class="label">Total Qty</span><span class="value" style="color:var(--accent)">${totalQty} pieces</span></div>
    </div>
    <div class="review-section">
      <h4>Decoration</h4>
      ${decoReviewRows || '<div class="review-row"><span class="label">Method</span><span class="value">—</span></div>'}
    </div>
    <div class="review-section">
      <h4>Artwork</h4>
      ${artworkRows || '<div class="review-row"><span class="label">Files</span><span class="value">—</span></div>'}
    </div>
    <div class="review-section">
      <h4>Contact</h4>
      <div class="review-row"><span class="label">Name</span><span class="value">${wizard.contact.fname} ${wizard.contact.lname}</span></div>
      <div class="review-row"><span class="label">Email</span><span class="value">${wizard.contact.email}</span></div>
      <div class="review-row"><span class="label">Phone</span><span class="value">${wizard.contact.phone}</span></div>
      ${wizard.contact.company ? `<div class="review-row"><span class="label">Company</span><span class="value">${wizard.contact.company}</span></div>` : ''}
    </div>`;
}

// ---- Wizard Navigation ----
function wizardNext() {
  if (!validateStep(wizard.currentStep)) return;
  if (wizard.currentStep === wizard.totalSteps) {
    addToCartItem();
    return;
  }
  wizard.currentStep++;
  if (wizard.currentStep === 2) _saveAbandon(); // product + color captured
  if (wizard.currentStep === 3) { updateSizesMinQty(); _saveAbandon(); }
  if (wizard.currentStep === 4) { renderArtworkLocations(); _saveAbandon(); }
  if (wizard.currentStep === 5) { prefillContactFromAccount(); updateStandardTimeline(); }
  if (wizard.currentStep === 6) { buildReview(); _saveAbandon(); } // contact captured by validateStep(5)
  updateStepVisibility();
  updateProgress();
  document.querySelector('.modal')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function wizardBack() {
  if (wizard.currentStep === 1) { closeWizard(); return; }
  wizard.currentStep--;
  updateStepVisibility();
  updateProgress();
}

function validateStep(step) {
  const p = wizard.product;
  if (step === 1) {
    if (p.colors && p.colors.length && !wizard.color) { showToast('Please select a garment color', 'error'); return false; }
  }
  if (step === 2) {
    // Auto-save a partially-filled builder before validating
    if (!wizard.decorations.length && wizard._buildType && wizard._buildLocations.length) {
      addDecorationEntry();
    }
    if (!wizard.decorations.length) { showToast('Please add at least one decoration method with a location', 'error'); return false; }
  }
  if (step === 3) {
    const minQty = getEffectiveMinQty();
    const total  = Object.values(wizard.quantities).reduce((a, b) => a + b, 0);
    if (total < minQty) { showToast(`Minimum ${minQty} pieces required`, 'error'); return false; }
  }
  if (step === 4) {
    for (const loc of getAllSelectedLocations()) {
      const art = wizard.artworks[loc] || {};
      if (!art.fileName && !art.needsHelp) {
        showToast(`Please upload artwork or request assistance for: ${loc}`, 'error');
        return false;
      }
    }
  }
  if (step === 5) {
    saveContact();
    if (!wizard.contact.fname || !wizard.contact.lname) { showToast('Please enter your name', 'error'); return false; }
    if (!wizard.contact.email || !wizard.contact.email.includes('@')) { showToast('Please enter a valid email', 'error'); return false; }
    if (!wizard.contact.phone) { showToast('Please enter your phone number', 'error'); return false; }
  }
  return true;
}

function updateStepVisibility() {
  document.querySelectorAll('.step-content').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.step) === wizard.currentStep);
  });
  const labelEl  = document.getElementById('wizard-step-label');
  const btnNext  = document.getElementById('btn-next');
  const btnBack  = document.getElementById('btn-back');
  if (labelEl) labelEl.textContent = `Step ${wizard.currentStep} of ${wizard.totalSteps}`;
  if (btnNext) btnNext.textContent = wizard.currentStep === wizard.totalSteps ? 'Add to Cart' : 'Next Step';
  if (btnBack) btnBack.textContent = wizard.currentStep === 1 ? 'Cancel' : 'Back';
}

function updateProgress() {
  const prog = document.getElementById('wizard-progress');
  if (!prog) return;
  const labels = ['Color', 'Decoration', 'Sizes', 'Artwork', 'Your Info', 'Review'];
  prog.innerHTML = labels.map((label, i) => {
    const stepNum = i + 1;
    const isDone   = stepNum < wizard.currentStep;
    const isActive = stepNum === wizard.currentStep;
    const connector = i < labels.length - 1
      ? `<div class="step-connector${isDone ? ' done' : ''}"></div>`
      : '';
    return `
      <div class="wizard-step-indicator">
        <div class="step-dot ${isDone ? 'done' : isActive ? 'active' : ''}">${isDone ? ICONS.check : stepNum}</div>
        <span class="step-label ${isActive ? 'active' : ''}">${label}</span>
      </div>${connector}`;
  }).join('');
}

// ============================================
// CART
// ============================================
const CART_KEY = 'insignia_cart';

function getCart() {
  try { return JSON.parse(sessionStorage.getItem(CART_KEY)) || []; } catch(e) { return []; }
}

function saveCart(items) {
  sessionStorage.setItem(CART_KEY, JSON.stringify(items));
}

function updateCartBadge() {
  const cart  = getCart();
  const badge = document.getElementById('cart-badge');
  if (!badge) return;
  badge.textContent = cart.length;
  badge.style.display = cart.length > 0 ? 'flex' : 'none';
}

function addToCartItem() {
  const btn = document.getElementById('btn-next');
  if (btn) { btn.disabled = true; btn.textContent = 'Adding to Cart…'; }

  saveContact();
  const p = wizard.product;
  const totalQty = Object.values(wizard.quantities).reduce((a, b) => a + b, 0);
  const decoIds = wizard.decorations.map(d => d.type).filter(Boolean);
  const pricePerPiece = (typeof calcCombinedPricePerPiece === 'function' && p?.blankCost && decoIds.length)
    ? calcCombinedPricePerPiece(p.blankCost, decoIds, totalQty) : null;

  // Strip large preview data from artworks before storing in sessionStorage
  const artworksSafe = {};
  for (const [loc, art] of Object.entries(wizard.artworks)) {
    artworksSafe[loc] = { fileName: art.fileName || '', needsHelp: !!art.needsHelp };
  }

  const cartItem = {
    cartId: 'cart-' + Date.now(),
    product: { id: p.id, name: p.name, icon: p.icon, blankCost: p.blankCost },
    color: wizard.color,
    quantities: { ...wizard.quantities },
    totalQty,
    decorations: wizard.decorations.map(d => ({ ...d })),
    artworks: artworksSafe,
    contact: { ...wizard.contact },
    inHandDate:     wizard.inHandDate || null,
    isHardDeadline: wizard.isHardDeadline || false,
    pricePerPiece,
    totalPrice: pricePerPiece ? pricePerPiece * totalQty : null,
    addedAt: new Date().toISOString(),
  };

  const cart = getCart();
  cart.push(cartItem);
  saveCart(cart);

  setTimeout(() => {
    closeWizard();
    updateCartBadge();
    openCart();
    if (btn) { btn.disabled = false; }
  }, 400);
}

function removeCartItem(cartId) {
  saveCart(getCart().filter(i => i.cartId !== cartId));
  updateCartBadge();
  renderCartDrawer();
}

function openCart() {
  renderCartDrawer();
  document.getElementById('cart-drawer-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cart-drawer-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function renderCartDrawer() {
  const cart   = getCart();
  const body   = document.getElementById('cart-body');
  const footer = document.getElementById('cart-footer');
  if (!body) return;

  const countEl = document.getElementById('cart-count-label');
  if (countEl) countEl.textContent = cart.length ? `(${cart.length})` : '';

  if (!cart.length) {
    body.innerHTML = `
      <div class="cart-empty">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        <p>Your cart is empty</p>
        <button class="btn btn-ghost btn-sm" onclick="closeCart()">Browse Products</button>
      </div>`;
    if (footer) footer.style.display = 'none';
    return;
  }

  const estimatedTotal = cart.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

  body.innerHTML = cart.map(item => {
    const decorations = item.decorations || [];
    const decoSummary = decorations.map(d => `${d.typeLabel}: ${d.locations.join(', ')}`).join(' · ');
    const total   = item.totalPrice ? `$${item.totalPrice.toFixed(2)}` : '—';
    const ppp     = item.pricePerPiece ? ` · $${item.pricePerPiece.toFixed(2)} ea` : '';
    return `
      <div class="cart-item">
        <div class="cart-item-thumb">
          ${ICONS[item.product?.icon] || ICONS.tshirt}
        </div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.product?.name || 'Product'}</div>
          ${item.color ? `<div class="cart-item-meta"><span class="cart-color-dot" style="background:${item.color.hex}"></span>${item.color.name}</div>` : ''}
          ${decoSummary ? `<div class="cart-item-meta">${decoSummary}</div>` : ''}
          <div class="cart-item-meta">${item.totalQty} pcs${ppp}</div>
        </div>
        <div class="cart-item-right">
          <div class="cart-item-total">${total}</div>
          <button class="cart-item-remove" onclick="removeCartItem('${item.cartId}')" title="Remove">
            ${ICONS.close}
          </button>
        </div>
      </div>`;
  }).join('');

  if (footer) {
    footer.style.display = 'flex';
    const totalEl = document.getElementById('cart-total');
    if (totalEl) totalEl.textContent = estimatedTotal > 0 ? `$${estimatedTotal.toFixed(2)}` : 'TBD';
  }
}

function placeOrders() {
  const cart = getCart();
  if (!cart.length) return;

  const btn = document.getElementById('cart-place-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Placing Orders…'; }

  setTimeout(() => {
    const orderIds = [];
    // Assign a shared groupId when multiple items are in the same cart checkout
    const groupId = cart.length > 1 ? 'GRP-' + Date.now().toString().slice(-6) : null;
    cart.forEach(item => {
      const contact = item.contact?.email ? item.contact : {};
      const artworkName = Object.entries(item.artworks || {})
        .map(([loc, art]) => art.needsHelp ? `${loc}: Need assistance` : `${loc}: ${art.fileName}`)
        .join(' | ');

      if (typeof createOrder === 'function') {
        const order = createOrder({
          product: item.product,
          color: item.color,
          quantities: item.quantities,
          decorations: item.decorations || [],
          decorationType: (item.decorations || [])[0]?.type || '',
          decorationLocation: (item.decorations || []).flatMap(d => d.locations).join(', '),
          artworkName,
          contact,
          inHandDate:     item.inHandDate || null,
          isHardDeadline: item.isHardDeadline || false,
          pricePerPiece: item.pricePerPiece,
          totalPrice: item.totalPrice,
          groupId,
        });
        orderIds.push(order.id);
      }
    });

    _clearAbandon();
    saveCart([]);
    closeCart();
    updateCartBadge();

    if (btn) { btn.disabled = false; btn.textContent = 'Place Orders'; }

    if (orderIds.length === 1) {
      showSuccessModal(orderIds[0]);
    } else {
      showToast(`${orderIds.length} orders placed! Check your email for confirmation.`, 'success');
    }
  }, 1200);
}

// ============================================
// ABANDONED CHECKOUT TRACKING
// ============================================
var _abandonId = sessionStorage.getItem('_isa_abn_id') || null;

function _genAbnId() {
  return 'abn-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function _saveAbandon() {
  if (typeof _firebaseDb === 'undefined' || !_firebaseDb) return;
  if (!wizard.product) return;

  if (!_abandonId) {
    _abandonId = _genAbnId();
    sessionStorage.setItem('_isa_abn_id', _abandonId);
    sessionStorage.setItem('_isa_abn_start', new Date().toISOString());
  }

  var record = {
    id:           _abandonId,
    startedAt:    sessionStorage.getItem('_isa_abn_start') || new Date().toISOString(),
    lastSeenAt:   new Date().toISOString(),
    lastStep:     wizard.currentStep,
    product:      wizard.product ? wizard.product.id   : null,
    productName:  wizard.product ? wizard.product.name : null,
    color:        wizard.color || null,
    decorations:  (wizard.decorations || []).map(function (d) {
      return { type: d.type, typeLabel: d.typeLabel, locations: d.locations };
    }),
    contact:      Object.assign({}, wizard.contact),
    placed:       false,
  };

  _firebaseDb.collection('app_data').doc('abandoned_checkouts').get()
    .then(function (doc) {
      var list = [];
      if (doc.exists) { try { list = JSON.parse(doc.data().data || '[]'); } catch (e) {} }
      var idx = list.findIndex(function (r) { return r.id === _abandonId; });
      if (idx !== -1) { list[idx] = record; } else { list.unshift(record); }
      // Keep only last 90 days
      var cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
      list = list.filter(function (r) { return r.placed || r.startedAt > cutoff; });
      return _firebaseDb.collection('app_data').doc('abandoned_checkouts').set({
        data: JSON.stringify(list),
        updatedAt: new Date().toISOString(),
      });
    })
    .catch(function (e) { console.warn('[Abandon] save failed:', e); });
}

function _clearAbandon() {
  if (!_abandonId || typeof _firebaseDb === 'undefined' || !_firebaseDb) return;
  var id = _abandonId;
  _firebaseDb.collection('app_data').doc('abandoned_checkouts').get()
    .then(function (doc) {
      if (!doc.exists) return;
      var list = [];
      try { list = JSON.parse(doc.data().data || '[]'); } catch (e) {}
      list = list.filter(function (r) { return r.id !== id; });
      return _firebaseDb.collection('app_data').doc('abandoned_checkouts').set({
        data: JSON.stringify(list),
        updatedAt: new Date().toISOString(),
      });
    })
    .catch(function (e) { console.warn('[Abandon] clear failed:', e); });
  sessionStorage.removeItem('_isa_abn_id');
  sessionStorage.removeItem('_isa_abn_start');
  _abandonId = null;
}

// ============================================
// ACCOUNT AUTH
// ============================================
function updateNavAuth() {
  const user     = (typeof getLoggedInUser === 'function') ? getLoggedInUser() : null;
  const authBtn  = document.getElementById('nav-auth-btn');
  const userWrap = document.getElementById('nav-user-wrap');
  const nameEl   = document.getElementById('nav-user-name');
  if (user) {
    if (authBtn)  authBtn.style.display  = 'none';
    if (userWrap) userWrap.style.display = 'flex';
    if (nameEl)   nameEl.textContent     = user.firstName;
  } else {
    if (authBtn)  authBtn.style.display  = '';
    if (userWrap) userWrap.style.display = 'none';
  }
}

function doNavLogout() {
  if (typeof logoutAccount === 'function') logoutAccount();
  updateNavAuth();
  document.getElementById('nav-user-dropdown')?.classList.remove('open');
  showToast('Signed out');
}

function toggleUserMenu() {
  document.getElementById('nav-user-dropdown')?.classList.toggle('open');
}

function openAuthModal(tab = 'login') {
  switchAuthTab(tab);
  document.getElementById('auth-modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
  document.getElementById('auth-modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t   => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.auth-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tab));
}

function doSignIn(e) {
  e && e.preventDefault();
  const email    = document.getElementById('auth-login-email')?.value.trim() || '';
  const password = document.getElementById('auth-login-pw')?.value || '';
  const errEl    = document.getElementById('auth-login-err');

  if (!email || !password) { errEl.textContent = 'Please fill in all fields.'; errEl.style.display = 'block'; return; }

  const result = (typeof loginAccount === 'function') ? loginAccount(email, password) : { ok: false, error: 'Accounts not available.' };
  if (!result.ok) { errEl.textContent = result.error; errEl.style.display = 'block'; return; }

  errEl.style.display = 'none';
  closeAuthModal();
  updateNavAuth();
  prefillContactFromAccount();
  showToast(`Welcome back, ${result.user.firstName}!`, 'success');
}

function doRegister(e) {
  e && e.preventDefault();
  const firstName = document.getElementById('auth-reg-fname')?.value.trim()  || '';
  const lastName  = document.getElementById('auth-reg-lname')?.value.trim()  || '';
  const email     = document.getElementById('auth-reg-email')?.value.trim()  || '';
  const phone     = document.getElementById('auth-reg-phone')?.value.trim()  || '';
  const password  = document.getElementById('auth-reg-pw')?.value            || '';
  const confirm   = document.getElementById('auth-reg-pw2')?.value           || '';
  const errEl     = document.getElementById('auth-reg-err');

  if (!firstName || !lastName || !email || !password) { errEl.textContent = 'Please fill in all required fields.'; errEl.style.display = 'block'; return; }
  if (password !== confirm) { errEl.textContent = 'Passwords do not match.'; errEl.style.display = 'block'; return; }

  const result = (typeof createAccount === 'function') ? createAccount({ firstName, lastName, email, phone, password }) : { ok: false, error: 'Accounts not available.' };
  if (!result.ok) { errEl.textContent = result.error; errEl.style.display = 'block'; return; }

  errEl.style.display = 'none';
  closeAuthModal();
  updateNavAuth();
  prefillContactFromAccount();
  showToast(`Account created! Welcome, ${result.user.firstName}!`, 'success');
}

function prefillContactFromAccount() {
  const user = (typeof getLoggedInUser === 'function') ? getLoggedInUser() : null;
  if (!user) return;
  const fields = { 'c-fname': user.firstName, 'c-lname': user.lastName, 'c-email': user.email, 'c-phone': user.phone || '' };
  for (const [id, val] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }
  saveContact();
}

// ============================================
// MISC
// ============================================
function showSuccessModal(ref) {
  const modal = document.getElementById('success-modal');
  if (!modal) return;
  document.getElementById('order-ref').textContent = ref || ('INS-' + Date.now().toString().slice(-6));
  modal.classList.add('open');
}

function closeSuccessModal() {
  document.getElementById('success-modal').classList.remove('open');
}

function showToast(message, type = 'success') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast ${type}`;
  setTimeout(() => toast.classList.add('visible'), 10);
  setTimeout(() => toast.classList.remove('visible'), 3000);
}

function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 20), { passive: true });
}

function toggleMobileMenu() {
  document.getElementById('mobile-menu')?.classList.toggle('open');
}

function initQuoteForm() {
  const form = document.getElementById('quote-form');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Sending…';
    setTimeout(() => {
      form.reset();
      btn.disabled = false; btn.textContent = 'Send Request';
      showToast('Quote request sent! We\'ll be in touch within 24 hours.', 'success');
    }, 1000);
  });
}

function getMinQtyForProduct(product) {
  if (!product.decoration || !product.decoration.length) return 12;
  const mins = product.decoration.map(id => {
    const dt = (typeof ALL_DECORATION_TYPES !== 'undefined' ? ALL_DECORATION_TYPES : []).find(d => d.id === id);
    return dt ? dt.minQty : 12;
  });
  return Math.min(...mins);
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  function bootApp(cloudProducts) {
    // Prefer live Firestore data; fall back to localStorage/defaults
    let source = cloudProducts;
    if (!source) {
      source = (typeof getProducts === 'function' ? getProducts() : DEFAULT_PRODUCTS);
    }
    PRODUCTS = source.filter(p => p.visible !== false);
    COLORS = [];

    renderProducts();
    initFilters();
    initNav();
    initQuoteForm();
    updateNavAuth();
    updateCartBadge();
  }

  function fetchProductsAndBoot() {
    if (typeof _firebaseDb !== 'undefined' && _firebaseDb) {
      _firebaseDb.collection('app_data').doc('products').get()
        .then(doc => {
          if (doc.exists) {
            try {
              const products = JSON.parse(doc.data().data);
              // Cache locally so getProducts() is fresh on next load
              localStorage.setItem('insignia_products', JSON.stringify(products));
              localStorage.setItem('_ts_products', doc.data().updatedAt || new Date().toISOString());
              bootApp(products);
              return;
            } catch(e) {}
          }
          bootApp(null);
        })
        .catch(() => bootApp(null));
    } else {
      bootApp(null);
    }
  }

  // Sign in anonymously so Firestore reads succeed for unauthenticated public visitors.
  // If already signed in (portal, returning visitors) this is a no-op.
  if (typeof firebase !== 'undefined' && typeof firebase.auth === 'function') {
    const currentUser = firebase.auth().currentUser;
    const authReady = currentUser
      ? Promise.resolve(currentUser)
      : firebase.auth().signInAnonymously().catch(() => null);
    authReady.then(fetchProductsAndBoot);
  } else {
    fetchProductsAndBoot();
  }

  // Close wizard on overlay click
  document.getElementById('order-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('order-overlay')) closeWizard();
  });

  // Close user dropdown on outside click
  document.addEventListener('click', e => {
    const wrap = document.getElementById('nav-user-wrap');
    if (wrap && !wrap.contains(e.target)) {
      document.getElementById('nav-user-dropdown')?.classList.remove('open');
    }
  });
});
