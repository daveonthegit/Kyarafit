"use client";

import { forwardRef } from "react";

interface UnderlineInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const UnderlineInput = forwardRef<HTMLInputElement, UnderlineInputProps>(
  ({ label, error, className = "", value, ...props }, ref) => {
    const borderState = error
      ? "border-b border-kyar-danger group-focus-within:border-kyar-danger"
      : "border-b border-kyar-border group-focus-within:border-kyar-text";

    return (
      <div className="w-full group">
        {label && (
          <label className="block text-[11px] font-sans-wide font-semibold uppercase tracking-wide text-kyar-meta mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          value={value ?? ""}
          className={`w-full bg-transparent border-0 text-sm md:text-base text-kyar-text placeholder:text-kyar-textTertiary outline-none py-2 transition-colors ${borderState} ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-kyar-danger">{error}</p>}
      </div>
    );
  }
);
UnderlineInput.displayName = "UnderlineInput";
