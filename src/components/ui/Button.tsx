import * as React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'magic' | 'soft' | 'default' | 'outline' | string;
export type ButtonSize = 'sm' | 'md' | 'lg' | string;

const variants: Record<string, string> = {
  primary: 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 shadow-sm',
  secondary: 'bg-white/90 dark:bg-zinc-900/90 text-zinc-900 dark:text-zinc-100 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 shadow-xs',
  ghost: 'text-zinc-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 hover:text-zinc-950 dark:hover:text-white',
  soft: 'bg-black/5 text-zinc-800 hover:bg-black/10 dark:bg-white/10 dark:text-zinc-200 dark:hover:bg-white/15',
  danger: 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30',
  outline: 'border border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/10 text-zinc-900 dark:text-white',
  default: 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 shadow-sm',
  magic:
    'text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 shadow-md transition-all duration-200',
};

const sizes: Record<string, string> = {
  sm: 'h-8 px-3 text-[0.8rem] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-[10px]',
  lg: 'h-12 px-5 text-[0.95rem] gap-2.5 rounded-xl',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  loading?: boolean;
  block?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      icon,
      loading,
      block,
      className = '',
      children,
      disabled,
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const variantClass = variants[variant] || variants.secondary;
    const sizeClass = sizes[size] || sizes.md;

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={`inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55 cursor-pointer ${variantClass} ${sizeClass} ${
          block ? 'w-full' : ''
        } ${className}`}
        {...rest}
      >
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
