const { getProducts, getSettings, json } = require('./_lib');

// Warm-instance memory cache: repeat calls skip Firestore. If Firestore fails, the last good copy is served.
let cache = { at: 0, body: null };
const TTL = 30 * 1000;

exports.handler = async () => {
  try {
    if (!cache.body || Date.now() - cache.at > TTL) {
      const [list, cfg] = await Promise.all([getProducts(), getSettings()]);
      cache = {
        at: Date.now(),
        body: {
          products: list.map(({ id, name, price, desc, img, imgs, stock }) => ({ id, name, price, desc, img, imgs: Array.isArray(imgs) && imgs.length ? imgs : (img ? [img] : []), stock: typeof stock === 'number' ? stock : null })),
          fee: cfg.shippingFee, freeAbove: cfg.freeAbove,
        },
      };
    }
  } catch (e) {
    console.error(e);
    if (!cache.body) return json(500, { error: 'Could not load products' });
  }
  const res = json(200, cache.body);
  // Netlify's CDN keeps a copy for 60s (then refreshes in the background), so most visits never run this function.
  res.headers['Cache-Control'] = 'public, max-age=0, must-revalidate';
  res.headers['Netlify-CDN-Cache-Control'] = 'public, s-maxage=60, stale-while-revalidate=120';
  return res;
};
