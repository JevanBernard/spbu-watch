import { afterEach, describe, expect, it, vi } from "vitest";
import { turnstileEnabled, verifyTurnstile } from "@/lib/turnstile";

const reply = (body: unknown, ok = true) =>
  vi.fn(async () => ({ ok, json: async () => body }) as unknown as Response) as unknown as typeof fetch;

describe("verifyTurnstile", () => {
  it("accepts a successful verification", async () => {
    expect(await verifyTurnstile("tok", "secret", "1.2.3.4", reply({ success: true }))).toBe(true);
  });
  it("rejects failed verification, http errors, missing token and network errors", async () => {
    expect(await verifyTurnstile("tok", "s", "ip", reply({ success: false }))).toBe(false);
    expect(await verifyTurnstile("tok", "s", "ip", reply({}, false))).toBe(false);
    expect(await verifyTurnstile(undefined, "s", "ip", reply({ success: true }))).toBe(false);
    const boom = vi.fn(async () => {
      throw new Error("down");
    }) as unknown as typeof fetch;
    expect(await verifyTurnstile("tok", "s", "ip", boom)).toBe(false);
  });
  it("sends secret, token and ip", async () => {
    const f = reply({ success: true });
    await verifyTurnstile("tok", "secret", "9.9.9.9", f);
    const body = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body as URLSearchParams;
    expect(body.get("secret")).toBe("secret");
    expect(body.get("response")).toBe("tok");
    expect(body.get("remoteip")).toBe("9.9.9.9");
  });
});

describe("turnstileEnabled", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("needs both keys", () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    expect(turnstileEnabled()).toBe(false);
    vi.stubEnv("TURNSTILE_SECRET_KEY", "s");
    expect(turnstileEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "k");
    expect(turnstileEnabled()).toBe(true);
  });
});
