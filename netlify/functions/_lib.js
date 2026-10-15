const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}
const db = admin.firestore();

const DEFAULT_FREE_ABOVE = 599; // free shipping from this subtotal (change in Firestore: settings > shop, or here)
const DEFAULT_FEE = 49;         // flat shipping fee below that
const MAX_QTY = 10000;          // practically unlimited; stock (if you set it in the admin panel) is the real limit
const DEFAULTS = {
  'hair-oil':  { name: 'Rijal Hair Oil',  price: 399, order: 1, active: true, img: '', desc: 'A light daily hair oil for a healthy shine and a smooth, manageable finish.' },
  'comb':      { name: 'Rijal Comb',      price: 199, order: 2, active: true, img: '', desc: 'A sturdy, smooth-toothed comb that glides through hair and beard without snagging.' },
  'beard-oil': { name: 'Rijal Beard Oil', price: 349, order: 3, active: true, img: '', desc: 'Softens and conditions your beard, leaving it neat, soft and lightly scented.' },
};

const num = (v, d) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

// Shop settings. Optional Firestore document settings/shop. You normally change these from the admin panel ("Checkout" tab):
//   codDeliveryEnabled/codDeliveryFee : Cash on delivery where the customer pays the delivery charge now
//   codExtraEnabled/codExtraFee       : Cash on delivery where the customer pays an extra COD fee now (on top of the order value)
//   shippingFee/freeAbove             : normal delivery charge used by the "extra COD fee" option (prepaid orders always ship free)
async function getSettings() {
  const fallback = { shippingFee: DEFAULT_FEE, freeAbove: DEFAULT_FREE_ABOVE, codDelivery: { enabled: true, fee: 80 }, codExtra: { enabled: false, fee: 50 } };
  try {
    const s = await db.collection('settings').doc('shop').get();
    const d = s.exists ? s.data() : {};
    return {
      shippingFee: num(d.shippingFee, DEFAULT_FEE),
      freeAbove: num(d.freeAbove, DEFAULT_FREE_ABOVE),
      codDelivery: { enabled: d.codDeliveryEnabled === undefined ? true : !!d.codDeliveryEnabled, fee: num(d.codDeliveryFee, 80) },
      codExtra: { enabled: !!d.codExtraEnabled, fee: num(d.codExtraFee, 50) },
    };
  } catch (e) {
    return fallback;
  }
}

// Products live in Firestore (edited from the admin panel). First run seeds the 3 defaults.
async function getProducts(all) {
  const col = db.collection('products');
  let snap = await col.get();
  if (snap.empty) {
    const b = db.batch();
    Object.entries(DEFAULTS).forEach(([id, p]) => b.set(col.doc(id), p));
    await b.commit();
    snap = await col.get();
  }
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (!all) list = list.filter((p) => p.active !== false);
  return list.sort((a, b) => (a.order || 99) - (b.order || 99));
}

// ---- COD + coupons ----
const bad = (m) => Object.assign(new Error(m), { user: true }); // errors the customer may read

async function getCoupon(code) {
  const id = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30);
  if (!id) return null;
  const s = await db.collection('coupons').doc(id).get();
  return s.exists ? { id, ...s.data() } : null;
}

function couponDiscount(c, subtotal) {
  if (!c || c.active === false) return { ok: false, message: 'This code is not valid' };
  if (c.expiresAt && Date.now() > Number(c.expiresAt)) return { ok: false, message: 'This code has expired' };
  if (c.maxUses && (c.used || 0) >= c.maxUses) return { ok: false, message: 'This code has been fully used' };
  if (c.minSubtotal && subtotal < c.minSubtotal) return { ok: false, message: 'Add items worth Rs ' + c.minSubtotal + ' or more to use this code' };
  let d = c.type === 'flat' ? Number(c.value) : Math.floor((subtotal * Number(c.value)) / 100);
  if (c.maxDiscount) d = Math.min(d, Number(c.maxDiscount));
  d = Math.max(0, Math.min(d, subtotal));
  return d > 0 ? { ok: true, discount: d } : { ok: false, message: 'This code gives no discount on your cart' };
}

