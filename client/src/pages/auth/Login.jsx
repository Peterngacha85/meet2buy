import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { apiError } from '../../services/api.js';
import { homeForRole } from '../../store/authStore.js';
import { AuthCard, FormError } from './AuthCard.jsx';

// Only allow same-site relative redirects (avoid open redirects).
const safeNext = (value) => (value && value.startsWith('/') && !value.startsWith('//') ? value : null);

export function Login() {
  const { user, status, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState({ message: '', fieldErrors: {} });
  const [submitting, setSubmitting] = useState(false);

  if (status === 'ready' && user && !submitting) return <Navigate to={next ?? homeForRole(user.role)} replace />;

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError({ message: '', fieldErrors: {} });
    try {
      const u = await login(form);
      navigate(next ?? homeForRole(u.role), { replace: true });
    } catch (err) {
      setError(apiError(err));
      setSubmitting(false);
    }
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
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={Object.keys(error.fieldErrors).length ? '' : error.message} />
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
