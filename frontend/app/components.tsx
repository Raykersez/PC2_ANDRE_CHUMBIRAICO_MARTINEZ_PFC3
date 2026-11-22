import type { ReactNode } from 'react';

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 13.5 6.8 7h14.4l2.8 6.5M6 15v6h16v-6M4 13.5c0 1.8 3.4 2.6 5 0 1.5 2.5 4 2.5 5 0 1.4 2.5 4 2.5 5 0 1.4 2.5 5 1.8 5 0M9 13.5 10 7m4 6.5V7m5 6.5L18 7M11 21v-4h6v4" />
        </svg>
      </span>
      <span>MercaOrden</span>
    </span>
  );
}

export function Field({ name, label, error, helper, children }: {
  name: string; label: string; error?: string; helper?: string; children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {children}
      <span id={name + '-hint'} className={error ? 'field-error' : 'hint'}>{error || helper}</span>
    </div>
  );
}
