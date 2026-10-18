# Teramanga

A browser manga reader with Keiyoushi/Suwayomi extension support and JSON catalogs. The frontend is hosted on [GitHub Pages](https://gavincouch.github.io/teramanga/).

## Development

Node.js 24:

```sh
npm ci
npm run dev
npm run build
npm test
```

`build` runs TypeScript checks and creates `dist/`. `test` runs Playwright against the development server, using `/usr/bin/chromium` in this cloud environment. On another machine, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to your Chromium path, or install Playwright's browser with `npx playwright install chromium` when no system Chromium is installed.

## Keiyoushi

Keiyoushi distributes Android extensions. A static website cannot execute them directly. Teramanga connects to **Suwayomi Server**, which installs and runs the actual extensions and proxies their images.

Use **Settings → Connect server**, then **Repositories → Add repository**. `https://github.com/keiyoushi`, Keiyoushi's old JSON URLs, and its repository website resolve to the current `https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.pb`. Install extensions in the **Extensions** tab, then open **Browse**.

The server supports full chapter lists and handles source networking. Individual sources can break or require browser verification. The free backend disables Chromium to fit its memory allowance.

[Free server setup](docs/free-hosting.md) includes a Render Free blueprint and a Docker option for your own computer. No paid instance, disk, database, or trial credits are requested. Render deployment still requires the owner to connect an account and create the service; saving a blueprint does not deploy it.

## Reading and library

- Search, collections, title/last-read sorting, and grid/list layouts.
- Vertical scrolling or single-page reading with left-to-right/right-to-left keyboard navigation.
- Adjustable page width, brightness, background, and spacing.
- Chapter filtering/sorting, saved page positions, and reading history.
- Fullscreen (`F`), hide controls (`H`), and return (`Escape`).
- Export/restore backups containing metadata and progress, without image files or server credentials.

The initial library is empty. Fictional sample manga and promotional copy from the original version have been removed. Existing imported catalogs and progress remain in browser storage. Legacy demo IDs remain in old backups but are not shown in the interface. The original direct MangaDex API setting is retained in backup parsing for compatibility; native MangaDex access now uses the installed extension.

## JSON catalogs

Use **Repositories → Import JSON** to add a URL or upload a file:

```json
{
  "name": "My catalog",
  "manga": [
    {
      "id": "title-1",
      "title": "Title",
      "author": "Author",
      "cover": "https://example.com/cover.jpg",
      "genres": ["Adventure"],
      "status": "Ongoing",
      "chapters": [
        {
          "id": "chapter-1",
          "number": 1,
          "title": "Chapter 1",
          "pages": ["https://example.com/page-1.jpg"]
        }
      ]
    }
  ]
}
```

Catalog endpoints must allow CORS. Relative image URLs resolve against the catalog URL. Uploaded files using relative paths need their original catalog URL. IDs are namespaced per catalog. On HTTPS deployments, image URLs must also use HTTPS. URL credentials, non-HTTP(S) images, duplicate IDs, and oversized catalogs are rejected.

## Storage and authentication

Library data is stored in localStorage. Extension-server credentials are held in sessionStorage and sent only to the configured server. Protected covers/pages are fetched with authorization headers and displayed as revocable blob URLs; credentials are not included in image URLs or backups. There is no cross-device account or cloud sync.

The free-server restore flow records repository URLs and installed package names. It can reinstall them after a server reset. Manga are reidentified by source ID and original URL; chapter identities use original chapter URLs rather than transient database IDs. This preserves reading positions when the source remains available. Keep browser backups before clearing site data.

## Deployment

`.github/workflows/pages.yml` publishes `main` to GitHub Pages. The Vite relative base supports `/teramanga/`. `render.yaml` defines the optional **Free** extension server. `backend/Dockerfile` pins the verified official Suwayomi image; `compose.yaml` runs the same backend locally with a persistent Docker volume.

[Design research and copy audit](docs/design-research.md).
