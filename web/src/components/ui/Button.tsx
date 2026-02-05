"use client";

import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "text";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: React.ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-black text-white border-0 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-kyar-accent focus:ring-offset-2 disabled:opacity-25 disabled:shadow-none",
  secondary:
    "bg-transparent text-black border border-black hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-kyar-accent focus:ring-offset-2 disabled:opacity-25",
  text: "bg-transparent text-black border-0 border-b border-black rounded-none hover:opacity-80 focus:outline-none focus:border-kyar-accent focus:border-b-2 disabled:opacity-25",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className = "", children, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center font-sans-wide font-semibold uppercase text-xs tracking-wider h-[52px] px-4 rounded-sm transition-opacity";
    return (
      <button ref={ref} className={`${base} ${variantClasses[variant]} ${className}`} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
