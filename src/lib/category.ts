import gesCodes from "@/data/ges_codes.json";

export type StationCategory = "spbu" | "pertashop" | "spbuk" | "spbbk" | "spbun";

export const CATEGORY_LABEL: Record<StationCategory, string> = {
  spbu: "SPBU",
  pertashop: "Pertashop",
  spbuk: "SPBUK",
  spbbk: "SPBBK",
  spbun: "SPBUN",
};

/** SPBU vs Pertashop (small outlet) vs SPBUK, from the official code prefix, falling back to brand/name. */
export function stationCategory(s: {
  brand?: string | null;
  name?: string | null;
  pertaminaCode?: string | null;
}): StationCategory {
  const code = s.pertaminaCode ?? "";
  if (/^SPBBK\b/i.test(s.name ?? "")) return "spbbk";
  if (code.startsWith("5P") || /pertashop/i.test(`${s.brand ?? ""} ${s.name ?? ""}`)) return "pertashop";
  if (code.startsWith("56.")) return "spbuk";
  if (code.startsWith("58.") || /^SPBUN/i.test(s.name ?? "")) return "spbun";
  return "spbu";
}

export interface GesInfo {
  spklu: boolean; // EV charging
  spbklu: boolean; // battery swap
}

/** Green Energy Station per the official GES list (matched by SPBU code). */
export function gesInfo(code: string | null | undefined): GesInfo | null {
  if (!code) return null;
  return (gesCodes as Record<string, GesInfo>)[code] ?? null;
}
