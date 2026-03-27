/* ============================================
   INSIGNIA — Product Data & Constants
   Edit via admin.html. Changes saved to localStorage.
   ============================================ */

const ALL_DECORATION_TYPES = [
  { id: 'screen-printing',        label: 'Screen Printing',        minQty: 24 },
  { id: 'digital-print',          label: 'Digital Print',          minQty: 12 },
  { id: 'transfers',              label: 'Transfers',              minQty: 12 },
  { id: 'embroidery',             label: 'Embroidery',             minQty: 12 },
  { id: 'embroidery-patch',       label: 'Embroidery Patch',       minQty: 50 },
  { id: 'woven-patch',            label: 'Woven Patch',            minQty: 50 },
  { id: 'printed-patch',          label: 'Printed Patch',          minQty: 50 },
  { id: 'pvc-patch',              label: 'PVC Patch',              minQty: 50 },
  { id: 'leather-patch',          label: 'Leather Patch',          minQty: 12 },
  { id: 'printed-leather-patch',  label: 'Printed Leather Patch',  minQty: 12 },
  { id: 'promo',                  label: 'Promo',                  minQty: 1  },
  { id: 'dye-sub',                label: 'Dye Sublimation',        minQty: 12 },
  { id: 'laser-engraving',        label: 'Laser Engraving',        minQty: 1  },
  { id: 'decals',                 label: 'Decals',                 minQty: 1  },
];

const ALL_LOCATIONS = [
  'Left Chest',
  'Big Front',
  'Big Back',
  'Upper Back',
  'Lower Back',
  'Right Sleeve',
  'Left Sleeve',
  'Neck Label',
  'Left Panel',
  'Right Panel',
  'Left Side of Hat',
  'Right Side of Hat',
  'Back of Hat',
];

const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', 'One Size (Adjustable)'];

const PRICE_BREAK_TIERS = [12, 24, 36, 48, 72, 144, 288];

/*
  Color objects per product:
  { name: 'Black', hex: '#1a1a1a', mockup: 'data:image/...' or null }
  mockup is base64 data URL of the blank garment image for that color.
*/

const DEFAULT_PRODUCTS = [
  {
    id: 'classic-tee',
    name: 'Classic T-Shirt',
    category: 'tshirts',
    description: 'Heavyweight 100% cotton. Perfect for bold screen prints.',
    icon: 'tshirt',
    popular: true,
    visible: true,
    sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
    decoration: ['screen-printing', 'digital-print', 'embroidery'],
    locations: ['Left Chest', 'Big Front', 'Big Back', 'Upper Back', 'Left Sleeve', 'Right Sleeve', 'Neck Label'],
    colors: [],  // populated via admin: [{ name, hex, mockup }]
    priceBreaks: {},  // { 'screen-printing': { 12: '', 24: '', ... }, ... }
  },
  {
    id: 'premium-hoodie',
    name: 'Premium Hoodie',
    category: 'hoodies',
    description: 'Midweight fleece pullover. Great for screen print and embroidery.',
    icon: 'hoodie',
    popular: true,
    visible: true,
    sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
    decoration: ['screen-printing', 'digital-print', 'embroidery', 'embroidery-patch'],
    locations: ['Left Chest', 'Big Front', 'Big Back', 'Upper Back', 'Left Sleeve', 'Right Sleeve'],
    colors: [],
    priceBreaks: {},
  },
  {
    id: 'zip-hoodie',
    name: 'Full-Zip Hoodie',
    category: 'hoodies',
    description: 'Classic full-zip fleece. Ideal for embroidery on chest or back.',
    icon: 'hoodie',
    popular: false,
    visible: true,
    sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
    decoration: ['embroidery', 'screen-printing', 'embroidery-patch'],
    locations: ['Left Chest', 'Big Back', 'Upper Back', 'Left Sleeve'],
    colors: [],
    priceBreaks: {},
  },
  {
    id: 'structured-hat',
    name: 'Structured Hat',
    category: 'hats',
    description: 'Structured 6-panel cap. Perfect canvas for embroidery.',
    icon: 'hat',
    popular: true,
    visible: true,
    sizes: ['One Size (Adjustable)'],
    decoration: ['embroidery', 'embroidery-patch', 'leather-patch', 'printed-leather-patch', 'woven-patch'],
    locations: ['Left Panel', 'Right Panel', 'Left Side of Hat', 'Right Side of Hat', 'Back of Hat'],
    colors: [],
    priceBreaks: {},
  },
  {
    id: 'dad-hat',
    name: 'Dad Hat / Unstructured',
    category: 'hats',
    description: 'Soft unstructured cap with curved brim. Low-profile and stylish.',
    icon: 'hat',
    popular: false,
    visible: true,
    sizes: ['One Size (Adjustable)'],
    decoration: ['embroidery', 'embroidery-patch', 'leather-patch', 'woven-patch'],
    locations: ['Left Panel', 'Right Panel', 'Left Side of Hat', 'Right Side of Hat', 'Back of Hat'],
    colors: [],
    priceBreaks: {},
  },
  {
    id: 'polo-shirt',
    name: 'Polo Shirt',
    category: 'polos',
    description: 'Performance piqué polo. Professional look with embroidered logo.',
    icon: 'polo',
    popular: false,
    visible: true,
    sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
    decoration: ['embroidery', 'digital-print', 'embroidery-patch'],
    locations: ['Left Chest', 'Right Sleeve', 'Left Sleeve', 'Neck Label'],
    colors: [],
    priceBreaks: {},
  },
  {
    id: 'long-sleeve',
    name: 'Long Sleeve Tee',
    category: 'tshirts',
    description: 'Cotton long sleeve. Great for seasonal prints and layering.',
    icon: 'tshirt',
    popular: false,
    visible: true,
    sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
    decoration: ['screen-printing', 'digital-print', 'embroidery'],
    locations: ['Left Chest', 'Big Front', 'Big Back', 'Left Sleeve', 'Right Sleeve'],
    colors: [],
    priceBreaks: {},
  },
  {
    id: 'crewneck',
    name: 'Crewneck Sweatshirt',
    category: 'hoodies',
    description: 'Classic fleece crewneck. Versatile for any decoration method.',
    icon: 'hoodie',
    popular: false,
    visible: true,
    sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
    decoration: ['screen-printing', 'embroidery', 'digital-print', 'embroidery-patch'],
    locations: ['Left Chest', 'Big Front', 'Big Back', 'Upper Back', 'Left Sleeve', 'Right Sleeve'],
    colors: [],
    priceBreaks: {},
  },
];

