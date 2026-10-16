import { expect, test } from "@playwright/test";

try {
  process.loadEnvFile(".env"); // ADMIN_TOKEN for the admin-mode test; variables may also already be set
} catch {
  // no .env file
}

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
  // reachable (OpenFreeMap needs no key), and CSP problems show up as console errors.
  const seen: { style: number | null } = { style: null };
  page.on("response", (r) => {
    if (/\/style\.json/.test(r.url())) seen.style = r.status();
  });
  await page.goto("/");

  await expect(page.getByText(/Bukan informasi resmi Pertamina/).first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Menu utama" }).getByRole("button", { name: "Info" })).toBeVisible();
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
  await page.getByRole("button", { name: "Lapor kondisi" }).click();
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

test("home page always shows attribution, privacy link and contact (audit)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/OpenStreetMap contributors/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Kebijakan privasi" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /@/ }).first()).toBeVisible(); // visible contact address
});

test("robots.txt, sitemap and the separate maskable icon exist", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toMatch(/Disallow: \/admin/);
  expect((await request.get("/sitemap.xml")).status()).toBe(200);
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  const maskable = manifest.icons.find((i: { purpose?: string }) => i.purpose === "maskable");
  expect(maskable.src).toBe("/icon-maskable-512.png");
  expect((await request.get("/icon-maskable-512.png")).status()).toBe(200);
});

test("stations API reports its own count", async ({ request }) => {
  const body = await (await request.get("/api/stations")).json();
  expect(body.count).toBe(body.stations.length);
});

test("filter chips narrow the map as well as the list", async ({ page }) => {
  await page.goto("/");
  const map = page.getByTestId("map");
  await expect(page.getByRole("button", { name: "Perbesar daftar" })).toBeVisible();
  await expect.poll(async () => Number(await map.getAttribute("data-station-count")), { timeout: 15_000 }).toBeGreaterThan(100);
  const total = Number(await map.getAttribute("data-station-count"));

  await page.getByRole("button", { name: "Pertashop", exact: true }).click();
  const filtered = Number(await map.getAttribute("data-station-count"));
  expect(filtered).toBeGreaterThan(0);
  expect(filtered).toBeLessThan(total);

  // the list says the same number
  await page.getByRole("button", { name: "Perbesar daftar" }).click();
  await expect(page.getByText(new RegExp(`^${filtered} dari ${total} SPBU`))).toBeVisible();
  expect(await page.locator("ul li button").count()).toBe(filtered);

  // clearing the filter brings every station back on the map
  await page.getByRole("button", { name: "Semua", exact: true }).click();
  expect(Number(await map.getAttribute("data-station-count"))).toBe(total);
});

test("bottom navigation: Lapor tab asks for location, Info tab shows how to read the data", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Menu utama" });
  await nav.getByRole("button", { name: "Lapor" }).click();
  await expect(page.getByRole("heading", { name: "Lapor kondisi SPBU" })).toBeVisible();
  await page.getByRole("button", { name: /Izinkan lokasi/ }).click();
  // the mocked position is in central Denpasar: either a station within 500 m is listed, or the empty state explains why not
  await expect(page.getByText(/Belum ada SPBU dalam radius 500 meter/).or(page.getByRole("list", { name: /radius 500 meter/ }))).toBeVisible({ timeout: 15_000 });

  await nav.getByRole("button", { name: "Info" }).click();
  await expect(page.getByRole("heading", { name: "Cara membaca status" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Call Center Pertamina 135/ })).toBeVisible();
  await nav.getByRole("button", { name: "Peta" }).click();
  await expect(page.getByTestId("map")).toBeVisible();
});

test("nearby row: cards within 5 km by distance, swipe or tap to pick, map stays big", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Gunakan lokasi saya" }).first().click();
  await expect(page.getByRole("heading", { name: /SPBU terdekat dalam radius 5 km/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/bukan ketersediaan BBM/)).toBeVisible();
  const row = page.getByRole("region", { name: "SPBU terdekat" });
  const cards = row.getByRole("button");
  await expect.poll(() => cards.count()).toBeGreaterThan(1);
  await expect(page.getByText(/± \d+ mnt/).first()).toBeVisible();

  // the sheet is compact: the map keeps most of the screen (phone: 375 x 760)
  const sheet = await page.getByRole("button", { name: "Perbesar daftar" }).evaluate((el) => {
    const r = el.parentElement!.getBoundingClientRect();
    return { top: r.top, height: r.height };
  });
  expect(sheet.height).toBeLessThan(760 * 0.4);

  // tapping a card opens that station's details
  const name = (await cards.first().locator("span.line-clamp-2").textContent())!.trim();
  await cards.first().click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Obrolan" })).toBeVisible();
});

