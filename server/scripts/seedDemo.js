// Demo shops for showing the mall concept before real sellers join.
//   npm run seed:demo            add (or refresh) the demo shops
//   npm run seed:demo -- --remove   delete every demo shop, account and product
// Demo accounts use @demo.meet2buy.test emails and random passwords (they cannot be logged into).
// Logos are left empty on purpose: each business uploads its own logo from the seller dashboard.
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { env, isProd } from '../src/config/env.js';
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

if (isProd && !process.argv.includes('--force')) {
  console.error('Refusing to seed demo shops with NODE_ENV=production (add --force if you really mean it).');
  process.exit(1);
}

await mongoose.connect(env.MONGO_URI);

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

if (!process.argv.includes('--remove')) {
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
          stock: 5,
          description: 'Demo product. Ask the salesperson for a demonstration.',
        })),
      ),
    );
  }
  console.log(`Added ${SHOPS.length} demo shops.`);
}

await mongoose.disconnect();
