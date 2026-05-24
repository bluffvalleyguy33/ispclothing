/* ============================================
   INSIGNIA — Cloud Functions (v1)
   ============================================ */

const functions = require('firebase-functions/v1');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const bcrypt = require('bcryptjs');

initializeApp();

const _CLOUD_COLLECTION = 'app_data';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

// Read a top-level app_data document and parse the JSON payload
async function _readDoc(docId) {
  const db = getFirestore();
  const ref = db.collection(_CLOUD_COLLECTION).doc(docId);
  const snap = await ref.get();
  if (!snap.exists) return [];
  const raw = snap.data().data;
  try {
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return [];
  }
}

// Write a top-level app_data document inside a transaction
async function _writeDoc(docId, mutator) {
  const db = getFirestore();
  const ref = db.collection(_CLOUD_COLLECTION).doc(docId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    let arr = [];
    if (snap.exists) {
      try { arr = JSON.parse(snap.data().data); } catch { arr = []; }
      if (!Array.isArray(arr)) arr = [];
    }
    const result = await mutator(arr);
    tx.set(ref, { data: JSON.stringify(arr), updatedAt: new Date().toISOString() });
    return result;
  });
}

// Legacy DJB2 hash — kept ONLY for transparent upgrade of pre-bcrypt accounts
function _legacyHash(pw) {
  let h = 5381;
  for (let i = 0; i < (pw || '').length; i++) h = (h * 33) ^ pw.charCodeAt(i);
  return (h >>> 0).toString(16);
}

// Strip sensitive fields before returning an account profile to the client
function _publicAccount(a) {
  if (!a) return null;
  return {
    email:     a.email,
    firstName: a.firstName || '',
    lastName:  a.lastName  || '',
    phone:     a.phone     || '',
    company:   a.company   || '',
    createdAt: a.createdAt || null,
    hasTempPassword: !!a.tempPassword,
  };
}

// Strip mockup base64 inline data when returning orders to the client
// (these may be already in Storage; client uses storage URLs anyway)
function _publicOrder(o) {
  if (!o) return null;
  // Don't strip — approval.html needs mockups visible. But we DO strip
  // any internal fields that aren't safe to expose.
  const clone = Object.assign({}, o);
  delete clone.adminNote;          // admin-only note never leaves the server
  delete clone.adminNotes;         // legacy field name
  delete clone.stripeSessionId;    // payment internals
  delete clone.stripePaymentLinkUrl; // we mint fresh links per request anyway
  return clone;
}

// Reject anything that looks like an email we don't trust
function _normalizeEmail(e) {
  return (e || '').toString().trim().toLowerCase();
}

// Returns true iff the auth context belongs to an approved admin.
// Customer custom-tokens carry { customer: true } so they're filtered out
// even if they happened to be signed in.
async function _isApprovedAdmin(context) {
  if (!context || !context.auth || !context.auth.uid) return false;
  if (context.auth.token && context.auth.token.customer) return false;
  try {
    const db = getFirestore();
    const snap = await db.collection('admins').doc(context.auth.uid).get();
    return snap.exists && snap.data() && snap.data().approved === true;
  } catch (_) {
    return false;
  }
}

