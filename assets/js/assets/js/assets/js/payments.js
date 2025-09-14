// assets/js/payments.js
// Simple payment helper: either redirect to static Stripe Payment Links or call a serverless Checkout creator.

window.EdgePayments = {
  goToStripePaymentLink: (link) => {
    if(!link) return alert('Payment link not configured.');
    window.location.href = link;
  },
  openCheckoutSession: async (priceId) => {
    try {
      const res = await fetch('/.netlify/functions/create-checkout-session', {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({priceId})
      });
      const data = await res.json();
      if(data.url) window.location.href = data.url;
      else alert('Checkout creation failed.');
    } catch(e){ console.error(e); alert('Checkout error.'); }
  }
};
