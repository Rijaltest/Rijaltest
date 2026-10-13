// Safety net: marks orders paid even if the customer closes the tab after paying.
// Razorpay Dashboard > Webhooks > URL: https://YOUR-DOMAIN/.netlify/functions/webhook
// Events: payment.captured, order.paid
const crypto = require('crypto');
const { markPaid, json } = require('./_lib');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  const sig = event.headers['x-razorpay-signature'] || '';
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return json(400, { error: 'Bad signature' });

  try {
    const body = JSON.parse(raw);
    const pay = body.payload && body.payload.payment && body.payload.payment.entity;
    if ((body.event === 'payment.captured' || body.event === 'order.paid') && pay) {
      await markPaid(pay.order_id, pay.id);
    }
    return json(200, { ok: true });
  } catch (e) {
    console.error(e);
    return json(500, { error: 'Webhook error' }); // Razorpay will retry
  }
};
