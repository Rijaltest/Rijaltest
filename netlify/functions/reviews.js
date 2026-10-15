// Customer reviews with approval: public GET (approved reviews) + public POST submit (goes to "pending") + admin-only actions.
const { db, requireAdmin, json, adminMsg } = require('./_lib');
const COL = () => db.collection('reviews');
const clean = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);

exports.handler = async (event) => {
  if (event.httpMethod === 'GET') {
    try {
      const s = await COL().where('status', '==', 'approved').get();
      const reviews = s.docs.map((d) => d.data()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 50)
        .map((r) => ({ name: r.name, city: r.city || '', text: r.text, stars: r.stars || 0, product: r.product || '' }));
      const res = json(200, { reviews });
      res.headers['Cache-Control'] = 'public, max-age=0, must-revalidate';
      res.headers['Netlify-CDN-Cache-Control'] = 'public, s-maxage=60, stale-while-revalidate=120';
      return res;
    } catch (e) { console.error(e); return json(200, { reviews: [] }); }
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  let b;
  try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad request' }); }

  // ---- public: a visitor shares a review (saved as "pending", never shown until you allow it) ----
  if (b.action === 'submit') {
    try {
      if (b.website) return json(200, { ok: true }); // hidden spam-trap field was filled: pretend it worked
      const name = clean(b.name, 60), city = clean(b.city, 60), text = clean(b.text, 600), stars = Number(b.stars);
      const phone = String(b.phone || '').replace(/\D/g, '').slice(-10); // used only to check the review against your order records, never shown on the website
      if (name.length < 2 || city.length < 2 || !/^[6-9]\d{9}$/.test(phone) || text.length < 10) return json(400, { error: 'Please enter your name, city, a 10-digit mobile number and a review of at least 10 characters.' });
      const pending = await COL().where('status', '==', 'pending').get();
      if (pending.size >= 100) return json(429, { error: 'Too many reviews are waiting right now. Please try again later.' });
      await COL().add({ name, city, phone, text, stars: Number.isInteger(stars) && stars >= 1 && stars <= 5 ? stars : 0, product: clean(b.product, 40), status: 'pending', createdAt: Date.now() });
      return json(200, { ok: true });
    } catch (e) { console.error(e); return json(500, { error: 'Could not save your review. Please try again.' }); }
  }

  // ---- admin only ----
  try { await requireAdmin(event); } catch (e) { return json(403, { error: adminMsg(e) }); }
  try {
    if (b.action === 'list') {
      const s = await COL().orderBy('createdAt', 'desc').limit(200).get();
      return json(200, { reviews: s.docs.map((d) => ({ id: d.id, ...d.data() })) });
    }
    if (b.action === 'setStatus') {
      if (!b.id || !['approved', 'denied', 'pending'].includes(b.status)) return json(400, { error: 'Bad request' });
      await COL().doc(String(b.id)).update({ status: b.status, reviewedAt: Date.now() });
      return json(200, { ok: true });
    }
    if (b.action === 'delete') {
      if (!b.id) return json(400, { error: 'Bad request' });
      await COL().doc(String(b.id)).delete();
      return json(200, { ok: true });
    }
    return json(400, { error: 'Unknown action' });
  } catch (e) { console.error(e); return json(500, { error: 'Server error' }); }
};
