"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Matches mobile (tabs): Home, Builds, Plan, Packing. */
const navItems = [
  { id: "home", icon: "home", label: "Home", path: "/home" },
  { id: "builds", icon: "layers", label: "Builds", path: "/builds" },
  { id: "plan", icon: "calendar_today", label: "Plan", path: "/conventions" },
  { id: "packing", icon: "package_2", label: "Packing", path: "/packing" },
];

export function BottomNav({ active }: { active?: string }) {
  const pathname = usePathname();
  const currentActive = active || navItems.find((n) => pathname.startsWith(n.path))?.id || "home";

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-kyar-borderSubtle pb-8 pt-3">
      <div className="flex justify-around items-center px-4">
        {navItems.map((item) => {
          const isActive = currentActive === item.id;
          return (
            <Link
              key={item.id}
              href={item.path}
              className={`flex flex-col items-center gap-1 transition-opacity ${isActive ? "opacity-100" : "opacity-30"} hover:opacity-100`}
            >
              <span className={`material-symbols-outlined text-2xl font-light`}>{item.icon}</span>
              <span className="text-[9px] font-semibold uppercase tracking-widest">
                {item.label}
              </span>
              {isActive && <div className="w-1 h-1 bg-black rounded-full mt-0.5" />}
            </Link>
          );
        })}
      </div>
    </footer>
  );
}
