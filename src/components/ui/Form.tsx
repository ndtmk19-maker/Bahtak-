import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

export function Field({ label, hint, children, htmlFor, aside }: { label: ReactNode; hint?: ReactNode; children: ReactNode; htmlFor?: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[0.8rem] font-semibold text-zinc-800 dark:text-zinc-200">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {hint && <p className="text-[0.74rem] leading-relaxed text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}

type WithLabel = { label: ReactNode; hint?: ReactNode; aside?: ReactNode };

export function TextInput({ label, hint, aside, className = '', ...rest }: WithLabel & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id} aside={aside}>
      <input id={id} type="text" className={`field ${className}`} {...rest} />
    </Field>
  );
}

export function TextArea({ label, hint, aside, className = '', ...rest }: WithLabel & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id} aside={aside}>
      <textarea id={id} className={`field resize-y scroll-thin ${className}`} {...rest} />
    </Field>
  );
}

export function SelectInput({ label, hint, aside, className = '', children, style, ...rest }: WithLabel & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id} aside={aside}>
      <select id={id} className={`field cursor-pointer [color-scheme:dark] dark:bg-zinc-900/90 dark:text-zinc-100 ${className}`} style={{ colorScheme: 'dark', ...style }} {...rest}>
        {children}
      </select>
    </Field>
  );
}
