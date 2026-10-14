import { expect, test } from "@playwright/test";

test("home page: disclaimer, map loads under the CSP, station list, no console errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));

  // Headless Chrome with software WebGL sometimes never starts the map, so a missing style request is
  // not a failure. If the style IS requested it must succeed: a 403 usually means this origin is not
  // allowed on the MapTiler key (add http://localhost:3100), and CSP problems show up as console errors.
  const seen: { style: number | null } = { style: null };
  page.on("response", (r) => {
    if (/\/style\.json/.test(r.url())) seen.style = r.status();
  });
  await page.goto("/");

  await expect(page.getByText(/Bukan informasi resmi Pertamina/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Informasi resmi/ })).toBeVisible();
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(6000); // let tiles, glyphs and the worker load (CSP violations log here)
  if (seen.style !== null) expect(seen.style, "map style request").toBe(200);

  await page.getByRole("button", { name: /Perbesar daftar/ }).click();
  await expect(page.locator("li button").first()).toBeVisible({ timeout: 20_000 });
  expect(await page.locator("li button").count()).toBeGreaterThan(50);

  expect(errors, errors.join("\n")).toEqual([]);
});

test("api: stations carry a computed status, official list is public", async ({ request }) => {
  const res = await request.get("/api/stations");
  expect(res.status()).toBe(200);
  const { stations } = await res.json();
  expect(stations.length).toBeGreaterThan(100);
  expect(stations[0]).toHaveProperty("queue.status");
  expect(JSON.stringify(stations)).not.toMatch(/device_id|ip_hash|deviceId/);
  expect((await request.get("/api/official")).status()).toBe(200);
});

test("admin endpoints reject requests without the token", async ({ request }) => {
  expect((await request.get("/api/admin/official")).status()).toBe(401);
  expect((await request.get("/api/admin/reports")).status()).toBe(401);
  const hide = await request.post("/api/admin/reports/00000000-0000-4000-8000-000000000000/hide");
  expect(hide.status()).toBe(401);
});

test("reports endpoint rejects invalid bodies", async ({ request }) => {
  const res = await request.post("/api/reports", { data: { nope: true } });
  expect(res.status()).toBe(400);
});

test("privacy page and admin login render", async ({ page }) => {
  await page.goto("/privasi");
  await expect(page.getByRole("heading", { name: "Privasi" })).toBeVisible();
  await page.goto("/admin");
  await expect(page.getByLabel("Token admin")).toBeVisible();
});

test("security headers are present", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["referrer-policy"]).toBeTruthy();
  expect(h["x-powered-by"]).toBeUndefined();
});

test("report flow reaches the choice step (nothing is submitted)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Perbesar daftar/ }).click();
  await page.locator("li button").first().click();
  await page.getByRole("button", { name: "Laporkan antrean" }).click();
  await page.getByRole("button", { name: /Izinkan lokasi/ }).click();
  await expect(page.getByRole("button", { name: /Sepi/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Panjang/ })).toBeVisible();
});

test("web app manifest is served", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);
  expect((await res.json()).short_name).toBe("SPBU Watch");
});
