const { admin, db, getProducts, requireAdmin, json } = require('./_lib');
const STATUSES = ['pending', 'paid', 'packed', 'dispatched', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'];
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try { await requireAdmin(event); } catch (e) { return json(403, { error: 'Not allowed' }); }
  try {
    const b = JSON.parse(event.body || '{}');
    switch (b.action) {
      case 'orders': {
        const snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(300).get();
        return json(200, snap.docs.map((d) => {
          const o = d.data();
          return { id: d.id, ...o, createdAt: o.createdAt && o.createdAt.toMillis ? o.createdAt.toMillis() : null, paidAt: o.paidAt && o.paidAt.toMillis ? o.paidAt.toMillis() : null };
        }));
      }
      case 'setStatus': {
        if (!STATUSES.includes(b.status) || !b.id) return json(400, { error: 'Bad status' });
        const note = String(b.note || '').slice(0, 300);
        await db.collection('orders').doc(b.id).update({
          status: b.status, note, statusUpdatedAt: Date.now(),
          history: admin.firestore.FieldValue.arrayUnion({ status: b.status, note, at: Date.now() }),
        });
        return json(200, { ok: true });
      }
      case 'products': return json(200, await getProducts(true));
      case 'saveProduct': {
        const price = Number(b.price);
        if (!b.name || !Number.isInteger(price) || price < 1) return json(400, { error: 'Name and a whole-number price are required' });
        const imgs = (Array.isArray(b.imgs) ? b.imgs : String(b.imgs || '').split('\n')).map((x) => String(x).trim().slice(0, 500)).filter(Boolean).slice(0, 6);
        const stock = b.stock === '' || b.stock === null || b.stock === undefined ? null : Number(b.stock);
        if (stock !== null && (!Number.isInteger(stock) || stock < 0)) return json(400, { error: 'Stock must be a whole number, or empty for unlimited' });
        const id = b.id || slug(b.name) || 'p' + Date.now();
        await db.collection('products').doc(id).set({
          name: String(b.name).slice(0, 80), price, desc: String(b.desc || '').slice(0, 400),
          img: imgs[0] || String(b.img || '').slice(0, 500), imgs, stock,
          active: b.active !== false, order: Number(b.order) || 50,
        }, { merge: true });
        return json(200, { ok: true, id });
      }
      case 'deleteProduct':
        if (!b.id) return json(400, { error: 'Missing id' });
        await db.collection('products').doc(b.id).delete();
        return json(200, { ok: true });
      default: return json(400, { error: 'Unknown action' });
    }
  } catch (e) { console.error(e); return json(500, { error: 'Server error' }); }
};
