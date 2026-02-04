'use client';

import { forwardRef, useState } from 'react';

interface UnderlineInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const UnderlineInput = forwardRef<HTMLInputElement, UnderlineInputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    const [focused, setFocused] = useState(false);
    return (
      <div className="w-full">
        {label && (
          <label className="block text-[11px] font-sans-wide font-semibold uppercase tracking-wide text-kyar-meta mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          className={`w-full bg-transparent border-0 border-b text-sm md:text-base text-kyar-text placeholder:text-kyar-textTertiary outline-none py-2 ${
            focused ? 'border-kyar-accent border-b-2' : 'border-black border-b'
          } ${error ? 'border-kyar-danger' : ''} ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-kyar-danger">{error}</p>
        )}
      </div>
    );
  }
);
UnderlineInput.displayName = 'UnderlineInput';