test("top of the map is compact: small disclaimer, small filter chips, no official-info banner", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/Bukan informasi resmi Pertamina/).first()).toBeVisible();
  await expect(page.getByText("Info resmi", { exact: true })).toHaveCount(0); // the banner is gone, Info is in the menu
  const chip = await page.getByRole("button", { name: "Pertashop", exact: true }).boundingBox();
  expect(chip!.height).toBeLessThanOrEqual(34);
  const disclaimer = await page.getByRole("button", { name: "Detail disclaimer" }).evaluate((el) => {
    const r = el.parentElement!.getBoundingClientRect();
    return r.height;
  });
  expect(disclaimer).toBeLessThanOrEqual(44);
});

test("station page: summary tiles, fuel chips and the 24-hour chart (history mocked, nothing written)", async ({ page }, info) => {
  const now = Date.now();
  const queue = ["unknown", "sepi", "sepi", "sedang", "panjang", "panjang", "sedang", "unknown", "sepi", "sedang"];
  const stock = ["available", "available", "out", "unconfirmed", "unknown", "available"];
  await page.route("**/api/stations/*", async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    json.timeline = {
      reportCount: 37,
      slots: Array.from({ length: 24 }, (_, i) => ({
        at: new Date(now - (23 - i) * 3_600_000).toISOString(),
        queue: queue[i % queue.length],
        stock: { pertalite: stock[i % stock.length], pertamax: "available" },
      })),
    };
    await route.fulfill({ response: res, json });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Perbesar daftar/ }).click();
  await page.locator("li button").first().click();
  const chart = page.getByRole("region", { name: "Riwayat 24 jam" });
  await expect(chart.getByText("37 laporan")).toBeVisible();
  await expect(chart.getByText(/Tinggi batang = panjang antrean/)).toBeVisible();
  await expect(chart.getByRole("button", { name: "Pertamax" })).toBeVisible();
  await expect(page.getByText("Laporan 24 jam")).toBeVisible();
  await page.screenshot({ path: "test-results/shots/detail-top.png" });
  await chart.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/shots/detail-chart.png" });
  info.annotations.push({ type: "note", description: "screenshots in test-results/shots" });
});

test("admin mode: a wrong token is refused", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Menu utama" }).getByRole("button", { name: "Info" }).click();
  await page.getByRole("button", { name: "Masuk mode admin" }).click();
  await page.getByLabel("Token admin").fill("definitely-not-the-token");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page.getByText("Token salah.")).toBeVisible();
  await expect(page.getByTestId("admin-banner")).toHaveCount(0);
});

test("admin mode: tapping a station on the map shows the edit block (nothing is saved)", async ({ page }) => {
  test.skip(!process.env.ADMIN_TOKEN, "ADMIN_TOKEN is not set");
  await page.goto("/");
  await page.getByRole("navigation", { name: "Menu utama" }).getByRole("button", { name: "Info" }).click();
  await page.getByRole("button", { name: "Masuk mode admin" }).click();
  await page.getByLabel("Token admin").fill(process.env.ADMIN_TOKEN!);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page.getByTestId("admin-banner")).toBeVisible();

  // the session survives a reload
  await page.reload();
  await expect(page.getByTestId("admin-banner")).toBeVisible();

  // open a station from the list: the edit block sits on top of the summary
  await page.getByRole("button", { name: /Perbesar daftar/ }).click();
  await page.locator("li button").first().click();
  const edit = page.getByRole("region", { name: "Edit kondisi (admin)" });
  await expect(edit).toBeVisible();
  await expect(edit.getByRole("button", { name: "Sepi" })).toBeVisible();
  await edit.getByRole("button", { name: "Ubah stok BBM" }).click();
  await edit.getByRole("button", { name: "Habis" }).first().click();
  await expect(edit.getByText(/langsung tampil merah/)).toBeVisible(); // asks to confirm; we cancel
  await edit.getByRole("button", { name: "Batal" }).click();

  await page.getByRole("button", { name: "Kembali ke daftar SPBU" }).click();
  await page.getByRole("button", { name: "Perkecil daftar" }).click();
  await page.getByRole("button", { name: "Keluar", exact: true }).click();
  await expect(page.getByTestId("admin-banner")).toHaveCount(0);
});

