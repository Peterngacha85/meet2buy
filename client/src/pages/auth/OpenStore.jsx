import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Field.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { DepartmentEditor } from '../../features/seller/DepartmentEditor.jsx';
import { PayoutFields, emptyPayout, payoutBody } from '../../features/seller/PayoutFields.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useFetch } from '../../hooks/useFetch.js';
import { api, apiError } from '../../services/api.js';
import { homeForRole } from '../../store/authStore.js';
import { AuthCard, FormError } from './AuthCard.jsx';

const STEPS = [
  { key: 'account', title: 'Your account', subtitle: 'The person who runs the shop.' },
  { key: 'store', title: 'Your shop', subtitle: 'Your shop name and the departments shoppers will walk into.' },
  { key: 'payout', title: 'Getting paid', subtitle: 'Where Meet2buy sends your money as soon as a buyer pays.' },
];

/** Server field errors look like "account.email" / "payout.tillNumber" → { step, field } */
function splitErrors(fieldErrors) {
  const out = { account: {}, store: {}, payout: {} };
  for (const [path, message] of Object.entries(fieldErrors)) {
    const [step, field = '_'] = path.split('.');
    if (out[step]) out[step][field] ??= message;
  }
  return out;
}

export function OpenStore() {
  const { user, status, registerSeller } = useAuth();
  const navigate = useNavigate();
  const wings = useFetch(() => api.get('/stores/wings'));

  const [step, setStep] = useState(0);
  const [account, setAccount] = useState({ name: '', email: '', phone: '', password: '' });
  const [shop, setShop] = useState({ name: '', description: '', departments: [] });
  const [payout, setPayout] = useState(emptyPayout);
  const [error, setError] = useState({ message: '', fields: splitErrors({}) });
  const [submitting, setSubmitting] = useState(false);

  if (status === 'ready' && user && !submitting) {
    if (user.role !== 'buyer') return <Navigate to={homeForRole(user.role)} replace />;
    return (
      <AuthCard title="Open your shop" subtitle="You are logged in as a shopper.">
        <p className="text-sm text-muted">
          Shops are opened with their own business account. Log out, then open your shop with the business email.
        </p>
      </AuthCard>
    );
  }

  const setA = (e) => setAccount((a) => ({ ...a, [e.target.name]: e.target.value }));
  const current = STEPS[step];

  function localCheck() {
    if (current.key === 'account') {
      const f = {};
      if (account.name.trim().length < 2) f.name = 'Enter your full name';
      if (!/^\S+@\S+\.\S+$/.test(account.email)) f.email = 'Enter a valid email address';
      if (account.phone.replace(/\D/g, '').length < 9) f.phone = 'Enter your phone number';
      if (account.password.length < 8) f.password = 'At least 8 characters';
      return f;
    }
    if (current.key === 'store') {
      const f = {};
      if (shop.name.trim().length < 2) f.name = 'Enter your shop name';
      if (!shop.departments.length) f.departments = 'Add at least one department';
      return f;
    }
    return {};
  }

  async function next(e) {
    e.preventDefault();
    const local = localCheck();
    if (Object.keys(local).length) {
      setError({ message: '', fields: { ...splitErrors({}), [current.key]: local } });
      return;
    }
    setError({ message: '', fields: splitErrors({}) });
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }

    setSubmitting(true);
    try {
      await registerSeller({
        account,
        store: { ...shop, departments: shop.departments.map(({ name, wing }) => ({ name, wing })) },
        payout: payoutBody(payout),
      });
      navigate('/seller', { replace: true });
    } catch (err) {
      const { message, fieldErrors } = apiError(err);
      const fields = splitErrors(fieldErrors);
      const firstBad = STEPS.findIndex((s) => Object.keys(fields[s.key]).length);
      if (firstBad >= 0) setStep(firstBad);
      setError({ message: Object.keys(fieldErrors).length ? '' : message, fields });
      setSubmitting(false);
    }
  }

  const fe = error.fields[current.key];

  return (
    <AuthCard
      title={current.title}
      subtitle={current.subtitle}
      footer={
        <>
          Already selling on Meet2buy?{' '}
          <Link to="/login" className="font-semibold text-navy hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <ol className="mb-6 flex gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex-1">
            <span className={`block h-1.5 rounded-full ${i <= step ? 'bg-orange' : 'bg-line'}`} />
            <span className={`mt-1.5 block text-xs font-medium ${i === step ? 'text-navy' : 'text-muted'}`}>
              {i + 1}. {s.title}
            </span>
          </li>
        ))}
      </ol>

      <form onSubmit={next} noValidate className="space-y-4">
        <FormError message={error.message} />

        {current.key === 'account' && (
          <>
            <Input label="Full name" name="name" autoComplete="name" value={account.name} onChange={setA} error={fe.name} />
            <Input label="Business email" name="email" type="email" autoComplete="email" value={account.email} onChange={setA} error={fe.email} />
            <Input
              label="Phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0712 345 678"
              value={account.phone}
              onChange={setA}
              error={fe.phone}
            />
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              hint="At least 8 characters"
              value={account.password}
              onChange={setA}
              error={fe.password}
            />
          </>
        )}

        {current.key === 'store' && (
          <>
            <Input
              label="Shop name"
              hint="As it should appear on your shop sign, e.g. Hisense"
              value={shop.name}
              onChange={(e) => setShop((s) => ({ ...s, name: e.target.value }))}
              error={fe.name}
            />
            <Textarea
              label="What do you sell? (optional)"
              rows={2}
              maxLength={500}
              value={shop.description}
              onChange={(e) => setShop((s) => ({ ...s, description: e.target.value }))}
              error={fe.description}
            />
            <div>
              <p className="text-sm font-medium text-ink">Departments</p>
              <p className="mb-3 text-sm text-muted">
                Each department gets its own product line-up. You can add your logo and products after this.
              </p>
              {wings.loading ? (
                <Spinner />
              ) : (
                <DepartmentEditor
                  wings={wings.data?.wings ?? []}
                  value={shop.departments}
                  onChange={(departments) => setShop((s) => ({ ...s, departments }))}
                  error={fe.departments}
                />
              )}
            </div>
          </>
        )}

        {current.key === 'payout' && <PayoutFields value={payout} onChange={setPayout} errors={fe} />}

        <div className="flex gap-3 pt-2">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={submitting}>
              <ArrowLeft className="size-4" aria-hidden /> Back
            </Button>
          )}
          <Button type="submit" variant={step === STEPS.length - 1 ? 'accent' : 'primary'} className="flex-1" loading={submitting}>
            {step === STEPS.length - 1 ? (
              'Submit my shop for review'
            ) : (
              <>
                Continue <ArrowRight className="size-4" aria-hidden />
              </>
            )}
          </Button>
        </div>
        {step === STEPS.length - 1 && (
          <p className="text-center text-xs text-muted">Free to join. Meet2buy only earns a commission when you sell.</p>
        )}
      </form>
    </AuthCard>
  );
}