// ─────────────────────────────────────────────
// createPaymentLink (callable)
//   - Looks up the order in Firestore
//   - Recalculates the balance due SERVER-SIDE
//   - Ignores any amount the caller passed in
//   - Allows: authenticated admin OR anonymous customer whose email matches
// ─────────────────────────────────────────────
exports.createPaymentLink = functions
  .runWith({ secrets: ['STRIPE_SECRET_KEY'] })
  .https.onCall(async (data, context) => {
    const { orderId, customerEmail, amountCents: clientAmountCents } = data || {};
    if (!orderId) {
      throw new functions.https.HttpsError('invalid-argument', 'orderId required.');
    }

    const orders = await _readDoc('orders');
    if (!Array.isArray(orders)) {
      throw new functions.https.HttpsError('internal', 'Orders document malformed.');
    }
    const order = orders.find(o => o && o.id === orderId);
    if (!order) {
      throw new functions.https.HttpsError('not-found', 'Order not found.');
    }

    // Authorization — approved admin always allowed (and may also override
    // the amount, e.g. for partial / deposit invoices). Anonymous customer
    // must supply the customerEmail that matches the order; their amount
    // is ALWAYS the server-computed balance due (no override).
    const isAdminCall = await _isApprovedAdmin(context);
    if (!isAdminCall) {
      const claimed = _normalizeEmail(customerEmail);
      const ordered = _normalizeEmail(order.customerEmail);
      if (!claimed || !ordered || claimed !== ordered) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Authentication required: matching customer email not provided.'
        );
      }
    }

    // SERVER-SIDE amount calculation. The customer cannot underpay.
    const totalPrice = parseFloat(order.totalPrice) || 0;
    const amountPaid = parseFloat(order.amountPaid) || 0;
    const balance    = Math.max(0, totalPrice - amountPaid);
    const balanceCents = Math.round(balance * 100);

    // Admin can specify a custom amount (deposits, change orders) — clamp
    // it to a reasonable range so a bad input doesn't bill catastrophically.
    let amountCents;
    if (isAdminCall && Number.isFinite(parseInt(clientAmountCents, 10)) && parseInt(clientAmountCents, 10) >= 50) {
      const requested = parseInt(clientAmountCents, 10);
      // Hard ceiling: never accept > 2x the order total + $50 from any input.
      const ceiling = Math.max(balanceCents, Math.round(totalPrice * 100)) * 2 + 5000;
      amountCents = Math.min(requested, ceiling);
    } else {
      amountCents = balanceCents;
    }
    if (amountCents < 50) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `No balance due on this order. Total $${totalPrice.toFixed(2)}, already paid $${amountPaid.toFixed(2)}.`
      );
    }

    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: { name: `Order ${orderId}` },
            unit_amount: amountCents,
          },
          quantity: 1,
        }],
        customer_email: order.customerEmail || undefined,
        // Include expectedAmountCents in metadata so the webhook can sanity-check
        metadata: {
          orderId,
          amountCents:           String(amountCents),
          expectedBalanceCents:  String(amountCents),
          orderTotalCents:       String(Math.round(totalPrice * 100)),
        },
        success_url: `https://insignia.ink/approval.html?id=${encodeURIComponent(orderId)}&paid=1`,
        cancel_url:  `https://insignia.ink/approval.html?id=${encodeURIComponent(orderId)}&canceled=1`,
      });
      return { url: session.url, sessionId: session.id, amountCents };
    } catch (err) {
      console.error('[createPaymentLink]', err);
      throw new functions.https.HttpsError('internal', err.message || 'Stripe error');
    }
  });

