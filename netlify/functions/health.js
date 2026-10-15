// Open  https://YOUR-SITE.netlify.app/.netlify/functions/health  in your browser.
// It tells you in plain words what is missing for payments to work. It never shows your secret values.
// You can delete this file once everything works.
const has = (n) => !!(process.env[n] && String(process.env[n]).trim());

exports.handler = async () => {
  const r = {
    step1_settings_present: {
      FIREBASE_SERVICE_ACCOUNT: has('FIREBASE_SERVICE_ACCOUNT'),
      ADMIN_EMAIL: has('ADMIN_EMAIL'),
      RAZORPAY_KEY_ID: has('RAZORPAY_KEY_ID'),
      RAZORPAY_KEY_SECRET: has('RAZORPAY_KEY_SECRET'),
      RAZORPAY_WEBHOOK_SECRET: has('RAZORPAY_WEBHOOK_SECRET'),
    },
  };
  const id = String(process.env.RAZORPAY_KEY_ID || '').trim();
  r.razorpay_key_type = id.startsWith('rzp_test_') ? 'TEST key (good for testing)' : id.startsWith('rzp_live_') ? 'LIVE key (real money)' : id ? 'does not look like a Razorpay key id' : 'missing';

  try {
    const j = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '');
    r.step2_firebase_key_file = j.project_id && j.private_key && j.client_email ? 'OK (project: ' + j.project_id + ')' : 'The pasted text is JSON but it is not the Firebase key file';
  } catch (e) { r.step2_firebase_key_file = 'PROBLEM: FIREBASE_SERVICE_ACCOUNT is not the full key file. Paste everything from the first { to the last }'; }

  try {
    const { db } = require('./_lib');
    await db.collection('products').limit(1).get();
    r.step3_database = 'OK (Firestore is connected)';
  } catch (e) { r.step3_database = 'PROBLEM: ' + String(e.message || e).slice(0, 200) + ' (Firestore must be created in your Firebase project, and the key file must belong to the same project)'; }

  try {
    const Razorpay = require('razorpay');
    const rz = new Razorpay({ key_id: id, key_secret: String(process.env.RAZORPAY_KEY_SECRET || '').trim() });
    await rz.orders.all({ count: 1 });
    r.step4_razorpay = 'OK (Razorpay accepted the keys)';
  } catch (e) { r.step4_razorpay = 'PROBLEM: ' + ((e && e.error && e.error.description) || String((e && e.message) || e)).slice(0, 200) + ' (check the Key Id and Key Secret, and that both come from the same mode, test or live)'; }

  r.summary = Object.values(r.step1_settings_present).every(Boolean) && String(r.step2_firebase_key_file).startsWith('OK') && String(r.step3_database).startsWith('OK') && String(r.step4_razorpay).startsWith('OK')
    ? 'ALL GOOD: payments can start. If the pay button still fails, the problem is in the browser (see the guide).'
    : 'Something above says PROBLEM or false. Fix that first, then press Deploy again in Netlify.';
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r, null, 2) };
};
