import type { ReactNode } from "react";
import { travelMinutes } from "@/lib/format";

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
      className={`inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-[13px] font-semibold whitespace-nowrap transition-colors [&_svg]:size-4 ${
        active
          ? "border-ink bg-ink text-white"
          : "border-line bg-white text-slate-800 shadow-sm active:bg-slate-100"
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
export const GasIcon = () => (
  <svg {...icon}>
    <path d="M4 21V5a2 2 0 012-2h6a2 2 0 012 2v16M3 21h12M7 8h4M14 9h2a2 2 0 012 2v5a1.5 1.5 0 003 0V9l-3-3" />
  </svg>
);
export const TimerIcon = () => (
  <svg {...icon}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2 2M10 2h4" />
  </svg>
);
export const CheckCircleIcon = () => (
  <svg {...icon}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.5 2.5L16 9.5" />
  </svg>
);
export const InfoIcon = () => (
  <svg {...icon}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
export const AlertIcon = () => (
  <svg {...icon}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v6M12 16.5h.01" />
  </svg>
);
export const BoltIcon = () => (
  <svg {...icon}>
    <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
  </svg>
);
export const ClockIcon = () => (
  <svg {...icon}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const StoreIcon = () => (
  <svg {...icon}>
    <path d="M4 9l1.5-5h13L20 9M4 9h16M4 9v11h16V9M9 20v-6h6v6" />
  </svg>
);
export const SyncIcon = () => (
  <svg {...icon}>
    <path d="M20 11a8 8 0 00-14-4M4 4v4h4M4 13a8 8 0 0014 4M20 20v-4h-4" />
  </svg>
);
export const UserShieldIcon = () => (
  <svg {...icon}>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
    <circle cx="12" cy="10" r="2" />
    <path d="M8.5 16a4 4 0 017 0" />
  </svg>
);
export const MapIcon = () => (
  <svg {...icon}>
    <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />
  </svg>
);
export const ReportPinIcon = () => (
  <svg {...icon}>
    <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11zM12 7v6M9 10h6" />
  </svg>
);
export const MegaphoneIcon = () => (
  <svg {...icon}>
    <path d="M3 11v2a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1zM15 9a4 4 0 010 6M18 6a8 8 0 010 12" />
  </svg>
);
export const PhoneIcon = () => (
  <svg {...icon}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
  </svg>
);
export const ShieldIcon = () => (
  <svg {...icon}>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4" />
  </svg>
);
export const ChevronDownIcon = () => (
  <svg {...icon}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const ChevronRightIcon = () => (
  <svg {...icon}>
    <path d="M9 6l6 6-6 6" />
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
  compact = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  /** 40 px instead of 44 px, for controls that float on the map. */
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex ${compact ? "size-10" : "size-11"} shrink-0 items-center justify-center rounded-full border border-line bg-white text-primary shadow-md active:bg-slate-100`}
    >
      {children}
    </button>
  );
}

export function routeUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** "± 2 mnt": a rough motorbike estimate from the straight-line distance. Not navigation. */
export function TravelEstimate({ distance, className = "" }: { distance: number; className?: string }) {
  return (
    <span
      className={`tnum ${className}`}
      title="Perkiraan kasar dengan sepeda motor dari jarak lurus. Bukan navigasi."
    >
      ± {travelMinutes(distance)} mnt
    </span>
  );
}