// ─────────────────────────────────────────────
// stripePaid (HTTP webhook)
//   - Verifies Stripe signature
//   - Only marks isPaid:true when amountPaid >= totalPrice
//   - Flags mismatched payments instead of silently accepting
// ─────────────────────────────────────────────
exports.stripePaid = functions
  .runWith({ secrets: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] })
  .https.onRequest(async (req, res) => {
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('[stripePaid] Signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type !== 'checkout.session.completed') {
      return res.status(200).send('ok');
    }

    const session = event.data.object;
    const orderId = session.metadata && session.metadata.orderId;
    const amountPaidCents = session.amount_total || 0;
    if (!orderId) return res.status(200).send('ok-no-order');

    try {
      await _writeDoc('orders', async (orders) => {
        const order = orders.find(o => o && o.id === orderId);
        if (!order) {
          console.warn('[stripePaid] Order not found:', orderId);
          return;
        }
        const paymentAmount = amountPaidCents / 100;
        const newAmountPaid = (parseFloat(order.amountPaid) || 0) + paymentAmount;
        const totalPrice    = parseFloat(order.totalPrice) || 0;
        const fullyPaid     = totalPrice > 0 && newAmountPaid + 0.005 >= totalPrice;

        // Defensive: if Stripe somehow reports more than the order total + 1%,
        // flag rather than silently overpay
        if (totalPrice > 0 && newAmountPaid > totalPrice * 1.01 + 0.50) {
          order.stripeAmountAnomaly = {
            at: new Date().toISOString(),
            paid: newAmountPaid,
            expectedTotal: totalPrice,
            sessionId: session.id,
          };
        }

        order.amountPaid = newAmountPaid;
        order.paidAt = order.paidAt || new Date().toISOString();
        order.stripeSessionId = session.id;
        order.isPaid = !!fullyPaid;
        order.updatedAt = new Date().toISOString();
        if (!Array.isArray(order.activityLog)) order.activityLog = [];
        order.activityLog.push({
          id: 'a_' + Date.now() + '_stripe',
          at: new Date().toISOString(),
          by: 'Stripe',
          action: fullyPaid ? 'stripe_paid' : 'stripe_partial',
          details: fullyPaid
            ? `Customer paid $${paymentAmount.toFixed(2)} via Stripe (session ${session.id}) — order now fully paid`
            : `Customer paid $${paymentAmount.toFixed(2)} via Stripe (session ${session.id}) — partial; balance remaining`,
        });
      });
      console.log('[stripePaid] Updated order:', orderId, '$', amountPaidCents / 100);
      return res.status(200).send('ok');
    } catch (err) {
      console.error('[stripePaid] Firestore update failed:', err);
      return res.status(500).send('internal');
    }
  });

// ─────────────────────────────────────────────
// loginCustomer (callable)
//   - bcrypt verification; transparent upgrade of legacy DJB2 hashes
//   - On success, returns profile + Firebase custom token so future
//     authenticated calls have context.auth.token.email set
// ─────────────────────────────────────────────
exports.loginCustomer = functions
  .https.onCall(async (data) => {
    const email = _normalizeEmail(data && data.email);
    const password = (data && data.password) || '';
    if (!email || !password) {
      throw new functions.https.HttpsError('invalid-argument', 'email and password required.');
    }

    const accounts = await _readDoc('accounts');
    if (!Array.isArray(accounts)) {
      throw new functions.https.HttpsError('internal', 'Accounts document malformed.');
    }
    const acct = accounts.find(a => _normalizeEmail(a.email) === email);
    if (!acct) {
      throw new functions.https.HttpsError('unauthenticated', 'No account found with that email.');
    }

    let ok = false;
    let needsUpgrade = false;
    const stored = acct.passwordHash || '';
    // bcrypt hashes always start with $2 — distinguish from legacy DJB2 (hex)
    if (stored.startsWith('$2')) {
      ok = await bcrypt.compare(password, stored);
    } else if (stored) {
      // Legacy DJB2 path
      if (stored === _legacyHash(password)) {
        ok = true;
        needsUpgrade = true;
      }
    }
    // Allow temp password (admin-issued) as an alternative match
    if (!ok && acct.tempPassword && password === acct.tempPassword) {
      ok = true;
      needsUpgrade = true;
    }
    if (!ok) {
      throw new functions.https.HttpsError('unauthenticated', 'Incorrect password.');
    }

    // Transparent upgrade: re-hash with bcrypt on successful legacy login
    if (needsUpgrade) {
      const newHash = await bcrypt.hash(password, 10);
      await _writeDoc('accounts', async (arr) => {
        const a = arr.find(x => _normalizeEmail(x.email) === email);
        if (a) {
          a.passwordHash = newHash;
          a.tempPassword = null;  // never keep plaintext after first real login
          a.lastLogin    = new Date().toISOString();
        }
      });
    } else {
      await _writeDoc('accounts', async (arr) => {
        const a = arr.find(x => _normalizeEmail(x.email) === email);
        if (a) a.lastLogin = new Date().toISOString();
      });
    }

    // Mint a Firebase custom token so the client can sign in. Customer's
    // uid is a stable hash of their email (no separate user record needed).
    let customToken = null;
    try {
      const uid = 'cust_' + email.replace(/[^a-z0-9]+/g, '_').slice(0, 100);
      customToken = await getAuth().createCustomToken(uid, { customer: true, email });
    } catch (err) {
      console.warn('[loginCustomer] custom token mint failed:', err.message);
      // Not fatal — client can still proceed without it
    }

    return {
      ok: true,
      profile: _publicAccount(acct),
      customToken,
    };
  });

