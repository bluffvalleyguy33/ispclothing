/* ============================================
   INSIGNIA — Meta Pixel
   --------------------------------------------
   1. Set META_PIXEL_ID below to your real Pixel ID from
      Meta Events Manager (it's a 15-16 digit number).
   2. Save and deploy. PageView fires automatically.
   3. The named helpers — fbqViewContent / fbqInitiateCheckout /
      fbqAddPaymentInfo / fbqPurchase — are called from app.js and
      approval.html at the right moments in the funnel.
   ============================================ */

// REPLACE WITH YOUR PIXEL ID. While this stays as the placeholder
// nothing fires — safe to ship the code now and flip the ID later.
const META_PIXEL_ID = 'YOUR_PIXEL_ID';

(function () {
  if (!META_PIXEL_ID || META_PIXEL_ID === 'YOUR_PIXEL_ID') return;

  // Standard Meta Pixel base code (their copy-paste snippet, cleaned up)
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  fbq('init', META_PIXEL_ID);
  fbq('track', 'PageView');
})();

// ── Funnel event helpers — safe no-ops when pixel is uninitialized ──

// Customer opened the order wizard / product detail
function fbqViewContent(payload) {
  if (typeof fbq !== 'function') return;
  fbq('track', 'ViewContent', payload || {});
}

// Customer opened the cart with at least one item
function fbqInitiateCheckout(payload) {
  if (typeof fbq !== 'function') return;
  fbq('track', 'InitiateCheckout', payload || {});
}

// Customer clicked "Pay" — about to be redirected to Stripe
function fbqAddPaymentInfo(payload) {
  if (typeof fbq !== 'function') return;
  fbq('track', 'AddPaymentInfo', payload || {});
}

// Customer's Stripe payment completed (approval.html?paid=1)
// payload should include { value: <dollars>, currency: 'USD' }
function fbqPurchase(payload) {
  if (typeof fbq !== 'function') return;
  fbq('track', 'Purchase', Object.assign({ currency: 'USD' }, payload || {}));
}
