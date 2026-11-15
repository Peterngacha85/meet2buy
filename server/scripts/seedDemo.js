// Demo shops for showing the mall concept before real sellers join.
//   npm run seed:demo               add (or refresh) the demo shops
//   npm run seed:demo -- --images   only add photos to the existing demo products (nothing is deleted)
//   npm run seed:demo -- --remove   delete every demo shop, account, product and demo photo
// Demo accounts use @demo.meet2buy.test emails and random passwords (they cannot be logged into).
// Logos are left empty on purpose: each business uploads its own logo from the seller dashboard.
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { env, isProd } from '../src/config/env.js';
import { isCloudinaryConfigured, signParams } from '../src/services/cloudinary.js';
import { User } from '../src/models/User.js';
import { Store } from '../src/models/Store.js';
import { Product } from '../src/models/Product.js';
import { PresentationRequest } from '../src/models/PresentationRequest.js';

const DOMAIN = '@demo.meet2buy.test';
const PHONES = 'phones-and-tablets';
const HOME = 'home-appliances';

const phonesDept = [{ name: 'Phones & Tablets', wing: PHONES }];
const applianceDepts = ['TVs', 'Cookers', 'Washing Machines', 'Fridges'].map((name) => ({ name, wing: HOME }));

const SHOPS = [
  { name: 'Samsung', color: '#1C2B8C', departments: [{ name: 'Home Appliances', wing: HOME }, ...phonesDept] },
  { name: 'Tecno', color: '#0E5AA7', departments: phonesDept },
  { name: 'Infinix', color: '#111827', departments: phonesDept },
  { name: 'Oppo', color: '#1F6F50', departments: phonesDept },
  { name: 'vivo', color: '#3346B8', departments: phonesDept },
  { name: 'Honor', color: '#262A33', departments: phonesDept },
  { name: 'realme', color: '#8A6A00', departments: phonesDept },
  { name: 'Hisense', color: '#007C7A', departments: applianceDepts },
  { name: 'LG', color: '#9E1B3A', departments: applianceDepts },
  { name: 'Hotpoint', color: '#1B3D6E', departments: applianceDepts },
  { name: 'TCL', color: '#B3261E', departments: applianceDepts },
  { name: 'Synix', color: '#2F4858', departments: applianceDepts },
  { name: 'Vision Plus', color: '#4A2C82', departments: applianceDepts },
];

// Generic placeholder line-ups (no model names or real prices).
const LINEUP = {
  'Phones & Tablets': [
    ['Smartphone 128 GB', 18999],
    ['Smartphone 256 GB', 32999],
    ['Tablet 10"', 24999],
  ],
  'Home Appliances': [
    ['Smart TV 55"', 59999],
    ['Double-door fridge', 64999],
    ['Front-load washer 8 kg', 47999],
  ],
  TVs: [
    ['Smart TV 43"', 32999],
    ['4K Smart TV 55"', 54999],
    ['4K Smart TV 65"', 89999],
  ],
  Cookers: [
    ['4-burner gas cooker', 27999],
    ['Gas + electric cooker with oven', 42999],
  ],
  'Washing Machines': [
    ['Top-load washer 7 kg', 32999],
    ['Front-load washer 9 kg', 54999],
  ],
  Fridges: [
    ['Single-door fridge 180 L', 26999],
    ['Double-door fridge 300 L', 49999],
  ],
};

// Generic product photos, all CC0 / public domain (no brand models, no credit needed):
// StockSnap (stocksnap.io) and rawpixel public-domain collection, found via Openverse.
const PHOTO = {
  phone: 'https://cdn.stocksnap.io/img-thumbs/960w/D2ROMCUEIV.jpg', // stocksnap.io/photo/nexus-smartphone-D2ROMCUEIV
  phone2: 'https://cdn.stocksnap.io/img-thumbs/960w/IU6HNPC2NT.jpg', // stocksnap.io/photo/smartphone-mobile-IU6HNPC2NT
  tablet: 'https://cdn.stocksnap.io/img-thumbs/960w/KCEVT4PCQ1.jpg', // stocksnap.io/photo/tablet-computer-KCEVT4PCQ1
  tv: 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvaXMxNjE0My1pbWFnZS1rd3Z3dHpydS5qcGc.jpg', // rawpixel.com/image/5917364
  washerFront: 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHg5ODc4OTMtaW1hZ2Uta3d2eGJnYmIuanBn.jpg', // rawpixel.com/image/5920313
  washerTop: 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHgxMDU5MjU2LWltYWdlLWt3dnk2b3RrLmpwZw.jpg', // rawpixel.com/image/5925486
  cooker: 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA2L2ZsMTQwODMxODc4NzEtaW1hZ2Uta3VjaDBxZDQuanBn.jpg', // rawpixel.com/image/4051735
  oven: 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2ZsMzczMDYxMzMwNTUtaW1hZ2Uta3liZWp0NDYuanBn.jpg', // rawpixel.com/image/6042998
  fridge: 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA0L3Vwd2s2MTY2MjMzNy13aWtpbWVkaWEtaW1hZ2Uta3A2YWJnYm8uanBn.jpg', // rawpixel.com/image/3337383
};

