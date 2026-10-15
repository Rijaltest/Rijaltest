# RIJAL website: setup from zero (about 30 minutes)

Follow the steps in order. Do not skip any.

## What is in this project
```
package.json
netlify.toml
README-SETUP.md
public/                 <- the website (everything customers and you see)
   index.html  blog.html  policies.html  admin.html
   style.css  hero.css  reviews.css  extras.css  theme.css  shop.css
   favicon.svg  admin-announce.js
netlify/
   functions/           <- the small server files (payments, admin, reviews)
      _lib.js  admin.js  announcement.js  create-order.js
      products.js  reviews.js  verify-payment.js  webhook.js
```
Keep this exact folder layout. Do not rename anything.

## Step 1. Put the files on GitHub
1. Log in to github.com with your new account.
2. Click **+** (top right), then **New repository**. Name it `rijal`. Choose **Private**. Click **Create repository**.
3. Click **uploading an existing file**.
4. Drag in `package.json`, `netlify.toml` and `README-SETUP.md`, then drag in the **public** folder and the **netlify** folder (drag the whole folders, not just the files inside).
5. Wait until all files are listed, then click **Commit changes**.
6. Check that `public` and `netlify/functions` show the files above.

## Step 2. Firebase (your database and admin login)
1. Go to console.firebase.google.com and click **Add project**. Name it `rijal`. Continue until it is created.
2. Left menu: **Build**, then **Firestore Database**, then **Create database**. Choose **Production mode**. Choose a location near India (for example `asia-south1`). Click **Enable**.
3. Left menu: **Build**, then **Authentication**, then **Get started**. Click **Email/Password**, switch it **on**, click **Save**.
4. In Authentication, open the **Users** tab and click **Add user**. Type your own email and a strong password. This is your admin login. Remember this email.
5. Click the gear icon, **Project settings**, then **Service accounts**, then **Generate new private key**, then **Generate key**. A file downloads. Keep it private. Never put it on GitHub.
6. Still in Project settings, open the **General** tab. Scroll to **Your apps** and click the web icon `</>`. Give it any name and click **Register app**. You will see `apiKey`, `authDomain` and `projectId`. Keep that page open (you need them in Step 4).

## Step 3. Razorpay (payments)
1. Go to dashboard.razorpay.com and log in or sign up.
2. Switch on **Test mode**.
3. **Account & Settings**, then **API Keys**, then **Generate key**. Copy the **Key Id** and **Key Secret**.
4. Settings, then **Payment capture**: make sure **Automatic** capture is on.
5. Do the webhook after Step 5 (you need your site address first).

## Step 4. Paste your Firebase details into the admin page
1. On GitHub open `public/admin.html` and click the pencil (edit).
2. Find the line that starts with `const FIREBASE_CONFIG=`.
3. Replace `PASTE_API_KEY`, `PASTE_PROJECT_ID` (twice) with your real `apiKey` and `projectId` from Step 2.6.
4. Click **Commit changes**.

## Step 5. Netlify (puts the site online)
1. Go to netlify.com and sign up with GitHub.
2. **Add new site**, then **Import an existing project**, then **GitHub**, then choose the `rijal` repository.
3. Do not change the build settings (they are read from `netlify.toml`). Click **Deploy**.
4. When it finishes, open **Site configuration**, then **Environment variables**, and add these 5 (one at a time, **Add a variable**):

| Name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | open the downloaded key file in Notepad, select all, copy, paste it as one block |
| `ADMIN_EMAIL` | the email you added in Step 2.4 |
| `RAZORPAY_KEY_ID` | the Key Id from Step 3 |
| `RAZORPAY_KEY_SECRET` | the Key Secret from Step 3 |
| `RAZORPAY_WEBHOOK_SECRET` | make up a long password and remember it (used in the next step) |

5. Go to **Deploys**, click **Trigger deploy**, then **Deploy site**. Wait until it says **Published**.
6. Copy your site address (for example `https://something.netlify.app`).

## Step 6. Finish Firebase and Razorpay
1. Firebase: **Authentication**, then **Settings**, then **Authorized domains**, then **Add domain**. Add your Netlify address without `https://` (for example `something.netlify.app`). Add your own domain here later too.
2. Razorpay: **Settings**, then **Webhooks**, then **Add new webhook**.
   - URL: `https://YOUR-SITE.netlify.app/.netlify/functions/webhook`
   - Secret: the same password you used for `RAZORPAY_WEBHOOK_SECRET`
   - Tick the events `payment.captured` and `order.paid`. Save.

## Step 7. Test everything
1. Open your site. You should see the 3 products.
2. Add a product to the cart, press Buy now, fill the form and pay with a Razorpay **test** card or UPI.
3. Open `YOUR-SITE.netlify.app/admin.html` and log in with your email and password. You should see the order as **New (paid)**.
4. In the admin panel, open **Site text** (announcement bar, trust line, scrolling tagline) and **Reviews**.
5. Send a test review from the website and press **Allow** in the admin **Reviews** tab.

