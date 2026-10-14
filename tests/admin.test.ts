import { afterEach, describe, expect, it, vi } from "vitest";
import { requireAdmin, tokensMatch } from "@/lib/admin";
import { createOfficialSchema, patchOfficialSchema, toColumns } from "@/lib/official";

const req = (token?: string) =>
  new Request("http://x/api/admin/official", { headers: token ? { "x-admin-token": token } : {} });

describe("tokensMatch", () => {
  it.each([
    ["secret-token", "secret-token", true],
    ["secret-token", "secret-tokeN", false],
    ["secret", "secret-token", false],
    ["secret-token-longer-than-expected", "secret-token", false],
    ["", "secret-token", false],
    [null, "secret-token", false],
    [undefined, "secret-token", false],
    ["anything", "", false],
  ])("%s vs %s -> %s", (provided, expected, result) => {
    expect(tokensMatch(provided as string | null | undefined, expected)).toBe(result);
  });
});

describe("requireAdmin", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns 503 when ADMIN_TOKEN is not configured (never open by default)", async () => {
    vi.stubEnv("ADMIN_TOKEN", "");
    const res = requireAdmin(req("whatever"));
    expect(res?.status).toBe(503);
  });

  it("returns 401 for a missing or wrong token", () => {
    vi.stubEnv("ADMIN_TOKEN", "right-token");
    expect(requireAdmin(req())?.status).toBe(401);
    expect(requireAdmin(req("wrong-token"))?.status).toBe(401);
  });

  it("lets the right token through", () => {
    vi.stubEnv("ADMIN_TOKEN", "right-token");
    expect(requireAdmin(req("right-token"))).toBeNull();
  });
});

const valid = {
  title: "Pasokan tambahan",
  body: "Isi informasi.",
  sourceName: "Pertamina",
  sourceUrl: "https://example.com/rilis",
  publishedAt: "2026-10-14T10:00:00.000Z",
};

describe("official update schemas", () => {
  it("accepts a valid update and applies optional flags", () => {
    expect(createOfficialSchema.safeParse(valid).success).toBe(true);
    expect(createOfficialSchema.safeParse({ ...valid, sourceUrl: null, pinned: true }).success).toBe(true);
  });

  it.each([
    ["empty title", { ...valid, title: "  " }],
    ["no source name", { ...valid, sourceName: "" }],
    ["javascript url", { ...valid, sourceUrl: "javascript:alert(1)" }],
    ["data url", { ...valid, sourceUrl: "data:text/html,hi" }],
    ["not a url", { ...valid, sourceUrl: "pertamina" }],
    ["bad date", { ...valid, publishedAt: "kemarin" }],
    ["unknown field", { ...valid, hidden: true }],
  ])("rejects %s", (_n, body) => {
    expect(createOfficialSchema.safeParse(body).success).toBe(false);
  });

  it("patch needs an id and at least one change", () => {
    const id = "3f2b8f0e-5c1a-4c1e-9d55-0b6f6a1e2c11";
    expect(patchOfficialSchema.safeParse({ id, pinned: true }).success).toBe(true);
    expect(patchOfficialSchema.safeParse({ id }).success).toBe(false);
    expect(patchOfficialSchema.safeParse({ pinned: true }).success).toBe(false);
    expect(patchOfficialSchema.safeParse({ id, sourceUrl: "javascript:x" }).success).toBe(false);
  });

  it("toColumns maps names and drops undefined", () => {
    expect(toColumns({ title: "T", sourceName: "S", pinned: false })).toEqual({
      title: "T",
      source_name: "S",
      pinned: false,
    });
    expect(toColumns({ sourceUrl: null })).toEqual({ source_url: null });
  });
});
