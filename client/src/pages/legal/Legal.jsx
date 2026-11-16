import { Link } from 'react-router';
import { FileText, ShieldCheck } from 'lucide-react';
import { DEVELOPER, SUPPORT_EMAIL, SUPPORT_PHONE, TERMS_UPDATED } from '../../config/legal.js';

// Terms of Use and Privacy Policy, written from how Meet2buy actually works (live rooms, the counter,
// M-Pesa collection and payouts, commission by price, receipts, after-sales). Change TERMS_UPDATED here
// and TERMS_VERSION on the server whenever the wording changes.

function Contact() {
  if (!SUPPORT_EMAIL && !SUPPORT_PHONE) return <>through the Help section of your account</>;
  return (
    <>
      {SUPPORT_EMAIL && (
        <>
          by email at{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-navy underline">
            {SUPPORT_EMAIL}
          </a>
        </>
      )}
      {SUPPORT_EMAIL && SUPPORT_PHONE && ' or '}
      {SUPPORT_PHONE && (
        <>
          by phone on <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`} className="font-semibold text-navy underline">{SUPPORT_PHONE}</a>
        </>
      )}
    </>
  );
}

function LegalPage({ icon: Icon, title, intro, sections, other }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <span className="grid size-12 place-items-center rounded-full bg-navy-soft text-navy">
        <Icon className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-[32px] font-bold leading-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">Last updated {TERMS_UPDATED}</p>
      <p className="mt-5 text-[16px] leading-relaxed text-ink">{intro}</p>

      <nav aria-label="Contents" className="mt-6 rounded-card border border-line bg-bg-soft p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Contents</p>
        <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-navy hover:underline">
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-8 space-y-8">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-24">
            <h2 className="text-xl font-bold">
              {i + 1}. {s.title}
            </h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-1.5">
              {s.body}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-10 border-t border-line pt-6 text-sm text-muted">
        See also our{' '}
        <Link to={other.to} className="font-semibold text-navy underline">
          {other.label}
        </Link>
        . Meet2buy is developed by{' '}
        <a href={DEVELOPER.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy underline">
          {DEVELOPER.name}
        </a>
        .
      </p>
    </div>
  );
}

const PRIVACY = [
  {
    id: 'who',
    title: 'Who we are',
    body: (
      <>
        <p>
          Meet2buy is an online mall. Shops open live video rooms where shoppers watch products being demonstrated, chat, queue to speak
          with the salesperson at the “counter”, and pay with M-Pesa. Meet2buy is the data controller for the personal data described here,
          under the Kenya Data Protection Act, 2019.
        </p>
        <p>
          You can reach us about your data <Contact />.
        </p>
      </>
    ),
  },
  {
    id: 'collect',
    title: 'What we collect',
    body: (
      <>
        <ul>
          <li>
            <strong>Account details:</strong> your name, email, phone number and password (stored only as a secure hash). If you sign in
            with Google we receive your name, email and profile photo from Google. A guest account holds only the name you give.
          </li>
          <li>
            <strong>Seller details:</strong> the shop name, logo, banner, departments and products, and the M-Pesa Till or Paybill number and
            registered name we pay you to.
          </li>
          <li>
            <strong>Orders and payments:</strong> what you bought, the price, the M-Pesa number you paid from, the M-Pesa receipt number,
            and the delivery name, phone, location and notes you enter at checkout. We keep a receipt for every paid order.
          </li>
          <li>
            <strong>Live rooms:</strong> chat messages (shown to everyone in the room), notes you send the seller when you join the queue,
            demonstration requests, and your place in the queue. Phone numbers and emails typed into chat or notes are hidden automatically.
          </li>
          <li>
            <strong>Video and sound:</strong> a seller’s camera and microphone while their room is live. A shopper’s microphone and camera
            are used only if you turn them on at the counter, and then you are seen and heard by everyone in that room. Meet2buy does not
            record live rooms.
          </li>
          <li>
            <strong>After-sales requests:</strong> complaints you raise about an order, messages exchanged with the seller or Meet2buy, and any
            photos you attach.
          </li>
          <li>
            <strong>Technical data:</strong> a login cookie that keeps you signed in, and basic server logs (time, page requested, IP address)
            used for security. Your browser may also remember your last delivery details on your own device to save typing.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'use',
    title: 'How we use it',
    body: (
      <ul>
        <li>To run your account, the live rooms, the queue and the counter.</li>
        <li>To take payment by M-Pesa, pay sellers after commission, and issue receipts.</li>
        <li>To let the seller deliver your order and handle after-sales requests.</li>
        <li>To send you notifications inside Meet2buy (your turn at the counter, new orders, request updates).</li>
        <li>To keep the platform safe: stop fraud and payment requests outside Meet2buy, review rooms, and suspend accounts that break the Terms.</li>
        <li>To keep the financial records the law requires.</li>
      </ul>
    ),
  },
  {
    id: 'basis',
    title: 'Our lawful basis',
    body: (
      <p>
        We use your data to perform our contract with you (running your account, orders and payouts), to meet legal obligations (tax and
        financial records), for our legitimate interest in keeping Meet2buy safe, and with your consent where we ask for it, such as turning
        on your camera or microphone. You can withdraw consent at any time, for example by turning your camera off.
      </p>
    ),
  },
  {
    id: 'share',
    title: 'Who we share it with',
    body: (
      <>
        <ul>
          <li>
            <strong>The seller you buy from</strong> gets your name, delivery details and order, and any after-sales request you raise with
            them. Sellers must use these only to deliver and support your order.
          </li>
          <li>
            <strong>People in a live room</strong> see your first name, your chat messages, and you (if you turn on your camera or microphone at
            the counter).
          </li>
          <li>
            <strong>Service providers</strong> who process data for us: Safaricom (M-Pesa payments and payouts), LiveKit (live video), Cloudinary
            (photos), MongoDB Atlas (database), Render and Vercel (hosting) and Google (sign-in, if you use it). Some of these store data outside
            Kenya; we use providers with appropriate safeguards as required by the Data Protection Act.
          </li>
          <li>
            <strong>Authorities</strong> when the law requires it, for example the Kenya Revenue Authority or a court order.
          </li>
        </ul>
        <p>We do not sell your personal data, and we do not use it for third-party advertising.</p>
      </>
    ),
  },
  {
    id: 'keep',
    title: 'How long we keep it',
    body: (
      <ul>
        <li>Your account details: until you delete your account.</li>
        <li>Orders, payments, receipts and payouts: at least five years, because tax law requires these records, even if you delete your account.</li>
        <li>After-sales requests: for as long as the order record is kept.</li>
        <li>Live room chat: 90 days, for safety reviews, then deleted automatically.</li>
      </ul>
    ),
  },
  {
    id: 'rights',
    title: 'Your rights',
    body: (
      <>
        <p>Under the Data Protection Act you have the right to:</p>
        <ul>
          <li>be told how your data is used (this policy);</li>
          <li>access the personal data we hold about you;</li>
          <li>have wrong or incomplete data corrected (most details can be changed on your Account page);</li>
          <li>have your data deleted. Use “Delete my account” on your Account page; records the law requires us to keep are retained;</li>
          <li>object to processing, and to receive your data in a portable format.</li>
        </ul>
        <p>
          To use these rights, contact us <Contact />. If you are not satisfied with our answer, you can complain to the Office of the Data
          Protection Commissioner (ODPC), Kenya.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <p>
        Passwords are hashed, the login cookie cannot be read by page scripts, payout details are visible only to the seller and Meet2buy
        admins, and every payment and payout is recorded. No system is perfectly secure: keep your password private and tell us at once if
        you think your account has been used by someone else.
      </p>
    ),
  },
  {
    id: 'children',
    title: 'Age',
    body: <p>Meet2buy is for people aged 18 and over. We do not knowingly collect data from children.</p>,
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        If we change this policy we will update the date at the top and, for important changes, tell you in Meet2buy. The version you accepted
        at sign-up is recorded on your account.
      </p>
    ),
  },
];

const TERMS = [
  {
    id: 'about',
    title: 'About Meet2buy',
    body: (
      <>
        <p>
          Meet2buy is an online mall where independent shops sell to shoppers through live video rooms. Shops (“sellers”) sell their own
          goods. Meet2buy provides the platform and collects payment on the seller’s behalf; the sale itself is between you and the seller.
        </p>
        <p>By creating an account, or using Meet2buy as a guest, you agree to these Terms and to our Privacy Policy.</p>
      </>
    ),
  },
  {
    id: 'accounts',
    title: 'Accounts',
    body: (
      <ul>
        <li>You must be 18 or older and give true details. One person or business per account.</li>
        <li>Keep your password private. You are responsible for what is done with your account.</li>
        <li>Admins are appointed by Meet2buy. Nobody from Meet2buy will ask for your password or M-Pesa PIN.</li>
      </ul>
    ),
  },
  {
    id: 'rooms',
    title: 'Live rooms and the counter',
    body: (
      <ul>
        <li>Anyone can watch a live room. You need an account to chat, join the queue or buy.</li>
        <li>
          At the counter you may turn on your microphone and camera. Everyone in the room can then see and hear you, so do not show
          documents, cards or other private information.
        </li>
        <li>Be respectful. No abuse, hate, spam, or sexual or violent content. Do not record other people without their permission.</li>
        <li>Do not share phone numbers, emails or payment details in chat or notes. Meet2buy hides them automatically.</li>
        <li>Meet2buy may watch rooms for safety, close a room, or suspend accounts that break these Terms.</li>
      </ul>
    ),
  },
  {
    id: 'payments',
    title: 'Prices and payment',
    body: (
      <>
        <ul>
          <li>Prices are in Kenya Shillings. The amount you pay is calculated by Meet2buy from the listed price or the seller’s offer.</li>
          <li>
            <strong>Pay only through Meet2buy.</strong> When you are ready, the seller sends a <em>Pay</em> button to your screen. You enter your
            M-Pesa number and approve the M-Pesa prompt on your phone. Never pay to a Till, Paybill or phone number spoken in a room, sent in
            chat or given outside Meet2buy. Payments made outside Meet2buy are not recorded, receipted or covered by after-sales support.
          </li>
          <li>Once M-Pesa confirms your payment you get a Meet2buy receipt, which you can view and print from My orders at any time.</li>
          <li>
            If M-Pesa confirms a payment we cannot match to an order, Meet2buy holds it and contacts you. We never pay a seller for a payment
            M-Pesa has not confirmed.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'sellers',
    title: 'Selling on Meet2buy',
    body: (
      <ul>
        <li>Shops open after Meet2buy approves them. Meet2buy may ask for documents to verify your business.</li>
        <li>
          List only genuine goods you have the right to sell, with honest descriptions, prices, variations and stock. Use brand names and logos
          only with the brand’s permission.
        </li>
        <li>
          Take payment <strong>only</strong> with Meet2buy’s Pay button. Asking a shopper to pay you directly is a serious breach and can lead to
          suspension.
        </li>
        <li>Deliver what was sold, as agreed with the buyer, and answer after-sales requests promptly and in good faith.</li>
        <li>
          <strong>Commission:</strong> Meet2buy keeps a commission on each sale, based on the selling price of the item (price bands shown in
          your dashboard), unless a different rate was agreed for your shop. The rest is sent to your M-Pesa Till or Paybill as soon as the
          buyer pays. Commission is fixed at the time of each sale.
        </li>
        <li>Keep your payout details correct. Meet2buy is not responsible for money sent to details you entered wrongly.</li>
        <li>You are responsible for your own taxes, licences and any warranty you offer.</li>
      </ul>
    ),
  },
  {
    id: 'delivery',
    title: 'Delivery',
    body: (
      <p>
        The seller arranges delivery using the details you give at checkout, and may call you on the phone number you entered. Delivery times
        and any delivery charges are agreed between you and the seller.
      </p>
    ),
  },
  {
    id: 'aftersales',
    title: 'Returns, complaints and after-sales service',
    body: (
      <>
        <p>
          If something is wrong with an order (not delivered, faulty, damaged, wrong item, or a warranty or repair need), open the order in
          <strong> My orders</strong> and choose <strong>Get help with this order</strong>. You get a reference number, and the seller is told
          at once.
        </p>
        <ul>
          <li>The seller must respond and try to resolve it with you: repair, replacement, refund or another fair solution.</li>
          <li>If you cannot agree, you can ask Meet2buy to step in. We review the messages and the order and help both sides reach a fair outcome.</li>
          <li>
            Refunds are the seller’s responsibility. Your rights under the Consumer Protection Act, 2012 and other Kenyan law are not affected by
            these Terms.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'suspension',
    title: 'Suspension and closing your account',
    body: (
      <p>
        Meet2buy may suspend or close an account, close a live room, or hide products that break these Terms or the law, or that put shoppers
        at risk. You can delete your account at any time from your Account page. Order and payment records are kept as the law requires.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Responsibility',
    body: (
      <p>
        Sellers are responsible for their products, descriptions and deliveries. Meet2buy works to keep the platform available and accurate,
        but live video and M-Pesa depend on networks outside our control, and we cannot guarantee uninterrupted service. As far as the law
        allows, Meet2buy is not liable for indirect losses. Nothing in these Terms limits liability that cannot be limited by Kenyan law.
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Changes and governing law',
    body: (
      <>
        <p>
          We may update these Terms. We will change the date at the top and, for important changes, tell you in Meet2buy. Continuing to use
          Meet2buy after that means you accept the new Terms.
        </p>
        <p>These Terms are governed by the laws of Kenya. Questions? Contact us <Contact />.</p>
      </>
    ),
  },
];

export function PrivacyPolicy() {
  return (
    <LegalPage
      icon={ShieldCheck}
      title="Privacy Policy"
      intro="This policy explains what personal data Meet2buy collects when you shop, sell or watch a live room, why we collect it, who sees it, and the rights you have under the Kenya Data Protection Act, 2019."
      sections={PRIVACY}
      other={{ to: '/terms', label: 'Terms of Use' }}
    />
  );
}

export function TermsOfUse() {
  return (
    <LegalPage
      icon={FileText}
      title="Terms of Use"
      intro="These Terms are the rules for using Meet2buy, for shoppers and sellers. Please read them; you accept them when you create an account."
      sections={TERMS}
      other={{ to: '/privacy', label: 'Privacy Policy' }}
    />
  );
}
