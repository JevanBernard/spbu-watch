import type { ReactNode } from "react";
import { MapIcon, MegaphoneIcon, ReportPinIcon } from "./ui";

export type AppTab = "peta" | "lapor" | "info";

const ITEMS: { id: AppTab; label: string; icon: ReactNode }[] = [
  { id: "peta", label: "Peta", icon: <MapIcon /> },
  { id: "lapor", label: "Lapor", icon: <ReportPinIcon /> },
  { id: "info", label: "Info", icon: <MegaphoneIcon /> },
];

/** Three-tab bar at the bottom. "Lapor" is raised because reporting is the main thing a visitor can contribute. */
export default function BottomNav({ tab, onChange }: { tab: AppTab; onChange: (t: AppTab) => void }) {
  return (
    <nav
      aria-label="Menu utama"
      className="absolute inset-x-0 bottom-0 z-50 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(15,23,42,0.08)] md:right-auto md:w-[440px] md:border-r"
    >
      <div className="mx-auto flex h-16 max-w-md items-stretch justify-around">
        {ITEMS.map((it) => {
          const active = tab === it.id;
          const raised = it.id === "lapor";
          return (
            <div key={it.id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(it.id)}
                aria-current={active ? "page" : undefined}
                className={`flex h-full w-full min-w-16 flex-col items-center justify-center gap-0.5 text-xs font-bold ${
                  active ? "text-primary" : "text-slate-600"
                }`}
              >
                <span
                  className={
                    raised
                      ? `flex size-10 items-center justify-center rounded-full shadow-md ${
                          active ? "bg-primary text-white" : "bg-primary-container text-white"
                        }`
                      : `flex h-7 w-14 items-center justify-center rounded-full ${active ? "bg-primary-fixed" : ""}`
                  }
                >
                  {it.icon}
                </span>
                {it.label}
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
