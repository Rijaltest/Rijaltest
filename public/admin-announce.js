// Adds two tabs to admin.html: "Site text" (announcement bar + trust line) and "Reviews" (allow / deny customer reviews).
// Install: add  <script src="admin-announce.js"></script>  just before </body> in admin.html.
(function () {
  if (typeof auth === 'undefined') return;
  const bar = document.querySelector('#app .bar'), app = document.querySelector('#app');
  if (!bar || !app) return;
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const st = document.createElement('style');
  st.textContent = '#annPanel label{display:block;font-weight:600;font-size:.88rem;margin:12px 0 4px}#annPanel input[type=text],#annPanel textarea{width:100%;padding:11px;border:1px solid #bfcac3;border-radius:10px;font:inherit}#annPanel .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}#annPanel h3{font-size:1.1rem;margin-bottom:4px}#coPanel label,#cpPanel label{display:block;font-weight:600;font-size:.88rem;margin:12px 0 4px}#coPanel input[type=text],#cpPanel input[type=text]{width:100%;padding:11px;border:1px solid #bfcac3;border-radius:10px;font:inherit}#coPanel .two,#cpPanel .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}#coPanel h3,#cpPanel h3{font-size:1.1rem;margin-bottom:4px}.co-opt{border:1px solid #e3e8e2;border-radius:12px;padding:12px;margin-top:12px}.co-opt .co-t{display:flex;gap:8px;align-items:center;font-weight:700;margin:0}.cpl{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.cpl .btn{padding:8px 16px;font-size:.9rem}@media(max-width:600px){#coPanel .two,#cpPanel .two{grid-template-columns:1fr}}.vdr{border:1px solid #e3e8e2;border-radius:12px;padding:12px;margin-bottom:10px}.vdr input{width:100%;padding:10px;border:1px solid #bfcac3;border-radius:10px;font:inherit;margin-top:6px}.vdr .two{display:grid;grid-template-columns:2fr 1fr;gap:10px}@media(max-width:600px){.vdr .two{grid-template-columns:1fr}}.rvb{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.rvb .btn{padding:8px 16px;font-size:.9rem}.rvt{white-space:pre-wrap;margin:8px 0}@media(max-width:600px){#annPanel .two{grid-template-columns:1fr}}';
  document.head.appendChild(st);

  const tab = document.createElement('button'); tab.className = 'tab'; tab.textContent = 'Site text';
  const revTab = document.createElement('button'); revTab.className = 'tab'; revTab.textContent = 'Reviews';
  const coTab = document.createElement('button'); coTab.className = 'tab'; coTab.textContent = 'Checkout';
  const cpTab = document.createElement('button'); cpTab.className = 'tab'; cpTab.textContent = 'Coupons';
  const vdTab = document.createElement('button'); vdTab.className = 'tab'; vdTab.textContent = 'Videos';
  [tab, revTab, coTab, cpTab, vdTab].forEach((b) => bar.insertBefore(b, $('#refresh')));

  const panel = document.createElement('div'); panel.id = 'annPanel'; panel.className = 'hide';
  panel.innerHTML =
    '<div class="pc"><h3>Announcement bar</h3><p class="sub" style="margin:0">The bar at the very top of your shop. One message per line (up to 5); more than one will rotate. Changes appear within about a minute.</p>' +
    '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="an-on" style="width:auto"> Show the announcement bar</label>' +
    '<label>Messages (one per line)</label><textarea id="an-text" rows="4" placeholder="Free shipping on orders above ₹599&#10;New: Rijal Combo is live"></textarea>' +
    '<div class="two"><div><label>Link text (optional)</label><input type="text" id="an-ltxt" placeholder="Shop now" maxlength="30"></div>' +
    '<div><label>Link (optional)</label><input type="text" id="an-link" placeholder="#products or https://..."></div></div>' +
    '<div class="err" id="an-err" role="alert"></div>' +
    '<div style="display:flex;gap:12px;align-items:center;margin-top:10px"><button class="btn" id="an-save">Save announcement</button><span class="note" id="an-ok"></span></div></div>' +
    '<div class="pc"><h3>Trust line</h3><p class="sub" style="margin:0">The line shown above the India map in "Trusted across India". Only write numbers you can back up.</p>' +
    '<label>Line</label><input type="text" id="tr-line" maxlength="200" placeholder="Pleased to have served more than 5000 happy customers so far">' +
    '<div class="err" id="tr-err" role="alert"></div>' +
    '<div style="display:flex;gap:12px;align-items:center;margin-top:10px"><button class="btn" id="tr-save">Save trust line</button><span class="note" id="tr-ok"></span></div></div>' +
    '<div class="pc"><h3>Scrolling tagline (above the products)</h3><p class="sub" style="margin:0">The moving line of highlights above your products. One phrase per line (up to 10). Leave it empty to use the standard lines.</p>' +
    '<label>Phrases (one per line)</label><textarea id="tk-text" rows="5" placeholder="Inspired by Sunnah, backed by science&#10;Free shipping on orders above ₹599&#10;Delivered across India"></textarea>' +
    '<div class="err" id="tk-err" role="alert"></div>' +
    '<div style="display:flex;gap:12px;align-items:center;margin-top:10px"><button class="btn" id="tk-save">Save tagline</button><span class="note" id="tk-ok"></span></div></div>';
  const revPanel = document.createElement('div'); revPanel.id = 'revPanel'; revPanel.className = 'hide';
  revPanel.innerHTML = '<p class="sub">Reviews that visitors send from your shop. Only reviews you <b>Allow</b> appear on the website. New ones wait here as Pending.</p><div class="err" id="rv-err" role="alert"></div><div id="rv-list"></div>';
  const coPanel = document.createElement('div'); coPanel.id = 'coPanel'; coPanel.className = 'hide';
  coPanel.innerHTML =
    '<div class="pc"><h3>Payment options at checkout</h3><p class="sub" style="margin:0">Prepaid orders (UPI, card, netbanking) <b>always get free shipping</b>. Choose which Cash on Delivery options customers can use, and the amount they pay online now. Changes appear within about a minute.</p>' +
    '<div class="co-opt"><label class="co-t"><input type="checkbox" id="co-d-on" style="width:auto"> Cash on delivery: customer pays the delivery charge now</label>' +
    '<p class="note">The customer pays this amount online now. It is the whole delivery charge. The order value is paid in cash on delivery.</p>' +
    '<label>Amount paid now (₹)</label><input type="text" id="co-d-fee" inputmode="numeric"></div>' +
    '<div class="co-opt"><label class="co-t"><input type="checkbox" id="co-e-on" style="width:auto"> Cash on delivery: customer pays an extra COD fee now</label>' +
    '<p class="note">The customer pays this extra fee online now, on top of the order value. The order value and the normal delivery charge (below) are paid in cash on delivery.</p>' +
    '<label>Extra COD fee paid now (₹)</label><input type="text" id="co-e-fee" inputmode="numeric">' +
    '<div class="two"><div><label>Normal delivery charge (₹)</label><input type="text" id="co-ship" inputmode="numeric"></div><div><label>Delivery is free from an order value of (₹)</label><input type="text" id="co-free" inputmode="numeric"></div></div>' +
    '<p class="note">These two apply only to this extra-fee option. Put 0 as the delivery charge for always free.</p></div>' +
    '<div class="err" id="co-err" role="alert"></div><div style="display:flex;gap:12px;align-items:center;margin-top:12px"><button class="btn" id="co-save">Save checkout settings</button><span class="note" id="co-ok"></span></div></div>';
  const cpPanel = document.createElement('div'); cpPanel.id = 'cpPanel'; cpPanel.className = 'hide';
  cpPanel.innerHTML =
    '<div class="pc"><h3 id="cp-title">New coupon</h3>' +
    '<div class="two"><div><label>Code (letters and numbers)</label><input type="text" id="cp-code" maxlength="30" placeholder="SAVE20" style="text-transform:uppercase"></div>' +
    '<div><label>Type</label><select id="cp-type" style="width:100%;padding:11px;border:1px solid #bfcac3;border-radius:10px;font:inherit"><option value="percent">Percent off (can have a maximum)</option><option value="flat">Flat amount off</option></select></div></div>' +
    '<div class="two"><div><label id="cp-vl">Percent off (%)</label><input type="text" id="cp-val" inputmode="numeric" placeholder="20"></div>' +
    '<div id="cp-capbox"><label>Maximum discount (₹), empty = no cap</label><input type="text" id="cp-cap" inputmode="numeric" placeholder="200"></div></div>' +
    '<div class="two"><div><label>Minimum order value (₹), optional</label><input type="text" id="cp-min" inputmode="numeric"></div>' +
    '<div><label>Times it can be used, empty = unlimited</label><input type="text" id="cp-uses" inputmode="numeric"></div></div>' +
    '<div class="two"><div><label>Expires on (optional)</label><input type="date" id="cp-exp" style="width:100%;padding:10px;border:1px solid #bfcac3;border-radius:10px;font:inherit"></div>' +
    '<div><label style="display:flex;gap:8px;align-items:center;margin-top:34px"><input type="checkbox" id="cp-on" checked style="width:auto"> Active (customers can use it)</label></div></div>' +
    '<p class="note" id="cp-prev"></p><div class="err" id="cp-err" role="alert"></div>' +
    '<div style="display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap"><button class="btn" id="cp-save">Save coupon</button><button class="btn ghost" id="cp-new" style="display:none">Cancel editing</button><span class="note" id="cp-ok"></span></div></div>' +
    '<h3 style="margin:18px 0 8px">Your coupons</h3><div id="cp-list"></div>';
  app.insertBefore(panel, $('#gerr')); app.insertBefore(revPanel, $('#gerr')); const vdPanel = document.createElement('div'); vdPanel.id = 'vdPanel'; vdPanel.className = 'hide';
  vdPanel.innerHTML = '<div class="pc"><h3>Review videos</h3><p class="sub" style="margin:0">The videos in the sliding "Loved by our customers" row. Paste an <b>Instagram reel</b> link, a <b>YouTube or YouTube Shorts</b> link, or a direct video link (.mp4 or Cloudinary). Customers tap a card to watch it. Instagram gives no cover picture, so you can paste your own cover picture link (optional). Changes appear within about a minute.</p>' +
    '<div id="vd-rows"></div><button class="btn ghost" id="vd-add" style="margin-top:6px">+ Add a video</button>' +
    '<div class="err" id="vd-err" role="alert"></div><div style="display:flex;gap:12px;align-items:center;margin-top:12px"><button class="btn" id="vd-save">Save videos</button><span class="note" id="vd-ok"></span></div></div>';
  app.insertBefore(coPanel, $('#gerr')); app.insertBefore(cpPanel, $('#gerr')); app.insertBefore(vdPanel, $('#gerr'));

  async function post(url, body) {
    const t = await auth.currentUser.getIdToken();
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || (r.status === 403 ? 'This login is not the shop owner account.' : 'Something went wrong'));
    return j;
  }
  const call = (b) => post('/.netlify/functions/announcement', b);
  const rcall = (b) => post('/.netlify/functions/reviews', b);

  const tabs = { ann: [tab, panel], rev: [revTab, revPanel], co: [coTab, coPanel], cp: [cpTab, cpPanel], vd: [vdTab, vdPanel] };
  function show(which) {
    Object.entries(tabs).forEach(([k, [t, p]]) => { t.classList.toggle('on', k === which); p.classList.toggle('hide', k !== which); });
    ['#orders', '#products'].forEach((s) => { const e = $(s); if (e) e.classList.add('hide'); });
    ({ ann: load, rev: loadRev, co: loadCo, cp: loadCp, vd: loadVd })[which]();
  }
  Object.entries(tabs).forEach(([k, [t]]) => { t.onclick = () => show(k); });
  document.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { Object.values(tabs).forEach(([t, p]) => { t.classList.remove('on'); p.classList.add('hide'); }); }));

  async function load() {
    ['#an-err', '#an-ok', '#tr-err', '#tr-ok', '#tk-err', '#tk-ok'].forEach((s) => { $(s).textContent = ''; });
    try {
      const a = await call({ action: 'get' });
      $('#an-on').checked = !!a.active; $('#an-text').value = (a.messages || []).join('\n');
      $('#an-ltxt').value = a.linkText || ''; $('#an-link').value = a.link || ''; $('#tr-line').value = a.trustLine || ''; $('#tk-text').value = (a.ticker || []).join('\n');
    } catch (x) { $('#an-err').textContent = x.message; }
  }
  async function save(btn, errSel, okSel, body, label) {
    $(errSel).textContent = ''; $(okSel).textContent = ''; btn.disabled = true; btn.textContent = 'Saving…';
    try { await call(body); $(okSel).textContent = 'Saved ✓'; } catch (x) { $(errSel).textContent = x.message; }
    btn.disabled = false; btn.textContent = label;
  }
  $('#an-save').onclick = (e) => save(e.target, '#an-err', '#an-ok', { action: 'save', active: $('#an-on').checked, messages: $('#an-text').value.split('\n'), linkText: $('#an-ltxt').value, link: $('#an-link').value }, 'Save announcement');
  $('#tk-save').onclick = (e) => save(e.target, '#tk-err', '#tk-ok', { action: 'saveTicker', ticker: $('#tk-text').value.split('\n') }, 'Save tagline');
  $('#tr-save').onclick = (e) => save(e.target, '#tr-err', '#tr-ok', { action: 'saveTrust', line: $('#tr-line').value }, 'Save trust line');

  // ---- reviews ----
  const LABEL = { pending: 'Pending', approved: 'Showing on website', denied: 'Denied' };
  const CLS = { pending: 'pending', approved: 'delivered', denied: 'cancelled' };
  async function loadRev() {
    $('#rv-err').textContent = ''; $('#rv-list').innerHTML = '<p class="sub">Loading…</p>';
    try {
      const j = await rcall({ action: 'list' });
      const order = { pending: 0, approved: 1, denied: 2 };
      const list = (j.reviews || []).sort((a, b) => (order[a.status] - order[b.status]) || ((b.createdAt || 0) - (a.createdAt || 0)));
      $('#rv-list').innerHTML = list.map((r) => '<div class="oc" data-id="' + esc(r.id) + '"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong>' + esc(r.name) + (r.city ? ' · ' + esc(r.city) : '') + '</strong><span class="badge ' + (CLS[r.status] || 'pending') + '">' + esc(LABEL[r.status] || r.status) + '</span></div>' +
        '<small>' + (r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN') : '') + (r.stars ? ' · ' + '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars) : ' · no star rating') + '</small>' +
        '<p class="rvt">' + esc(r.text) + '</p>' + (r.phone ? '<small>Mobile (for checking your records): <a href="tel:+91' + esc(r.phone) + '">' + esc(r.phone) + '</a> · <a href="https://wa.me/91' + esc(r.phone) + '" target="_blank" rel="noopener">WhatsApp</a></small>' : '') +
        '<div class="rvb">' + (r.status !== 'approved' ? '<button class="btn" data-a="approved">Allow</button>' : '') + (r.status !== 'denied' ? '<button class="btn ghost" data-a="denied">Deny</button>' : '') + '<button class="btn ghost" data-a="delete">Delete</button></div></div>').join('') || '<p class="sub">No reviews yet.</p>';
    } catch (x) { $('#rv-err').textContent = x.message; $('#rv-list').innerHTML = ''; }
  }
  $('#rv-list').onclick = async (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const id = b.closest('.oc').dataset.id, a = b.dataset.a;
    if (a === 'delete' && !confirm('Delete this review permanently?')) return;
    b.disabled = true;
    try { await rcall(a === 'delete' ? { action: 'delete', id } : { action: 'setStatus', id, status: a }); await loadRev(); }
    catch (x) { $('#rv-err').textContent = x.message; b.disabled = false; }
  };

  // ---- checkout settings ----
  const adm = (b) => post('/.netlify/functions/admin', b);
  const rs = (n) => '₹' + Number(n).toLocaleString('en-IN');
  async function loadCo() {
    ['#co-err', '#co-ok'].forEach((s) => { $(s).textContent = ''; });
    try {
      const c = await adm({ action: 'getShop' });
      $('#co-d-on').checked = !!c.codDelivery.enabled; $('#co-d-fee').value = c.codDelivery.fee;
      $('#co-e-on').checked = !!c.codExtra.enabled; $('#co-e-fee').value = c.codExtra.fee;
      $('#co-ship').value = c.shippingFee; $('#co-free').value = c.freeAbove;
    } catch (x) { $('#co-err').textContent = x.message; }
  }
  $('#co-save').onclick = async (e) => {
    const btn = e.target; $('#co-err').textContent = ''; $('#co-ok').textContent = ''; btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await adm({ action: 'saveShop', codDeliveryEnabled: $('#co-d-on').checked, codDeliveryFee: $('#co-d-fee').value.trim(), codExtraEnabled: $('#co-e-on').checked, codExtraFee: $('#co-e-fee').value.trim(), shippingFee: $('#co-ship').value.trim(), freeAbove: $('#co-free').value.trim() });
      $('#co-ok').textContent = 'Saved ✓';
    } catch (x) { $('#co-err').textContent = x.message; }
    btn.disabled = false; btn.textContent = 'Save checkout settings';
  };

  // ---- coupons ----
  let coupons = [], editing = null;
  function cpPrev() {
    const t = $('#cp-type').value, v = $('#cp-val').value.trim(), cap = $('#cp-cap').value.trim();
    $('#cp-vl').textContent = t === 'flat' ? 'Discount amount (₹)' : 'Percent off (%)';
    $('#cp-capbox').style.display = t === 'flat' ? 'none' : '';
    $('#cp-prev').textContent = !v ? '' : 'Customers get ' + (t === 'flat' ? rs(v) + ' off' : v + '% off' + (cap && Number(cap) > 0 ? ', up to ' + rs(cap) : ', no maximum')) + '.';
  }
  ['#cp-type', '#cp-val', '#cp-cap'].forEach((s) => { $(s).oninput = cpPrev; $(s).onchange = cpPrev; });
  function cpReset() {
    editing = null; $('#cp-title').textContent = 'New coupon'; $('#cp-new').style.display = 'none'; $('#cp-code').readOnly = false;
    ['#cp-code', '#cp-val', '#cp-cap', '#cp-min', '#cp-uses', '#cp-exp'].forEach((s) => { $(s).value = ''; });
    $('#cp-type').value = 'percent'; $('#cp-on').checked = true; cpPrev();
  }
  $('#cp-new').onclick = cpReset;
  const cpState = (c) => (c.active === false ? ['Off', 'cancelled'] : c.expiresAt && Date.now() > c.expiresAt ? ['Expired', 'cancelled'] : c.maxUses && (c.used || 0) >= c.maxUses ? ['Fully used', 'cancelled'] : ['Active', 'delivered']);
  function cpDraw() {
    $('#cp-list').innerHTML = coupons.map((c) => {
      const [lab, cls] = cpState(c);
      const off = c.type === 'flat' ? rs(c.value) + ' off' : c.value + '% off' + (c.maxDiscount ? ' up to ' + rs(c.maxDiscount) : '');
      const bits = [off, c.minSubtotal ? 'min order ' + rs(c.minSubtotal) : '', 'used ' + (c.used || 0) + (c.maxUses ? ' of ' + c.maxUses : ''), c.expiresAt ? 'expires ' + new Date(c.expiresAt).toLocaleDateString('en-IN') : ''].filter(Boolean).join(' · ');
      return '<div class="oc" data-id="' + esc(c.id) + '"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong>' + esc(c.id) + '</strong><span class="badge ' + cls + '">' + lab + '</span></div><p class="rvt">' + esc(bits) + '</p>' +
        '<div class="cpl"><button class="btn ghost" data-a="edit">Edit</button><button class="btn ghost" data-a="toggle">' + (c.active === false ? 'Turn on' : 'Turn off') + '</button><button class="btn ghost" data-a="del">Delete</button></div></div>';
    }).join('') || '<p class="sub">No coupons yet. Create your first one above.</p>';
  }
  async function loadCp() {
    ['#cp-err', '#cp-ok'].forEach((s) => { $(s).textContent = ''; });
    try { coupons = await adm({ action: 'coupons' }); cpDraw(); cpPrev(); } catch (x) { $('#cp-err').textContent = x.message; }
  }
  const cpBody = (c) => ({ action: 'saveCoupon', code: c.id, type: c.type, value: c.value, maxDiscount: c.maxDiscount || '', minSubtotal: c.minSubtotal || '', maxUses: c.maxUses || '', expiresAt: c.expiresAt || '', active: c.active !== false });
  $('#cp-save').onclick = async (e) => {
    const btn = e.target; $('#cp-err').textContent = ''; $('#cp-ok').textContent = ''; btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const exp = $('#cp-exp').value ? new Date($('#cp-exp').value + 'T23:59:59').getTime() : '';
      await adm({ action: 'saveCoupon', code: $('#cp-code').value.trim(), type: $('#cp-type').value, value: $('#cp-val').value.trim(), maxDiscount: $('#cp-cap').value.trim(), minSubtotal: $('#cp-min').value.trim(), maxUses: $('#cp-uses').value.trim(), expiresAt: exp, active: $('#cp-on').checked });
      cpReset(); $('#cp-ok').textContent = 'Saved ✓'; await loadCp();
    } catch (x) { $('#cp-err').textContent = x.message; }
    btn.disabled = false; btn.textContent = 'Save coupon';
  };
  $('#cp-list').onclick = async (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const id = b.closest('.oc').dataset.id, c = coupons.find((x) => x.id === id), act = b.dataset.a;
    try {
      if (act === 'edit') {
        editing = id; $('#cp-title').textContent = 'Edit coupon ' + id; $('#cp-new').style.display = '';
        $('#cp-code').value = id; $('#cp-code').readOnly = true; $('#cp-type').value = c.type; $('#cp-val').value = c.value; $('#cp-cap').value = c.maxDiscount || '';
        $('#cp-min').value = c.minSubtotal || ''; $('#cp-uses').value = c.maxUses || ''; $('#cp-on').checked = c.active !== false;
        $('#cp-exp').value = c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 10) : ''; cpPrev(); $('#cp-code').scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (act === 'toggle') { await adm({ ...cpBody(c), active: c.active === false }); await loadCp(); }
      else if (act === 'del') { if (confirm('Delete coupon ' + id + '?')) { await adm({ action: 'deleteCoupon', id }); await loadCp(); } }
    } catch (x) { $('#cp-err').textContent = x.message; }
  };
  cpPrev();

  // ---- review videos ----
  let vids = [];
  const vdRead = () => [...document.querySelectorAll('#vd-rows .vdr')].map((r) => ({ src: r.querySelector('.v-src').value.trim(), name: r.querySelector('.v-name').value.trim(), poster: r.querySelector('.v-poster').value.trim() }));
  function vdDraw() {
    $('#vd-rows').innerHTML = vids.map((v, i) => '<div class="vdr" data-i="' + i + '"><div class="two"><input class="v-src" placeholder="Video link (https://...)" value="' + esc(v.src) + '"><input class="v-name" placeholder="Label, for example Ali, Srinagar" maxlength="40" value="' + esc(v.name) + '"></div>' +
      '<input class="v-poster" placeholder="Cover picture link (optional)" value="' + esc(v.poster || '') + '"><div class="cpl"><button class="btn ghost" data-a="up">Move up</button><button class="btn ghost" data-a="down">Move down</button><button class="btn ghost" data-a="del">Remove</button></div></div>').join('') || '<p class="sub">No videos yet. Press "Add a video".</p>';
  }
  async function loadVd() {
    ['#vd-err', '#vd-ok'].forEach((s) => { $(s).textContent = ''; });
    try { const a = await call({ action: 'get' }); vids = (a.videos || []).map((v) => ({ src: v.src || '', name: v.name || '', poster: v.poster || '' })); vdDraw(); } catch (x) { $('#vd-err').textContent = x.message; }
  }
  $('#vd-add').onclick = () => { vids = vdRead(); vids.push({ src: '', name: '', poster: '' }); vdDraw(); const r = document.querySelectorAll('#vd-rows .v-src'); r[r.length - 1].focus(); };
  $('#vd-rows').onclick = (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    vids = vdRead(); const i = +b.closest('.vdr').dataset.i;
    if (b.dataset.a === 'del') vids.splice(i, 1);
    else if (b.dataset.a === 'up' && i > 0) [vids[i - 1], vids[i]] = [vids[i], vids[i - 1]];
    else if (b.dataset.a === 'down' && i < vids.length - 1) [vids[i + 1], vids[i]] = [vids[i], vids[i + 1]];
    vdDraw();
  };
  $('#vd-save').onclick = async (e) => {
    const btn = e.target; $('#vd-err').textContent = ''; $('#vd-ok').textContent = ''; btn.disabled = true; btn.textContent = 'Saving…';
    try { vids = vdRead().filter((v) => v.src); await call({ action: 'saveVideos', videos: vids }); vdDraw(); $('#vd-ok').textContent = 'Saved ✓'; } catch (x) { $('#vd-err').textContent = x.message; }
    btn.disabled = false; btn.textContent = 'Save videos';
  };
})();