test("admin mode: Ada / Habis show which one is selected (the save request is mocked)", async ({ page }) => {
  test.skip(!process.env.ADMIN_TOKEN, "ADMIN_TOKEN is not set");
  await page.route("**/api/admin/reports", async (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({ status: 201, json: { ok: true, id: "00000000-0000-4000-8000-000000000001" } });
    }
    return route.continue();
  });
  await page.route("**/api/admin/reports/*/hide", (route) => route.fulfill({ status: 200, json: { ok: true } }));
  await page.goto("/");
  await page.getByRole("navigation", { name: "Menu utama" }).getByRole("button", { name: "Info" }).click();
  await page.getByRole("button", { name: "Masuk mode admin" }).click();
  await page.getByLabel("Token admin").fill(process.env.ADMIN_TOKEN!);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.getByRole("button", { name: /Perbesar daftar/ }).click();
  await page.locator("li button").first().click();

  const edit = page.getByRole("region", { name: "Edit kondisi (admin)" });
  await edit.getByRole("button", { name: "Ubah stok BBM" }).click();
  const lite = edit.getByRole("group", { name: "Stok Pertalite", exact: true });
  const max = edit.getByRole("group", { name: "Stok Pertamax", exact: true });

  await lite.getByRole("button", { name: "Ada" }).click();
  await expect(lite.getByRole("button", { name: "Ada" })).toHaveAttribute("aria-pressed", "true");
  await expect(lite.getByRole("button", { name: "Habis" })).toHaveAttribute("aria-pressed", "false");

  await max.getByRole("button", { name: "Habis" }).click();
  await edit.getByRole("button", { name: "Ya, habis" }).click();
  await expect(max.getByRole("button", { name: "Habis" })).toHaveAttribute("aria-pressed", "true");
  await expect(max.getByRole("button", { name: "Ada" })).toHaveAttribute("aria-pressed", "false");

  // undo takes the highlight away again
  await edit.getByRole("button", { name: "Urungkan" }).click();
  await expect(max.getByRole("button", { name: "Habis" })).toHaveAttribute("aria-pressed", "false");
});

test("admin mode: one tap on a queue level selects it and reloads the list past the CDN cache", async ({ page }) => {
  test.skip(!process.env.ADMIN_TOKEN, "ADMIN_TOKEN is not set");
  await page.route("**/api/admin/reports", async (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({ status: 201, json: { ok: true, id: "00000000-0000-4000-8000-000000000002" } });
    }
    return route.continue();
  });
  const listRequests: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/stations(\?|$)/.test(r.url())) listRequests.push(r.url());
  });
  await page.goto("/");
  await page.getByRole("navigation", { name: "Menu utama" }).getByRole("button", { name: "Info" }).click();
  await page.getByRole("button", { name: "Masuk mode admin" }).click();
  await page.getByLabel("Token admin").fill(process.env.ADMIN_TOKEN!);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.getByRole("button", { name: /Perbesar daftar/ }).click();
  await page.locator("li button").first().click();

  const edit = page.getByRole("region", { name: "Edit kondisi (admin)" });
  const before = listRequests.length;
  await edit.getByRole("button", { name: /Sedang/ }).click();
  await expect(edit.getByRole("button", { name: /Sedang/ })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => listRequests.slice(before).some((u) => /[?&]fresh=\d+/.test(u))).toBe(true);

  // choosing another level moves the selection in one tap as well
  await edit.getByRole("button", { name: /Panjang/ }).click();
  await expect(edit.getByRole("button", { name: /Panjang/ })).toHaveAttribute("aria-pressed", "true");
  await expect(edit.getByRole("button", { name: /Sedang/ })).toHaveAttribute("aria-pressed", "false");
});

