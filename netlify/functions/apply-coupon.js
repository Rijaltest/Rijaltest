const { calc, getCoupon, couponDiscount, json } = require('./_lib');

// Checks a coupon code against the cart (the customer clicks "Apply").
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const { code, items } = JSON.parse(event.body || '{}');
    const base = await calc(items); // subtotal from the real prices
    const c = await getCoupon(code);
    const r = couponDiscount(c, base.subtotal);
    if (!r.ok) return json(200, { ok: false, message: r.message });
    return json(200, {
      ok: true, code: c.id, type: c.type === 'flat' ? 'flat' : 'percent', value: Number(c.value),
      minSubtotal: Number(c.minSubtotal || 0), maxDiscount: Number(c.maxDiscount || 0), discount: r.discount,
    });
  } catch (e) {
    console.error(e);
    return json(200, { ok: false, message: e.user ? e.message : 'Could not check the code. Please try again.' });
  }
};