// ============================================
// PRICING METRICS
// Multiplier grid per decoration type.
// sell_price_per_piece = blankCost × multiplier
// Rows = qty tiers, Columns = blank cost ranges
// ============================================

function buildDefaultGrid(qtys, numCols, baseMultipliers) {
  // baseMultipliers: array of [col0, col1, ...] per qty row
  return qtys.map((q, ri) => baseMultipliers[ri] || Array(numCols).fill(''));
}

const DEFAULT_PRICING_METRICS = (() => {
  const qtys = [12, 24, 36, 48, 72, 144, 288];
  const costRanges = [
    { minVal: 0,     maxVal: 5,    label: '$0–$5' },
    { minVal: 5.01,  maxVal: 7,    label: '$5.01–$7' },
    { minVal: 7.01,  maxVal: 10,   label: '$7.01–$10' },
    { minVal: 10.01, maxVal: 15,   label: '$10.01–$15' },
    { minVal: 15.01, maxVal: 9999, label: '$15.01+' },
  ];

  return {
    'screen-printing': {
      qtys: [24, 36, 48, 72, 144, 288],
      costRanges,
      grid: [
        ['3.8',  '3.0',  '2.5',  '2.3',  '2.1'],
        ['3.5',  '2.75', '2.3',  '2.2',  '2.0'],
        ['3.25', '2.4',  '2.2',  '2.1',  '1.9'],
        ['3.0',  '2.3',  '2.0',  '2.0',  '1.8'],
        ['2.5',  '2.0',  '1.7',  '1.6',  '1.6'],
        ['2.0',  '1.8',  '1.6',  '1.5',  '1.5'],
      ],
    },
    'digital-print': {
      qtys: [12, 24, 36, 48, 72, 144, 288],
      costRanges,
      grid: [
        ['4.2',  '3.4',  '2.8',  '2.5',  '2.2'],
        ['3.9',  '3.1',  '2.6',  '2.3',  '2.1'],
        ['3.6',  '2.9',  '2.4',  '2.2',  '2.0'],
        ['3.3',  '2.6',  '2.2',  '2.0',  '1.9'],
        ['3.0',  '2.4',  '2.0',  '1.8',  '1.8'],
        ['2.6',  '2.1',  '1.8',  '1.7',  '1.7'],
        ['2.2',  '1.9',  '1.7',  '1.6',  '1.6'],
      ],
    },
    'embroidery': {
      qtys: [12, 24, 36, 48, 72, 144, 288],
      costRanges,
      grid: [
        ['4.5',  '3.6',  '3.0',  '2.7',  '2.4'],
        ['4.1',  '3.3',  '2.7',  '2.4',  '2.2'],
        ['3.8',  '3.0',  '2.5',  '2.3',  '2.1'],
        ['3.5',  '2.8',  '2.3',  '2.1',  '2.0'],
        ['3.2',  '2.5',  '2.1',  '1.9',  '1.9'],
        ['2.8',  '2.2',  '1.9',  '1.8',  '1.8'],
        ['2.4',  '2.0',  '1.8',  '1.7',  '1.7'],
      ],
    },
    'embroidery-patch': {
      qtys: [50, 72, 144, 288],
      costRanges,
      grid: [
        ['5.0',  '4.2',  '3.5',  '3.0',  '2.7'],
        ['4.5',  '3.8',  '3.2',  '2.8',  '2.5'],
        ['4.0',  '3.4',  '2.9',  '2.5',  '2.3'],
        ['3.5',  '3.0',  '2.6',  '2.3',  '2.1'],
      ],
    },
    'woven-patch': {
      qtys: [50, 72, 144, 288],
      costRanges,
      grid: [
        ['5.2',  '4.4',  '3.7',  '3.2',  '2.9'],
        ['4.7',  '4.0',  '3.4',  '2.9',  '2.6'],
        ['4.2',  '3.6',  '3.0',  '2.6',  '2.4'],
        ['3.7',  '3.2',  '2.7',  '2.4',  '2.2'],
      ],
    },
    'printed-patch': {
      qtys: [50, 72, 144, 288],
      costRanges,
      grid: [
        ['4.8',  '4.0',  '3.4',  '2.9',  '2.6'],
        ['4.3',  '3.6',  '3.1',  '2.7',  '2.4'],
        ['3.8',  '3.2',  '2.8',  '2.4',  '2.2'],
        ['3.4',  '2.9',  '2.5',  '2.2',  '2.0'],
      ],
    },
    'leather-patch': {
      qtys: [12, 24, 36, 48, 72, 144, 288],
      costRanges,
      grid: [
        ['5.5',  '4.6',  '3.9',  '3.4',  '3.0'],
        ['5.0',  '4.2',  '3.5',  '3.1',  '2.8'],
        ['4.6',  '3.8',  '3.2',  '2.8',  '2.6'],
        ['4.2',  '3.5',  '2.9',  '2.6',  '2.4'],
        ['3.8',  '3.2',  '2.7',  '2.4',  '2.2'],
        ['3.4',  '2.8',  '2.4',  '2.2',  '2.1'],
        ['3.0',  '2.5',  '2.2',  '2.0',  '1.9'],
      ],
    },
    'printed-leather-patch': {
      qtys: [12, 24, 36, 48, 72, 144, 288],
      costRanges,
      grid: [
        ['5.3',  '4.4',  '3.7',  '3.2',  '2.9'],
        ['4.8',  '4.0',  '3.4',  '2.9',  '2.7'],
        ['4.4',  '3.6',  '3.1',  '2.7',  '2.5'],
        ['4.0',  '3.3',  '2.8',  '2.5',  '2.3'],
        ['3.6',  '3.0',  '2.6',  '2.3',  '2.1'],
        ['3.2',  '2.7',  '2.3',  '2.1',  '2.0'],
        ['2.8',  '2.4',  '2.1',  '1.9',  '1.8'],
      ],
    },
  };
})();