// Prices always come from the database, never from the browser.
// opts: { payment: 'online' | 'cod_delivery' | 'cod_extra', coupon: 'CODE' }
//   online        : shipping is always free, customer pays everything now
//   cod_delivery  : customer pays the delivery charge now; the order value is paid on delivery
//   cod_extra     : customer pays an extra COD fee now; the order value + normal delivery charge are paid on delivery
async function calc(items, opts = {}) {
  if (!Array.isArray(items) || !items.length) throw bad('Cart is empty');
  const [plist, cfg] = await Promise.all([getProducts(), getSettings()]);
  const prods = Object.fromEntries(plist.map((p) => [p.id, p]));
  const seen = new Set();
  const lines = items.map((i) => {
    const p = prods[i.id];
    const qty = Number(i.qty);
    if (!p || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY || seen.has(i.id)) throw bad('Invalid item');
    seen.add(i.id);
    if (typeof p.stock === 'number' && qty > p.stock) throw bad('Not enough stock');
    return { id: i.id, name: p.name, price: p.price, qty, lineTotal: p.price * qty };
  });
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  const mode = opts.payment === 'cod' ? 'cod_delivery' : (opts.payment || 'online');
  if (!['online', 'cod_delivery', 'cod_extra'].includes(mode)) throw bad('Please choose how you want to pay');
  if (mode === 'cod_delivery' && !cfg.codDelivery.enabled) throw bad('This payment option is not available right now');
  if (mode === 'cod_extra' && !cfg.codExtra.enabled) throw bad('This payment option is not available right now');

  let discount = 0, coupon = null;
  if (opts.coupon) {
    const c = await getCoupon(opts.coupon);
    const r = couponDiscount(c, subtotal);
    if (!r.ok) throw bad(r.message);
    discount = r.discount;
    coupon = { code: c.id, discount };
  }

  let shipping = 0, codFee = 0;
  if (mode === 'cod_delivery') shipping = cfg.codDelivery.fee;
  if (mode === 'cod_extra') {
    shipping = subtotal >= cfg.freeAbove || cfg.shippingFee === 0 ? 0 : cfg.shippingFee;
    codFee = cfg.codExtra.fee;
  }
  const total = subtotal - discount + shipping + codFee;
  const payNow = mode === 'cod_delivery' ? shipping : mode === 'cod_extra' ? codFee : total; // what Razorpay charges now
  if (payNow < 1) throw bad('Order total is too low');
  return { lines, subtotal, discount, coupon, shipping, codFee, total, payNow, dueOnDelivery: total - payNow, payment: mode };
}

// Only moves pending -> paid (so a late/duplicate webhook can never undo "dispatched" etc.) and reduces stock once.
async function markPaid(orderId, paymentId) {
  const ref = db.collection('orders').doc(orderId);
  return db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) return { found: false };
    const o = snap.data();
    if (o.status !== 'pending') return { found: true, already: true };
    const ids = [...new Set((o.items || []).map((i) => i.id))];
    const psnaps = await Promise.all(ids.map((id) => t.get(db.collection('products').doc(id))));
    const cp = o.coupon && o.coupon.code ? await t.get(db.collection('coupons').doc(o.coupon.code)) : null;
    t.update(ref, { status: 'paid', paymentId, paidAt: admin.firestore.FieldValue.serverTimestamp() });
    if (cp && cp.exists) t.update(cp.ref, { used: (cp.data().used || 0) + 1 });
    psnaps.forEach((ps) => {
      if (!ps.exists) return;
      const st = ps.data().stock;
      if (typeof st !== 'number') return; // no stock tracking for this product
      const sold = (o.items || []).filter((i) => i.id === ps.id).reduce((a, i) => a + i.qty, 0);
      t.update(ps.ref, { stock: Math.max(0, st - sold) });
    });
    return { found: true, already: false, order: o };
  });
}

async function requireAdmin(event) {
  const owner = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!owner) {
    const e = new Error('no_admin_email');
    e.reason = 'ADMIN_EMAIL is not set in Netlify (Site configuration > Environment variables). Add it, then deploy again.';
    throw e;
  }
  const token = String(event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer /i, '');
  let d;
  try { d = await admin.auth().verifyIdToken(token); } catch (err) {
    const e = new Error('bad_token');
    e.reason = 'The server could not verify your login. The Firebase key in Netlify (FIREBASE_SERVICE_ACCOUNT) must come from the same Firebase project as the details in admin.html.';
    throw e;
  }
  const mail = String(d.email || '').toLowerCase();
  if (mail !== owner) {
    const e = new Error('not_owner');
    e.reason = 'You are logged in as ' + mail + ', but ADMIN_EMAIL in Netlify is a different address. Set ADMIN_EMAIL to exactly ' + mail + ' and deploy again.';
    throw e;
  }
}
const adminMsg = (e) => (e && e.reason) || 'Not allowed';

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

module.exports = { admin, db, getProducts, getSettings, getCoupon, couponDiscount, calc, markPaid, requireAdmin, adminMsg, json };
