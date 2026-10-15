const { admin, db, getProducts, getSettings, requireAdmin, json, adminMsg } = require('./_lib');
const STATUSES = ['pending', 'paid', 'packed', 'dispatched', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'];
const whole = (v, label) => { const n = v === '' || v === null || v === undefined ? 0 : Number(v); if (!Number.isInteger(n) || n < 0) throw Object.assign(new Error(label + ' must be a whole number (0 or more)'), { user: true }); return n; };
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try { await requireAdmin(event); } catch (e) { return json(403, { error: adminMsg(e) }); }
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
        const rating = b.rating === '' || b.rating === null || b.rating === undefined ? 0 : Math.round(Number(b.rating) * 10) / 10;
        if (!Number.isFinite(rating) || rating < 0 || rating > 5) return json(400, { error: 'Rating must be between 0 and 5 (for example 4.4), or empty to hide it' });
        const ratingCount = whole(b.ratingCount, 'Number of ratings'), mrp = whole(b.mrp, 'MRP');
        const id = b.id || slug(b.name) || 'p' + Date.now();
        await db.collection('products').doc(id).set({
          name: String(b.name).slice(0, 80), price, desc: String(b.desc || '').slice(0, 400),
          img: imgs[0] || String(b.img || '').slice(0, 500), imgs, stock,
          size: String(b.size || '').trim().slice(0, 30), bought: String(b.bought || '').trim().slice(0, 60),
          badge: String(b.badge || '').trim().slice(0, 40), choice: String(b.choice || '').trim().slice(0, 30),
          rating, ratingCount, mrp,
          active: b.active !== false, order: Number(b.order) || 50,
        }, { merge: true });
        return json(200, { ok: true, id });
      }
      case 'deleteProduct':
        if (!b.id) return json(400, { error: 'Missing id' });
        await db.collection('products').doc(b.id).delete();
        return json(200, { ok: true });
      // ---- checkout settings: Cash on delivery options + normal delivery charge ----
      case 'getShop': return json(200, await getSettings());
      case 'saveShop': {
        const codDeliveryFee = whole(b.codDeliveryFee, 'Delivery charge for COD'), codExtraFee = whole(b.codExtraFee, 'Extra COD fee');
        if (codDeliveryFee < 1 || codExtraFee < 1) return json(400, { error: 'COD amounts must be at least 1 rupee' });
        await db.collection('settings').doc('shop').set({
          codDeliveryEnabled: !!b.codDeliveryEnabled, codDeliveryFee,
          codExtraEnabled: !!b.codExtraEnabled, codExtraFee,
          shippingFee: whole(b.shippingFee, 'Delivery charge'), freeAbove: whole(b.freeAbove, 'Free delivery above'),
        }, { merge: true });
        return json(200, { ok: true });
      }
      // ---- coupons ----
      case 'coupons': {
        const snap = await db.collection('coupons').get();
        return json(200, snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((x, y) => String(x.id).localeCompare(String(y.id))));
      }
      case 'saveCoupon': {
        const code = String(b.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30);
        if (code.length < 3) return json(400, { error: 'The code needs 3 to 30 letters or numbers' });
        const type = b.type === 'flat' ? 'flat' : 'percent';
        const value = Number(b.value);
        if (!Number.isFinite(value) || value <= 0) return json(400, { error: 'Enter the discount (a number above 0)' });
        if (type === 'percent' && value > 100) return json(400, { error: 'A percent discount cannot be above 100' });
        if (type === 'flat' && !Number.isInteger(value)) return json(400, { error: 'A flat discount must be a whole number of rupees' });
        const maxDiscount = type === 'percent' ? whole(b.maxDiscount, 'Maximum discount') : 0;
        const minSubtotal = whole(b.minSubtotal, 'Minimum order'), maxUses = whole(b.maxUses, 'Uses allowed');
        const expiresAt = b.expiresAt ? Number(b.expiresAt) : null;
        if (expiresAt !== null && !Number.isFinite(expiresAt)) return json(400, { error: 'Bad expiry date' });
        const ref = db.collection('coupons').doc(code), old = await ref.get();
        await ref.set({ type, value, maxDiscount, minSubtotal, maxUses, expiresAt, active: b.active !== false, used: old.exists ? (old.data().used || 0) : 0, updatedAt: Date.now() });
        return json(200, { ok: true, code });
      }
      case 'deleteCoupon': {
        const id = String(b.id || '').replace(/[^A-Z0-9_-]/g, '');
        if (!id) return json(400, { error: 'Missing code' });
        await db.collection('coupons').doc(id).delete();
        return json(200, { ok: true });
      }
      default: return json(400, { error: 'Unknown action' });
    }
  } catch (e) { if (e && e.user) return json(400, { error: e.message }); console.error(e); return json(500, { error: 'Server error' }); }
};
