import { z } from "zod";

/** Only http(s) links: a `javascript:` URL in an <a href> would be an XSS hole. */
const httpUrl = z
  .string()
  .max(500)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "URL harus diawali http:// atau https://");

const fields = {
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(2000),
  sourceName: z.string().trim().min(1).max(100),
  sourceUrl: httpUrl.nullable().optional(),
  publishedAt: z.string().datetime({ offset: true }),
  pinned: z.boolean().optional(),
  active: z.boolean().optional(),
};

export const createOfficialSchema = z.object(fields).strict();

export const patchOfficialSchema = z
  .object({ id: z.string().uuid() })
  .extend(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])))
  .strict()
  .refine((v) => Object.keys(v).length > 1, "Tidak ada perubahan");

export type OfficialInput = z.infer<typeof createOfficialSchema>;

/** Maps API field names to database column names, skipping undefined values. */
export function toColumns(input: Partial<OfficialInput>) {
  const map: Record<string, unknown> = {
    title: input.title,
    body: input.body,
    source_name: input.sourceName,
    source_url: input.sourceUrl,
    published_at: input.publishedAt,
    pinned: input.pinned,
    active: input.active,
  };
  return Object.fromEntries(Object.entries(map).filter(([, v]) => v !== undefined));
}
