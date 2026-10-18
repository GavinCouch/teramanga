import { test, expect } from "@playwright/test";
test("library search, collections and list view", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".manga-card")).toHaveCount(6);
  await page.getByRole("textbox", { name: "Search manga" }).fill("midnight");
  await expect(page.locator(".manga-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear search" }).click();
  await page.getByRole("button", { name: "List view" }).click();
  await expect(page.locator(".manga-list")).toBeVisible();
  await page
    .getByRole("button", { name: "Open The Last Light", exact: true })
    .click();
  await page.getByLabel("Manga collection").selectOption("Reading");
  await page.getByRole("button", { name: "Close details" }).click();
  await page
    .locator(".shelf-tabs")
    .getByRole("button", { name: "Reading" })
    .click();
  await expect(page.locator(".manga-card")).toHaveCount(1);
  expect(errors).toEqual([]);
});
test("reader settings, keyboard navigation and resume persist", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start a story" }).click();
  await expect(page.locator(".reader")).toBeVisible();
  await expect(page.locator(".reader-page img")).toHaveCount(5);
  await page.getByRole("button", { name: "Reader settings" }).click();
  await page.getByRole("button", { name: "Single page", exact: true }).click();
  await page.getByRole("button", { name: "sepia reader background" }).click();
  await page
    .getByRole("button", { name: "Close settings", exact: true })
    .click();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".page-controls strong")).toHaveText("2");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".page-controls strong")).toHaveText("3");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.locator(".continue-card")).toHaveCount(1);
  await page.reload();
  await page.locator(".continue-card").click();
  await expect(page.locator(".page-controls strong")).toHaveText("3");
  await expect(page.locator(".reader-sepia")).toBeVisible();
  await expect(page.locator(".reader-page")).toHaveCount(1);
});
test("chapter completion updates library and history", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start a story" }).click();
  await page.getByRole("button", { name: "Finish & return" }).click();
  await page
    .locator(".shelf-tabs")
    .getByRole("button", { name: "Completed" })
    .click();
  await expect(page.locator(".manga-card")).toHaveCount(1);
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "History" })
    .click();
  await expect(page.locator(".manga-card")).toHaveCount(1);
  await expect(page.locator(".history-date")).toBeVisible();
});
test("connect, read and refresh a custom repository", async ({ page }) => {
  const catalog = {
    name: "Test source",
    manga: [
      {
        id: "test",
        title: "A Test Story",
        author: "Test Author",
        description: "A story from your source.",
        cover: "http://127.0.0.1:5173/demo/orbit.svg",
        genres: ["Sci-fi"],
        chapters: [
          {
            id: "one",
            number: 1,
            title: "First steps",
            pages: ["http://127.0.0.1:5173/demo/orbit-page-1.svg"],
          },
        ],
      },
    ],
  };
  await page.route("https://catalog.example.org/catalog.json", (route) =>
    route.fulfill({ json: catalog }),
  );
  await page.goto("/");
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Repositories" })
    .click();
  await page
    .getByRole("button", { name: "Add repository", exact: true })
    .click();
  await page
    .getByLabel("Repository URL")
    .fill("https://catalog.example.org/catalog.json");
  await page.getByRole("button", { name: "Connect repository" }).click();
  await expect(
    page.getByRole("button", { name: "Open A Test Story", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open A Test Story", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add to library", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start reading", exact: true })
    .click();
  await expect(page.locator(".reader-page img")).toBeVisible();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "Close details" }).click();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Repositories" })
    .click();
  await page.getByRole("button", { name: "Refresh Test source" }).click();
  await expect(page.getByRole("status")).toContainText("Repository refreshed");
  await page.reload();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Discover" })
    .click();
  await expect(
    page.getByRole("button", { name: "Open A Test Story", exact: true }),
  ).toBeVisible();
});
test("invalid catalogs and failed requests show actionable errors", async ({
  page,
}) => {
  await page.route("https://catalog.example.org/bad.json", (route) =>
    route.fulfill({
      json: {
        name: "Broken",
        manga: [
          {
            id: "x",
            title: "Unsafe",
            cover: "javascript:alert(1)",
            chapters: [],
          },
        ],
      },
    }),
  );
  await page.goto("/");
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Repositories" })
    .click();
  await page
    .getByRole("button", { name: "Add repository", exact: true })
    .click();
  await page
    .getByLabel("Repository URL")
    .fill("https://catalog.example.org/bad.json");
  await page.getByRole("button", { name: "Connect repository" }).click();
  await expect(page.getByRole("alert")).toContainText("Only HTTP or HTTPS");
});
test("backup export and restore include reading data", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start a story" }).click();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page
    .locator(".sidebar-bottom")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  const dl = await downloadPromise;
  expect(dl.suggestedFilename()).toBe("teramanga-backup.json");
  const before = await page.evaluate(() =>
    localStorage.getItem("teramanga.v1"),
  );
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(before!),
    });
  await expect(page.getByRole("status")).toContainText("restored");
  await page.reload();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "History" })
    .click();
  await expect(page.locator(".manga-card")).toHaveCount(1);
});
test("mobile library and reader fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".manga-card")).toHaveCount(6);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/teramanga-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Repositories" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your repositories." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Library" })
    .click();
  await page.getByRole("button", { name: "Start a story" }).click();
  await page.getByRole("button", { name: "Reader settings" }).click();
  await expect(page.locator(".reader-settings")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("desktop screenshot and sample images load", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1120 });
  await page.goto("/");
  await expect(page.locator(".manga-card")).toHaveCount(6);
  for (const img of await page.locator(".cover-button img").all()) {
    await expect(img).toBeVisible();
    expect(
      await img.evaluate(
        (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
      ),
    ).toBe(true);
  }
  await page.screenshot({ path: "/tmp/teramanga-desktop.png", fullPage: true });
});
test("vertical reader tracks visible pages and restores the scroll position", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start a story" }).click();
  await page.locator(".reader-page").nth(2).scrollIntoViewIfNeeded();
  await expect(page.locator(".page-controls strong")).toHaveText("3");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.locator(".continue-card").click();
  await expect(page.locator(".page-controls strong")).toHaveText("3");
  await expect(page.locator(".reader-page").nth(2)).toBeInViewport();
});
test("MangaDex adapter remains functional after saving and reloading", async ({
  page,
}) => {
  const id = "11111111-1111-1111-1111-111111111111";
  const chapter = "22222222-2222-2222-2222-222222222222";
  await page.route("https://api.mangadex.org/**", (route) => {
    const u = route.request().url();
    if (u.includes("/at-home/"))
      return route.fulfill({
        json: {
          baseUrl: "https://images.example.org",
          chapter: { hash: "test", data: ["page.svg"] },
        },
      });
    if (u.includes("/feed?"))
      return route.fulfill({
        json: {
          data: [
            {
              id: chapter,
              attributes: {
                chapter: "1",
                title: "Remote chapter",
                externalUrl: null,
              },
            },
          ],
        },
      });
    return route.fulfill({
      json: {
        data: [
          {
            id,
            attributes: {
              title: { en: "Remote Manga" },
              description: { en: "Live adapter test" },
              tags: [],
              status: "ongoing",
            },
            relationships: [],
          },
        ],
      },
    });
  });
  await page.route("https://images.example.org/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1450"><rect width="900" height="1450" fill="white"/></svg>',
    }),
  );
  await page.goto("/");
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Discover" })
    .click();
  await page.getByLabel("Choose source").selectOption("MangaDex");
  await page
    .getByRole("button", { name: "Search source", exact: true })
    .click();
  await page.getByRole("button", { name: "Open Remote Manga" }).click();
  await page
    .getByRole("button", { name: "Add to library", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Open Remote Manga" }).click();
  await page
    .getByRole("button", { name: "Start reading", exact: true })
    .click();
  await expect(page.locator(".reader-title")).toContainText("Remote chapter");
  await expect(page.locator(".reader-page img")).toBeVisible();
  expect(
    await page
      .locator(".reader-page img")
      .evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
  ).toBe(true);
});
