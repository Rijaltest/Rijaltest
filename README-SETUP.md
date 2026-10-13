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

## Everyday changes
- **Prices, descriptions, photos, stock:** admin panel, **Products** tab. Photo links: one per line, the first is the main photo. Stock empty means unlimited.
- **Combos:** add a product with the word `Combo` or `Bundle` in its name, and write the product names inside the description.
- **Ratings, tags, original price (MRP):** `PRODUCT_META` inside `public/index.html`.
- **Customer videos and written reviews:** `REVIEW_VIDEOS` and `REVIEWS` inside `public/index.html`.
- **India map numbers:** `TM` inside `public/index.html` (real numbers only).
- **Order notification states:** `LIST` inside `public/index.html` (only states you really delivered to).
- **Blog articles:** `POSTS` inside `public/blog.html`.
- **Shipping fee and free-shipping limit:** default is 49 and 599. To change, create in Firestore a collection `settings` with a document `shop` and fields `shippingFee` and `freeAbove` (numbers). Also update the text in your products section if needed.
- **Theme:** Noir & Gold is on. For another look change `<html lang="en">` in `public/index.html` to `<html lang="en" data-theme="green">` or `data-theme="cream"`.

## If something goes wrong
- Site shows old content: press Ctrl+F5, or open it in a private window.
- Products do not load: Netlify, **Functions**, check for errors. The usual cause is a wrong `FIREBASE_SERVICE_ACCOUNT` (it must be the full contents of the key file).
- Admin says "not the shop owner account": `ADMIN_EMAIL` does not match the email you log in with.
- Admin login fails or does nothing: the Firebase details in `admin.html` (Step 4) or the authorized domain (Step 6.1) are wrong.
- Payment succeeds but the order stays unpaid: check the webhook address and secret (Step 6.2).
