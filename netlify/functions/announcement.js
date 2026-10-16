// Site text: public GET (shop reads the announcement bar + trust line) and admin-only POST (admin panel edits them).
const { db, requireAdmin, json, adminMsg } = require('./_lib');
const REF = () => db.collection('site').doc('announcement');
const TREF = () => db.collection('site').doc('trust');
const okLink = (l) => l === '' || /^(https?:\/\/|#|\/)/i.test(l);
// Shown until you save your own list in the admin panel (Videos tab).
const DEFAULT_VIDEOS = [
  { src: 'https://www.instagram.com/reel/DbA-kedz25U/', name: 'Customer review' },
  { src: 'https://www.instagram.com/reel/Dctbj4yp6-W/', name: 'Customer review' },
  { src: 'https://www.instagram.com/reel/DXrQVSHj3Do/', name: 'Customer review' },
  { src: 'https://www.youtube.com/shorts/CTtleSIrjv8', name: 'Customer review' },
  { src: 'https://www.youtube.com/shorts/aZjXCUD0_Ks', name: 'Customer review' },
];
// Popup poster (admin panel, Popup tab). The shop only receives it while it is switched on and inside its dates (India time).
const istDay = (ms) => new Date(ms + 19800000).toISOString().slice(0, 10);
const popupLive = (t) => {
  const p = t.exists ? t.data().popup : null;
  if (!p || !p.enabled || !p.image) return null;
  const today = istDay(Date.now());
  if (p.startsAt && today < p.startsAt) return null;
  if (p.endsAt && today > p.endsAt) return null;
  const { enabled, startsAt, endsAt, ...pub } = p;
  return pub;
};
const videosOf = (t) => (t.exists && Array.isArray(t.data().videos) ? t.data().videos : DEFAULT_VIDEOS);

exports.handler = async (event) => {
  if (event.httpMethod === 'GET') {
    try {
      const [s, t] = await Promise.all([REF().get(), TREF().get()]);
      const d = s.exists ? s.data() : {};
      const messages = Array.isArray(d.messages) ? d.messages : [];
      const res = json(200, {
        active: !!d.active && messages.length > 0, messages, link: d.link || '', linkText: d.linkText || '',
        trustLine: t.exists ? String(t.data().line || '') : '',
        ticker: t.exists && Array.isArray(t.data().ticker) ? t.data().ticker : [],
        videos: videosOf(t),
        popup: popupLive(t),
      });
      res.headers['Cache-Control'] = 'public, max-age=0, must-revalidate';
      res.headers['Netlify-CDN-Cache-Control'] = 'public, s-maxage=30, stale-while-revalidate=60';
      return res;
    } catch (e) { console.error(e); return json(200, { active: false, messages: [], trustLine: '' }); }
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try { await requireAdmin(event); } catch (e) { return json(403, { error: adminMsg(e) }); }
  try {
    const b = JSON.parse(event.body || '{}');
    if (b.action === 'get') {
      const [s, t] = await Promise.all([REF().get(), TREF().get()]);
      const d = s.exists ? s.data() : {};
      return json(200, { active: !!d.active, messages: d.messages || [], link: d.link || '', linkText: d.linkText || '', trustLine: t.exists ? String(t.data().line || '') : '', ticker: t.exists && Array.isArray(t.data().ticker) ? t.data().ticker : [], videos: videosOf(t), popup: t.exists && t.data().popup ? t.data().popup : null });
    }
    if (b.action === 'save') {
      const messages = (Array.isArray(b.messages) ? b.messages : []).map((m) => String(m).trim().slice(0, 160)).filter(Boolean).slice(0, 5);
      const link = String(b.link || '').trim().slice(0, 300);
      if (!okLink(link)) return json(400, { error: 'Link must start with https://, http://, # or /' });
      await REF().set({ active: !!b.active, messages, link, linkText: String(b.linkText || '').trim().slice(0, 30), updatedAt: Date.now() });
      return json(200, { ok: true });
    }
    if (b.action === 'saveTrust') {
      await TREF().set({ line: String(b.line || '').trim().slice(0, 200), updatedAt: Date.now() }, { merge: true });
      return json(200, { ok: true });
    }
    if (b.action === 'saveTicker') {
      const ticker = (Array.isArray(b.ticker) ? b.ticker : []).map((m) => String(m).trim().slice(0, 90)).filter(Boolean).slice(0, 10);
      await TREF().set({ ticker, updatedAt: Date.now() }, { merge: true });
      return json(200, { ok: true });
    }
    if (b.action === 'saveVideos') {
      const https = (u) => /^https:\/\/[^\s"'<>]+$/i.test(u);
      const videos = [];
      for (const v of (Array.isArray(b.videos) ? b.videos : []).slice(0, 20)) {
        const src = String((v && v.src) || '').trim().slice(0, 400);
        if (!src) continue;
        if (!https(src)) return json(400, { error: 'Every video link must start with https://' });
        const poster = String((v && v.poster) || '').trim().slice(0, 400);
        if (poster && !https(poster)) return json(400, { error: 'The cover picture link must start with https://' });
        videos.push({ src, name: String((v && v.name) || '').trim().slice(0, 40), poster });
      }
      await TREF().set({ videos, updatedAt: Date.now() }, { merge: true });
      return json(200, { ok: true });
    }
    if (b.action === 'savePopup') {
      const P = b.popup || {};
      const https = (u) => /^https:\/\/[^\s"'<>]+$/i.test(u);
      const day = (d) => (d === '' || d === undefined || d === null ? '' : /^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? String(d) : null);
      const enabled = !!P.enabled, image = String(P.image || '').trim().slice(0, 500);
      if (enabled && !https(image)) return json(400, { error: 'The poster picture link must start with https://' });
      if (image && !https(image)) return json(400, { error: 'The poster picture link must start with https://' });
      const action = ['none', 'products', 'combos', 'product', 'link'].includes(P.action) ? P.action : 'none';
      const productId = String(P.productId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
      const link = String(P.link || '').trim().slice(0, 300);
      if (action === 'product' && !productId) return json(400, { error: 'Choose the product the poster should open' });
      if (action === 'link' && !(https(link) || /^(#|\/)/.test(link))) return json(400, { error: 'The link must start with https://, # or /' });
      const startsAt = day(P.startsAt), endsAt = day(P.endsAt);
      if (startsAt === null || endsAt === null) return json(400, { error: 'Bad date' });
      if (startsAt && endsAt && endsAt < startsAt) return json(400, { error: 'The end date is before the start date' });
      const frequency = ['session', 'day', 'always'].includes(P.frequency) ? P.frequency : 'session';
      await TREF().set({ popup: { enabled, image, title: String(P.title || '').trim().slice(0, 60), action, productId, link: action === 'link' ? link : '', buttonText: String(P.buttonText || '').trim().slice(0, 30), startsAt, endsAt, frequency, version: Date.now() }, updatedAt: Date.now() }, { merge: true });
      return json(200, { ok: true });
    }
    return json(400, { error: 'Unknown action' });
  } catch (e) { console.error(e); return json(500, { error: 'Server error' }); }
};