// Product name → photo key.
const PHOTO_FOR = {
  'Smartphone 128 GB': 'phone',
  'Smartphone 256 GB': 'phone2',
  'Tablet 10"': 'tablet',
  'Smart TV 55"': 'tv',
  'Smart TV 43"': 'tv',
  '4K Smart TV 55"': 'tv',
  '4K Smart TV 65"': 'tv',
  'Double-door fridge': 'fridge',
  'Single-door fridge 180 L': 'fridge',
  'Double-door fridge 300 L': 'fridge',
  'Front-load washer 8 kg': 'washerFront',
  'Front-load washer 9 kg': 'washerFront',
  'Top-load washer 7 kg': 'washerTop',
  '4-burner gas cooker': 'cooker',
  'Gas + electric cooker with oven': 'oven',
};

const DEMO_FOLDER = `${env.CLOUDINARY_FOLDER}/demo`;

/** Copy each photo into our Cloudinary (meet2buy/demo/<key>) so the demo never depends on other sites. */
async function demoPhotoUrls() {
  if (!isCloudinaryConfigured()) {
    console.log('Cloudinary not configured: linking the photos directly.');
    return PHOTO;
  }
  const urls = {};
  for (const [key, source] of Object.entries(PHOTO)) {
    const params = { folder: DEMO_FOLDER, overwrite: 'true', public_id: key, timestamp: Math.floor(Date.now() / 1000) };
    const form = new FormData();
    form.append('file', source); // Cloudinary fetches the remote URL itself
    form.append('api_key', env.CLOUDINARY_API_KEY);
    form.append('signature', signParams(params));
    for (const [k, v] of Object.entries(params)) form.append(k, String(v));
    const res = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: form });
    const body = await res.json();
    if (!res.ok) throw new Error(`Cloudinary upload of ${key} failed: ${body.error?.message ?? res.status}`);
    urls[key] = body.secure_url;
    console.log(`  photo ${key} → ${body.secure_url}`);
  }
  return urls;
}

async function removeDemoPhotos() {
  if (!isCloudinaryConfigured()) return;
  const auth = Buffer.from(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`).toString('base64');
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/image/upload?prefix=${encodeURIComponent(`${DEMO_FOLDER}/`)}`,
    { method: 'DELETE', headers: { Authorization: `Basic ${auth}` } },
  );
  console.log(res.ok ? 'Removed demo photos from Cloudinary.' : `Could not remove demo photos (${res.status}).`);
}

const imagesFor = (urls, name) => (PHOTO_FOR[name] ? [urls[PHOTO_FOR[name]]] : []);

if (isProd && !process.argv.includes('--force')) {
  console.error('Refusing to seed demo shops with NODE_ENV=production (add --force if you really mean it).');
  process.exit(1);
}

await mongoose.connect(env.MONGO_URI);

// --images: only attach photos to the demo products that already exist. Nothing is deleted.
if (process.argv.includes('--images')) {
  const users = await User.find({ email: { $regex: `${DOMAIN.replace(/\./g, '\\.')}$` } }).select('_id');
  const stores = await Store.find({ owner: { $in: users.map((u) => u._id) } }).select('_id');
  const urls = await demoPhotoUrls();
  let updated = 0;
  for (const [name, key] of Object.entries(PHOTO_FOR)) {
    const res = await Product.updateMany({ store: { $in: stores.map((s) => s._id) }, name }, { images: [urls[key]] });
    updated += res.modifiedCount;
  }
  console.log(`Added photos to ${updated} demo products in ${stores.length} demo shops.`);
  await mongoose.disconnect();
  process.exit(0);
}

const demoUsers = await User.find({ email: { $regex: `${DOMAIN.replace(/\./g, '\\.')}$` } }).select('_id');
const demoStores = await Store.find({ owner: { $in: demoUsers.map((u) => u._id) } }).select('_id');
const storeIds = demoStores.map((s) => s._id);
await Promise.all([
  Product.deleteMany({ store: { $in: storeIds } }),
  PresentationRequest.deleteMany({ store: { $in: storeIds } }),
]);
await Store.deleteMany({ _id: { $in: storeIds } });
await User.deleteMany({ _id: { $in: demoUsers.map((u) => u._id) } });
console.log(`Removed ${storeIds.length} demo shops.`);

if (process.argv.includes('--remove')) await removeDemoPhotos();
else {
  const urls = await demoPhotoUrls();
  for (const [i, shop] of SHOPS.entries()) {
    const slug = await Store.uniqueSlug(shop.name);
    const user = await User.create({
      name: `${shop.name} (demo)`,
      email: `${slug}${DOMAIN}`,
      phone: `2547${String(10000000 + i).slice(-8)}`,
      password: crypto.randomBytes(24).toString('hex'),
      role: 'seller',
    });
    const store = await Store.create({
      owner: user._id,
      name: shop.name,
      slug,
      description: `Official ${shop.name} store (demo). Browse the line-up and ask a salesperson for a live demonstration.`,
      brandColor: shop.color,
      departments: shop.departments,
      status: 'approved',
      statusChangedAt: new Date(),
      payout: { type: 'till', tillNumber: '000000', registeredName: 'DEMO', verified: false },
    });
    await Product.insertMany(
      store.departments.flatMap((d) =>
        (LINEUP[d.name] ?? []).map(([name, price]) => ({
          store: store._id,
          department: d._id,
          name,
          price,
          images: imagesFor(urls, name),
          stock: 5,
          description: 'Demo product. Ask the salesperson for a demonstration.',
        })),
      ),
    );
  }
  console.log(`Added ${SHOPS.length} demo shops.`);
}

await mongoose.disconnect();