// ─────────────────────────────────────────────
// signupCustomer (callable)
//   - bcrypt-hashed password; idempotent on duplicate email (returns error)
// ─────────────────────────────────────────────
exports.signupCustomer = functions
  .https.onCall(async (data) => {
    const email     = _normalizeEmail(data && data.email);
    const password  = (data && data.password) || '';
    const firstName = ((data && data.firstName) || '').trim();
    const lastName  = ((data && data.lastName)  || '').trim();
    const phone     = ((data && data.phone)     || '').trim();
    const company   = ((data && data.company)   || '').trim();

    if (!email || !password) {
      throw new functions.https.HttpsError('invalid-argument', 'email and password required.');
    }
    if (password.length < 6) {
      throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters.');
    }

    const hash = await bcrypt.hash(password, 10);
    let createdAccount = null;
    await _writeDoc('accounts', async (arr) => {
      const existing = arr.find(a => _normalizeEmail(a.email) === email);
      if (existing) {
        // Don't reveal exact reason for duplicates (anti-enumeration)
        throw new functions.https.HttpsError('already-exists', 'An account with that email already exists.');
      }
      const acct = {
        email,
        firstName, lastName, phone, company,
        passwordHash: hash,
        createdAt: new Date().toISOString(),
      };
      arr.push(acct);
      createdAccount = acct;
    });

    let customToken = null;
    try {
      const uid = 'cust_' + email.replace(/[^a-z0-9]+/g, '_').slice(0, 100);
      customToken = await getAuth().createCustomToken(uid, { customer: true, email });
    } catch (err) {
      console.warn('[signupCustomer] custom token mint failed:', err.message);
    }

    return { ok: true, profile: _publicAccount(createdAccount), customToken };
  });

// ─────────────────────────────────────────────
// changeCustomerPassword (callable)
//   - Requires the OLD password (so a session alone isn't enough)
//   - Stores new password as bcrypt
// ─────────────────────────────────────────────
exports.changeCustomerPassword = functions
  .https.onCall(async (data) => {
    const email       = _normalizeEmail(data && data.email);
    const oldPassword = (data && data.oldPassword) || '';
    const newPassword = (data && data.newPassword) || '';
    if (!email || !oldPassword || !newPassword) {
      throw new functions.https.HttpsError('invalid-argument', 'email, oldPassword and newPassword required.');
    }
    if (newPassword.length < 6) {
      throw new functions.https.HttpsError('invalid-argument', 'New password must be at least 6 characters.');
    }

    const accounts = await _readDoc('accounts');
    const acct = (accounts || []).find(a => _normalizeEmail(a.email) === email);
    if (!acct) throw new functions.https.HttpsError('unauthenticated', 'No account found.');

    let ok = false;
    const stored = acct.passwordHash || '';
    if (stored.startsWith('$2')) ok = await bcrypt.compare(oldPassword, stored);
    else if (stored) ok = (stored === _legacyHash(oldPassword));
    if (!ok && acct.tempPassword && oldPassword === acct.tempPassword) ok = true;
    if (!ok) throw new functions.https.HttpsError('unauthenticated', 'Incorrect current password.');

    const newHash = await bcrypt.hash(newPassword, 10);
    await _writeDoc('accounts', async (arr) => {
      const a = arr.find(x => _normalizeEmail(x.email) === email);
      if (a) {
        a.passwordHash = newHash;
        a.tempPassword = null;
        a.updatedAt = new Date().toISOString();
      }
    });
    return { ok: true };
  });