function getPricingMetrics() {
  try {
    const saved = localStorage.getItem('insignia_pricing');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return JSON.parse(JSON.stringify(DEFAULT_PRICING_METRICS));
}

function savePricingMetrics(metrics) {
  localStorage.setItem('insignia_pricing', JSON.stringify(metrics));
}

// Calculate sell price per piece given product blank cost, deco type, and qty
function calcPricePerPiece(blankCost, decoId, qty) {
  const metrics = getPricingMetrics();
  const m = metrics[decoId];
  if (!m || !blankCost || blankCost <= 0) return null;

  // Find cost range column
  const colIdx = m.costRanges.findIndex(r => blankCost >= r.minVal && blankCost <= r.maxVal);
  if (colIdx === -1) return null;

  // Find qty row — largest row qty that is <= ordered qty
  let rowIdx = -1;
  for (let i = 0; i < m.qtys.length; i++) {
    if (qty >= m.qtys[i]) rowIdx = i;
  }
  if (rowIdx === -1) return null;

  const multiplier = parseFloat(m.grid[rowIdx]?.[colIdx]);
  if (isNaN(multiplier) || multiplier <= 0) return null;
  return blankCost * multiplier;
}

function getProducts() {
  try {
    const saved = localStorage.getItem('insignia_products');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
}

function saveProducts(products) {
  localStorage.setItem('insignia_products', JSON.stringify(products));
  if (typeof cloudSave === 'function') cloudSave('products', products);
}

function resetProducts() {
  localStorage.removeItem('insignia_products');
  return JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
}

// Helper: get the decoration type object by id
function getDecoType(id) {
  return ALL_DECORATION_TYPES.find(d => d.id === id);
}

// Helper: get lowest starting price from a product's priceBreaks
function getStartingPrice(product) {
  const breaks = product.priceBreaks || {};
  let lowest = null;
  Object.values(breaks).forEach(tiers => {
    Object.values(tiers).forEach(price => {
      const n = parseFloat(price);
      if (!isNaN(n) && n > 0) {
        if (lowest === null || n < lowest) lowest = n;
      }
    });
  });
  return lowest;
}
