import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { apiError } from '../../services/api.js';
import { homeForRole } from '../../store/authStore.js';
import { AuthCard, FormError } from './AuthCard.jsx';
import { GoogleButton } from '../../features/auth/GoogleButton.jsx';

export function Register() {
  const { user, status, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState({ message: '', fieldErrors: {} });
  const [submitting, setSubmitting] = useState(false);

  if (status === 'ready' && user && !submitting) return <Navigate to={homeForRole(user.role)} replace />;

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError({ message: '', fieldErrors: {} });
    try {
      await register(form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(apiError(err));
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Free for shoppers. Walk the mall, meet sellers, buy live."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-navy hover:underline">
            Log in
          </Link>
          <span className="mx-2">·</span>
          <Link to="/open-store" className="font-semibold text-orange-ink hover:underline">
            Selling? Open a store
          </Link>
        </>
      }
    >
      <GoogleButton
        text="signup_with"
        onCredential={async (credential) => {
          setSubmitting(true);
          setError({ message: '', fieldErrors: {} });
          try {
            const u = await loginWithGoogle(credential);
            navigate(homeForRole(u.role), { replace: true });
          } catch (err) {
            setError(apiError(err));
            setSubmitting(false);
          }
        }}
        onError={(message) => setError({ message, fieldErrors: {} })}
      />
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={Object.keys(error.fieldErrors).length ? '' : error.message} />
        <Input
          label="Full name"
          name="name"
          autoComplete="name"
          value={form.name}
          onChange={onChange}
          error={error.fieldErrors.name}
          required
        />
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
          label="Phone (M-Pesa)"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0712 345 678"
          value={form.phone}
          onChange={onChange}
          error={error.fieldErrors.phone}
          required
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters"
          value={form.password}
          onChange={onChange}
          error={error.fieldErrors.password}
          required
        />
        <Button type="submit" className="w-full" loading={submitting}>
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}
