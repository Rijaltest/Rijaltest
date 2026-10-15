// Order emails through Brevo (https://www.brevo.com): one to the customer, one to you.
// Needs these Netlify environment variables (if BREVO_API_KEY is missing, no email is sent and nothing breaks):
//   BREVO_API_KEY       your Brevo API key
//   BREVO_SENDER_EMAIL  a sender email you verified in Brevo (Senders & IP)
//   BREVO_SENDER_NAME   optional, defaults to RIJAL
//   OWNER_EMAIL         optional, where YOU get the new-order email (defaults to ADMIN_EMAIL)
const { db } = require('./_lib');

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rs = (n) => '\u20B9' + Number(n || 0).toLocaleString('en-IN');
const when = (d) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
const SUPPORT_EMAIL = 'rijalstore1212@gmail.com', SUPPORT_PHONE = '+91 91039 98116';

async function brevo(payload) {
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'api-key': process.env.BREVO_API_KEY },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error('Brevo ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

function parts(o) {
  const cod = o.payment && o.payment !== 'online';
  const rows = [['Subtotal', rs(o.subtotal)]];
  if (o.discount) rows.push(['Discount' + (o.coupon ? ' (' + o.coupon.code + ')' : ''), '- ' + rs(o.discount)]);
  if (o.payment === 'cod_extra') {
    rows.push(['Delivery charge', o.shipping ? rs(o.shipping) + ' (pay on delivery)' : 'Free']);
    rows.push(['COD fee (paid now)', rs(o.codFee)]);
  } else if (cod) rows.push(['Delivery charge (paid now)', rs(o.shipping)]);
  else rows.push(['Shipping', 'Free']);
  rows.push(['Total', rs(o.total)]);
  rows.push([cod ? 'Paid online now' : 'Paid online', rs(o.paidOnline != null ? o.paidOnline : o.total)]);
  if (cod) rows.push(['To pay on delivery', rs(o.dueOnDelivery)]);
  return { cod, rows };
}

const table = (rows, boldLast) => rows.map((r, i) => '<tr><td style="padding:6px 0;color:#7a6657">' + esc(r[0]) + '</td><td style="padding:6px 0;text-align:right;font-weight:' + (r[0] === 'Total' || (boldLast && i === rows.length - 1) ? '700' : '400') + '">' + esc(r[1]) + '</td></tr>').join('');
const itemRows = (o) => (o.items || []).map((i) => '<tr><td style="padding:8px 0;border-bottom:1px solid #eadfce">' + esc(i.qty) + ' &times; ' + esc(i.name) + '</td><td style="padding:8px 0;border-bottom:1px solid #eadfce;text-align:right">' + rs(i.lineTotal) + '</td></tr>').join('');
const shell = (inner) => '<div style="background:#f6efe3;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#2a1a14"><table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fffdf9;border-radius:16px;overflow:hidden;border-collapse:collapse">' +
  '<tr><td style="background:#16110e;padding:26px;text-align:center"><div style="font-family:Georgia,serif;font-size:30px;letter-spacing:10px;color:#d9961f;font-weight:700">RIJAL</div></td></tr>' +
  '<tr><td style="padding:26px">' + inner + '</td></tr>' +
  '<tr><td style="background:#16110e;padding:16px;text-align:center;color:#cdbfae;font-size:12px">RIJAL &middot; ' + SUPPORT_EMAIL + ' &middot; ' + SUPPORT_PHONE + '</td></tr></table></div>';

function customerMail(id, o, at) {
  const c = o.customer || {}, { cod, rows } = parts(o);
  const addr = [c.address, c.city, c.state, c.pincode].filter(Boolean).join(', ');
  const html = shell(
    '<h1 style="font-family:Georgia,serif;font-size:26px;margin:0 0 6px;text-align:center">Thank you, ' + esc(c.name) + '!</h1>' +
    '<p style="text-align:center;margin:0 0 20px;color:#7a6657">Your order is confirmed.</p>' +
    '<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px"><tr><td style="padding:4px 0;color:#7a6657">Order ID</td><td style="text-align:right;font-weight:700">' + esc(id) + '</td></tr>' +
    '<tr><td style="padding:4px 0;color:#7a6657">Date and time</td><td style="text-align:right">' + esc(when(at)) + '</td></tr></table>' +
    '<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;margin-top:14px">' + itemRows(o) + '</table>' +
    '<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;margin-top:8px">' + table(rows) + '</table>' +
    (cod ? '<div style="margin-top:16px;padding:12px 14px;background:#fbf1dc;border:1px solid #e7cd8e;border-radius:12px;font-size:14px"><b>Cash on delivery:</b> please keep <b>' + rs(o.dueOnDelivery) + '</b> ready to pay on delivery.</div>' : '') +
    '<p style="font-size:14px;margin:18px 0 4px"><b>Delivering to</b><br>' + esc(c.name) + '<br>' + esc(addr) + '<br>' + esc(c.phone) + '</p>' +
    '<p style="font-size:13px;color:#7a6657;margin-top:18px">Please keep this email for your reference. You can track your parcel at <a href="https://rehbarpost.com/track" style="color:#b8780f">rehbarpost.com/track</a>. Questions? Reply to this email or call ' + SUPPORT_PHONE + '.</p>');
  const text = 'Thank you, ' + c.name + '! Your RIJAL order ' + id + ' is confirmed (' + when(at) + ').\n' + (o.items || []).map((i) => i.qty + ' x ' + i.name + ' - ' + rs(i.lineTotal)).join('\n') + '\n' + rows.map((r) => r[0] + ': ' + r[1]).join('\n') + '\nDelivering to: ' + addr + '\nTrack: https://rehbarpost.com/track\nQuestions: ' + SUPPORT_EMAIL + ' / ' + SUPPORT_PHONE;
  return { html, text };
}

function ownerMail(id, o, at) {
  const c = o.customer || {}, { cod, rows } = parts(o);
  const addr = [c.address, c.city, c.state, c.pincode].filter(Boolean).join(', ');
  const admin = (process.env.URL || '') + '/admin.html';
  const html = shell(
    '<h1 style="font-family:Georgia,serif;font-size:24px;margin:0 0 6px">New order ' + (cod ? '(COD)' : '(prepaid)') + '</h1>' +
    '<p style="margin:0 0 16px;color:#7a6657">' + esc(when(at)) + ' &middot; Order ID <b>' + esc(id) + '</b></p>' +
    (cod ? '<div style="margin-bottom:14px;padding:12px 14px;background:#fdeceb;border:1px solid #f0b6b3;border-radius:12px;font-size:15px"><b>COLLECT ' + rs(o.dueOnDelivery) + ' ON DELIVERY</b> (customer already paid ' + rs(o.paidOnline) + ' online)</div>' : '') +
    '<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px">' + itemRows(o) + '</table>' +
    '<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;margin-top:8px">' + table(rows) + '</table>' +
    '<p style="font-size:14px;margin:18px 0 4px"><b>Customer</b><br>' + esc(c.name) + '<br><a href="tel:' + esc(c.phone) + '">' + esc(c.phone) + '</a> &middot; <a href="https://wa.me/91' + esc(c.phone) + '">WhatsApp</a><br>' + esc(c.email) + '<br>' + esc(addr) + '</p>' +
    (admin.startsWith('http') ? '<p style="margin-top:16px"><a href="' + esc(admin) + '" style="background:#d9961f;color:#2a1a14;padding:10px 18px;border-radius:99px;text-decoration:none;font-weight:700">Open admin panel</a></p>' : ''));
  const text = 'New order ' + id + ' (' + (cod ? 'COD, collect ' + rs(o.dueOnDelivery) : 'prepaid') + ')\n' + (o.items || []).map((i) => i.qty + ' x ' + i.name).join('\n') + '\nTotal ' + rs(o.total) + '\nCustomer: ' + c.name + ', ' + c.phone + ', ' + c.email + '\nAddress: ' + addr;
  return { html, text };
}

// Sends both emails and notes the result on the order. Never throws, so a mail problem can never break a payment.
async function sendOrderEmails(id, o) {
  try {
    if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) return { skipped: true };
    const sender = { name: process.env.BREVO_SENDER_NAME || 'RIJAL', email: process.env.BREVO_SENDER_EMAIL };
    const owner = process.env.OWNER_EMAIL || process.env.ADMIN_EMAIL;
    const c = o.customer || {}, at = Date.now(), status = {};
    if (c.email) {
      try {
        const m = customerMail(id, o, at);
        await brevo({ sender, to: [{ email: c.email, name: c.name || undefined }], replyTo: owner ? { email: owner } : undefined, subject: 'Your RIJAL order is confirmed (' + id + ')', htmlContent: m.html, textContent: m.text });
        status.customer = 'sent';
      } catch (e) { console.error('customer email failed:', e.message); status.customer = 'failed'; }
    }
    if (owner) {
      try {
        const m = ownerMail(id, o, at);
        await brevo({ sender, to: [{ email: owner }], subject: 'New order ' + rs(o.total) + ' from ' + (c.name || 'a customer') + (c.city ? ', ' + c.city : '') + (o.payment && o.payment !== 'online' ? ' (COD)' : ''), htmlContent: m.html, textContent: m.text });
        status.owner = 'sent';
      } catch (e) { console.error('owner email failed:', e.message); status.owner = 'failed'; }
    }
    try { await db.collection('orders').doc(id).update({ emails: status }); } catch (e) { console.error(e.message); }
    return status;
  } catch (e) { console.error('sendOrderEmails:', e.message); return { error: true }; }
}

module.exports = { sendOrderEmails };
