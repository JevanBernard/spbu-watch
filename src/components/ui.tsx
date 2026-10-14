import type { ReactNode } from "react";

/** Toggle chip for the horizontally scrolling filter row. 44 px tall for touch. */
export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors ${
        active
          ? "border-blue-900 bg-blue-900 text-white"
          : "border-slate-300 bg-white text-slate-800 active:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

const icon = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const NavIcon = () => (
  <svg {...icon}>
    <path d="M3 11l18-8-8 18-2-8-8-2z" />
  </svg>
);
export const LocateIcon = () => (
  <svg {...icon}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    <circle cx="12" cy="12" r="8" />
  </svg>
);
export const ShareIcon = () => (
  <svg {...icon}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" />
  </svg>
);
export const BackIcon = () => (
  <svg {...icon}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
export const SearchIcon = () => (
  <svg {...icon}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);
export const SlidersIcon = () => (
  <svg {...icon}>
    <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="8" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </svg>
);

/** Round 44 px icon button. */
export function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-11 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-blue-900 shadow-sm active:bg-slate-100"
    >
      {children}
    </button>
  );
}

export function routeUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