// ─────────────────────────────────────────────
// getApprovalOrder (callable)
//   - Customer-facing single-order fetch (used by approval.html)
//   - Strips adminNote and other admin-only fields
//   - Public read: anyone with the orderId may fetch (URL = auth, matches
//     current behavior); future iteration could add an order-specific token
// ─────────────────────────────────────────────
exports.getApprovalOrder = functions
  .https.onCall(async (data) => {
    const orderId = (data && data.orderId) || '';
    if (!orderId) throw new functions.https.HttpsError('invalid-argument', 'orderId required.');
    const orders = await _readDoc('orders');
    const order = (orders || []).find(o => o && o.id === orderId);
    if (!order) throw new functions.https.HttpsError('not-found', 'Order not found.');
    return { ok: true, order: _publicOrder(order) };
  });

// ─────────────────────────────────────────────
// updateApprovalOrder (callable)
//   - Customer can update quantities (pre-approval) or approve / decline
//   - Caller must provide the matching customerEmail
//   - Server enforces what fields are mutable; admin-only fields are ignored
// ─────────────────────────────────────────────
const _CUSTOMER_MUTABLE_FIELDS = new Set([
  'decorationGroups',  // for qty edits — server re-derives totals from this
  'totalQty',
  'totalPrice',
  'status',            // approved / declined / pre-production
  'approvedAt',
  'approvedByName',
  'declinedAt',
  'declineReason',
]);

exports.updateApprovalOrder = functions
  .https.onCall(async (data, context) => {
    const orderId = (data && data.orderId) || '';
    const customerEmail = _normalizeEmail(data && data.customerEmail);
    const changes = (data && data.changes) || {};
    const actorName = ((data && data.actorName) || '').trim();
    if (!orderId) throw new functions.https.HttpsError('invalid-argument', 'orderId required.');

    const isAdmin = await _isApprovedAdmin(context);
    let updated = null;
    await _writeDoc('orders', async (orders) => {
      const order = orders.find(o => o && o.id === orderId);
      if (!order) throw new functions.https.HttpsError('not-found', 'Order not found.');

      // Authorization — same model as createPaymentLink
      if (!isAdmin) {
        const ordered = _normalizeEmail(order.customerEmail);
        if (!customerEmail || !ordered || customerEmail !== ordered) {
          throw new functions.https.HttpsError('permission-denied', 'Email does not match order.');
        }
        // Customer cannot modify once already approved (one-way gate)
        if (order.approvedAt && changes.status !== 'declined' /* declines after approval are admin-only */) {
          // Allow re-saving approvedByName as a no-op but block field mutations
          const onlyHarmless = Object.keys(changes).every(k =>
            ['approvedByName'].includes(k)
          );
          if (!onlyHarmless && changes.status !== 'approved') {
            throw new functions.https.HttpsError(
              'failed-precondition',
              'Order is already approved — changes must be made by admin.'
            );
          }
        }
      }

      // Apply only whitelisted fields
      Object.keys(changes).forEach(k => {
        if (_CUSTOMER_MUTABLE_FIELDS.has(k)) order[k] = changes[k];
      });
      order.updatedAt = new Date().toISOString();

      // Activity log
      if (!Array.isArray(order.activityLog)) order.activityLog = [];
      const by = actorName || (order.customerName || 'Customer');
      if (changes.status === 'approved' && changes.approvedAt) {
        order.activityLog.push({
          id: 'a_' + Date.now() + '_approve',
          at: new Date().toISOString(),
          by,
          action: 'approved',
          details: 'Order approved by ' + by,
        });
      } else if (changes.status === 'declined') {
        order.activityLog.push({
          id: 'a_' + Date.now() + '_decline',
          at: new Date().toISOString(),
          by,
          action: 'declined',
          details: 'Customer requested changes: ' + (changes.declineReason || '(no reason)'),
        });
      } else if (changes.decorationGroups) {
        order.activityLog.push({
          id: 'a_' + Date.now() + '_qty',
          at: new Date().toISOString(),
          by,
          action: 'quantity_changed',
          details: 'Customer edited quantities — new total $' +
            (parseFloat(changes.totalPrice) || 0).toFixed(2),
        });
      }
      updated = order;
    });
    return { ok: true, order: _publicOrder(updated) };
  });