## Step 8. Go live
1. Open `public/policies.html` and replace `YOUR_BUSINESS_ADDRESS`.
2. Finish Razorpay KYC, then switch Razorpay to **Live mode**, make live keys, and replace `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in Netlify. Create the webhook again in live mode.
3. Netlify: **Domain management** to connect your own domain.
4. Trigger a deploy after changing keys.

## Order emails with Brevo (customer confirmation + new-order email to you)
Without this the shop works the same, just without emails. Free Brevo plan is enough to start.
1. Go to brevo.com and create an account.
2. **Senders, Domains & Dedicated IPs**, then **Senders**, then **Add a sender**. Use the email you want customers to see (for example `orders@yourdomain.com`). Brevo emails you a link to verify it. A Gmail address can work for testing but often lands in spam; a domain email is better.
3. **SMTP & API**, then **API keys**, then **Generate a new API key**. Copy it.
4. In Netlify, **Site configuration**, **Environment variables**, add:

| Name | Value |
|---|---|
| `BREVO_API_KEY` | the key from step 3 |
| `BREVO_SENDER_EMAIL` | the sender you verified in step 2 |
| `BREVO_SENDER_NAME` | optional, for example `RIJAL` |
| `OWNER_EMAIL` | optional, where YOU get the new-order email (if empty, your `ADMIN_EMAIL` is used) |

5. **Deploys**, **Trigger deploy**.
6. Place a test order. The customer gets "Your RIJAL order is confirmed" and you get "New order ...". In the admin panel each order shows `Emails: to you sent, to customer sent`. If it says `failed`, check the API key and the sender, and look at Brevo, **Transactional**, **Logs**.

## Visitor and funnel tracking (Google Analytics)
The site already contains your Google Analytics tag (`G-BGW29WYSYZ`) in `public/index.html` and `public/blog.html`. To switch tracking off, delete the first `<script>` block in the `<head>` of those two files.
- It loads late (after the page has finished loading or on the first scroll or tap), so it does not slow the first view.
- **Exclude your own phone/computer:** open your site once with `?noga=1` at the end of the address (for example `https://yoursite.netlify.app/?noga=1`). Use `?noga=0` to switch it back on.
- **See it working:** open your site on your phone, then in analytics.google.com open **Reports, Realtime**.
- **Funnel (landing, cart, left):** **Explore, Funnel exploration**. Steps, in order: `page_view` (visited), `view_item_list` (saw the products), `add_to_cart`, `view_cart`, `begin_checkout`, `add_payment_info`, `purchase`. Break the funnel down by Device category, Region, or Session source.
- **Mark purchases as a key event:** Admin, **Events**, switch on **Mark as key event** next to `purchase` once it appears.
- **See online vs COD:** Admin, **Custom definitions**, **Create custom dimension**, scope **Event**, event parameter `payment_type`.
- Other events recorded: `remove_from_cart`, `apply_coupon`, `payment_failed`, `click_whatsapp`, `click_bulk_order`, `click_track_order`, `play_review_video`, `click_contact`, `submit_review`, `download_receipt`, `view_section`.
- Most reports fill in after 24 to 48 hours. Ad blockers hide some visitors, so numbers are close, not exact.

## Everyday changes
- **Prices, descriptions, photos, stock:** admin panel, **Products** tab. Photo links: one per line, the first is the main photo. Stock empty means unlimited.
- **Combos:** add a product with the word `Combo` or `Bundle` in its name, and write the product names inside the description.
- **Product card details (size, rating, number of ratings, "bought" line, red offer tag, photo label such as Best Seller, MRP):** admin panel, **Products** tab, in the box "Details shown on the shop card". Leave a box empty to hide it. (`PRODUCT_META` inside `public/index.html` is only a backup.)
- **Review videos:** admin panel, **Videos** tab. Paste Instagram reel, YouTube or YouTube Shorts links (or direct video links), add a label and an optional cover picture, reorder, remove, and Save.
- **Written reviews:** `REVIEWS` inside `public/index.html`, plus the reviews customers send (approve them in the admin **Reviews** tab).
- **India map numbers:** `TM` inside `public/index.html` (real numbers only).
- **Order notification states:** `LIST` inside `public/index.html` (only states you really delivered to).
- **Blog articles:** `POSTS` inside `public/blog.html`.
- **Cash on delivery, delivery charge, free shipping:** admin panel, **Checkout** tab. Prepaid orders always ship free. There you switch each Cash on Delivery option on or off and set the amount the customer pays online now:
  - *Delivery charge now*: the customer pays this amount now (it is the whole delivery charge) and the order value on delivery.
  - *Extra COD fee now*: the customer pays this extra fee now, on top of the order value; the order value and the normal delivery charge are paid on delivery.
- **Coupon codes:** admin panel, **Coupons** tab. Make a code, choose *Percent off* (with an optional maximum, for example 20% up to Rs 200) or *Flat amount off*, and optionally set a minimum order, how many times it can be used, an expiry date, and turn it on or off.
- **Theme:** Noir & Gold is on. For another look change `<html lang="en">` in `public/index.html` to `<html lang="en" data-theme="green">` or `data-theme="cream"`.

## If payment does not start (do this first)
1. Open this address in your browser (put your own site name): `https://YOUR-SITE.netlify.app/.netlify/functions/health`
2. You will see a short list. Every line should say `true` or `OK`. Read the line that says `PROBLEM` or `false`:
   - a setting is `false`: add it again in Netlify, Site configuration, Environment variables, then press Deploy again
   - Firebase key file problem: paste the whole key file again (from the first `{` to the last `}`)
   - database problem: make sure you created Firestore in Firebase (Step 2.2)
   - Razorpay problem: copy the Key Id and Key Secret again; both must be test keys, or both live keys
3. After any change press **Deploy**, wait for **Published**, then press Ctrl+F5 on your site.
4. When payments work you can delete `netlify/functions/health.js`.

## If something goes wrong
- Site shows old content: press Ctrl+F5, or open it in a private window.
- Products do not load: Netlify, **Functions**, check for errors. The usual cause is a wrong `FIREBASE_SERVICE_ACCOUNT` (it must be the full contents of the key file).
- Admin says "not the shop owner account": `ADMIN_EMAIL` does not match the email you log in with.
- Admin login fails or does nothing: the Firebase details in `admin.html` (Step 4) or the authorized domain (Step 6.1) are wrong.
- Payment succeeds but the order stays unpaid: check the webhook address and secret (Step 6.2).
