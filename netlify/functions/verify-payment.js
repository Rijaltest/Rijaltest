const crypto = require('crypto');
const { markPaid, json } = require('./_lib');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = JSON.parse(event.body || '{}');
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return json(400, { error: 'Missing fields' });

    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id).digest('hex');
    const a = Buffer.from(expected), b = Buffer.from(razorpay_signature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return json(400, { error: 'Invalid signature' });

    const r = await markPaid(razorpay_order_id, razorpay_payment_id);
    if (!r.found) return json(404, { error: 'Order not found' });
    return json(200, { ok: true, orderId: razorpay_order_id });
  } catch (e) {
    console.error(e);
    return json(500, { error: 'Verification failed' });
  }
};
