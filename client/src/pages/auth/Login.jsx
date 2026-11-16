import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { apiError } from '../../services/api.js';
import { homeForRole } from '../../store/authStore.js';
import { AuthCard, FormError } from './AuthCard.jsx';
import { GoogleButton } from '../../features/auth/GoogleButton.jsx';
import { TermsCheckbox } from '../../features/auth/TermsCheckbox.jsx';

// Only allow same-site relative redirects (avoid open redirects).
const safeNext = (value) => (value && value.startsWith('/') && !value.startsWith('//') ? value : null);

export function Login() {
  const { user, status, login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState({ message: '', fieldErrors: {} });
  const [submitting, setSubmitting] = useState(false);
  // A Google account new to Meet2buy must accept the terms first: the server says so, then we ask.
  const [needsTerms, setNeedsTerms] = useState(false);
  const [accepted, setAccepted] = useState(false);

  if (status === 'ready' && user && !submitting) return <Navigate to={next ?? homeForRole(user.role)} replace />;

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function run(action) {
    setSubmitting(true);
    setError({ message: '', fieldErrors: {} });
    try {
      const u = await action();
      navigate(next ?? homeForRole(u.role), { replace: true });
    } catch (err) {
      const e = apiError(err);
      if (e.fieldErrors.acceptTerms) setNeedsTerms(true);
      setError(e);
      setSubmitting(false);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    run(() => login(form));
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to chat with sellers, join the queue and buy."
      footer={
        <>
          New to Meet2buy?{' '}
          <Link to="/register" className="font-semibold text-navy hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <GoogleButton
        text="signin_with"
        onCredential={(credential) => run(() => loginWithGoogle(credential, accepted))}
        onError={(message) => setError({ message, fieldErrors: {} })}
      />
      {needsTerms && (
        <div className="-mt-2 mb-5 space-y-2">
          <p className="text-sm text-ink">This Google account is new to Meet2buy. Accept the terms, then tap the Google button again.</p>
          <TermsCheckbox
            id="google-terms"
            checked={accepted}
            onChange={(v) => {
              setAccepted(v);
              setError({ message: '', fieldErrors: {} });
            }}
            error={accepted ? undefined : error.fieldErrors.acceptTerms}
          />
        </div>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={Object.keys(error.fieldErrors).length || needsTerms ? '' : error.message} />
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={onChange}
          error={error.fieldErrors.email}
          required
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={onChange}
          error={error.fieldErrors.password}
          required
        />
        <Button type="submit" className="w-full" loading={submitting}>
          Log in
        </Button>
      </form>
    </AuthCard>
  );
}
