// Adds two tabs to admin.html: "Site text" (announcement bar + trust line) and "Reviews" (allow / deny customer reviews).
// Install: add  <script src="admin-announce.js"></script>  just before </body> in admin.html.
(function () {
  if (typeof auth === 'undefined') return;
  const bar = document.querySelector('#app .bar'), app = document.querySelector('#app');
  if (!bar || !app) return;
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const st = document.createElement('style');
  st.textContent = '#annPanel label{display:block;font-weight:600;font-size:.88rem;margin:12px 0 4px}#annPanel input[type=text],#annPanel textarea{width:100%;padding:11px;border:1px solid #bfcac3;border-radius:10px;font:inherit}#annPanel .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}#annPanel h3{font-size:1.1rem;margin-bottom:4px}.rvb{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.rvb .btn{padding:8px 16px;font-size:.9rem}.rvt{white-space:pre-wrap;margin:8px 0}@media(max-width:600px){#annPanel .two{grid-template-columns:1fr}}';
  document.head.appendChild(st);

  const tab = document.createElement('button'); tab.className = 'tab'; tab.textContent = 'Site text';
  const revTab = document.createElement('button'); revTab.className = 'tab'; revTab.textContent = 'Reviews';
  bar.insertBefore(tab, $('#refresh')); bar.insertBefore(revTab, $('#refresh'));

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
  app.insertBefore(panel, $('#gerr')); app.insertBefore(revPanel, $('#gerr'));

  async function post(url, body) {
    const t = await auth.currentUser.getIdToken();
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(r.status === 403 ? 'This login is not the shop owner account.' : (j.error || 'Something went wrong'));
    return j;
  }
  const call = (b) => post('/.netlify/functions/announcement', b);
  const rcall = (b) => post('/.netlify/functions/reviews', b);

  function show(which) {
    bar.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b === (which === 'ann' ? tab : revTab)));
    ['#orders', '#products'].forEach((s) => { const e = $(s); if (e) e.classList.add('hide'); });
    panel.classList.toggle('hide', which !== 'ann'); revPanel.classList.toggle('hide', which !== 'rev');
    if (which === 'ann') load(); else loadRev();
  }
  tab.onclick = () => show('ann'); revTab.onclick = () => show('rev');
  document.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { panel.classList.add('hide'); revPanel.classList.add('hide'); tab.classList.remove('on'); revTab.classList.remove('on'); }));

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
})();