test("station chat tab: notice, and writing is limited to people near the station (nothing is sent)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Perbesar daftar/ }).click();
  await page.locator("li button").first().click();
  await page.getByRole("tab", { name: "Obrolan" }).click();
  await expect(page.getByText(/Belum diverifikasi/)).toBeVisible();
  await expect(page.getByText(/tidak mengubah/)).toBeVisible();
  // the position is not known yet, so there is no message box, only the explanation and the location button
  await expect(page.getByText(/Hanya pengguna dalam radius 500 meter/)).toBeVisible();
  await expect(page.getByLabel(/Tulis pesan/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Izinkan lokasi" })).toBeVisible();
});

test("chat API: reading needs no login, bad ids and bodies are refused, nothing leaks", async ({ request }) => {
  expect((await request.get("/api/stations/not-a-uuid/chat")).status()).toBe(400);
  const id = "00000000-0000-4000-8000-000000000000";
  const post = await request.post(`/api/stations/${id}/chat`, { data: { nope: true } });
  expect(post.status()).toBe(400);
  expect((await request.post(`/api/stations/${id}/chat/not-a-uuid/flag`, { data: {} })).status()).toBe(400);
  expect((await request.get("/api/admin/chat")).status()).toBe(401); // moderation needs the admin token
  expect((await request.post(`/api/admin/chat/${id}/hide`)).status()).toBe(401);
});

test.describe("desktop layout (1280 x 800): list pane on the left, map on the right", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("two panes that do not overlap, list open by default, nav inside the left pane", async ({ page }) => {
    await page.goto("/");
    const canvas = page.locator("canvas.maplibregl-canvas");
    await expect(canvas).toBeVisible({ timeout: 20_000 });
    const mapBox = await page.getByTestId("map").boundingBox();
    expect(mapBox!.x).toBeGreaterThanOrEqual(439);
    expect(mapBox!.x + mapBox!.width).toBeGreaterThanOrEqual(1279);

    // the list is the default content of the left pane, no sheet to pull up
    await expect(page.getByRole("heading", { name: "Daftar SPBU" })).toBeVisible();
    await expect.poll(() => page.locator("li button").count(), { timeout: 15_000 }).toBeGreaterThan(50);
    await expect(page.getByRole("button", { name: /Perbesar daftar|Perkecil daftar/ })).toBeHidden();

    const nav = await page.getByRole("navigation", { name: "Menu utama" }).boundingBox();
    expect(nav!.x).toBe(0);
    expect(nav!.width).toBeLessThanOrEqual(441);
    const noSideScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(noSideScroll).toBe(true);

    // quick filters sit on the map (only one set is visible), and still narrow the list
    await expect(page.getByRole("button", { name: "Pertashop", exact: true })).toHaveCount(1);
    const before = await page.locator("li button").count();
    await page.getByRole("button", { name: "Pertashop", exact: true }).click();
    await expect.poll(() => page.locator("li button").count()).toBeLessThan(before);

    // opening a station keeps the map visible next to it
    await page.getByRole("button", { name: "Semua", exact: true }).click();
    await page.locator("li button").first().click();
    await expect(page.getByRole("tab", { name: "Obrolan" })).toBeVisible();
    await expect(canvas).toBeVisible();

    // Lapor and Info open inside the left pane, not over the whole screen
    await page.getByRole("navigation", { name: "Menu utama" }).getByRole("button", { name: "Info" }).click();
    const info = await page.getByRole("heading", { name: "Cara membaca status" }).boundingBox();
    expect(info!.x + info!.width).toBeLessThanOrEqual(441);
    await expect(canvas).toBeVisible();
  });
});

for (const size of [
  { name: "phone", viewport: { width: 375, height: 760 } },
  { name: "desktop", viewport: { width: 1280, height: 800 } },
]) {
  test(`shared link (?spbu=) opens the station without hydration errors, ${size.name}`, async ({ page, request }) => {
    await page.setViewportSize(size.viewport);
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));

    const { stations } = (await (await request.get("/api/stations")).json()) as { stations: { id: string; name: string }[] };
    const station = stations[0];
    await page.goto(`/?spbu=${station.id}`);
    await expect(page.getByRole("heading", { name: station.name })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1500); // let hydration finish and any error show up

    // the content must not touch the top edge of the pane
    const back = await page.getByRole("button", { name: "Kembali ke daftar SPBU" }).boundingBox();
    if (size.name === "desktop") expect(back!.y).toBeGreaterThanOrEqual(12);

    const hydration = errors.filter((e) => /hydrat|did not match|#418|#423|#425/i.test(e));
    expect(hydration, hydration.join("\n")).toEqual([]);
  });
}

