import { Link } from 'react-router';
import { FullLogo } from '../../components/Logo.jsx';
import { Card } from '../../components/ui/Card.jsx';

export function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-10 sm:py-16">
      <Link to="/" aria-label="Meet2buy home">
        <FullLogo className="w-60" />
      </Link>
      <Card className="mt-8 w-full p-6 sm:p-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </Card>
      {footer && <div className="mt-6 text-sm text-muted">{footer}</div>}
    </div>
  );
}

export function FormError({ message }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-4 rounded-btn border border-danger/30 bg-[#FDE8E7] px-3.5 py-2.5 text-sm text-danger">
      {message}
    </p>
  );
}