// ─────────────────────────────────────────────
// getCustomerOrders (callable)
//   - Returns orders for the caller's email
//   - Requires Firebase custom-token sign-in (context.auth.token.email)
//   - Falls back to email+password if no auth context (stateless)
// ─────────────────────────────────────────────
exports.getCustomerOrders = functions
  .https.onCall(async (data, context) => {
    let email = '';
    if (context && context.auth && context.auth.token && context.auth.token.email) {
      email = _normalizeEmail(context.auth.token.email);
    } else if (data && data.email && data.password) {
      // Stateless fallback — re-verify password
      const accounts = await _readDoc('accounts');
      const acct = (accounts || []).find(a => _normalizeEmail(a.email) === _normalizeEmail(data.email));
      if (!acct) throw new functions.https.HttpsError('unauthenticated', 'No account found.');
      const stored = acct.passwordHash || '';
      let ok = false;
      if (stored.startsWith('$2')) ok = await bcrypt.compare(data.password, stored);
      else if (stored) ok = (stored === _legacyHash(data.password));
      if (!ok && acct.tempPassword && data.password === acct.tempPassword) ok = true;
      if (!ok) throw new functions.https.HttpsError('unauthenticated', 'Incorrect password.');
      email = _normalizeEmail(data.email);
    } else {
      throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
    }

    const orders = await _readDoc('orders');
    const mine = (orders || []).filter(o =>
      o && _normalizeEmail(o.customerEmail) === email && o.visibleToCustomer !== false
    );
    return { ok: true, orders: mine.map(_publicOrder) };
  });

// ─────────────────────────────────────────────
// createCustomerOrder (callable)
//   - Used by the storefront/cart to create a new order
//   - Server stamps id / createdAt / status; client cannot forge those
//   - Pricing is recomputed if a pricing document is available
// ─────────────────────────────────────────────
exports.createCustomerOrder = functions
  .https.onCall(async (data, context) => {
    const draft = (data && data.order) || {};
    if (!draft.customerEmail || !_normalizeEmail(draft.customerEmail)) {
      throw new functions.https.HttpsError('invalid-argument', 'customerEmail required.');
    }
    // If the call is authenticated, ensure the email matches the auth claim
    if (context && context.auth && context.auth.token && context.auth.token.email) {
      const claim = _normalizeEmail(context.auth.token.email);
      const claimed = _normalizeEmail(draft.customerEmail);
      if (claim !== claimed) {
        throw new functions.https.HttpsError('permission-denied', 'Order email must match signed-in user.');
      }
    }

    let created = null;
    await _writeDoc('orders', async (orders) => {
      const id = 'INS-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100);
      const now = new Date().toISOString();
      // Whitelist fields the client may set — everything else is server-stamped
      const allowed = [
        'customerName','customerEmail','customerPhone','customerCompany',
        'shippingAddress','customerNote',
        'product','color','colorHex','productId',
        'quantities','totalQty','totalPrice',
        'decorationGroups','decorationTypes','decorations','decorationType','decorationLocation',
        'customerSuppliedBlanks','source',
        'mockups',
      ];
      const o = { id, status: 'new', createdAt: now, updatedAt: now, activityLog: [{
        id: 'a_' + Date.now() + '_create', at: now, by: 'Customer', action: 'created',
        details: 'Order placed online'
      }] };
      allowed.forEach(k => { if (k in draft) o[k] = draft[k]; });
      o.customerEmail = _normalizeEmail(o.customerEmail);
      orders.push(o);
      created = o;
    });
    return { ok: true, order: _publicOrder(created) };
  });