test("admin mode: the edit block follows the card in the nearby row (nothing is saved)", async ({ page }) => {
  test.skip(!process.env.ADMIN_TOKEN, "ADMIN_TOKEN is not set");
  await page.goto("/");
  await page.getByRole("navigation", { name: "Menu utama" }).getByRole("button", { name: "Info" }).click();
  await page.getByRole("button", { name: "Masuk mode admin" }).click();
  await page.getByLabel("Token admin").fill(process.env.ADMIN_TOKEN!);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.getByRole("button", { name: "Gunakan lokasi saya" }).first().click();
  const edit = page.getByRole("region", { name: "Edit kondisi (admin)" });
  await expect(edit).toBeVisible({ timeout: 15_000 });
  await expect(edit.getByRole("button", { name: /Sedang/ })).toBeVisible();
});

test("tapping empty map clears the selected station, tapping a card selects it again", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Gunakan lokasi saya" }).first().click();
  const row = page.getByRole("region", { name: "SPBU terdekat" });
  const selected = row.locator('[aria-current="true"]');
  await expect(row.getByRole("button").nth(1)).toBeVisible({ timeout: 15_000 });
  await expect(selected).toHaveCount(0); // nothing is selected until the reader picks something

  // swiping the second card into the middle selects it (and the map moves to it)
  await row.locator("ul").evaluate((ul) => ul.scrollTo({ left: 300, behavior: "instant" as ScrollBehavior }));
  await expect(selected).toHaveCount(1);
  await page.waitForTimeout(1500); // the map is flying to the station

  // tap places on the map where no station is until the selection clears
  const canvas = page.locator("canvas.maplibregl-canvas");
  let cleared = false;
  for (const [x, y] of [[60, 220], [315, 220], [60, 300], [315, 300], [187, 150]]) {
    await canvas.click({ position: { x, y } });
    await page.waitForTimeout(500);
    if ((await selected.count()) === 0) {
      cleared = true;
      break;
    }
    await row.locator("ul").evaluate((ul) => ul.scrollTo({ left: 300, behavior: "instant" as ScrollBehavior })); // select again
    await page.waitForTimeout(800);
  }
  expect(cleared, "no empty spot on the map cleared the selection").toBe(true);
  expect(new URL(page.url()).searchParams.get("spbu")).toBeNull();

  // From the detail view, a tap on empty map closes it and clears the selection as well
  const tapEmptyMap = async (closed: () => Promise<boolean>) => {
    for (const [x, y] of [[60, 220], [315, 220], [60, 300], [315, 300], [187, 150]]) {
      await canvas.click({ position: { x, y } });
      await page.waitForTimeout(500);
      if (await closed()) return true;
    }
    return false;
  };
  const detailTab = page.getByRole("tab", { name: "Obrolan" });
  await row.getByRole("button").first().click();
  await expect(detailTab).toBeVisible();
  await page.getByRole("button", { name: "Perkecil daftar" }).click(); // shrink the sheet so the map is reachable
  expect(await tapEmptyMap(async () => (await detailTab.count()) === 0), "detail stayed open").toBe(true);
  await expect(row).toBeVisible();
  expect(new URL(page.url()).searchParams.get("spbu")).toBeNull();

  // but a report that is half filled in is not thrown away without asking
  await row.getByRole("button").first().click();
  await page.getByRole("button", { name: "Lapor kondisi" }).click();
  await page.getByRole("button", { name: "Laporkan antrean" }).click();
  await page.getByRole("button", { name: "Perkecil daftar" }).click();
  page.once("dialog", (d) => d.dismiss()); // "no, keep it"
  await tapEmptyMap(async () => (await detailTab.count()) === 0);
  await expect(detailTab).toBeVisible();
  page.on("dialog", (d) => d.accept()); // "yes, close it"
  expect(await tapEmptyMap(async () => (await detailTab.count()) === 0), "detail did not close after confirming").toBe(true);
});
