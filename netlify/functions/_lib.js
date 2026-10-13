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

// Shipping settings. Optional Firestore document settings/shop = { shippingFee: 49, freeAbove: 599 }. Falls back to the defaults above.
async function getSettings() {
  try {
    const s = await db.collection('settings').doc('shop').get();
    const d = s.exists ? s.data() : {};
    return { shippingFee: num(d.shippingFee, DEFAULT_FEE), freeAbove: num(d.freeAbove, DEFAULT_FREE_ABOVE) };
  } catch (e) {
    return { shippingFee: DEFAULT_FEE, freeAbove: DEFAULT_FREE_ABOVE };
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

// Prices always come from the database, never from the browser.
async function calc(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('Cart is empty');
  const [plist, cfg] = await Promise.all([getProducts(), getSettings()]);
  const prods = Object.fromEntries(plist.map((p) => [p.id, p]));
  const seen = new Set();
  const lines = items.map((i) => {
    const p = prods[i.id];
    const qty = Number(i.qty);
    if (!p || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY || seen.has(i.id)) throw new Error('Invalid item');
    seen.add(i.id);
    if (typeof p.stock === 'number' && qty > p.stock) throw new Error('Not enough stock');
    return { id: i.id, name: p.name, price: p.price, qty, lineTotal: p.price * qty };
  });
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const shipping = subtotal >= cfg.freeAbove || cfg.shippingFee === 0 ? 0 : cfg.shippingFee;
  return { lines, subtotal, shipping, total: subtotal + shipping };
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
    t.update(ref, { status: 'paid', paymentId, paidAt: admin.firestore.FieldValue.serverTimestamp() });
    psnaps.forEach((ps) => {
      if (!ps.exists) return;
      const st = ps.data().stock;
      if (typeof st !== 'number') return; // no stock tracking for this product
      const sold = (o.items || []).filter((i) => i.id === ps.id).reduce((a, i) => a + i.qty, 0);
      t.update(ps.ref, { stock: Math.max(0, st - sold) });
    });
    return { found: true, already: false };
  });
}

async function requireAdmin(event) {
  const token = (event.headers.authorization || '').replace('Bearer ', '');
  const d = await admin.auth().verifyIdToken(token);
  if (!d.email || d.email.toLowerCase() !== String(process.env.ADMIN_EMAIL || '').trim().toLowerCase()) throw new Error('forbidden');
}

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

module.exports = { admin, db, getProducts, getSettings, calc, markPaid, requireAdmin, json };
