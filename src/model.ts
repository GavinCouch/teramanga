export type Chapter = {
  id: string;
  number: number;
  title: string;
  pages: string[];
  remote?: boolean;
  serverId?: number;
};
export type Manga = {
  id: string;
  title: string;
  author: string;
  description: string;
  cover: string;
  genres: string[];
  status: "Ongoing" | "Completed";
  chapters: Chapter[];
  source?: string;
  remote?: boolean;
  serverId?: number;
  serverURL?: string;
  sourceId?: string;
  sourceMangaURL?: string;
};
export type Repo = {
  id: string;
  name: string;
  url: string;
  count: number;
  enabled: boolean;
  added: string;
  manga: Manga[];
  importOnly?: boolean;
};
export type Progress = {
  mangaId: string;
  chapterId: string;
  page: number;
  total: number;
  updated: number;
  completed: boolean;
};
export type Preferences = {
  mode: "vertical" | "paged";
  width: number;
  theme: "dark" | "light" | "sepia";
  direction: "ltr" | "rtl";
  gap: boolean;
  dim: number;
};
export type State = {
  library: string[];
  repos: Repo[];
  progress: Record<string, Progress>;
  preferences: Preferences;
  categories: Record<string, string>;
  mangaDexEndpoint: string;
  serverURL: string;
  extensionConfig: { repositories: string[]; packages: string[] };
};
export const defaults: State = {
  library: [],
  repos: [],
  progress: {},
  preferences: {
    mode: "vertical",
    width: 800,
    theme: "dark",
    direction: "ltr",
    gap: true,
    dim: 100,
  },
  categories: {},
  serverURL: "",
  extensionConfig: { repositories: [], packages: [] },
  mangaDexEndpoint: ["localhost", "127.0.0.1"].includes(location.hostname)
    ? "https://api.mangadex.org"
    : "",
};
export function readState(): State {
  try {
    const s = JSON.parse(localStorage.getItem("teramanga.v1") || "null");
    return s ? validateBackup(s) : defaults;
  } catch {
    return defaults;
  }
}
export function safeURL(value: unknown, base: string) {
  if (typeof value !== "string" || !value.trim())
    throw new Error("Every cover and page needs a URL.");
  const u = new URL(value, base);
  if (!["https:", "http:"].includes(u.protocol) || u.username || u.password)
    throw new Error("Only HTTP or HTTPS image URLs are supported.");
  if (location.protocol === "https:" && u.protocol !== "https:")
    throw new Error("The secure reader requires HTTPS images.");
  return u.href;
}
export function validateCatalog(
  data: unknown,
  base: string,
): { name: string; manga: Manga[] } {
  if (!data || typeof data !== "object")
    throw new Error("The repository must be a JSON object.");
  const d = data as Record<string, unknown>;
  if (
    typeof d.name !== "string" ||
    !d.name.trim() ||
    !Array.isArray(d.manga) ||
    d.manga.length > 5000
  )
    throw new Error(
      "A repository needs a name and a manga array (up to 5,000 titles).",
    );
  const ids = new Set<string>();
  const manga = d.manga.map((raw: unknown) => {
    const m = raw as Record<string, unknown>;
    if (
      !m ||
      typeof m.id !== "string" ||
      !m.id ||
      typeof m.title !== "string" ||
      !m.title ||
      !Array.isArray(m.chapters) ||
      m.chapters.length > 10000
    )
      throw new Error("Each manga needs an id, title, and chapters array.");
    if (ids.has(m.id))
      throw new Error("Manga IDs must be unique within a repository.");
    ids.add(m.id);
    const chapterIds = new Set<string>();
    return {
      id: m.id,
      title: m.title.slice(0, 300),
      author: typeof m.author === "string" ? m.author : "Unknown author",
      description: typeof m.description === "string" ? m.description : "",
      cover: safeURL(m.cover, base),
      genres: Array.isArray(m.genres)
        ? m.genres
            .filter((g: unknown): g is string => typeof g === "string")
            .slice(0, 20)
        : [],
      status:
        m.status === "Completed"
          ? ("Completed" as const)
          : ("Ongoing" as const),
      chapters: m.chapters.map((raw: unknown) => {
        const c = raw as Record<string, unknown>;
        if (
          !c ||
          typeof c.id !== "string" ||
          !c.id ||
          chapterIds.has(c.id) ||
          typeof c.number !== "number" ||
          !Number.isFinite(c.number) ||
          !Array.isArray(c.pages) ||
          c.pages.length > 1000
        )
          throw new Error(
            "Each chapter needs a unique id, numeric number, and pages array.",
          );
        chapterIds.add(c.id);
        return {
          id: c.id,
          number: c.number,
          title: typeof c.title === "string" ? c.title : `Chapter ${c.number}`,
          pages: c.pages.map((p: unknown) => safeURL(p, base)),
        };
      }),
    };
  });
  return { name: d.name.slice(0, 200), manga };
}
export function validateBackup(raw: unknown): State {
  const s = raw as State;
  if (
    !s ||
    !Array.isArray(s.library) ||
    !s.library.every((x) => typeof x === "string") ||
    !Array.isArray(s.repos) ||
    !s.progress ||
    typeof s.progress !== "object"
  )
    throw new Error("This is not a Teramanga backup.");
  const repos = s.repos.map((r) => {
    if (
      !r ||
      typeof r.id !== "string" ||
      typeof r.url !== "string" ||
      typeof r.enabled !== "boolean"
    )
      throw new Error("Invalid repository in backup.");
    const catalog = validateCatalog({ name: r.name, manga: r.manga }, r.url);
    if (r.id === "mangadex-saved") {
      catalog.manga = catalog.manga.map((m) => {
        if (!/^md:[0-9a-f-]{36}$/.test(m.id))
          throw new Error("Invalid MangaDex title ID.");
        return {
          ...m,
          remote: true,
          chapters: m.chapters.map((c) => ({ ...c, remote: true })),
        };
      });
    }
    if (r.id.startsWith("suwayomi:")) {
      catalog.manga = catalog.manga.map((m, index) => {
        const original = r.manga[index];
        if (
          !Number.isInteger(original.serverId) ||
          typeof original.serverURL !== "string"
        )
          throw new Error("Invalid extension title in backup.");
        safeURL(original.serverURL, location.href);
        return {
          ...m,
          serverId: original.serverId,
          serverURL: original.serverURL,
          source: original.source,
          sourceId: original.sourceId,
          sourceMangaURL: original.sourceMangaURL,
          chapters: m.chapters.map((c, i) => ({
            ...c,
            serverId: original.chapters[i].serverId,
          })),
        };
      });
    }
    return { ...r, ...catalog, count: catalog.manga.length };
  });
  const progress: Record<string, Progress> = {};
  for (const [id, p] of Object.entries(s.progress)) {
    if (
      !p ||
      typeof p.mangaId !== "string" ||
      typeof p.chapterId !== "string" ||
      !Number.isInteger(p.page) ||
      !Number.isInteger(p.total) ||
      p.page < 0 ||
      p.total < 1 ||
      p.page >= p.total ||
      !Number.isFinite(p.updated) ||
      typeof p.completed !== "boolean"
    )
      throw new Error("Invalid reading progress.");
    progress[id] = p;
  }
  const p = s.preferences || defaults.preferences;
  if (
    !["vertical", "paged"].includes(p.mode) ||
    !["dark", "light", "sepia"].includes(p.theme) ||
    !["ltr", "rtl"].includes(p.direction) ||
    !Number.isFinite(p.width) ||
    p.width < 400 ||
    p.width > 1200 ||
    !Number.isFinite(p.dim) ||
    p.dim < 40 ||
    p.dim > 100
  )
    throw new Error("Invalid reader settings.");
  const categories: Record<string, string> = {};
  for (const [id, c] of Object.entries(s.categories || {})) {
    if (
      typeof c === "string" &&
      ["Reading", "Completed", "Plan to read"].includes(c)
    )
      categories[id] = c;
  }
  const endpoint =
    typeof s.mangaDexEndpoint === "string"
      ? s.mangaDexEndpoint
      : defaults.mangaDexEndpoint;
  if (endpoint) safeURL(endpoint, location.href);
  return {
    library: [...new Set(s.library)],
    repos,
    progress,
    preferences: { ...defaults.preferences, ...p },
    categories,
    extensionConfig: {
      repositories: Array.isArray(s.extensionConfig?.repositories)
        ? s.extensionConfig.repositories.filter(
            (x) => typeof x === "string" && x.startsWith("https://"),
          )
        : [],
      packages: Array.isArray(s.extensionConfig?.packages)
        ? s.extensionConfig.packages.filter(
            (x) => typeof x === "string" && /^[a-zA-Z0-9_.]+$/.test(x),
          )
        : [],
    },
    mangaDexEndpoint: endpoint,
    serverURL:
      typeof s.serverURL === "string"
        ? s.serverURL
          ? safeURL(s.serverURL, location.href).replace(/\/$/, "")
          : ""
        : "",
  };
}
export async function fetchJSON(url: string, signal?: AbortSignal) {
  const response = await fetch(url, {
    signal: signal || AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error(`The source returned HTTP ${response.status}.`);
  const text = await response.text();
  if (text.length > 15_000_000)
    throw new Error("Repository exceeds the 15 MB size limit.");
  return JSON.parse(text);
}
export function exportFile(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
