import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  Library,
  Compass,
  Clock3,
  Settings,
  Search,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  LayoutGrid,
  List,
  SlidersHorizontal,
  RefreshCw,
  Trash2,
  Download,
  Upload,
  Bookmark,
  Menu,
  Layers,
  LoaderCircle,
  Server,
  ExternalLink,
  Plug,
  ArrowLeft,
  Ellipsis,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  type Manga,
  type Chapter,
  type Repo,
  type State,
  type Progress,
  readState,
  validateBackup,
  exportFile,
  validateCatalog,
  fetchJSON,
} from "./model";
import {
  Suwayomi,
  KEIYOUSHI,
  type Source,
  type Extension,
  type Store,
  normalizeServer,
  normalizeRepository,
  basicAuthorization,
  setServerAuth,
} from "./suwayomi";
import Reader from "./Reader";
import CatalogDialog from "./CatalogDialog";
import ContentImage from "./ContentImage";
const menu = [
  { name: "Library", icon: Library },
  { name: "Browse", icon: Compass },
  { name: "History", icon: Clock3 },
  { name: "Repositories", icon: Layers },
];
const language = (code: string) => {
  if (code === "all") return "All languages";
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) || code;
  } catch {
    return code === "all" ? "All languages" : code;
  }
};
export default function App() {
  const [state, setState] = useState<State>(readState);
  const [view, setView] = useState("Library");
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState("Recently added");
  const [layout, setLayout] = useState("grid");
  const [genre, setGenre] = useState("All genres");
  const [filters, setFilters] = useState(false);
  const [details, setDetails] = useState<Manga | null>(null);
  const [reader, setReader] = useState<{
    manga: Manga;
    chapter: Chapter;
    page: number;
  } | null>(null);
  const [catalogDialog, setCatalogDialog] = useState(false);
  const [repoDialog, setRepoDialog] = useState(false);
  const [connectDialog, setConnectDialog] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [serverStatus, setServerStatus] = useState<
    "disconnected" | "connecting" | "connected" | "error"
  >("disconnected");
  const [repoTab, setRepoTab] = useState("Repositories");
  const [extensionLang, setExtensionLang] = useState("en");
  const [showAdult, setShowAdult] = useState(false);
  const [extensionSearch, setExtensionSearch] = useState("");
  const [browseSource, setBrowseSource] = useState<Source | null>(null);
  const [browseCatalog, setBrowseCatalog] = useState(false);
  const [catalogId, setCatalogId] = useState("");
  const [results, setResults] = useState<Manga[]>([]);
  const [browsePage, setBrowsePage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [browseMode, setBrowseMode] = useState<"POPULAR" | "LATEST">("POPULAR");
  const [chapterFilter, setChapterFilter] = useState("");
  const [chapterDescending, setChapterDescending] = useState(true);
  const [uninstall, setUninstall] = useState<Extension | null>(null);
  const [removeRepo, setRemoveRepo] = useState<Repo | null>(null);
  const [historyConfirm, setHistoryConfirm] = useState(false);
  const restoreRef = useRef<HTMLInputElement>(null);
  const client = useMemo(
    () => new Suwayomi(state.serverURL),
    [state.serverURL],
  );
  const requestID = useRef(0);
  useEffect(() => {
    try {
      localStorage.setItem("teramanga.v1", JSON.stringify(state));
    } catch {
      setError(
        "Browser storage is full. Export a backup before closing this page.",
      );
    }
  }, [state]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);
  async function loadServer(refresh = false, api = client) {
    if (!api.url) return;
    setServerStatus("connecting");
    try {
      const [s, e] = await Promise.all([
        api.sources(),
        api.extensions(refresh),
      ]);
      setSources(s);
      setExtensions(e.extensions);
      setStores(e.extensionStores);
      setServerStatus("connected");
      setState((previous) => {
        const installed = e.extensions
          .filter((x) => x.isInstalled)
          .map((x) => x.pkgName);
        if (!installed.length && previous.extensionConfig.packages.length)
          return previous;
        return {
          ...previous,
          extensionConfig: {
            repositories: e.extensionStores.map((x) => x.indexUrl),
            packages: installed,
          },
        };
      });
    } catch (e) {
      setServerStatus("error");
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    setSources([]);
    setExtensions([]);
    setStores([]);
    if (state.serverURL) loadServer();
    else setServerStatus("disconnected");
  }, [client]);
  function navigate(next: string) {
    requestID.current++;
    setView(next);
    setMobile(false);
    setBusy("");
    setQuery("");
    setGenre("All genres");
    setError("");
    setFilters(false);
    setBrowseSource(null);
    setBrowseCatalog(false);
    setCatalogId("");
    setResults([]);
  }
  const catalogs = state.repos.filter((r) => !r.id.startsWith("suwayomi:"));
  const allManga = useMemo<Manga[]>(
    () =>
      state.repos
        .filter((r) => r.enabled)
        .flatMap((r) =>
          r.manga.map((m) => ({ ...m, source: m.source || r.name })),
        )
        .filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i),
    [state.repos],
  );
  const library = allManga.filter((m) => state.library.includes(m.id));
  const history = Object.values(state.progress)
    .sort((a, b) => b.updated - a.updated)
    .map((p) => ({ m: allManga.find((m) => m.id === p.mangaId), p }))
    .filter((x): x is { m: Manga; p: Progress } => !!x.m);
  const continued = history.filter((x) => !x.p.completed);
  const collection = (m: Manga) =>
    state.categories[m.id] ||
    (state.progress[m.id]?.completed
      ? "Completed"
      : state.progress[m.id]
        ? "Reading"
        : "Plan to read");
  let shown = (
    view === "Browse"
      ? browseSource
        ? results
        : catalogs
            .filter((r) => r.enabled && (!catalogId || r.id === catalogId))
            .flatMap((r) => r.manga.map((m) => ({ ...m, source: r.name })))
      : view === "History"
        ? history.map((x) => x.m)
        : library
  ).filter(
    (m) =>
      browseSource ||
      m.title.toLowerCase().includes(query.toLowerCase()) ||
      m.author.toLowerCase().includes(query.toLowerCase()),
  );
  if (view === "Library" && filter !== "All")
    shown = shown.filter((m) => collection(m) === filter);
  if (genre !== "All genres")
    shown = shown.filter((m) => m.genres.includes(genre));
  if (sort === "Title") shown.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "Last read")
    shown.sort(
      (a, b) =>
        (state.progress[b.id]?.updated || 0) -
        (state.progress[a.id]?.updated || 0),
    );
  if (sort === "Recently added" && view === "Library")
    shown.sort(
      (a, b) => state.library.indexOf(b.id) - state.library.indexOf(a.id),
    );
  function remember(m: Manga) {
    if (m.serverId === undefined) return;
    const id = "suwayomi:" + m.serverURL;
    setState((s) => {
      const found = s.repos.find((r) => r.id === id);
      return {
        ...s,
        repos: found
          ? s.repos.map((r) =>
              r.id === id
                ? {
                    ...r,
                    manga: [...r.manga.filter((x) => x.id !== m.id), m],
                    count: r.manga.filter((x) => x.id !== m.id).length + 1,
                  }
                : r,
            )
          : [
              ...s.repos,
              {
                id,
                name: "Extension library",
                url: m.serverURL!,
                enabled: true,
                count: 1,
                added: new Date().toISOString(),
                manga: [m],
              },
            ],
      };
    });
  }
  function toggleLibrary(m: Manga) {
    remember(m);
    setState((s) => ({
      ...s,
      library: s.library.includes(m.id)
        ? s.library.filter((id) => id !== m.id)
        : [...s.library, m.id],
    }));
    setNotice(
      state.library.includes(m.id)
        ? "Removed from library"
        : "Added to library",
    );
  }
  async function openDetails(m: Manga) {
    setDetails(m);
    setChapterFilter("");
    if (m.serverId === undefined) return;
    if (m.serverURL !== state.serverURL) {
      setError("Connect the server used for this title in Settings.");
      return;
    }
    setBusy("details");
    try {
      const updated = await client.details(m);
      setDetails((current) => (current?.id === m.id ? updated : current));
      remember(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function read(m: Manga, chosen?: Chapter, restart = false) {
    setBusy("read");
    try {
      let title = m;
      if (m.serverId !== undefined && m.serverURL !== state.serverURL)
        throw new Error("Connect the server used for this title in Settings.");
      if (m.serverId !== undefined) {
        title = await client.details(m);
        remember(title);
      }
      let chapter = chosen
        ? title.chapters.find((c) => c.id === chosen.id) ||
          title.chapters.find(
            (c) => c.number === chosen.number && c.title === chosen.title,
          )
        : title.chapters.find(
            (c) => c.id === state.progress[m.id]?.chapterId,
          ) || title.chapters[0];
      if (!chapter)
        throw new Error(
          m.remote
            ? "Find this title again in an installed extension source to reconnect it."
            : "No chapters available.",
        );
      if (chapter.serverId !== undefined && !chapter.pages.length)
        chapter = await client.pages(chapter);
      if (!chapter.pages.length)
        throw new Error("No pages available for this chapter.");
      remember(title);
      const progress = state.progress[m.id];
      const page =
        !restart && progress?.chapterId === chapter.id && !progress.completed
          ? Math.min(progress.page, chapter.pages.length - 1)
          : 0;
      setReader({ manga: title, chapter, page });
      setDetails(null);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function browse(
    source: Source,
    search = "",
    page = 1,
    mode = browseMode,
  ) {
    const id = ++requestID.current;
    setBrowseSource(source);
    setBrowseCatalog(false);
    setView("Browse");
    setBusy("browse");
    setError("");
    if (page === 1) setResults([]);
    try {
      const data = await client.browse(source.id, search, page, mode);
      if (id !== requestID.current) return;
      setResults((old) =>
        page === 1
          ? data.manga
          : [...old, ...data.manga].filter(
              (m, i, a) => a.findIndex((x) => x.id === m.id) === i,
            ),
      );
      setHasNext(data.hasNextPage);
      setBrowsePage(page);
    } catch (e) {
      if (id === requestID.current) setError((e as Error).message);
    } finally {
      if (id === requestID.current) setBusy("");
    }
  }
  async function changeExtension(
    ext: Extension,
    action: "install" | "update" | "uninstall",
  ) {
    setBusy(ext.pkgName);
    setError("");
    try {
      await client.install(ext.pkgName, action);
      if (action === "uninstall")
        setState((s) => ({
          ...s,
          extensionConfig: {
            ...s.extensionConfig,
            packages: s.extensionConfig.packages.filter(
              (p) => p !== ext.pkgName,
            ),
          },
        }));
      await loadServer(false);
      setNotice(
        action === "uninstall"
          ? "Extension uninstalled"
          : action === "update"
            ? "Extension updated"
            : "Extension installed",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
      setUninstall(null);
    }
  }
  async function refreshRepository(repo: Repo) {
    setBusy(repo.id);
    try {
      const data = validateCatalog(await fetchJSON(repo.url), repo.url);
      const manga = data.manga.map((m) => ({
        ...m,
        id: repo.id + ":" + m.id,
        chapters: m.chapters.map((c) => ({ ...c, id: repo.id + ":" + c.id })),
      }));
      setState((s) => ({
        ...s,
        repos: s.repos.map((r) =>
          r.id === repo.id
            ? { ...r, name: data.name, manga, count: manga.length }
            : r,
        ),
      }));
      setNotice("Catalog refreshed");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function restore(file?: File) {
    if (!file) return;
    try {
      if (file.size > 20_000_000) throw new Error("Backup exceeds 20 MB.");
      setState(validateBackup(JSON.parse(await file.text())));
      setNotice("Backup restored");
    } catch (e) {
      setError((e as Error).message);
    }
    if (restoreRef.current) restoreRef.current.value = "";
  }
  const missingExtensions = state.extensionConfig.packages.filter(
    (pkg) => !extensions.some((e) => e.pkgName === pkg && e.isInstalled),
  );
  async function restoreExtensions() {
    setBusy("restore");
    setError("");
    try {
      for (const url of state.extensionConfig.repositories.length
        ? state.extensionConfig.repositories
        : [KEIYOUSHI])
        await client.addRepository(url);
      await client.extensions(true);
      for (const pkg of missingExtensions) await client.install(pkg);
      await loadServer(false);
      setNotice("Extensions restored");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const filteredExtensions = extensions
    .filter(
      (e) =>
        e.pkgName !== "local" &&
        (repoTab !== "Installed" || e.isInstalled) &&
        (!extensionLang || e.lang === extensionLang || e.lang === "all") &&
        (showAdult || !["ADULT", "NSFW"].includes(e.contentWarning || "")) &&
        e.name.toLowerCase().includes(extensionSearch.toLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  if (reader)
    return (
      <Reader
        session={reader}
        preferences={state.preferences}
        onPreferences={(p) => setState((s) => ({ ...s, preferences: p }))}
        onProgress={(p) =>
          setState((s) => ({
            ...s,
            progress: { ...s.progress, [p.mangaId]: p },
          }))
        }
        onClose={() => setReader(null)}
        onChapter={(c) => read(reader.manga, c, true)}
      />
    );
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate("Library");
          }}
        >
          <BookOpen size={23} strokeWidth={1.7} />
          <span>Teramanga</span>
        </a>
        <nav>
          {menu.map((n) => (
            <button
              key={n.name}
              className={"nav-item " + (view === n.name ? "selected" : "")}
              onClick={() => navigate(n.name)}
            >
              <n.icon size={19} strokeWidth={1.7} />
              <span>{n.name}</span>
              {n.name === "Library" && library.length > 0 && (
                <small>{library.length}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="collection-nav">
          <span>Collections</span>
          {["Reading", "Completed", "Plan to read"].map((c) => (
            <button
              key={c}
              className={view === "Library" && filter === c ? "active" : ""}
              onClick={() => {
                navigate("Library");
                setFilter(c);
              }}
            >
              <span className="collection-marker" />
              {c}
              <small>{library.filter((m) => collection(m) === c).length}</small>
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <button
            className="connection-status"
            onClick={() => setConnectDialog(true)}
          >
            <span className={"status-dot " + serverStatus} />
            <span>
              {serverStatus === "connected"
                ? "Server connected"
                : serverStatus === "connecting"
                  ? "Connecting…"
                  : state.serverURL
                    ? "Server unavailable"
                    : "No extension server"}
            </span>
            <ChevronRight size={14} />
          </button>
          <button
            className={"nav-item " + (view === "Settings" ? "selected" : "")}
            onClick={() => navigate("Settings")}
          >
            <Settings size={19} strokeWidth={1.7} />
            <span>Settings</span>
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Close menu"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="page-title">
            <button
              className="mobile-menu icon-button"
              aria-label="Open menu"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            {browseSource && view === "Browse" ? (
              <>
                <button
                  className="text-button"
                  onClick={() => {
                    requestID.current++;
                    setBrowseSource(null);
                    setQuery("");
                    setBusy("");
                  }}
                >
                  Browse
                </button>
                <ChevronRight size={15} />
                <h1>{browseSource.displayName}</h1>
              </>
            ) : (
              <h1>{view}</h1>
            )}
            {view === "Library" && (
              <span className="total-count">{library.length}</span>
            )}
          </div>
          <div className="topbar-actions">
            {view === "Library" && (
              <button
                className="primary-button"
                onClick={() => navigate("Browse")}
              >
                <Plus size={16} />
                Add manga
              </button>
            )}
            {view === "Repositories" && (
              <>
                <button
                  className="secondary-button"
                  onClick={() => setCatalogDialog(true)}
                >
                  Import JSON
                </button>
                <button
                  className="primary-button"
                  onClick={() => setRepoDialog(true)}
                >
                  <Plus size={16} />
                  Add repository
                </button>
              </>
            )}
          </div>
        </header>
        <main>
          {serverStatus === "connected" && missingExtensions.length > 0 && (
            <div className="restore-banner">
              <span>
                {missingExtensions.length} saved extensions need to be restored
                after a server reset.
              </span>
              <button
                className="secondary-button"
                disabled={!!busy}
                onClick={restoreExtensions}
              >
                {busy === "restore" ? (
                  <LoaderCircle size={15} className="spin" />
                ) : null}
                Restore extensions
              </button>
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={17} />
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {view === "Library" && (
            <>
              <div className="shelf-tabs">
                {["All", "Reading", "Completed", "Plan to read"].map((f) => (
                  <button
                    className={filter === f ? "active" : ""}
                    key={f}
                    onClick={() => setFilter(f)}
                  >
                    {f}
                    <span>
                      {f === "All"
                        ? library.length
                        : library.filter((m) => collection(m) === f).length}
                    </span>
                  </button>
                ))}
              </div>
              {continued.length > 0 && filter === "All" && !query && (
                <section className="continue-section">
                  <h2>Continue reading</h2>
                  <div className="continue-grid">
                    {continued.slice(0, 3).map(({ m, p }) => (
                      <button
                        className="continue-card"
                        key={m.id}
                        onClick={() => read(m)}
                      >
                        <ContentImage src={m.cover} alt="" loading="lazy" />
                        <span>
                          <strong>{m.title}</strong>
                          <small>
                            Chapter{" "}
                            {m.chapters.find((c) => c.id === p.chapterId)
                              ?.number ?? 1}
                            , page {p.page + 1}
                          </small>
                          <span className="progress-track">
                            <span
                              style={{
                                width: `${((p.page + 1) / p.total) * 100}%`,
                              }}
                            />
                          </span>
                        </span>
                        <ChevronRight size={18} />
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
          {(view === "Library" ||
            view === "History" ||
            (view === "Browse" && (browseSource || browseCatalog))) && (
            <>
              <div className="catalog-toolbar">
                <form
                  className="search-field"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (browseSource) browse(browseSource, query);
                  }}
                >
                  <Search size={18} />
                  <input
                    aria-label="Search manga"
                    placeholder={
                      browseSource
                        ? "Search this source"
                        : "Search titles or authors"
                    }
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setQuery("")}
                    >
                      <X size={15} />
                    </button>
                  )}
                  {browseSource && (
                    <button
                      className="search-submit"
                      disabled={busy === "browse"}
                    >
                      Search
                    </button>
                  )}
                </form>
                <div className="toolbar-options">
                  {browseSource ? (
                    <select
                      aria-label="Browse order"
                      value={browseMode}
                      onChange={(e) => {
                        const mode = e.target.value as typeof browseMode;
                        setBrowseMode(mode);
                        browse(browseSource, query, 1, mode);
                      }}
                    >
                      <option value="POPULAR">Popular</option>
                      {browseSource.supportsLatest && (
                        <option value="LATEST">Latest</option>
                      )}
                    </select>
                  ) : (
                    <select
                      aria-label="Sort manga"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option>Recently added</option>
                      <option>Title</option>
                      <option>Last read</option>
                    </select>
                  )}
                  <button
                    className={"icon-button " + (filters ? "active" : "")}
                    aria-label="Filter by genre"
                    onClick={() => setFilters(!filters)}
                  >
                    <SlidersHorizontal size={18} />
                  </button>
                  <div className="view-toggle">
                    <button
                      className={layout === "grid" ? "active" : ""}
                      aria-label="Grid view"
                      onClick={() => setLayout("grid")}
                    >
                      <LayoutGrid size={17} />
                    </button>
                    <button
                      className={layout === "list" ? "active" : ""}
                      aria-label="List view"
                      onClick={() => setLayout("list")}
                    >
                      <List size={19} />
                    </button>
                  </div>
                </div>
              </div>
              {filters && (
                <div className="filter-panel">
                  <label>
                    Genre
                    <select
                      aria-label="Genre"
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                    >
                      {[
                        "All genres",
                        ...new Set(shown.flatMap((m) => m.genres)),
                      ].map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="text-button"
                    onClick={() => setGenre("All genres")}
                  >
                    Reset
                  </button>
                </div>
              )}
              {view === "History" && history.length > 0 && (
                <div className="history-toolbar">
                  <span>{history.length} titles</span>
                  <button
                    className="text-button"
                    onClick={() => setHistoryConfirm(true)}
                  >
                    Clear history
                  </button>
                </div>
              )}
              {shown.length > 0 ? (
                <div
                  className={
                    "manga-grid " + (layout === "list" ? "manga-list" : "")
                  }
                >
                  {shown.map((m) => (
                    <article key={m.id} className="manga-card">
                      <button
                        className="cover-button"
                        aria-label={"Open " + m.title}
                        onClick={() => openDetails(m)}
                      >
                        <ContentImage
                          src={m.cover}
                          alt={m.title + " cover"}
                          loading="lazy"
                        />
                        {state.progress[m.id] && (
                          <span
                            className="cover-progress"
                            style={{
                              width: `${((state.progress[m.id].page + 1) / state.progress[m.id].total) * 100}%`,
                            }}
                          />
                        )}
                      </button>
                      <div className="card-meta">
                        <button
                          className="manga-title"
                          onClick={() => openDetails(m)}
                        >
                          {m.title}
                        </button>
                        <span className="manga-author">
                          {m.source || m.author}
                        </span>
                        {view === "History" && state.progress[m.id] && (
                          <small className="history-date">
                            {new Date(
                              state.progress[m.id].updated,
                            ).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </small>
                        )}
                      </div>
                      <button
                        className="card-menu icon-button"
                        aria-label={"Details for " + m.title}
                        onClick={() => openDetails(m)}
                      >
                        <Ellipsis size={18} />
                      </button>
                    </article>
                  ))}
                </div>
              ) : busy === "browse" ? (
                <Loading label="Loading manga" />
              ) : (
                <Empty
                  icon={
                    view === "History"
                      ? Clock3
                      : view === "Library"
                        ? Library
                        : Search
                  }
                  title={
                    query
                      ? "No matches"
                      : view === "History"
                        ? "No reading history"
                        : view === "Library" && filter === "All"
                          ? "Your library is empty"
                          : view === "Library"
                            ? `No titles in ${filter.toLowerCase()}`
                            : "No titles found"
                  }
                  text={
                    query
                      ? "Try a different title or author."
                      : view === "History"
                        ? "Chapters you read will appear here."
                        : view === "Library"
                          ? "Browse a source and save a title to your library."
                          : "Try another source or search."
                  }
                  action={() => navigate("Browse")}
                  label="Browse sources"
                />
              )}
              {busy === "browse" && shown.length > 0 && (
                <Loading label="Loading manga" />
              )}
              {view === "Browse" && browseSource && hasNext && (
                <button
                  className="secondary-button load-more"
                  disabled={busy === "browse"}
                  onClick={() => browse(browseSource, query, browsePage + 1)}
                >
                  Load more
                </button>
              )}
            </>
          )}
          {view === "Browse" && !browseSource && !browseCatalog && (
            <>
              <div className="section-toolbar">
                <h2>Installed sources</h2>
                <button
                  className="secondary-button"
                  onClick={() => {
                    navigate("Repositories");
                    setRepoTab("Extensions");
                  }}
                >
                  Manage extensions
                </button>
              </div>
              {sources.length ? (
                <div className="source-list">
                  {sources.map((s) => (
                    <button
                      className="source-row"
                      key={s.id}
                      onClick={() => {
                        setQuery("");
                        browse(s);
                      }}
                    >
                      <ContentImage
                        src={client.resource(s.iconUrl)}
                        alt=""
                        loading="lazy"
                      />
                      <span>
                        <strong>{s.displayName}</strong>
                        <small>{language(s.lang)}</small>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                  ))}
                </div>
              ) : (
                <Empty
                  icon={Plug}
                  title={
                    state.serverURL
                      ? "No sources installed"
                      : "Connect an extension server"
                  }
                  text={
                    state.serverURL
                      ? "Install an extension from Keiyoushi to browse its sources."
                      : "Keiyoushi extensions run on a Suwayomi server."
                  }
                  label={
                    state.serverURL ? "Install extensions" : "Connect server"
                  }
                  action={() =>
                    state.serverURL
                      ? (navigate("Repositories"), setRepoTab("Extensions"))
                      : setConnectDialog(true)
                  }
                />
              )}
              <div className="section-toolbar catalog-title">
                <h2>JSON catalogs</h2>
                <button
                  className="text-button"
                  onClick={() => setCatalogDialog(true)}
                >
                  <Plus size={16} />
                  Import catalog
                </button>
              </div>
              {catalogs.filter((r) => r.enabled).length ? (
                <div className="source-list">
                  {catalogs
                    .filter((r) => r.enabled)
                    .map((r) => (
                      <button
                        className="source-row"
                        key={r.id}
                        onClick={() => {
                          setQuery("");
                          setCatalogId(r.id);
                          setBrowseCatalog(true);
                        }}
                      >
                        <span className="source-fallback">
                          <BookOpen size={21} />
                        </span>
                        <span>
                          <strong>{r.name}</strong>
                          <small>{r.count} titles</small>
                        </span>
                        <ChevronRight size={18} />
                      </button>
                    ))}
                </div>
              ) : (
                <p className="inline-empty">No catalogs imported.</p>
              )}
            </>
          )}
          {view === "Repositories" && (
            <>
              <div className="shelf-tabs">
                {["Repositories", "Installed", "Extensions"].map((t) => (
                  <button
                    key={t}
                    className={repoTab === t ? "active" : ""}
                    onClick={() => setRepoTab(t)}
                  >
                    {t}
                    {t === "Installed" && (
                      <span>
                        {extensions.filter((e) => e.isInstalled).length}
                      </span>
                    )}
                  </button>
                ))}
                <button
                  className="tab-end icon-button"
                  aria-label="Refresh extensions"
                  disabled={!state.serverURL || !!busy}
                  onClick={async () => {
                    setBusy("extensions");
                    await loadServer(true);
                    setBusy("");
                  }}
                >
                  <RefreshCw
                    size={17}
                    className={busy === "extensions" ? "spin" : ""}
                  />
                </button>
              </div>
              {repoTab === "Repositories" ? (
                <>
                  <section className="connection-panel">
                    <Server size={21} />
                    <div>
                      <h2>Extension server</h2>
                      <p>{state.serverURL || "Not connected"}</p>
                    </div>
                    <span className={"connection-label " + serverStatus}>
                      {serverStatus === "connected"
                        ? "Connected"
                        : serverStatus === "connecting"
                          ? "Connecting"
                          : state.serverURL
                            ? "Unavailable"
                            : "Not connected"}
                    </span>
                    <button
                      className="secondary-button"
                      onClick={() => setConnectDialog(true)}
                    >
                      {state.serverURL ? "Configure" : "Connect"}
                    </button>
                  </section>
                  <div className="section-toolbar">
                    <h2>Extension repositories</h2>
                  </div>
                  <div className="repository-list">
                    {stores.length ? (
                      stores.map((r) => (
                        <div className="repository-row" key={r.indexUrl}>
                          <span className="repository-icon">
                            <Layers size={22} />
                          </span>
                          <div>
                            <h3>{r.name}</h3>
                            <a
                              href={r.indexUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {r.indexUrl}
                            </a>
                          </div>
                          <span className="repo-count">
                            {
                              extensions.filter(
                                (e) => e.storeIndexUrl === r.indexUrl,
                              ).length
                            }{" "}
                            extensions
                          </span>
                          <button
                            className="icon-button"
                            aria-label={"Remove repository " + r.name}
                            onClick={async () => {
                              setBusy(r.indexUrl);
                              try {
                                await client.removeRepository(r.indexUrl);
                                await loadServer(false);
                              } catch (e) {
                                setError((e as Error).message);
                              } finally {
                                setBusy("");
                              }
                            }}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="repository-row">
                        <span className="repository-icon">
                          <Layers size={22} />
                        </span>
                        <div>
                          <h3>Keiyoushi</h3>
                          <a
                            href="https://github.com/keiyoushi"
                            target="_blank"
                            rel="noreferrer"
                          >
                            github.com/keiyoushi
                          </a>
                        </div>
                        <button
                          className="secondary-button"
                          onClick={() =>
                            state.serverURL
                              ? setRepoDialog(true)
                              : setConnectDialog(true)
                          }
                        >
                          {state.serverURL ? "Add" : "Connect server"}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="section-toolbar catalog-title">
                    <h2>JSON catalogs</h2>
                  </div>
                  {catalogs.length ? (
                    <div className="repository-list">
                      {catalogs.map((r) => (
                        <div className="repository-row" key={r.id}>
                          <span className="repository-icon">
                            <BookOpen size={21} />
                          </span>
                          <div>
                            <h3>{r.name}</h3>
                            <p>
                              {r.count} titles
                              {r.importOnly ? " — imported file" : ""}
                            </p>
                          </div>
                          <button
                            className={"switch " + (r.enabled ? "on" : "")}
                            role="switch"
                            aria-checked={r.enabled}
                            aria-label={"Enable " + r.name}
                            onClick={() =>
                              setState((s) => ({
                                ...s,
                                repos: s.repos.map((x) =>
                                  x.id === r.id
                                    ? { ...x, enabled: !x.enabled }
                                    : x,
                                ),
                              }))
                            }
                          >
                            <span />
                          </button>
                          {!r.importOnly && (
                            <button
                              className="icon-button"
                              aria-label={"Refresh " + r.name}
                              disabled={busy === r.id}
                              onClick={() => refreshRepository(r)}
                            >
                              <RefreshCw
                                size={17}
                                className={busy === r.id ? "spin" : ""}
                              />
                            </button>
                          )}
                          <button
                            className="icon-button danger-hover"
                            aria-label={"Remove " + r.name}
                            onClick={() => setRemoveRepo(r)}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="inline-empty">No catalogs imported.</p>
                  )}
                </>
              ) : (
                <>
                  {!state.serverURL ? (
                    <Empty
                      icon={Server}
                      title="Connect an extension server"
                      text="The server installs and runs Keiyoushi extensions."
                      label="Connect server"
                      action={() => setConnectDialog(true)}
                    />
                  ) : (
                    <>
                      <div className="catalog-toolbar">
                        <label className="search-field">
                          <Search size={18} />
                          <input
                            aria-label="Search extensions"
                            placeholder="Search extensions"
                            value={extensionSearch}
                            onChange={(e) => setExtensionSearch(e.target.value)}
                          />
                        </label>
                        <select
                          aria-label="Extension language"
                          value={extensionLang}
                          onChange={(e) => setExtensionLang(e.target.value)}
                        >
                          <option value="">All languages</option>
                          {[...new Set(extensions.map((e) => e.lang))]
                            .filter((l) => l !== "all")
                            .sort()
                            .map((l) => (
                              <option key={l} value={l}>
                                {language(l)}
                              </option>
                            ))}
                        </select>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={showAdult}
                            onChange={(e) => setShowAdult(e.target.checked)}
                          />
                          Adult sources
                        </label>
                      </div>
                      {filteredExtensions.length ? (
                        <div className="extension-list">
                          {filteredExtensions.map((e) => (
                            <div className="extension-row" key={e.pkgName}>
                              <ContentImage
                                src={client.resource(e.iconUrl)}
                                alt=""
                                loading="lazy"
                              />
                              <div>
                                <h3>{e.name}</h3>
                                <p>
                                  {language(e.lang)}
                                  <span>{e.versionName}</span>
                                  {e.isObsolete && <span>Obsolete</span>}
                                </p>
                              </div>
                              {e.isInstalled ? (
                                <>
                                  <button
                                    className="secondary-button"
                                    disabled={!!busy}
                                    onClick={() =>
                                      e.hasUpdate
                                        ? changeExtension(e, "update")
                                        : navigate("Browse")
                                    }
                                  >
                                    {busy === e.pkgName ? (
                                      <LoaderCircle
                                        className="spin"
                                        size={15}
                                      />
                                    ) : e.hasUpdate ? (
                                      "Update"
                                    ) : (
                                      "Installed"
                                    )}
                                  </button>
                                  <button
                                    className="icon-button"
                                    aria-label={"Uninstall " + e.name}
                                    disabled={!!busy}
                                    onClick={() => setUninstall(e)}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              ) : (
                                <button
                                  className="secondary-button"
                                  disabled={!!busy || e.isObsolete}
                                  onClick={() => changeExtension(e, "install")}
                                >
                                  {busy === e.pkgName ? (
                                    <LoaderCircle className="spin" size={15} />
                                  ) : (
                                    <Download size={15} />
                                  )}
                                  Install
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : busy ? (
                        <Loading label="Loading extensions" />
                      ) : (
                        <Empty
                          icon={Layers}
                          title={
                            repoTab === "Installed"
                              ? "No extensions installed"
                              : "No extensions found"
                          }
                          text="Add a repository or change your search and language filters."
                          label="Add repository"
                          action={() => setRepoDialog(true)}
                        />
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
          {view === "Settings" && (
            <div className="settings-stack">
              <section className="settings-section">
                <div className="settings-section-heading">
                  <h2>Extension server</h2>
                  <button
                    className="secondary-button"
                    onClick={() => setConnectDialog(true)}
                  >
                    {state.serverURL ? "Configure" : "Connect server"}
                  </button>
                </div>
                <p>
                  {state.serverURL ||
                    "Connect Suwayomi to use Keiyoushi extensions."}
                </p>
                {state.serverURL && (
                  <button
                    className="text-button"
                    onClick={() => {
                      setServerAuth(state.serverURL, "");
                      setState((s) => ({ ...s, serverURL: "" }));
                      setNotice("Server disconnected");
                    }}
                  >
                    Disconnect
                  </button>
                )}
                <a
                  className="deploy-link"
                  href="https://render.com/deploy?repo=https://github.com/GavinCouch/teramanga"
                  target="_blank"
                  rel="noreferrer"
                >
                  Deploy free server
                  <ExternalLink size={14} />
                </a>
                <p className="field-hint">
                  Uses Render’s free service. It sleeps when idle and server
                  data can reset. Your library stays in this browser.
                </p>
              </section>
              <section className="settings-section">
                <h2>Reader defaults</h2>
                <div className="settings-fields">
                  <label>
                    Mode
                    <select
                      value={state.preferences.mode}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          preferences: {
                            ...s.preferences,
                            mode: e.target.value as "vertical" | "paged",
                          },
                        }))
                      }
                    >
                      <option value="vertical">Vertical scroll</option>
                      <option value="paged">Single page</option>
                    </select>
                  </label>
                  <label>
                    Background
                    <select
                      value={state.preferences.theme}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          preferences: {
                            ...s.preferences,
                            theme: e.target.value as "dark" | "light" | "sepia",
                          },
                        }))
                      }
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                      <option value="sepia">Sepia</option>
                    </select>
                  </label>
                  <label>
                    Direction
                    <select
                      value={state.preferences.direction}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          preferences: {
                            ...s.preferences,
                            direction: e.target.value as "ltr" | "rtl",
                          },
                        }))
                      }
                    >
                      <option value="ltr">Left to right</option>
                      <option value="rtl">Right to left</option>
                    </select>
                  </label>
                </div>
              </section>
              <section className="settings-section">
                <h2>Backup</h2>
                <p>
                  Export your library, catalogs, progress, and settings. Images
                  and server passwords are excluded.
                </p>
                <div className="settings-actions">
                  <button
                    className="secondary-button"
                    onClick={() => exportFile("teramanga-backup.json", state)}
                  >
                    <Download size={16} />
                    Export backup
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => restoreRef.current?.click()}
                  >
                    <Upload size={16} />
                    Restore backup
                  </button>
                  <input
                    ref={restoreRef}
                    type="file"
                    accept=".json,application/json"
                    hidden
                    onChange={(e) => restore(e.target.files?.[0])}
                  />
                </div>
                <p className="field-hint">
                  Restoring replaces data in this browser. Export a backup
                  first.
                </p>
              </section>
              <section className="settings-section">
                <h2>Storage</h2>
                <p>
                  Your library and reading progress are stored in this browser.
                  Server credentials are kept for this tab’s browser session and
                  are never exported.
                </p>
              </section>
            </div>
          )}
        </main>
      </div>
      {details && (
        <Modal
          title={details.title}
          onClose={() => setDetails(null)}
          className="detail-modal"
        >
          <div className="detail-top">
            <ContentImage
              className="detail-cover"
              src={details.cover}
              alt={details.title + " cover"}
            />
            <div className="detail-info">
              <span className="detail-source">{details.source}</span>
              <h2>{details.title}</h2>
              {details.author && (
                <p className="detail-author">{details.author}</p>
              )}
              <span className="detail-status">{details.status}</span>
              <div className="genre-tags">
                {details.genres.map((g) => (
                  <span key={g}>{g}</span>
                ))}
              </div>
              <p className="detail-description">
                {details.description.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")}
              </p>
              <div className="detail-actions">
                <button
                  className="primary-button"
                  disabled={busy === "read" || busy === "details"}
                  onClick={() => read(details)}
                >
                  {busy === "read" ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <BookOpen size={16} />
                  )}{" "}
                  {state.progress[details.id] &&
                  !state.progress[details.id].completed
                    ? "Continue"
                    : "Read"}
                </button>
                <button
                  className="secondary-button"
                  onClick={() => toggleLibrary(details)}
                >
                  {state.library.includes(details.id) ? (
                    <Check size={16} />
                  ) : (
                    <Plus size={16} />
                  )}{" "}
                  {state.library.includes(details.id)
                    ? "Saved"
                    : "Add to library"}
                </button>
              </div>
              {state.library.includes(details.id) && (
                <label className="collection-select">
                  Collection
                  <select
                    aria-label="Manga collection"
                    value={collection(details)}
                    onChange={(e) => {
                      const c = e.target.value;
                      setState((s) => ({
                        ...s,
                        categories: { ...s.categories, [details.id]: c },
                      }));
                    }}
                  >
                    {["Reading", "Completed", "Plan to read"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>
          <div className="chapter-heading">
            <h3>
              Chapters <span>{details.chapters.length}</span>
            </h3>
            <div>
              <input
                aria-label="Filter chapters"
                placeholder="Find chapter"
                value={chapterFilter}
                onChange={(e) => setChapterFilter(e.target.value)}
              />
              <button
                className="text-button"
                onClick={() => setChapterDescending(!chapterDescending)}
              >
                {chapterDescending ? "Newest first" : "Oldest first"}
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
          {busy === "details" ? (
            <Loading label="Loading chapters" />
          ) : details.chapters.length ? (
            <div className="chapter-list">
              {[...details.chapters]
                .filter(
                  (c) =>
                    !chapterFilter ||
                    c.title
                      .toLowerCase()
                      .includes(chapterFilter.toLowerCase()) ||
                    String(c.number).includes(chapterFilter),
                )
                .sort((a, b) =>
                  chapterDescending ? b.number - a.number : a.number - b.number,
                )
                .map((c) => (
                  <button
                    key={c.id}
                    className="chapter-row"
                    disabled={busy === "read"}
                    onClick={() => read(details, c, true)}
                  >
                    <span>
                      <strong>{c.title || `Chapter ${c.number}`}</strong>
                      <small>
                        Chapter {c.number}
                        {c.pages.length ? `, ${c.pages.length} pages` : ""}
                      </small>
                    </span>
                    {state.progress[details.id]?.chapterId === c.id ? (
                      <Bookmark size={16} />
                    ) : (
                      <ChevronRight size={18} />
                    )}
                  </button>
                ))}
            </div>
          ) : (
            <p className="inline-empty">No chapters available.</p>
          )}
        </Modal>
      )}
      {catalogDialog && (
        <CatalogDialog
          existing={state.repos}
          onClose={() => setCatalogDialog(false)}
          onAdd={(r) => {
            setState((s) => ({ ...s, repos: [...s.repos, r] }));
            setCatalogDialog(false);
            navigate("Browse");
            setBrowseCatalog(true);
            setCatalogId(r.id);
            setNotice(`${r.name} imported`);
          }}
        />
      )}
      {repoDialog && (
        <RepositoryDialog
          connected={!!state.serverURL}
          onConnect={() => {
            setRepoDialog(false);
            setConnectDialog(true);
          }}
          onClose={() => setRepoDialog(false)}
          onAdd={async (url) => {
            await client.addRepository(url);
            await loadServer(true);
            setRepoDialog(false);
            setRepoTab("Extensions");
            setNotice("Repository added");
          }}
        />
      )}
      {connectDialog && (
        <ConnectDialog
          currentURL={state.serverURL}
          onClose={() => setConnectDialog(false)}
          onConnect={async (url, authorization) => {
            const api = new Suwayomi(url, authorization);
            await api.check();
            setServerAuth(url, authorization);
            setState((s) => ({ ...s, serverURL: url }));
            setConnectDialog(false);
            await loadServer(false, api);
            setNotice("Server connected");
          }}
        />
      )}
      {uninstall && (
        <Confirm
          title={"Uninstall " + uninstall.name + "?"}
          text="Saved titles and reading progress will be kept."
          onCancel={() => setUninstall(null)}
          onConfirm={() => changeExtension(uninstall, "uninstall")}
          label="Uninstall"
          busy={!!busy}
        />
      )}
      {removeRepo && (
        <Confirm
          title={"Remove " + removeRepo.name + "?"}
          text="Its catalog will be removed from this browser. Export a backup to keep a copy."
          onCancel={() => setRemoveRepo(null)}
          onConfirm={() => {
            setState((s) => ({
              ...s,
              repos: s.repos.filter((r) => r.id !== removeRepo.id),
            }));
            setRemoveRepo(null);
          }}
          label="Remove"
        />
      )}
      {historyConfirm && (
        <Confirm
          title="Clear reading history?"
          text="Your library will be kept. Saved chapter positions will be removed."
          onCancel={() => setHistoryConfirm(false)}
          onConfirm={() => {
            setState((s) => ({ ...s, progress: {} }));
            setHistoryConfirm(false);
          }}
          label="Clear history"
        />
      )}
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          <span>{notice}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function Empty({
  icon: Icon,
  title,
  text,
  action,
  label,
}: {
  icon: typeof Library;
  title: string;
  text: string;
  action: () => void;
  label: string;
}) {
  return (
    <div className="empty-state">
      <Icon size={36} strokeWidth={1.25} />
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="secondary-button" onClick={action}>
        {label}
      </button>
    </div>
  );
}
function Loading({ label }: { label: string }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle size={20} className="spin" />
      {label}
    </div>
  );
}
function Modal({
  children,
  title,
  onClose,
  className = "",
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
    const first = ref.current?.querySelector<HTMLElement>(
      "input,button,select",
    );
    first?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not([hidden]),select,a[href]",
          ) || [],
        ).filter((el) => el.offsetParent !== null);
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={ref}
        className={"modal " + className}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        {children}
      </section>
    </div>
  );
}
function Confirm({
  title,
  text,
  onConfirm,
  onCancel,
  label,
  busy = false,
}: {
  title: string;
  text: string;
  onConfirm: () => void;
  onCancel: () => void;
  label: string;
  busy?: boolean;
}) {
  return (
    <Modal title={title} onClose={onCancel} className="confirm-modal">
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="modal-actions">
        <button className="secondary-button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-button" onClick={onConfirm} disabled={busy}>
          {busy ? <LoaderCircle size={16} className="spin" /> : label}
        </button>
      </div>
    </Modal>
  );
}
function ConnectDialog({
  currentURL,
  onClose,
  onConnect,
}: {
  currentURL: string;
  onClose: () => void;
  onConnect: (url: string, authorization: string) => Promise<void>;
}) {
  const [url, setURL] = useState(currentURL);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal title="Connect extension server" onClose={onClose}>
      <h2>Connect extension server</h2>
      <p>Enter your Suwayomi server address.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const normalized = normalizeServer(url);
            await onConnect(normalized, basicAuthorization(username, password));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field-label" htmlFor="server-url">
          Server URL
        </label>
        <input
          id="server-url"
          className="text-input"
          type="url"
          placeholder="https://your-server.onrender.com"
          required
          value={url}
          onChange={(e) => setURL(e.target.value)}
        />
        <div className="form-columns">
          <label>
            Username
            <input
              autoComplete="username"
              className="text-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="reader"
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              className="text-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        </div>
        <p className="field-hint">
          Credentials are saved for this browser session only. Leave blank if
          your private server has no authentication.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button full-width" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Plug size={16} />
          )}{" "}
          {busy ? "Connecting…" : "Connect"}
        </button>
      </form>
      <a
        className="deploy-link"
        href="https://render.com/deploy?repo=https://github.com/GavinCouch/teramanga"
        target="_blank"
        rel="noreferrer"
      >
        Deploy free server
        <ExternalLink size={14} />
      </a>
      <p className="field-hint">
        Select the Free plan. It sleeps when idle and has temporary server
        storage. You can restore installed extensions from this browser.
      </p>
    </Modal>
  );
}
function RepositoryDialog({
  connected,
  onClose,
  onAdd,
  onConnect,
}: {
  connected: boolean;
  onClose: () => void;
  onAdd: (url: string) => Promise<void>;
  onConnect: () => void;
}) {
  const [url, setURL] = useState("https://github.com/keiyoushi");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal title="Add extension repository" onClose={onClose}>
      <h2>Add extension repository</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onAdd(normalizeRepository(url));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field-label" htmlFor="extension-repo-url">
          Repository URL
        </label>
        <input
          id="extension-repo-url"
          type="url"
          required
          className="text-input"
          value={url}
          onChange={(e) => setURL(e.target.value)}
        />
        <p className="field-hint">
          Keiyoushi links resolve to its current index.pb repository.
        </p>
        {!connected && (
          <div className="server-required">
            <p>Connect an extension server first.</p>
            <button
              type="button"
              className="secondary-button"
              onClick={onConnect}
            >
              Connect server
            </button>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary-button full-width"
          disabled={!connected || busy}
        >
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Plus size={16} />
          )}{" "}
          {busy ? "Adding repository…" : "Add repository"}
        </button>
      </form>
    </Modal>
  );
}
