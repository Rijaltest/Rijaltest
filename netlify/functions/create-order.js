const Razorpay = require('razorpay');
const { db, calc, json } = require('./_lib');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const { items, customer, payment, coupon } = JSON.parse(event.body || '{}');
    const c = customer || {};
    if (!c.name || !/^[6-9]\d{9}$/.test(c.phone || '') || !/^\S+@\S+\.\S+$/.test(c.email || '') ||
        !c.address || !c.city || !c.state || !/^\d{6}$/.test(c.pincode || '')) {
      return json(400, { error: 'Please fill all delivery details correctly.' });
    }
    const q = await calc(items, { payment, coupon });

    const rzp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const order = await rzp.orders.create({
      amount: q.payNow * 100, // paise (for Cash on Delivery this is only the delivery charge)
      currency: 'INR',
      receipt: 'RS' + Date.now(),
    });

    await db.collection('orders').doc(order.id).set({
      status: 'pending',
      items: q.lines, subtotal: q.subtotal, discount: q.discount, coupon: q.coupon, shipping: q.shipping, total: q.total,
      codFee: q.codFee, payment: q.payment, paidOnline: q.payNow, dueOnDelivery: q.dueOnDelivery,
      customer: {
        name: String(c.name).slice(0, 100), phone: c.phone, email: c.email,
        address: String(c.address).slice(0, 300), city: String(c.city).slice(0, 80),
        state: String(c.state).slice(0, 80), pincode: c.pincode,
      },
      createdAt: new Date(),
    });

    return json(200, { orderId: order.id, amount: order.amount, keyId: process.env.RAZORPAY_KEY_ID, payment: q.payment, payNow: q.payNow, dueOnDelivery: q.dueOnDelivery, mail: !!(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL) });
  } catch (e) {
    console.error(e);
    if (e.user) return json(400, { error: e.message });
    // Clear messages so you can see what to fix (they only describe setup problems, never secrets)
    let hint = 'Could not start payment. Please try again.';
    const msg = String((e && e.message) || '');
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      hint = 'Payment is not set up yet: the Razorpay keys are missing on the server (Netlify environment variables).';
    } else if (e && (e.statusCode === 401 || (e.error && /authentication/i.test(String(e.error.description || ''))))) {
      hint = 'Razorpay rejected the keys. In Netlify check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET: no spaces, both from the same mode (Test or Live), then deploy again.';
    } else if (e && e.error && e.error.description) {
      hint = 'Razorpay says: ' + String(e.error.description).slice(0, 140);
    } else if (/NOT_FOUND|PERMISSION_DENIED|UNAUTHENTICATED|Could not load the default credentials|private_key/i.test(msg)) {
      hint = 'The database could not be reached. Check that Firestore is created and FIREBASE_SERVICE_ACCOUNT in Netlify is the full key file.';
    }
    return json(400, { error: hint });
  }
};
