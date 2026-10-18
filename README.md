# Teramanga

A personal manga reader for the web. Built with React, TypeScript, and Vite; deployable as static files on GitHub Pages. No backend account, database, analytics, or paid service is required.

## Development

Use Node.js 24 and npm:

```sh
npm ci
npm run dev
```

`npm run build` type-checks the application and produces `dist/`. `npm run preview` serves the production build.

`npm test` runs the Playwright integration suite. The cloud environment uses `/usr/bin/chromium`. On another machine, install Playwright Chromium with `npx playwright install chromium` and remove the `executablePath` override in `playwright.config.ts`, or point it to your installed Chromium. Tests cover custom repositories, source validation, reading and resume, collections, chapter completion, backups, and mobile layout.

## Reading

- Personal library with Reading, Completed, and Plan to read collections.
- Search, genre filters, grid/list layouts, and title/last-read sorting.
- Vertical scrolling or single-page reading; adjustable width, brightness, page spacing, and background.
- Arrow-key page navigation with left-to-right or right-to-left direction, fullscreen (`F`), hide controls (`H`), and return (`Escape`).
- Chapter/page navigation, automatic progress, reading history, and explicit chapter completion.
- JSON backup export/restore, including imported catalogs and preferences.

The built-in catalog contains eight **original illustrated demo stories**, each with one five-page chapter. These are sample content, not licensed commercial manga. Cover and chapter SVGs are original project assets.

## Repositories

Tachiyomi/Mihon/Tachimanga Android APK extensions cannot execute in browsers. Teramanga accepts web-compatible JSON catalogs with this structure:

```json
{
  "name": "My catalog",
  "manga": [
    {
      "id": "my-story",
      "title": "My Story",
      "author": "Author",
      "description": "A story you have permission to share.",
      "cover": "https://example.com/cover.jpg",
      "genres": ["Adventure"],
      "status": "Ongoing",
      "chapters": [
        {
          "id": "my-story-1",
          "number": 1,
          "title": "The beginning",
          "pages": ["https://example.com/page-001.jpg"]
        }
      ]
    }
  ]
}
```

Add a URL under **Repositories → Add repository**, or import a JSON file. Relative URLs resolve against the catalog URL. For imported files, provide their original URL when they contain relative image paths. Uploaded file catalogs are snapshots; reimport a new file to update one. HTTP(S) image URLs only; HTTPS is required when the site runs over HTTPS. Manga IDs and chapter IDs must be unique within their respective scopes. Imported IDs are namespaced per repository.

Catalog servers must permit browser access with an appropriate `Access-Control-Allow-Origin` header. Public GitHub raw files generally work. Image hosts may restrict hotlinking. Teramanga cannot bypass authentication, CORS, paywalls, DRM, or source availability restrictions. Only add content you have permission to access.

**Optional MangaDex adapter:** MangaDex does not allow direct browser requests from arbitrary hosted origins, including GitHub Pages. It permits localhost for development. To enable the source on the public site, configure a trusted CORS-compatible MangaDex API gateway in Settings (same route structure as the official API). No gateway is bundled or hosted by this project. The source is hidden until an endpoint is configured. Select it in Discover and click **Search source**; it retrieves safe/suggestive listings and available English chapters (first 100 per selected title). The configured API and image servers must be reachable from the reader's browser. There is no server proxy. API errors are reported; sample stories remain usable. MangaDex titles saved to the library retain their remote source adapter across reloads and backups.

## Storage and privacy

Library metadata, imported catalogs, progress, and preferences are saved in localStorage on the current browser. There is no login or automatic cross-device sync. Export backups in Settings before clearing browser data or changing devices. Restoring a backup replaces local data. Backups contain image URLs, not the actual images; reading requires access to the source. Do not place private credentials in repository URLs. Repository URLs with embedded credentials are rejected.

## Hosting

The GitHub Actions workflow in `.github/workflows/pages.yml` builds and deploys `main` to GitHub Pages. In repository **Settings → Pages**, set the source to **GitHub Actions**. Every push to `main` publishes a new build. The Vite relative base supports the `/teramanga/` project path.

For another static host, run `npm ci && npm run build` and publish `dist/`. There are no server secrets or runtime environment variables to configure.
