const Razorpay = require('razorpay');
const { db, calc, json } = require('./_lib');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const { items, customer } = JSON.parse(event.body || '{}');
    const c = customer || {};
    if (!c.name || !/^[6-9]\d{9}$/.test(c.phone || '') || !/^\S+@\S+\.\S+$/.test(c.email || '') ||
        !c.address || !c.city || !c.state || !/^\d{6}$/.test(c.pincode || '')) {
      return json(400, { error: 'Please fill all delivery details correctly.' });
    }
    const { lines, subtotal, shipping, total } = await calc(items);

    const rzp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const order = await rzp.orders.create({
      amount: total * 100, // paise
      currency: 'INR',
      receipt: 'RS' + Date.now(),
    });

    await db.collection('orders').doc(order.id).set({
      status: 'pending',
      items: lines, subtotal, shipping, total,
      customer: {
        name: String(c.name).slice(0, 100), phone: c.phone, email: c.email,
        address: String(c.address).slice(0, 300), city: String(c.city).slice(0, 80),
        state: String(c.state).slice(0, 80), pincode: c.pincode,
      },
      createdAt: new Date(),
    });

    return json(200, { orderId: order.id, amount: order.amount, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (e) {
    console.error(e);
    return json(400, { error: ['Invalid item', 'Cart is empty', 'Not enough stock'].includes(e.message) ? e.message : 'Could not start payment. Please try again.' });
  }
};
