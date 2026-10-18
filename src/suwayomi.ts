import type { Manga, Chapter } from "./model";
export const KEIYOUSHI =
  "https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.pb";
export type Extension = {
  pkgName: string;
  name: string;
  lang: string;
  versionName: string;
  isInstalled: boolean;
  hasUpdate: boolean;
  isObsolete: boolean;
  iconUrl: string;
  storeIndexUrl?: string;
  contentWarning?: string;
};
export type Source = {
  id: string;
  name: string;
  displayName: string;
  lang: string;
  iconUrl: string;
  supportsLatest: boolean;
  homeUrl?: string;
  extension: { pkgName: string };
};
export type Store = { name: string; indexUrl: string };
type ServerManga = {
  url?: string;
  sourceId?: string;
  id: number;
  title: string;
  author?: string;
  description?: string;
  thumbnailUrl?: string;
  genre: string[];
  status: string;
  source?: { displayName: string };
};
const mangaFields =
  "id url sourceId title author description thumbnailUrl genre status source { displayName }";
export function normalizeServer(value: string) {
  const u = new URL(value.trim());
  if (u.username || u.password || u.search || u.hash)
    throw new Error(
      "Enter a server URL without credentials or query parameters.",
    );
  if (
    u.protocol !== "https:" &&
    !(u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname))
  )
    throw new Error("Use HTTPS, or HTTP for a server on localhost.");
  return u.href.replace(/\/$/, "").replace(/\/api\/graphql$/, "");
}
export function setServerAuth(url: string, authorization: string) {
  if (authorization)
    sessionStorage.setItem(
      "teramanga.auth",
      JSON.stringify({ url, authorization }),
    );
  else sessionStorage.removeItem("teramanga.auth");
}
export function authFor(url: string) {
  try {
    const s = JSON.parse(sessionStorage.getItem("teramanga.auth") || "null");
    return s && url.startsWith(s.url + "/") ? (s.authorization as string) : "";
  } catch {
    return "";
  }
}
export function basicAuthorization(username: string, password: string) {
  if (!username && !password) return "";
  const bytes = new TextEncoder().encode(username + ":" + password);
  return "Basic " + btoa(String.fromCharCode(...bytes));
}
export class Suwayomi {
  constructor(
    public url: string,
    private authorization?: string,
  ) {}
  async request<T>(
    query: string,
    variables: Record<string, unknown> = {},
  ): Promise<T> {
    if (!this.url) throw new Error("Connect an extension server first.");
    let response: Response;
    try {
      const authorization =
        this.authorization ?? authFor(this.url + "/api/graphql");
      response = await fetch(this.url + "/api/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authorization ? { Authorization: authorization } : {}),
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(90000),
      });
    } catch (e) {
      throw new Error(
        (e as Error).name === "TimeoutError"
          ? "The server or source timed out. Free servers may need time to wake; try again."
          : "Cannot reach the extension server. Check its URL and CORS settings.",
      );
    }
    if (response.status === 401 || response.status === 403)
      throw new Error("Sign in to the extension server in Settings.");
    if (!response.ok)
      throw new Error(`Server returned HTTP ${response.status}.`);
    const body = await response.json();
    if (body.errors?.length)
      throw new Error(
        String(body.errors[0].message)
          .split(/\r?\n/)[0]
          .replace(/^Exception while fetching data \([^)]*\)\s*:\s*/, ""),
      );
    if (!body.data) throw new Error("The server returned no data.");
    return body.data;
  }
  async check() {
    return this.request<{
      aboutServer: { name: string; version: string };
      sources: { totalCount: number };
    }>("{ aboutServer { name version } sources(first:1) { totalCount } }");
  }
  async sources() {
    const d = await this.request<{ sources: { nodes: Source[] } }>(
      "{ sources { nodes { id name displayName lang iconUrl supportsLatest homeUrl extension { pkgName } } } }",
    );
    return d.sources.nodes.filter((s) => s.id !== "0");
  }
  async extensions(refresh = false) {
    const fields =
      "pkgName name lang versionName isInstalled hasUpdate isObsolete iconUrl storeIndexUrl contentWarning";
    if (refresh) {
      const d = await this.request<{
        fetchExtensions: { extensions: Extension[]; extensionStores: Store[] };
      }>(
        `mutation { fetchExtensions(input:{}) { extensions { ${fields} } extensionStores { name indexUrl } } }`,
      );
      return d.fetchExtensions;
    }
    const d = await this.request<{
      extensions: { nodes: Extension[] };
      extensionStores: { nodes: Store[] };
    }>(
      `{ extensions { nodes { ${fields} } } extensionStores { nodes { name indexUrl } } }`,
    );
    return {
      extensions: d.extensions.nodes.filter((e) => e.pkgName !== "local"),
      extensionStores: d.extensionStores.nodes,
    };
  }
  async addRepository(indexUrl: string) {
    const input = normalizeRepository(indexUrl);
    return this.request(
      "mutation AddRepository($input:AddExtensionStoreInput!){ addExtensionStore(input:$input) { extensionStore { name indexUrl } } }",
      { input: { indexUrl: input } },
    );
  }
  async removeRepository(indexUrl: string) {
    return this.request(
      "mutation RemoveRepository($input:RemoveExtensionStoreInput!){ removeExtensionStore(input:$input) { extensionStore { indexUrl } } }",
      { input: { indexUrl } },
    );
  }
  async install(
    pkg: string,
    action: "install" | "update" | "uninstall" = "install",
  ) {
    return this.request(
      "mutation Extension($input:UpdateExtensionInput!){ updateExtension(input:$input) { extension { pkgName isInstalled hasUpdate } } }",
      { input: { id: pkg, patch: { [action]: true } } },
    );
  }
  resource(path?: string) {
    return path
      ? new URL(path, this.url + "/").href
      : new URL(
          "./placeholder.svg",
          new URL(import.meta.env.BASE_URL, location.href),
        ).href;
  }
  manga(m: ServerManga): Manga {
    return {
      id:
        "suwayomi:" +
        encodeURIComponent(this.url) +
        ":" +
        (m.sourceId && m.url
          ? m.sourceId + ":" + encodeURIComponent(m.url)
          : m.id),
      serverId: m.id,
      serverURL: this.url,
      sourceId: m.sourceId,
      sourceMangaURL: m.url,
      title: m.title,
      author: m.author || "",
      description: m.description || "",
      cover: this.resource(m.thumbnailUrl),
      genres: m.genre || [],
      status: m.status === "COMPLETED" ? "Completed" : "Ongoing",
      chapters: [],
      source: m.source?.displayName || "",
    };
  }
  async browse(
    source: string,
    query = "",
    page = 1,
    mode: "POPULAR" | "LATEST" | "SEARCH" = "POPULAR",
  ) {
    const d = await this.request<{
      fetchSourceManga: { mangas: ServerManga[]; hasNextPage: boolean };
    }>(
      `mutation Browse($input:FetchSourceMangaInput!){ fetchSourceManga(input:$input) { mangas { ${mangaFields} } hasNextPage } }`,
      { input: { source, type: query ? "SEARCH" : mode, page, query } },
    );
    return {
      manga: d.fetchSourceManga.mangas.map((m) => this.manga(m)),
      hasNextPage: d.fetchSourceManga.hasNextPage,
    };
  }
  async resolve(m: Manga) {
    if (!m.sourceId || !m.sourceMangaURL) return m.serverId;
    const d = await this.request<{ mangas: { nodes: ServerManga[] } }>(
      `query Resolve($source:LongString!,$url:String!){mangas(condition:{sourceId:$source,url:$url}){nodes{${mangaFields}}}}`,
      { source: m.sourceId, url: m.sourceMangaURL },
    );
    const existing = d.mangas.nodes.find(
      (x) => x.url === m.sourceMangaURL && x.sourceId === m.sourceId,
    );
    if (existing) return existing.id;
    for (let page = 1; page <= 3; page++) {
      const found = await this.browse(m.sourceId, m.title, page);
      const match = found.manga.find(
        (x) => x.sourceMangaURL === m.sourceMangaURL,
      );
      if (match) return match.serverId;
      if (!found.hasNextPage) break;
    }
    throw new Error(
      "Source data was reset. Restore extensions, then find this title in its source to reconnect it.",
    );
  }
  async details(m: Manga) {
    const resolvedId = await this.resolve(m);
    const d = await this.request<{
      fetchMangaAndChapters: {
        manga: ServerManga;
        chapters: {
          url?: string;
          id: number;
          name: string;
          chapterNumber: number;
        }[];
      };
    }>(
      `mutation Details($input:FetchMangaAndChaptersInput!){ fetchMangaAndChapters(input:$input) { manga { ${mangaFields} } chapters { id url name chapterNumber } } }`,
      { input: { id: resolvedId, fetchManga: true, fetchChapters: true } },
    );
    return {
      ...this.manga(d.fetchMangaAndChapters.manga),
      id: m.id,
      chapters: d.fetchMangaAndChapters.chapters
        .map((c) => ({
          id:
            "suwayomi-chapter:" +
            encodeURIComponent(this.url) +
            ":" +
            (c.url ? encodeURIComponent(c.url) : c.id),
          serverId: c.id,
          number: c.chapterNumber,
          title: c.name,
          pages: [],
        }))
        .sort((a, b) => a.number - b.number),
    };
  }
  async pages(chapter: Chapter) {
    const d = await this.request<{ fetchChapterPages: { pages: string[] } }>(
      "mutation Pages($input:FetchChapterPagesInput!){ fetchChapterPages(input:$input) { pages } }",
      { input: { chapterId: chapter.serverId } },
    );
    return {
      ...chapter,
      pages: d.fetchChapterPages.pages.map((p) => this.resource(p)),
    };
  }
}
export function normalizeRepository(value: string) {
  let url = value.trim();
  if (
    /^https:\/\/(?:github\.com\/keiyoushi(?:\/extensions(?:\/.*)?)?|keiyoushi\.github\.io(?:\/.*)?)\/?$/.test(
      url,
    ) ||
    url.includes("raw.githubusercontent.com/keiyoushi/extensions/")
  )
    return KEIYOUSHI;
  const u = new URL(url);
  if (u.protocol !== "https:" || u.username || u.password)
    throw new Error("Use an HTTPS repository URL.");
  if (u.hostname === "github.com") {
    u.hostname = "raw.githubusercontent.com";
    u.pathname = u.pathname.replace("/raw/", "/").replace("/blob/", "/");
  }
  return u.href;
}
