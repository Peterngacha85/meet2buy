import { Link } from 'react-router';
import { Loader2 } from 'lucide-react';

// Colour roles (doc 03): navy = actions, orange = money/live (with navy text for contrast).
const variants = {
  primary: 'bg-navy text-white hover:bg-navy-dark',
  accent: 'bg-orange text-navy hover:bg-orange-dark',
  outline: 'border border-navy text-navy hover:bg-navy-soft',
  ghost: 'text-navy hover:bg-navy-soft',
  danger: 'bg-danger text-white hover:brightness-95',
  inverse: 'bg-white text-navy hover:bg-navy-soft',
};

const sizes = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-13 px-7 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  to,
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-btn font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${className}`;

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
