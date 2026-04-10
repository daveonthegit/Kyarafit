"use client";

import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "text";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: React.ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-kyar-text text-kyar-bg border-0 hover:opacity-90 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bg disabled:opacity-25 disabled:shadow-none disabled:active:scale-100",
  secondary:
    "bg-transparent text-kyar-text border border-kyar-text hover:opacity-90 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bg disabled:opacity-25 disabled:active:scale-100",
  text:
    "bg-transparent text-kyar-text border-0 border-b border-kyar-text rounded-none hover:opacity-80 active:scale-[0.97] focus:outline-none focus-visible:border-kyar-accent focus-visible:border-b-2 focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bg disabled:opacity-25 disabled:active:scale-100",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className = "", children, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center font-sans-wide font-semibold uppercase text-xs tracking-wider h-[52px] px-4 rounded-sm transition-[opacity,transform,color,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]";
    return (
      <button ref={ref} className={`${base} ${variantClasses[variant]} ${className}`} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
