/* ============================================
   INSIGNIA — VIP Catalogs
   ============================================ */

function getCatalogs() {
  try { return JSON.parse(localStorage.getItem('insignia_catalogs')) || []; } catch(e) { return []; }
}

function saveCatalogs(cats) {
  localStorage.setItem('insignia_catalogs', JSON.stringify(cats));
  if (typeof cloudSave === 'function') cloudSave('catalogs', cats);
}

function getCatalogByEmail(email) {
  const e = (email || '').toLowerCase().trim();
  return getCatalogs().find(c => c.customerEmail === e) || null;
}

// Create a new catalog for a customer (or return existing one)
function upsertCatalog(customerEmail, customerName) {
  const e = (customerEmail || '').toLowerCase().trim();
  const cats = getCatalogs();
  let cat = cats.find(c => c.customerEmail === e);
  if (!cat) {
    cat = {
      id: 'CAT-' + Date.now(),
      customerEmail: e,
      customerName: customerName || '',
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    cats.push(cat);
    saveCatalogs(cats);
  }
  return cat;
}

// Replace a catalog's items array (full overwrite)
function saveCatalogItems(catalogId, items) {
  const cats = getCatalogs();
  const idx = cats.findIndex(c => c.id === catalogId);
  if (idx === -1) return null;
  cats[idx].items = items;
  cats[idx].updatedAt = new Date().toISOString();
  saveCatalogs(cats);
  return cats[idx];
}

function deleteCatalog(catalogId) {
  saveCatalogs(getCatalogs().filter(c => c.id !== catalogId));
}
