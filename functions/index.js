/* ============================================
   INSIGNIA — Stripe Payment Cloud Functions
   ============================================ */

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { setGlobalOptions } = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

setGlobalOptions({ maxInstances: 10 });
initializeApp();

// Secrets — set with: firebase functions:secrets:set STRIPE_SECRET_KEY
const STRIPE_SECRET_KEY     = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

const _CLOUD_COLLECTION = 'app_data';

// ============================================
// createStripeCheckout
// Called from admin to generate a payment link for an order
// ============================================
exports.createStripeCheckout = onCall(
  { secrets: [STRIPE_SECRET_KEY], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in.');
    }
    const { orderId, amountCents, customerEmail, description } = request.data || {};
    if (!orderId || !amountCents || amountCents < 50) {
      throw new HttpsError('invalid-argument', 'orderId and amountCents (>= 50) required.');
    }
    const Stripe = require('stripe');
    const stripe = new Stripe(STRIPE_SECRET_KEY.value());
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: description || `Order ${orderId}`,
            },
            unit_amount: Math.round(amountCents),
          },
          quantity: 1,
        }],
        customer_email: customerEmail || undefined,
        metadata: { orderId, amountCents: String(amountCents) },
        success_url: 'https://insigniascreenprinting.com/portal.html?paid=1',
        cancel_url:  'https://insigniascreenprinting.com/portal.html?canceled=1',
      });
      return { url: session.url, sessionId: session.id };
    } catch (err) {
      console.error('[createStripeCheckout]', err);
      throw new HttpsError('internal', err.message || 'Stripe error');
    }
  }
);

// ============================================
// stripeWebhook
// Stripe posts here when a payment succeeds → marks order paid in Firestore
// ============================================
exports.stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] },
  async (req, res) => {
    const Stripe = require('stripe');
    const stripe = new Stripe(STRIPE_SECRET_KEY.value());
    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        STRIPE_WEBHOOK_SECRET.value()
      );
    } catch (err) {
      console.error('[stripeWebhook] Signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type !== 'checkout.session.completed') {
      console.log('[stripeWebhook] Ignoring event type:', event.type);
      return res.status(200).send('ok');
    }

    const session = event.data.object;
    const orderId = session.metadata?.orderId;
    const amountPaidCents = session.amount_total || 0;
    if (!orderId) {
      console.warn('[stripeWebhook] No orderId in metadata');
      return res.status(200).send('ok-no-order');
    }

    try {
      const db = getFirestore();
      const ref = db.collection(_CLOUD_COLLECTION).doc('orders');
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
          console.warn('[stripeWebhook] No orders doc');
          return;
        }
        const raw = snap.data().data;
        let orders;
        try { orders = JSON.parse(raw); } catch { orders = []; }
        if (!Array.isArray(orders)) orders = [];
        const order = orders.find(o => o && o.id === orderId);
        if (!order) {
          console.warn('[stripeWebhook] Order not found:', orderId);
          return;
        }
        order.isPaid = true;
        order.paidAt = new Date().toISOString();
        order.amountPaid = (order.amountPaid || 0) + (amountPaidCents / 100);
        order.stripeSessionId = session.id;
        order.updatedAt = new Date().toISOString();
        const ts = new Date().toISOString();
        tx.set(ref, { data: JSON.stringify(orders), updatedAt: ts });
      });
      console.log('[stripeWebhook] Order marked paid:', orderId, '$', amountPaidCents / 100);
      return res.status(200).send('ok');
    } catch (err) {
      console.error('[stripeWebhook] Firestore update failed:', err);
      return res.status(500).send('internal');
    }
  }
);
