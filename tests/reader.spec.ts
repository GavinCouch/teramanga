import { test, expect, type Page } from "@playwright/test";
const origin = "http://127.0.0.1:5173";
const prefs = {
  mode: "vertical",
  width: 800,
  theme: "dark",
  direction: "ltr",
  gap: true,
  dim: 100,
};
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1450"><rect width="900" height="1450" fill="#eee"/><path d="M25 25h850v430H25zm0 460h850v430H25zm0 460h850v480H25" fill="#ddd" stroke="#222" stroke-width="4"/></svg>';
const fixture = (id: string, title: string) => ({
  id,
  title,
  author: "Test author",
  description: "Test description.",
  cover: origin + "/placeholder.svg",
  genres: ["Adventure"],
  status: "Ongoing",
  chapters: [
    {
      id: id + "-1",
      number: 1,
      title: "Chapter one",
      pages: Array.from(
        { length: 5 },
        (_, i) => origin + "/test-pages/" + i + ".svg",
      ),
    },
  ],
});
function stored() {
  const manga = [
    fixture("a", "Alpha"),
    fixture("b", "Beta"),
    fixture("c", "Gamma"),
  ];
  return {
    library: ["a", "b", "c"],
    repos: [
      {
        id: "fixture",
        name: "Test catalog",
        url: origin + "/catalog.json",
        count: 3,
        enabled: true,
        added: "2026-01-01",
        manga,
      },
    ],
    progress: {},
    preferences: prefs,
    categories: {},
    mangaDexEndpoint: "",
    serverURL: "",
  };
}
async function seed(page: Page) {
  await page.addInitScript((data) => {
    if (!localStorage.getItem("teramanga.v1"))
      localStorage.setItem("teramanga.v1", JSON.stringify(data));
  }, stored());
  await page.route("**/test-pages/**", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: svg }),
  );
}
async function openAlpha(page: Page) {
  await page.getByRole("button", { name: "Open Alpha", exact: true }).click();
  await page.getByRole("button", { name: "Read", exact: true }).click();
  await expect(page.locator(".reader")).toBeVisible();
}
test("empty library uses neutral greys and contains no decorative content", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your library is empty" }),
  ).toBeVisible();
  await expect(page.locator(".hero")).toHaveCount(0);
  await expect(page.locator(".manga-card")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor === "rgba(0, 0, 0, 0)"
        ? getComputedStyle(document.documentElement).backgroundColor
        : getComputedStyle(document.body).backgroundColor,
    ),
  ).toBe("rgb(25, 25, 28)");
  await expect(page.locator("body")).not.toContainText("Your next chapter");
});
test("library search, collection changes and list layout", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await expect(page.locator(".manga-card")).toHaveCount(3);
  await page.getByLabel("Search manga").fill("Alpha");
  await expect(page.locator(".manga-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear search" }).click();
  await page.getByRole("button", { name: "List view" }).click();
  await expect(page.locator(".manga-list")).toBeVisible();
  await page.getByRole("button", { name: "Open Alpha", exact: true }).click();
  await page.getByLabel("Manga collection").selectOption("Reading");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .locator(".shelf-tabs")
    .getByRole("button", { name: "Reading" })
    .click();
  await expect(page.locator(".manga-card")).toHaveCount(1);
});
test("reader mode, direction, background and resume persist", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/");
  await openAlpha(page);
  await page.getByRole("button", { name: "Reader settings" }).click();
  await page.getByRole("button", { name: "Single page", exact: true }).click();
  await page
    .getByRole("button", { name: "Right to left", exact: true })
    .click();
  await page.getByRole("button", { name: "light reader background" }).click();
  await page
    .getByRole("button", { name: "Close settings", exact: true })
    .click();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".page-controls strong")).toHaveText("3");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.reload();
  await page.locator(".continue-card").click();
  await expect(page.locator(".page-controls strong")).toHaveText("3");
  await expect(page.locator(".reader-light")).toBeVisible();
  await expect(page.locator(".reader-page")).toHaveCount(1);
});
test("vertical reader tracks pages and chapter completion", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/");
  await openAlpha(page);
  await page.locator(".reader-page").nth(2).scrollIntoViewIfNeeded();
  await expect(page.locator(".page-controls strong")).toHaveText("3");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.locator(".continue-card").click();
  await expect(page.locator(".reader-page").nth(2)).toBeInViewport();
  await page.getByRole("button", { name: "Finish & return" }).click();
  await page
    .locator(".shelf-tabs")
    .getByRole("button", { name: "Completed" })
    .click();
  await expect(page.locator(".manga-card")).toHaveCount(1);
  await page.locator("nav").getByRole("button", { name: "History" }).click();
  await expect(page.locator(".history-date")).toBeVisible();
});
test("JSON catalogs import, refresh and reject unsafe image URLs", async ({
  page,
}) => {
  await page.route("https://catalog.example.org/good.json", (r) =>
    r.fulfill({
      json: { name: "New catalog", manga: [fixture("new", "New title")] },
    }),
  );
  await page.route("https://catalog.example.org/bad.json", (r) =>
    r.fulfill({
      json: {
        name: "Unsafe",
        manga: [
          { ...fixture("unsafe", "Unsafe"), cover: "javascript:alert(1)" },
        ],
      },
    }),
  );
  await page.goto("/");
  await page
    .locator("nav")
    .getByRole("button", { name: "Repositories" })
    .click();
  await page.getByRole("button", { name: "Import JSON", exact: true }).click();
  await page
    .getByLabel("Repository URL")
    .fill("https://catalog.example.org/bad.json");
  await page.getByRole("button", { name: "Connect repository" }).click();
  await expect(page.getByRole("alert")).toContainText("Only HTTP or HTTPS");
  await page
    .getByLabel("Repository URL")
    .fill("https://catalog.example.org/good.json");
  await page.getByRole("button", { name: "Connect repository" }).click();
  await page
    .getByRole("button", { name: "Open New title", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add to library", exact: true })
    .click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Repositories" })
    .click();
  await page.getByRole("button", { name: "Refresh New catalog" }).click();
  await expect(page.getByRole("status")).toContainText("Catalog refreshed");
});
const backend = "https://server.example.org";
const sourceId = "9223372036854775001";
const extension = {
  pkgName: "eu.kanade.tachiyomi.extension.all.mangadex",
  name: "MangaDex",
  lang: "all",
  versionName: "1.6",
  isInstalled: false,
  hasUpdate: false,
  isObsolete: false,
  iconUrl: "/icons/md.png",
  storeIndexUrl:
    "https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.pb",
  contentWarning: "SAFE",
};
const source = {
  id: sourceId,
  name: "MangaDex",
  displayName: "MangaDex (EN)",
  lang: "en",
  iconUrl: "/icons/md.png",
  supportsLatest: true,
  extension: { pkgName: extension.pkgName },
};
async function mockServer(page: Page) {
  const requests: { query: string; variables: any; authorization: string }[] =
    [];
  let installed = false;
  await page.route(backend + "/**", async (route) => {
    if (!route.request().url().endsWith("/api/graphql")) {
      expect(route.request().headers().authorization).toMatch(/^Basic /);
      return route.fulfill({ contentType: "image/svg+xml", body: svg });
    }
    const { query, variables } = route.request().postDataJSON();
    requests.push({
      query,
      variables,
      authorization: route.request().headers().authorization || "",
    });
    let data: any;
    if (query.includes("addExtensionStore"))
      data = {
        addExtensionStore: {
          extensionStore: {
            name: "Keiyoushi",
            indexUrl: variables.input.indexUrl,
          },
        },
      };
    else if (query.includes("updateExtension")) {
      installed = true;
      data = {
        updateExtension: { extension: { ...extension, isInstalled: true } },
      };
    } else if (query.includes("fetchSourceManga"))
      data = {
        fetchSourceManga: {
          mangas: [
            {
              id: 42,
              title: "Remote title",
              author: "Remote author",
              description: "Description",
              thumbnailUrl: "/covers/42.jpg",
              genre: ["Adventure"],
              status: "ONGOING",
              source: { displayName: "MangaDex (EN)" },
            },
          ],
          hasNextPage: false,
        },
      };
    else if (query.includes("fetchMangaAndChapters"))
      data = {
        fetchMangaAndChapters: {
          manga: {
            id: 42,
            title: "Remote title",
            author: "Remote author",
            thumbnailUrl: "/covers/42.jpg",
            genre: ["Adventure"],
            status: "ONGOING",
            source: { displayName: "MangaDex (EN)" },
          },
          chapters: [{ id: 99, name: "First chapter", chapterNumber: 1 }],
        },
      };
    else if (query.includes("fetchChapterPages"))
      data = {
        fetchChapterPages: { pages: ["/pages/99/0.jpg", "/pages/99/1.jpg"] },
      };
    else if (query.includes("fetchExtensions"))
      data = {
        fetchExtensions: {
          extensions: [{ ...extension, isInstalled: installed }],
          extensionStores: [
            { name: "Keiyoushi", indexUrl: extension.storeIndexUrl },
          ],
        },
      };
    else if (query.includes("extensions {"))
      data = {
        extensions: { nodes: [{ ...extension, isInstalled: installed }] },
        extensionStores: {
          nodes: [{ name: "Keiyoushi", indexUrl: extension.storeIndexUrl }],
        },
      };
    else if (query.includes("aboutServer"))
      data = {
        aboutServer: { name: "Suwayomi", version: "2.4" },
        sources: { totalCount: installed ? 1 : 0 },
      };
    else data = { sources: { nodes: installed ? [source] : [] } };
    await route.fulfill({ json: { data } });
  });
  return requests;
}
async function connect(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "No extension server" }).click();
  await page.getByLabel("Server URL").fill(backend);
  await page.getByLabel("Username", { exact: true }).fill("reader");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Server connected" }),
  ).toBeVisible();
}
test("Keiyoushi repository installs real extension-shaped records and browses exact source IDs", async ({
  page,
}) => {
  const calls = await mockServer(page);
  await connect(page);
  await page
    .locator("nav")
    .getByRole("button", { name: "Repositories" })
    .click();
  await page
    .getByRole("button", { name: "Add repository", exact: true })
    .click();
  await page.getByLabel("Repository URL").fill("https://github.com/keiyoushi");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add repository", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Install", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Install", exact: true }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Browse", exact: true })
    .click();
  await page.getByRole("button", { name: "MangaDex (EN) English" }).click();
  await page
    .getByRole("button", { name: "Open Remote title", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "First chapter Chapter 1" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add to library", exact: true })
    .click();
  await page.getByRole("button", { name: "Read", exact: true }).click();
  await expect(page.locator(".reader-page")).toHaveCount(2);
  await expect
    .poll(() =>
      page
        .locator(".reader-page img")
        .first()
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    )
    .toBe(true);
  expect(
    calls.find((c) => c.query.includes("addExtensionStore"))?.variables.input
      .indexUrl,
  ).toBe(extension.storeIndexUrl);
  expect(
    calls.find((c) => c.query.includes("fetchSourceManga"))?.variables.input
      .source,
  ).toBe(sourceId);
  expect(calls.every((c) => c.authorization.startsWith("Basic "))).toBe(true);
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Open Remote title", exact: true })
    .click();
  await expect(
    page
      .getByRole("button", { name: "Read", exact: true })
      .or(page.getByRole("button", { name: "Continue", exact: true })),
  ).toBeVisible();
});
test("connection errors remain visible and do not mark the server connected", async ({
  page,
}) => {
  await page.route(backend + "/**", (route) =>
    route.fulfill({ status: 401, body: "Unauthorized" }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "No extension server" }).click();
  await page.getByLabel("Server URL").fill(backend);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Sign in",
  );
  await expect(
    page.getByRole("button", { name: "Server connected" }),
  ).toHaveCount(0);
});
test("backup export and restore keep reading data and exclude server credentials", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/");
  await openAlpha(page);
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page
    .locator(".sidebar-bottom")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  const promise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  expect((await promise).suggestedFilename()).toBe("teramanga-backup.json");
  const backup = await page.evaluate(() =>
    localStorage.getItem("teramanga.v1"),
  );
  expect(backup).not.toContain("test-password");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(backup!),
    });
  await expect(page.getByRole("status")).toContainText("Backup restored");
  await page.reload();
  await page.locator("nav").getByRole("button", { name: "History" }).click();
  await expect(page.locator(".manga-card")).toHaveCount(1);
});
test("mobile controls, library and dialogs fit a narrow viewport", async ({
  page,
}) => {
  await seed(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".manga-card")).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/teramanga-redesign-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Repositories" })
    .click();
  await page
    .getByRole("button", { name: "Add repository", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.locator("nav").getByRole("button", { name: "Library" }).click();
  await openAlpha(page);
  await page.getByRole("button", { name: "Reader settings" }).click();
  await expect(page.locator(".reader-settings")).toBeVisible();
});
test("desktop interface loads without browser errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator(".manga-card")).toHaveCount(3);
  await page.screenshot({
    path: "/tmp/teramanga-redesign-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("free-server resets restore extensions and rebind chapters without losing the saved page", async ({
  page,
}) => {
  const chapterURL = "/chapter/original";
  const chapterId =
    "suwayomi-chapter:" +
    encodeURIComponent(backend) +
    ":" +
    encodeURIComponent(chapterURL);
  const book = {
    ...fixture("stable-title", "Remote title"),
    cover: backend + "/covers/17",
    serverId: 17,
    serverURL: backend,
    sourceId,
    sourceMangaURL: "/title/original",
    chapters: [
      {
        id: chapterId,
        serverId: 18,
        number: 1,
        title: "First chapter",
        pages: [],
      },
    ],
  };
  const state = {
    ...stored(),
    serverURL: backend,
    extensionConfig: {
      repositories: [extension.storeIndexUrl],
      packages: [extension.pkgName],
    },
    library: [book.id],
    repos: [
      {
        id: "suwayomi:" + backend,
        name: "Extension library",
        url: backend,
        count: 1,
        enabled: true,
        added: "2026-01-01",
        manga: [book],
      },
    ],
    progress: {
      [book.id]: {
        mangaId: book.id,
        chapterId,
        page: 1,
        total: 2,
        updated: Date.now(),
        completed: false,
      },
    },
  };
  await page.addInitScript((data) => {
    localStorage.setItem("teramanga.v1", JSON.stringify(data));
    sessionStorage.setItem(
      "teramanga.auth",
      JSON.stringify({
        url: "https://server.example.org",
        authorization: "Basic " + btoa("reader:test"),
      }),
    );
  }, state);
  let installed = false;
  let found = false;
  const fetchedIds: number[] = [];
  const raw = {
    id: 42,
    url: "/title/original",
    sourceId,
    title: "Remote title",
    thumbnailUrl: "/covers/42",
    genre: [],
    status: "ONGOING",
    source: { displayName: "MangaDex (EN)" },
  };
  await page.route(backend + "/**", async (route) => {
    if (!route.request().url().endsWith("/api/graphql"))
      return route.fulfill({ contentType: "image/svg+xml", body: svg });
    const { query, variables } = route.request().postDataJSON();
    let data: any;
    if (query.includes("addExtensionStore"))
      data = {
        addExtensionStore: {
          extensionStore: {
            name: "Keiyoushi",
            indexUrl: extension.storeIndexUrl,
          },
        },
      };
    else if (query.includes("fetchExtensions"))
      data = {
        fetchExtensions: {
          extensions: [{ ...extension, isInstalled: installed }],
          extensionStores: [
            { name: "Keiyoushi", indexUrl: extension.storeIndexUrl },
          ],
        },
      };
    else if (query.includes("updateExtension")) {
      installed = true;
      data = {
        updateExtension: { extension: { ...extension, isInstalled: true } },
      };
    } else if (query.includes("query Resolve"))
      data = { mangas: { nodes: found ? [raw] : [] } };
    else if (query.includes("fetchSourceManga")) {
      expect(variables.input.source).toBe(sourceId);
      found = true;
      data = { fetchSourceManga: { mangas: [raw], hasNextPage: false } };
    } else if (query.includes("fetchMangaAndChapters")) {
      fetchedIds.push(variables.input.id);
      data = {
        fetchMangaAndChapters: {
          manga: raw,
          chapters: [
            {
              id: 99,
              url: chapterURL,
              name: "First chapter",
              chapterNumber: 1,
            },
          ],
        },
      };
    } else if (query.includes("fetchChapterPages")) {
      expect(variables.input.chapterId).toBe(99);
      data = { fetchChapterPages: { pages: ["/pages/99/0", "/pages/99/1"] } };
    } else if (query.includes("extensions {"))
      data = {
        extensions: { nodes: [{ ...extension, isInstalled: installed }] },
        extensionStores: {
          nodes: [{ name: "Keiyoushi", indexUrl: extension.storeIndexUrl }],
        },
      };
    else data = { sources: { nodes: installed ? [source] : [] } };
    await route.fulfill({ json: { data } });
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Restore extensions", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Restore extensions", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Extensions restored");
  await page
    .getByRole("button", { name: "Open Remote title", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".page-controls strong")).toHaveText("2");
  expect(fetchedIds.length).toBeGreaterThan(0);
  expect(fetchedIds.every((id) => id === 42)).toBe(true);
});
