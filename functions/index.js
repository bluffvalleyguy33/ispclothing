/* ============================================
   INSIGNIA — Stripe Payment Cloud Functions (v1)
   ============================================ */

const functions = require('firebase-functions/v1');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();

const _CLOUD_COLLECTION = 'app_data';

// ============================================
// createStripeCheckout (callable)
// Called from admin to generate a Stripe Checkout link for a specific amount
// ============================================
exports.createPaymentLink = functions
  .runWith({ secrets: ['STRIPE_SECRET_KEY'] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in.');
    }
    const { orderId, amountCents, customerEmail, description } = data || {};
    if (!orderId || !amountCents || amountCents < 50) {
      throw new functions.https.HttpsError('invalid-argument', 'orderId and amountCents (>= 50) required.');
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
            product_data: {
              name: description || `Order ${orderId}`,
            },
            unit_amount: Math.round(amountCents),
          },
          quantity: 1,
        }],
        customer_email: customerEmail || undefined,
        metadata: { orderId, amountCents: String(amountCents) },
        success_url: 'https://insignia.ink/portal.html?paid=1',
        cancel_url:  'https://insignia.ink/portal.html?canceled=1',
      });
      return { url: session.url, sessionId: session.id };
    } catch (err) {
      console.error('[createStripeCheckout]', err);
      throw new functions.https.HttpsError('internal', err.message || 'Stripe error');
    }
  });

// ============================================
// stripeWebhook (HTTP)
// Stripe POSTs here when a checkout completes — auto-marks the order paid
// ============================================
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
      console.error('[stripeWebhook] Signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type !== 'checkout.session.completed') {
      console.log('[stripeWebhook] Ignoring event type:', event.type);
      return res.status(200).send('ok');
    }

    const session = event.data.object;
    const orderId = session.metadata && session.metadata.orderId;
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
        const paymentAmount = amountPaidCents / 100;
        order.isPaid = true;
        order.paidAt = new Date().toISOString();
        order.amountPaid = (order.amountPaid || 0) + paymentAmount;
        order.stripeSessionId = session.id;
        order.updatedAt = new Date().toISOString();
        if (!Array.isArray(order.activityLog)) order.activityLog = [];
        order.activityLog.push({
          id: 'a_' + Date.now() + '_stripe',
          at: new Date().toISOString(),
          by: 'Stripe',
          action: 'stripe_paid',
          details: `Customer paid $${paymentAmount.toFixed(2)} via Stripe (session ${session.id})`,
        });
        const ts = new Date().toISOString();
        tx.set(ref, { data: JSON.stringify(orders), updatedAt: ts });
      });
      console.log('[stripeWebhook] Order marked paid:', orderId, '$', amountPaidCents / 100);
      return res.status(200).send('ok');
    } catch (err) {
      console.error('[stripeWebhook] Firestore update failed:', err);
      return res.status(500).send('internal');
    }
  });
