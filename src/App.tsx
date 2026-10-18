import { useState, useEffect, useMemo, useRef } from "react";
import {
  BookOpen,
  Library,
  Compass,
  Clock3,
  Settings,
  Search,
  Plus,
  ArrowUpRight,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  LayoutGrid,
  List,
  SlidersHorizontal,
  MoreHorizontal,
  Github,
  ExternalLink,
  RefreshCw,
  Trash2,
  Download,
  Upload,
  Bookmark,
  Menu,
  Sun,
  Moon,
  Maximize,
  Minimize,
  BookMarked,
  Layers,
  CircleHelp,
  LoaderCircle,
  Rss,
  CheckCircle2,
} from "lucide-react";
import {
  type Manga,
  type Chapter,
  type Repo,
  type State,
  type Progress,
  readState,
  defaults,
  validateCatalog,
  validateBackup,
  fetchJSON,
  exportFile,
} from "./model";
const BASE = new URL(import.meta.env.BASE_URL, location.href).href;
const asset = (p: string) => new URL(p, BASE).href;
const navs = [
  { name: "Library", icon: Library },
  { name: "Discover", icon: Compass },
  { name: "History", icon: Clock3 },
  { name: "Repositories", icon: Layers },
];
const title = (x: any) => x.en || Object.values(x)[0] || "Untitled";
export default function App() {
  const [state, setState] = useState<State>(readState);
  const [demo, setDemo] = useState<Manga[]>([]);
  const [view, setView] = useState("Library");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All manga");
  const [sort, setSort] = useState("Recently added");
  const [layout, setLayout] = useState("grid");
  const [details, setDetails] = useState<Manga | null>(null);
  const [reader, setReader] = useState<{
    manga: Manga;
    chapter: Chapter;
    page: number;
  } | null>(null);
  const [repoModal, setRepoModal] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [remote, setRemote] = useState<Manga[]>([]);
  const [discoverSource, setDiscoverSource] = useState("All sources");
  const [genre, setGenre] = useState("All genres");
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  function notify(message: string) {
    setToast(message);
  }
  useEffect(() => {
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    try {
      localStorage.setItem("teramanga.v1", JSON.stringify(state));
    } catch {
      notify(
        "Browser storage is full or unavailable. Export a backup to keep your changes.",
      );
    }
  }, [state]);
  useEffect(() => {
    const controller = new AbortController();
    fetchJSON(asset("catalog.json"), controller.signal)
      .then((d) =>
        setDemo(
          validateCatalog(d, asset("catalog.json")).manga.map((m) => ({
            ...m,
            source: "Teramanga Originals",
          })),
        ),
      )
      .catch((e) => {
        if (e.name !== "AbortError")
          setCatalogError(
            "The sample catalog could not load. Reload the page or add your own repository.",
          );
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!details && !repoModal && !help) return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => {
      const modal = document.querySelector<HTMLElement>("[role=dialog]");
      modal
        ?.querySelector<HTMLElement>("input, button, select, a[href]")
        ?.focus();
    }, 0);
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDetails(null);
        setRepoModal(false);
        setHelp(false);
      }
      if (e.key === "Tab") {
        const items = Array.from(
          document.querySelectorAll<HTMLElement>(
            "[role=dialog] button:not(:disabled),[role=dialog] input:not([hidden]),[role=dialog] select,[role=dialog] a[href]",
          ),
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
      clearTimeout(timer);
      document.body.style.overflow = "";
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [details?.id, repoModal, help]);
  const manga = useMemo(
    () =>
      [
        ...demo,
        ...state.repos
          .filter((r) => r.enabled)
          .flatMap((r) => r.manga.map((m) => ({ ...m, source: r.name }))),
        ...remote,
      ].filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i),
    [demo, state.repos, remote],
  );
  const saved = manga.filter((m) => state.library.includes(m.id));
  const active = Object.values(state.progress).sort(
    (a, b) => b.updated - a.updated,
  );
  const recent = active
    .filter((p) => !p.completed)
    .map((p) => ({ m: manga.find((m) => m.id === p.mangaId), p }))
    .filter((x) => x.m);
  const category = (m: Manga) =>
    state.categories[m.id] ||
    (state.progress[m.id]?.completed
      ? "Completed"
      : state.progress[m.id]
        ? "Reading"
        : "Plan to read");
  let shown = (
    view === "Discover"
      ? manga
      : view === "History"
        ? (active
            .map((p) => manga.find((m) => m.id === p.mangaId))
            .filter(Boolean) as Manga[])
        : saved
  ).filter(
    (m) =>
      m.title.toLowerCase().includes(query.toLowerCase()) ||
      m.author.toLowerCase().includes(query.toLowerCase()),
  );
  if (view === "Library" && filter !== "All manga")
    shown = shown.filter((m) => category(m) === filter);
  if (genre !== "All genres")
    shown = shown.filter((m) => m.genres.includes(genre));
  if (
    view === "Discover" &&
    discoverSource !== "All sources" &&
    discoverSource !== "MangaDex"
  )
    shown = shown.filter((m) => m.source === discoverSource);
  if (view === "Discover" && discoverSource === "MangaDex")
    shown = shown.filter((m) => m.remote);
  if (sort === "Title A–Z")
    shown.sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === "Last read")
    shown.sort(
      (a, b) =>
        (state.progress[b.id]?.updated || 0) -
        (state.progress[a.id]?.updated || 0),
    );
  function toggleLibrary(m: Manga) {
    setState((s) => ({
      ...s,
      library: s.library.includes(m.id)
        ? s.library.filter((id) => id !== m.id)
        : [...s.library, m.id],
      repos:
        m.remote && !s.repos.some((r) => r.id === "mangadex-saved")
          ? [
              ...s.repos,
              {
                id: "mangadex-saved",
                name: "MangaDex saved titles",
                url: "https://api.mangadex.org",
                enabled: true,
                count: 1,
                added: new Date().toISOString(),
                manga: [m],
              },
            ]
          : m.remote
            ? s.repos.map((r) =>
                r.id === "mangadex-saved"
                  ? {
                      ...r,
                      manga: [...r.manga.filter((x) => x.id !== m.id), m],
                      count: r.manga.filter((x) => x.id !== m.id).length + 1,
                    }
                  : r,
              )
            : s.repos,
    }));
    notify(
      state.library.includes(m.id)
        ? "Removed from your library"
        : "Added to your library",
    );
  }
  function navigate(name: string) {
    setView(name);
    setQuery("");
    setGenre("All genres");
    setMobile(false);
    setShowFilters(false);
  }
  async function read(m: Manga, chapter?: Chapter, fromStart = false) {
    setLoading(m.id);
    try {
      let chapters = m.chapters;
      if (m.remote && !state.mangaDexEndpoint)
        throw new Error(
          "Configure a CORS-compatible MangaDex endpoint in Settings to read this title.",
        );
      if (m.remote && !chapters.length) {
        const data = await fetchJSON(
          `${state.mangaDexEndpoint}/manga/${m.id.replace("md:", "")}/feed?translatedLanguage[]=en&order[chapter]=asc&limit=100&includeExternalUrl=0`,
        );
        chapters = data.data
          .filter((c: any) => !c.attributes.externalUrl)
          .map((c: any) => ({
            id: c.id,
            number: Number(c.attributes.chapter) || 0,
            title:
              c.attributes.title ||
              `Chapter ${c.attributes.chapter || "Oneshot"}`,
            pages: [],
            remote: true,
          }));
        setDetails({ ...m, chapters });
        if (!chapters.length)
          throw new Error(
            "No English chapters are available from this source.",
          );
      }
      let c =
        chapter ||
        chapters.find((c) => c.id === state.progress[m.id]?.chapterId) ||
        chapters[0];
      if (!c) throw new Error("This title has no chapters yet.");
      if (c.remote && !c.pages.length) {
        const data = await fetchJSON(
          `${state.mangaDexEndpoint}/at-home/server/${c.id}`,
        );
        c = {
          ...c,
          pages: data.chapter.data.map(
            (p: string) => `${data.baseUrl}/data/${data.chapter.hash}/${p}`,
          ),
        };
      }
      if (!c.pages.length) throw new Error("This chapter has no pages.");
      const last = state.progress[m.id];
      const page =
        !fromStart && last?.chapterId === c.id && !last.completed
          ? Math.min(last.page, c.pages.length - 1)
          : 0;
      setReader({ manga: { ...m, chapters }, chapter: c, page });
    } catch (e) {
      notify(
        (e as Error).message +
          " Check source availability and browser CORS permissions.",
      );
    } finally {
      setLoading("");
    }
  }
  function progress(p: Progress) {
    setState((s) => ({ ...s, progress: { ...s.progress, [p.mangaId]: p } }));
  }
  async function searchMangaDex() {
    setLoading("mangadex");
    try {
      const data = await fetchJSON(
        `${state.mangaDexEndpoint}/manga?limit=24&includes[]=cover_art&includes[]=author&contentRating[]=safe&contentRating[]=suggestive&order[followedCount]=desc${query ? "&title=" + encodeURIComponent(query) : ""}`,
      );
      const items: Manga[] = data.data.map((m: any) => {
        const cover = m.relationships.find((r: any) => r.type === "cover_art");
        return {
          id: "md:" + m.id,
          title: title(m.attributes.title),
          author:
            m.relationships.find((r: any) => r.type === "author")?.attributes
              ?.name || "Unknown author",
          description: m.attributes.description.en || "",
          cover: cover
            ? `https://uploads.mangadex.org/covers/${m.id}/${cover.attributes.fileName}.256.jpg`
            : asset("demo/the-last-light.svg"),
          genres: m.attributes.tags.map((t: any) => t.attributes.name.en),
          status: m.attributes.status === "completed" ? "Completed" : "Ongoing",
          chapters: [],
          source: "MangaDex",
          remote: true,
        };
      });
      setRemote(items);
      setDiscoverSource("MangaDex");
      if (!items.length) notify("No titles found. Try a different search.");
    } catch {
      notify(
        "MangaDex could not be reached. Your browser must allow api.mangadex.org and the source must support CORS. JSON repositories remain available.",
      );
    } finally {
      setLoading("");
    }
  }
  async function refreshRepo(repo: Repo) {
    setRefreshing(repo.id);
    try {
      const catalog = validateCatalog(await fetchJSON(repo.url), repo.url);
      const prefixed = catalog.manga.map((m) => ({
        ...m,
        id: repo.id + ":" + m.id,
        chapters: m.chapters.map((c) => ({ ...c, id: repo.id + ":" + c.id })),
      }));
      setState((s) => ({
        ...s,
        repos: s.repos.map((r) =>
          r.id === repo.id
            ? {
                ...r,
                name: catalog.name,
                manga: prefixed,
                count: prefixed.length,
              }
            : r,
        ),
      }));
      notify("Repository refreshed");
    } catch (e) {
      notify("Refresh failed: " + (e as Error).message);
    } finally {
      setRefreshing(null);
    }
  }
  async function importBackup(file?: File) {
    if (!file) return;
    try {
      if (file.size > 20_000_000) throw new Error("Backup is too large.");
      const backup = validateBackup(JSON.parse(await file.text()));
      setState(backup);
      notify("Library, repositories, and reading settings restored.");
    } catch (e) {
      notify("Could not import backup: " + (e as Error).message);
    }
    if (importRef.current) importRef.current.value = "";
  }
  const hero = demo[0];
  if (reader)
    return (
      <Reader
        session={reader}
        preferences={state.preferences}
        onPreferences={(p) => setState((s) => ({ ...s, preferences: p }))}
        onProgress={progress}
        onClose={() => setReader(null)}
        onChapter={(c) => read(reader.manga, c, true)}
      />
    );
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("Library");
          }}
        >
          <span className="brand-mark">
            <BookOpen size={22} />
          </span>
          <span>
            tera<span className="brand-light">manga</span>
            <span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace-label">YOUR SPACE</div>
        <nav>
          {navs.map((n) => (
            <button
              key={n.name}
              className={"nav-item " + (view === n.name ? "selected" : "")}
              onClick={() => navigate(n.name)}
            >
              <n.icon size={19} />
              <span>{n.name}</span>
              {n.name === "Library" && <small>{saved.length}</small>}
              {n.name === "Repositories" && <span className="tiny-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <div className="workspace-label collections-label">
          COLLECTIONS{" "}
          <button
            aria-label="Manage collections"
            onClick={() => {
              navigate("Library");
              setShowFilters(true);
              notify(
                "Open a title and choose its collection to organize your library.",
              );
            }}
          >
            <Plus size={15} />
          </button>
        </div>
        {["Reading", "Completed", "Plan to read"].map((name, i) => (
          <button
            className="collection"
            key={name}
            onClick={() => {
              navigate("Library");
              setFilter(name);
            }}
          >
            <span className={"collection-dot cd" + i} />
            {name}
            <small>{saved.filter((m) => category(m) === name).length}</small>
          </button>
        ))}
        <div className="sidebar-bottom">
          <div className="reading-note">
            <span className="note-star">✧</span>
            <p>
              A little escape.
              <br />A whole new world.
            </p>
            <span>Make time for your next chapter.</span>
          </div>
          <button
            className={"nav-item " + (view === "Settings" ? "selected" : "")}
            onClick={() => navigate("Settings")}
          >
            <Settings size={18} />
            Settings
          </button>
          <button className="profile" onClick={() => navigate("Settings")}>
            <span className="avatar">Y</span>
            <span>
              Your reading space<small>Saved on this device</small>
            </span>
            <ChevronRight size={15} />
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
          <div className="breadcrumbs">
            <button
              className="mobile-menu icon-button"
              aria-label="Open menu"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>Your workspace</span>
            <ChevronRight size={13} />
            <strong>{view}</strong>
          </div>
          <div className="topbar-actions">
            <span className="local-status">
              <span />
              Local-first. Yours to keep.
            </span>
            <button
              className="icon-button help-button"
              aria-label="Help"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={19} />
            </button>
            <button
              className="avatar small"
              aria-label="Open settings"
              onClick={() => navigate("Settings")}
            >
              Y
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {view === "Library"
                  ? "A WORLD BETWEEN THE PAGES"
                  : view === "Discover"
                    ? "FIND YOUR NEXT OBSESSION"
                    : view === "Repositories"
                      ? "MORE STORIES, YOUR WAY"
                      : view === "History"
                        ? "PICK UP WHERE YOU LEFT OFF"
                        : "MAKE YOURSELF AT HOME"}
              </div>
              <h1>
                {view === "Library"
                  ? "Your library"
                  : view === "Discover"
                    ? "Discover something new"
                    : view === "Repositories"
                      ? "Your repositories"
                      : view === "History"
                        ? "Reading history"
                        : "Your preferences"}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {view === "Library"
                  ? "All your stories. One quiet corner of the internet."
                  : view === "Discover"
                    ? "A new world is always one chapter away."
                    : view === "Repositories"
                      ? "Connect a catalog. Build a library that feels like you."
                      : view === "History"
                        ? "Every chapter is part of your journey."
                        : "A reading experience that works for you."}
              </p>
            </div>
            {view === "Library" || view === "Discover" ? (
              <button
                className="primary-button"
                onClick={() => {
                  navigate("Discover");
                  setQuery("");
                }}
              >
                <Plus size={17} />
                Find manga
              </button>
            ) : view === "Repositories" ? (
              <button
                className="primary-button"
                onClick={() => setRepoModal(true)}
              >
                <Plus size={17} />
                Add repository
              </button>
            ) : null}
          </div>
          {catalogError && <div className="error-banner">{catalogError}</div>}
          {view === "Library" && hero && (
            <section className="hero">
              <img
                className="hero-art"
                src={asset("demo/hero.svg")}
                alt="An illustrated traveler in a sunlit forest"
              />
              <div className="hero-shade" />
              <div className="hero-content">
                <span className="hero-kicker">
                  <span /> YOUR NEXT LITTLE ESCAPE
                </span>
                <h2>
                  The world can wait.
                  <br />
                  Your next chapter can’t.
                </h2>
                <p>Get lost in a story. Find a little wonder.</p>
                <button
                  className="light-button"
                  onClick={() => read(recent[0]?.m || hero)}
                >
                  {recent.length ? "Continue reading" : "Start a story"}
                  <ArrowRight size={16} />
                </button>
                <div className="hero-caption">
                  <span className="hero-line" />
                  {recent[0]?.m?.title || hero.title} <span>·</span>{" "}
                  {recent[0]
                    ? "Continue your journey"
                    : "An original sample story"}
                </div>
              </div>
              <div className="hero-counter">
                01 <span>/ 08</span>
                <span className="hero-counter-line" />
              </div>
            </section>
          )}
          {view === "Library" && recent.length > 0 && (
            <section className="continue-section">
              <div className="section-heading">
                <h2>
                  Continue reading <span>{recent.length}</span>
                </h2>
                <button
                  className="text-button"
                  onClick={() => navigate("History")}
                >
                  View history
                  <ArrowUpRight size={15} />
                </button>
              </div>
              <div className="continue-grid">
                {recent.slice(0, 3).map(({ m, p }) => (
                  <button
                    className="continue-card"
                    key={p.mangaId}
                    onClick={() => read(m!)}
                  >
                    <img src={m!.cover} alt="" />
                    <span className="continue-copy">
                      <strong>{m!.title}</strong>
                      <small>
                        Chapter{" "}
                        {m!.chapters.find((c) => c.id === p.chapterId)
                          ?.number || 1}{" "}
                        · Page {p.page + 1} of {p.total}
                      </small>
                      <span className="progress-track">
                        <span
                          style={{
                            width: `${((p.page + 1) / p.total) * 100}%`,
                          }}
                        />
                      </span>
                    </span>
                    <span className="continue-arrow">
                      <ArrowRight size={16} />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {(view === "Library" ||
            view === "Discover" ||
            view === "History") && (
            <section className="catalog-section">
              <div className="section-heading">
                <h2>
                  {view === "Library"
                    ? "Your bookshelf"
                    : view === "Discover"
                      ? "Explore the shelves"
                      : "Recently read"}
                  <span>{shown.length}</span>
                </h2>
                {view === "Library" && (
                  <span className="quiet-label">
                    <span />
                    Everything in its place
                  </span>
                )}
                {view === "History" && active.length > 0 && (
                  <button
                    className="text-button"
                    onClick={() => {
                      if (
                        confirm(
                          "Clear reading history? Your library will be kept.",
                        )
                      )
                        setState((s) => ({ ...s, progress: {} }));
                    }}
                  >
                    Clear history
                  </button>
                )}
              </div>
              {view === "Library" && (
                <div className="shelf-tabs">
                  {["All manga", "Reading", "Completed", "Plan to read"].map(
                    (f) => (
                      <button
                        key={f}
                        className={filter === f ? "active" : ""}
                        onClick={() => setFilter(f)}
                      >
                        {f}
                        <span>
                          {f === "All manga"
                            ? saved.length
                            : saved.filter((m) => category(m) === f).length}
                        </span>
                      </button>
                    ),
                  )}
                </div>
              )}
              {view === "Discover" && (
                <div className="source-strip">
                  <label>
                    Source
                    <select
                      aria-label="Choose source"
                      value={discoverSource}
                      onChange={(e) => setDiscoverSource(e.target.value)}
                    >
                      {[
                        "All sources",
                        "Teramanga Originals",
                        ...state.repos
                          .filter((r) => r.enabled)
                          .map((r) => r.name),
                        ...(state.mangaDexEndpoint ? ["MangaDex"] : []),
                      ]
                        .filter((x, i, a) => a.indexOf(x) === i)
                        .map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                    </select>
                  </label>
                  <button
                    className="text-button"
                    onClick={() => setRepoModal(true)}
                  >
                    <Plus size={15} />
                    Add a source
                  </button>
                </div>
              )}
              <div className="catalog-toolbar">
                <label className="search-field">
                  <Search size={17} />
                  <input
                    aria-label="Search manga"
                    placeholder={
                      view === "Discover"
                        ? "Search titles or authors…"
                        : "Search your library…"
                    }
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && discoverSource === "MangaDex")
                        searchMangaDex();
                    }}
                  />
                  {query && (
                    <button
                      aria-label="Clear search"
                      onClick={() => setQuery("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
                <div className="toolbar-options">
                  {view === "Discover" && discoverSource === "MangaDex" && (
                    <button
                      className="secondary-button"
                      onClick={searchMangaDex}
                      disabled={loading === "mangadex"}
                    >
                      {loading === "mangadex" ? (
                        <LoaderCircle className="spin" size={15} />
                      ) : (
                        <Search size={15} />
                      )}
                      Search source
                    </button>
                  )}
                  <label className="sort-select">
                    <span>Sort:</span>
                    <select
                      aria-label="Sort manga"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option>Recently added</option>
                      <option>Title A–Z</option>
                      <option>Last read</option>
                    </select>
                  </label>
                  <button
                    className={
                      "icon-button filter-button " +
                      (showFilters ? "active" : "")
                    }
                    aria-label="Filter by genre"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <SlidersHorizontal size={17} />
                  </button>
                  <div className="view-toggle">
                    <button
                      className={layout === "grid" ? "active" : ""}
                      aria-label="Grid view"
                      onClick={() => setLayout("grid")}
                    >
                      <LayoutGrid size={16} />
                    </button>
                    <button
                      className={layout === "list" ? "active" : ""}
                      aria-label="List view"
                      onClick={() => setLayout("list")}
                    >
                      <List size={18} />
                    </button>
                  </div>
                </div>
              </div>
              {showFilters && (
                <div className="filter-panel">
                  <label>
                    Genre{" "}
                    <select
                      aria-label="Genre"
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                    >
                      {[
                        "All genres",
                        ...new Set(manga.flatMap((m) => m.genres)),
                      ].map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="text-button"
                    onClick={() => {
                      setGenre("All genres");
                      setFilter("All manga");
                    }}
                  >
                    Reset filters
                  </button>
                </div>
              )}
              {shown.length ? (
                <div
                  className={
                    "manga-grid " + (layout === "list" ? "manga-list" : "")
                  }
                >
                  {shown.map((m) => (
                    <article className="manga-card" key={m.id}>
                      <button
                        className="cover-button"
                        onClick={() => setDetails(m)}
                        aria-label={"Open " + m.title}
                      >
                        <img
                          src={m.cover}
                          alt={m.title + " cover"}
                          loading="lazy"
                        />
                        <span className="cover-text">
                          <span>{m.genres[0]}</span>
                          <strong>{m.title}</strong>
                        </span>
                        <span
                          className={
                            "status-pill " +
                            (category(m) === "Completed" ? "finished" : "")
                          }
                        >
                          <span />
                          {view === "Library" ? category(m) : m.status}
                        </span>
                        <span className="cover-hover">
                          <BookOpen size={22} />
                          Open manga
                        </span>
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
                          onClick={() => setDetails(m)}
                        >
                          {m.title}
                        </button>
                        <button
                          className="card-menu"
                          aria-label={"Details for " + m.title}
                          onClick={() => setDetails(m)}
                        >
                          <MoreHorizontal size={18} />
                        </button>
                      </div>
                      <span className="manga-author">{m.author}</span>
                      <div className="card-footer">
                        <span>{m.genres.slice(0, 2).join(" · ")}</span>
                        <span>
                          {m.remote ? "MangaDex" : `${m.chapters.length} ch.`}
                        </span>
                      </div>
                      {view === "History" && state.progress[m.id] && (
                        <small className="history-date">
                          {new Date(
                            state.progress[m.id].updated,
                          ).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </small>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <Empty
                  icon={view === "History" ? Clock3 : Search}
                  title={
                    view === "History"
                      ? "Your story starts here"
                      : query
                        ? "No matching stories"
                        : "A little room for something new"
                  }
                  text={
                    view === "History"
                      ? "Open a manga and start reading. Your place will be saved automatically."
                      : view === "Discover" && discoverSource === "MangaDex"
                        ? "Search MangaDex to load live titles from the source."
                        : "Try another filter, explore the sample catalog, or connect a repository."
                  }
                  action={() => {
                    navigate("Discover");
                    setDiscoverSource("All sources");
                  }}
                  label="Explore manga"
                />
              )}
              {view === "Discover" && (
                <div className="source-notice">
                  <CircleHelp size={17} />
                  <p>
                    Teramanga Originals are illustrated demo stories. Connect a
                    JSON repository for your own catalog, or configure an
                    optional MangaDex API endpoint in Settings.
                  </p>
                </div>
              )}
            </section>
          )}
          {view === "Repositories" && (
            <>
              <div className="repository-intro">
                <div className="repo-intro-icon">
                  <Layers size={27} />
                </div>
                <div>
                  <h2>A bigger world, one source at a time.</h2>
                  <p>
                    Add web-compatible catalogs with a URL. Your sources,
                    library, and progress stay in your browser.
                  </p>
                </div>
                <button className="text-button" onClick={() => setHelp(true)}>
                  How it works
                  <ArrowUpRight size={15} />
                </button>
              </div>
              <div className="section-heading">
                <h2>
                  Connected sources <span>{state.repos.length + 1}</span>
                </h2>
                <span className="quiet-label">JSON repositories</span>
              </div>
              <div className="repo-list">
                <div className="repo-row">
                  <span className="repo-symbol">
                    <BookOpen size={25} />
                  </span>
                  <div className="repo-info">
                    <h3>
                      Teramanga Originals{" "}
                      <span className="subtle-badge">BUILT IN</span>
                    </h3>
                    <p>
                      Original illustrated samples. A little something to get
                      you started.
                    </p>
                    <span>{demo.length} titles · No account needed</span>
                  </div>
                  <span className="connected-label">
                    <CheckCircle2 size={15} />
                    Connected
                  </span>
                  <button
                    className="icon-button"
                    aria-label="Browse original catalog"
                    onClick={() => {
                      navigate("Discover");
                      setDiscoverSource("Teramanga Originals");
                    }}
                  >
                    <ArrowUpRight size={19} />
                  </button>
                </div>
                {state.repos.map((r) => (
                  <div className="repo-row" key={r.id}>
                    <span className="repo-symbol custom">
                      <Rss size={25} />
                    </span>
                    <div className="repo-info">
                      <h3>{r.name}</h3>
                      <p className="repo-url">{r.url}</p>
                      <span>
                        {r.count} titles · Added{" "}
                        {new Date(r.added).toLocaleDateString()}
                      </span>
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
                            x.id === r.id ? { ...x, enabled: !x.enabled } : x,
                          ),
                        }))
                      }
                    >
                      <span />
                    </button>
                    {r.id !== "mangadex-saved" && !r.importOnly && (
                      <button
                        className="icon-button"
                        aria-label={"Refresh " + r.name}
                        disabled={refreshing === r.id}
                        onClick={() => refreshRepo(r)}
                      >
                        <RefreshCw
                          className={refreshing === r.id ? "spin" : ""}
                          size={17}
                        />
                      </button>
                    )}
                    <button
                      className="icon-button danger-hover"
                      aria-label={"Remove " + r.name}
                      onClick={() => {
                        if (
                          confirm(
                            `Remove ${r.name}? Export a backup first to preserve its catalog. Reading history will be kept.`,
                          )
                        )
                          setState((s) => ({
                            ...s,
                            repos: s.repos.filter((x) => x.id !== r.id),
                          }));
                      }}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="add-repo-card"
                onClick={() => setRepoModal(true)}
              >
                <Plus size={23} />
                <span>
                  Add a repository
                  <small>Paste a catalog URL or import a JSON file</small>
                </span>
                <ArrowRight size={19} />
              </button>
              <div className="source-notice">
                <CircleHelp size={18} />
                <p>
                  Android APK extensions from Tachiyomi, Mihon, and Tachimanga
                  cannot run on the web. Teramanga supports open JSON catalogs
                  and an optional MangaDex API adapter. Only connect sources you
                  trust and content you have permission to access.
                </p>
              </div>
            </>
          )}
          {view === "Settings" && (
            <div className="settings-stack">
              <section className="settings-card">
                <div className="settings-icon">
                  <BookOpen size={23} />
                </div>
                <div>
                  <h2>Read your way</h2>
                  <p>These defaults follow you into every chapter.</p>
                </div>
                <div className="settings-fields">
                  <label>
                    Reading mode
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
                    Reader background
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
                      <option value="dark">Midnight</option>
                      <option value="light">Paper</option>
                      <option value="sepia">Warm paper</option>
                    </select>
                  </label>
                  <label>
                    Reading direction
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
              <section className="settings-card">
                <div className="settings-icon">
                  <Download size={23} />
                </div>
                <div>
                  <h2>Your library belongs to you</h2>
                  <p>
                    Export your library, catalogs, progress, and reader
                    settings. Backups contain no image files.
                  </p>
                </div>
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
                    onClick={() => importRef.current?.click()}
                  >
                    <Upload size={16} />
                    Restore backup
                  </button>
                  <input
                    ref={importRef}
                    type="file"
                    accept=".json,application/json"
                    hidden
                    onChange={(e) => importBackup(e.target.files?.[0])}
                  />
                </div>
                <p className="settings-note">
                  Restoring replaces data on this device. Export a backup first.
                  Browser storage can be cleared by your browser; keep a backup
                  of anything important.
                </p>
              </section>
              <section className="settings-card">
                <div className="settings-icon">
                  <Compass size={23} />
                </div>
                <div>
                  <h2>Optional MangaDex connection</h2>
                  <p>
                    MangaDex blocks direct requests from GitHub Pages. Connect a
                    trusted, CORS-enabled MangaDex API gateway to enable this
                    source. Leave blank to use JSON catalogs only.
                  </p>
                </div>
                <form
                  className="api-settings-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const endpoint = new FormData(e.currentTarget).get(
                      "endpoint",
                    ) as string;
                    try {
                      const value = endpoint.trim().replace(/\/$/, "");
                      if (value) {
                        const u = new URL(value);
                        if (u.protocol !== "https:" || u.username || u.password)
                          throw new Error(
                            "Use an HTTPS endpoint without credentials.",
                          );
                      }
                      setState((s) => ({ ...s, mangaDexEndpoint: value }));
                      notify(
                        value
                          ? "API endpoint saved. Test your connection in Discover → MangaDex."
                          : "MangaDex connection disabled.",
                      );
                    } catch (e) {
                      notify((e as Error).message);
                    }
                  }}
                >
                  <label className="field-label" htmlFor="api-endpoint">
                    MangaDex API endpoint
                  </label>
                  <div>
                    <input
                      id="api-endpoint"
                      name="endpoint"
                      type="url"
                      className="text-input"
                      defaultValue={state.mangaDexEndpoint}
                      placeholder="https://your-api.example.com"
                    />
                    <button className="secondary-button">Save endpoint</button>
                  </div>
                </form>
              </section>
              <section className="settings-card">
                <div className="settings-icon">
                  <Library size={23} />
                </div>
                <div>
                  <h2>A personal reading space</h2>
                  <p>
                    No account. No tracking. No automatic cloud sync. Your
                    preferences and history are stored on this browser.
                  </p>
                </div>
                <button className="text-button" onClick={() => setHelp(true)}>
                  About repositories and reading
                  <ArrowUpRight size={15} />
                </button>
              </section>
            </div>
          )}
          <footer>
            <span>
              <BookOpen size={14} /> Your manga. Your pace.
            </span>
            <span>
              Made for the love of stories.<span className="footer-dot">✧</span>
            </span>
          </footer>
        </main>
      </div>
      {details && (
        <div className="modal-backdrop" onClick={() => setDetails(null)}>
          <section
            className="modal detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label={details.title}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close details"
              onClick={() => setDetails(null)}
            >
              <X size={20} />
            </button>
            <div className="detail-top">
              <div className="detail-cover">
                <img src={details.cover} alt={details.title + " cover"} />
                <span>{details.title}</span>
              </div>
              <div className="detail-info">
                <span className="eyebrow">
                  {details.source || "YOUR CATALOG"}
                </span>
                <h2>{details.title}</h2>
                <p className="detail-author">by {details.author}</p>
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
                    onClick={() => read(details)}
                    disabled={loading === details.id}
                  >
                    {loading === details.id ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <BookOpen size={17} />
                    )}{" "}
                    {state.progress[details.id] &&
                    !state.progress[details.id].completed
                      ? "Continue reading"
                      : "Start reading"}
                  </button>
                  <button
                    className={
                      "secondary-button " +
                      (state.library.includes(details.id) ? "saved" : "")
                    }
                    onClick={() => toggleLibrary(details)}
                  >
                    {state.library.includes(details.id) ? (
                      <Check size={16} />
                    ) : (
                      <Plus size={16} />
                    )}{" "}
                    {state.library.includes(details.id)
                      ? "In library"
                      : "Add to library"}
                  </button>
                </div>
                {state.library.includes(details.id) && (
                  <label className="collection-select">
                    Collection
                    <select
                      aria-label="Manga collection"
                      value={category(details)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setState((s) => ({
                          ...s,
                          categories: { ...s.categories, [details.id]: v },
                        }));
                      }}
                    >
                      {["Reading", "Completed", "Plan to read"].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>
            <div className="chapter-heading">
              <h3>
                Chapters <span>{details.chapters.length || "—"}</span>
              </h3>
              <span>{details.status}</span>
            </div>
            {details.chapters.length ? (
              details.chapters.map((c) => (
                <button
                  className="chapter-row"
                  key={c.id}
                  onClick={() => read(details, c, true)}
                  disabled={loading === details.id}
                >
                  <span className="chapter-number">
                    {String(c.number).padStart(2, "0")}
                  </span>
                  <span>
                    <strong>{c.title}</strong>
                    <small>
                      {c.pages.length
                        ? `${c.pages.length} pages`
                        : "Load pages from source"}
                    </small>
                  </span>
                  {state.progress[details.id]?.chapterId === c.id ? (
                    <Bookmark size={17} />
                  ) : (
                    <ChevronRight size={18} />
                  )}
                </button>
              ))
            ) : (
              <p className="chapter-empty">
                {details.remote
                  ? "Select Start reading to fetch available English chapters."
                  : "No chapters published yet."}
              </p>
            )}
          </section>
        </div>
      )}
      {repoModal && (
        <RepoModal
          existing={state.repos}
          onClose={() => setRepoModal(false)}
          onAdd={(repo) => {
            setState((s) => ({ ...s, repos: [...s.repos, repo] }));
            setRepoModal(false);
            notify(
              `${repo.name} connected. ${repo.count} titles ready to explore.`,
            );
            navigate("Discover");
            setDiscoverSource(repo.name);
          }}
        />
      )}
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="modal help-modal"
            role="dialog"
            aria-modal="true"
            aria-label="About Teramanga"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close help"
              onClick={() => setHelp(false)}
            >
              <X size={20} />
            </button>
            <span className="brand-mark">
              <BookOpen size={25} />
            </span>
            <h2>A home for your next chapter.</h2>
            <p>
              Teramanga is a personal, browser-based manga reader. Browse a
              source, save a title, and settle into a chapter. Your place is
              saved automatically on this device.
            </p>
            <h3>Bring your own catalog</h3>
            <p>
              Repositories are JSON files listing manga, chapters, and image
              URLs. They must allow browser requests (CORS). You can also import
              a catalog file. Android APK extensions are not supported.
            </p>
            <h3>Reading controls</h3>
            <p>
              Use arrow keys in single-page mode, F for full screen, and Escape
              to return. Open reader settings for page width, direction,
              background, and brightness.
            </p>
            <h3>Keep your place</h3>
            <p>
              Export a backup in Settings to move your library to another
              browser. Images are streamed from their source and require an
              internet connection unless already cached.
            </p>
            <button className="primary-button" onClick={() => setHelp(false)}>
              Make yourself at home
              <ArrowRight size={16} />
            </button>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
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
  icon: typeof Search;
  title: string;
  text: string;
  action: () => void;
  label: string;
}) {
  return (
    <div className="empty-state">
      <span>
        <Icon size={29} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      <button className="secondary-button" onClick={action}>
        {label}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
function RepoModal({
  existing,
  onAdd,
  onClose,
}: {
  existing: Repo[];
  onAdd: (r: Repo) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [schema, setSchema] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  async function add(file?: File) {
    setError("");
    setBusy(true);
    try {
      let base: string;
      let raw: unknown;
      if (file) {
        if (file.size > 15_000_000)
          throw new Error("Catalog exceeds the 15 MB limit.");
        raw = JSON.parse(await file.text());
        base = url.trim() ? new URL(url.trim()).href : location.href;
        if (!url.trim()) {
          const data = raw as { manga?: Manga[] };
          if (
            Array.isArray(data.manga) &&
            data.manga.some(
              (m) =>
                (typeof m.cover === "string" &&
                  !/^https?:\/\//.test(m.cover)) ||
                (Array.isArray(m.chapters) &&
                  m.chapters.some(
                    (c) =>
                      Array.isArray(c.pages) &&
                      c.pages.some(
                        (p) => typeof p === "string" && !/^https?:\/\//.test(p),
                      ),
                  )),
            )
          )
            throw new Error(
              "This file uses relative image URLs. Enter its original catalog URL first so images can be resolved.",
            );
        }
      } else {
        base = new URL(url.trim()).href;
        if (
          !["https:", "http:"].includes(new URL(base).protocol) ||
          new URL(base).username ||
          new URL(base).password
        )
          throw new Error(
            "Enter an HTTPS catalog URL without embedded credentials.",
          );
        if (
          location.protocol === "https:" &&
          new URL(base).protocol !== "https:"
        )
          throw new Error("Use HTTPS to avoid mixed-content blocking.");
        if (existing.some((r) => r.url === base))
          throw new Error("This repository is already connected.");
        raw = await fetchJSON(base);
      }
      if (
        !["https:", "http:"].includes(new URL(base).protocol) ||
        new URL(base).username ||
        new URL(base).password
      )
        throw new Error(
          "Use an HTTP(S) catalog URL without embedded credentials.",
        );
      const catalog = validateCatalog(raw, base);
      const id = crypto.randomUUID();
      onAdd({
        id,
        name: catalog.name,
        url: base,
        importOnly: !!file,
        count: catalog.manga.length,
        enabled: true,
        added: new Date().toISOString(),
        manga: catalog.manga.map((m) => ({
          ...m,
          id: id + ":" + m.id,
          chapters: m.chapters.map((c) => ({ ...c, id: id + ":" + c.id })),
        })),
      });
    } catch (e) {
      setError(
        (e as Error).message +
          (e instanceof TypeError
            ? " Check that the URL is correct and the server allows CORS."
            : ""),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal repo-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add repository"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close icon-button"
          aria-label="Close add repository"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <span className="modal-symbol">
          <Layers size={25} />
        </span>
        <span className="eyebrow">A NEW SOURCE OF STORIES</span>
        <h2>Add a repository</h2>
        <p>
          Connect a web-compatible JSON catalog. We’ll keep the stories
          organized; you do the reading.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label className="field-label" htmlFor="repo-url">
            Repository URL
          </label>
          <input
            id="repo-url"
            className="text-input"
            type="url"
            placeholder="https://example.com/catalog.json"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            autoFocus
          />
          <span className="input-hint">
            The source must allow cross-origin requests (CORS).
          </span>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <button className="primary-button full-width" disabled={busy}>
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Plus size={17} />
            )}{" "}
            {busy ? "Connecting…" : "Connect repository"}
          </button>
        </form>
        <div className="or-divider">
          <span />
          or bring your own file
          <span />
        </div>
        <button
          className="secondary-button full-width"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={16} />
          Import catalog JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => add(e.target.files?.[0])}
        />
        <button
          className="schema-toggle text-button"
          onClick={() => setSchema(!schema)}
        >
          Repository format
          <ChevronDown
            size={15}
            style={{ transform: schema ? "rotate(180deg)" : "" }}
          />
        </button>
        {schema && (
          <>
            <pre>
              {JSON.stringify(
                {
                  name: "My collection",
                  manga: [
                    {
                      id: "story-1",
                      title: "A new story",
                      author: "Author",
                      cover: "https://example.com/cover.jpg",
                      genres: ["Adventure"],
                      status: "Ongoing",
                      chapters: [
                        {
                          id: "chapter-1",
                          number: 1,
                          title: "The beginning",
                          pages: ["https://example.com/page-1.jpg"],
                        },
                      ],
                    },
                  ],
                },
                null,
                2,
              )}
            </pre>
            <button
              className="text-button"
              onClick={() =>
                exportFile("example-catalog.json", {
                  name: "My collection",
                  manga: [],
                })
              }
            >
              <Download size={14} />
              Download empty catalog
            </button>
          </>
        )}
        <div className="modal-footnote">
          <CircleHelp size={15} />
          <span>APK extensions aren’t compatible with web browsers.</span>
        </div>
      </section>
    </div>
  );
}
function Reader({
  session,
  preferences: p,
  onPreferences,
  onProgress,
  onClose,
  onChapter,
}: {
  session: { manga: Manga; chapter: Chapter; page: number };
  preferences: State["preferences"];
  onPreferences: (p: State["preferences"]) => void;
  onProgress: (p: Progress) => void;
  onClose: () => void;
  onChapter: (c: Chapter) => void;
}) {
  const [page, setPage] = useState(session.page);
  const [settings, setSettings] = useState(false);
  const [controls, setControls] = useState(true);
  const [full, setFull] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("");
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
  const pagesRef = useRef<(HTMLDivElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initial = useRef(true);
  const current = useRef(page);
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;
  const chapter = session.chapter;
  const count = chapter.pages.length;
  useEffect(() => {
    setPage(session.page);
    current.current = session.page;
    setComplete(false);
    initial.current = true;
    setImageErrors({});
  }, [chapter.id, session.page]);
  useEffect(() => {
    const old = document.title;
    document.title = `${session.manga.title} · Chapter ${chapter.number} — Teramanga`;
    return () => {
      document.title = old;
    };
  }, [chapter.id, session.manga.title, chapter.number]);
  useEffect(() => {
    if (p.mode === "vertical" && initial.current) {
      const timer = setTimeout(() => {
        pagesRef.current[session.page]?.scrollIntoView({ block: "start" });
        initial.current = false;
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [chapter.id, p.mode, session.page]);
  useEffect(() => {
    progressRef.current({
      mangaId: session.manga.id,
      chapterId: chapter.id,
      page,
      total: count,
      updated: Date.now(),
      completed: complete,
    });
  }, [page, complete, chapter.id, count, session.manga.id]);
  useEffect(() => {
    if (p.mode !== "vertical") return;
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (initial.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const n = Number((entry.target as HTMLElement).dataset.page);
            current.current = n;
            setPage(n);
          }
        }
      },
      { root, rootMargin: "-10% 0px -65% 0px", threshold: 0 },
    );
    pagesRef.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [chapter.id, p.mode]);
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setMessage("Fullscreen is unavailable in this browser.");
    }
  }
  useEffect(() => {
    const handler = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);
  function go(n: number) {
    n = Math.max(0, Math.min(count - 1, n));
    current.current = n;
    setPage(n);
    if (p.mode === "vertical")
      pagesRef.current[n]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    else scrollRef.current?.scrollTo({ top: 0 });
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        ["INPUT", "SELECT", "TEXTAREA"].includes(
          (e.target as HTMLElement).tagName,
        )
      )
        return;
      if (e.key === "Escape") {
        if (settings) setSettings(false);
        else if (!document.fullscreenElement) onClose();
      }
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        fullscreen();
      }
      if (e.key.toLowerCase() === "h") setControls((x) => !x);
      if (
        p.mode === "paged" &&
        (e.key === "ArrowRight" || e.key === "ArrowLeft")
      ) {
        e.preventDefault();
        const next = (e.key === "ArrowRight") === (p.direction === "ltr");
        go(current.current + (next ? 1 : -1));
      }
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [settings, p.mode, p.direction, count, onClose]);
  const nextChapter =
    session.manga.chapters[
      session.manga.chapters.findIndex((c) => c.id === chapter.id) + 1
    ];
  function done() {
    if (Object.values(imageErrors).some(Boolean)) {
      setMessage(
        "Some pages could not load. Retry them before marking this chapter complete.",
      );
      return false;
    }
    setComplete(true);
    setPage(count - 1);
    setMessage("Chapter complete. Your progress has been saved.");
    return true;
  }
  const image = (src: string, i: number) => (
    <div
      className="reader-page"
      data-page={i}
      key={chapter.id + ":" + i}
      ref={(el) => {
        pagesRef.current[i] = el;
      }}
      style={{ marginBottom: p.gap ? 18 : 0 }}
    >
      <img
        src={src}
        alt={`${session.manga.title}, chapter ${chapter.number}, page ${i + 1}`}
        width="900"
        height="1450"
        loading={i < session.page + 2 ? "eager" : "lazy"}
        style={{ filter: `brightness(${p.dim}%)` }}
        onLoad={() => setImageErrors((s) => ({ ...s, [i]: false }))}
        onError={() => setImageErrors((s) => ({ ...s, [i]: true }))}
      />
      {imageErrors[i] && (
        <div className="page-load-error">
          <p>Page {i + 1} couldn’t load from its source.</p>
          <button
            className="secondary-button"
            onClick={() => {
              const img = pagesRef.current[i]?.querySelector("img");
              if (img) {
                const u = new URL(src);
                u.searchParams.set("_retry", String(Date.now()));
                img.src = u.href;
              }
            }}
          >
            <RefreshCw size={15} />
            Retry page
          </button>
        </div>
      )}
      <span className="page-number">
        {i + 1} / {count}
      </span>
    </div>
  );
  return (
    <div
      className={"reader reader-" + p.theme + (controls ? "" : " reader-zen")}
    >
      <header className="reader-header">
        <button className="reader-back" onClick={onClose}>
          <ChevronLeft size={20} />
          <span>Library</span>
        </button>
        <div className="reader-title">
          <strong>{session.manga.title}</strong>
          <span>
            Chapter {chapter.number} <span>·</span> {chapter.title}
          </span>
        </div>
        <div className="reader-header-actions">
          <button
            className="icon-button"
            aria-label="Toggle full screen"
            onClick={fullscreen}
          >
            {full ? <Minimize size={19} /> : <Maximize size={19} />}
          </button>
          <button
            className={"icon-button " + (settings ? "active" : "")}
            aria-label="Reader settings"
            onClick={() => setSettings(!settings)}
          >
            <SlidersHorizontal size={20} />
          </button>
          <button
            className="icon-button"
            aria-label="Hide controls"
            onClick={() => setControls(false)}
          >
            <Minimize size={18} />
          </button>
        </div>
      </header>
      {!controls && (
        <button
          className="show-reader-controls"
          onClick={() => setControls(true)}
        >
          <Menu size={17} />
          Show controls
        </button>
      )}
      <div className="reader-scroll" ref={scrollRef}>
        <div className="reader-chapter-intro">
          <span className="eyebrow">SETTLE IN. THE WORLD CAN WAIT.</span>
          <h1>{chapter.title}</h1>
          <p>
            Chapter {chapter.number} · {count} pages
          </p>
        </div>
        <div className="reader-pages" style={{ maxWidth: p.width }}>
          {p.mode === "vertical"
            ? chapter.pages.map(image)
            : image(chapter.pages[page], page)}
        </div>
        {(p.mode === "vertical" || page === count - 1) && (
          <div className="chapter-end">
            <span>✧</span>
            <h2>
              {complete
                ? "Another chapter, another world."
                : "You’ve reached the end."}
            </h2>
            <p>
              {nextChapter
                ? "Your next chapter is waiting."
                : "Take a breath. A new story is always waiting."}
            </p>
            <div>
              {!complete && (
                <button className="secondary-button" onClick={done}>
                  <Check size={17} />
                  Mark chapter complete
                </button>
              )}
              {nextChapter ? (
                <button
                  className="primary-button"
                  onClick={() => {
                    if (done()) onChapter(nextChapter);
                  }}
                >
                  Next chapter
                  <ArrowRight size={17} />
                </button>
              ) : (
                <button
                  className="primary-button"
                  onClick={() => {
                    if (!Object.values(imageErrors).some(Boolean)) {
                      onProgress({
                        mangaId: session.manga.id,
                        chapterId: chapter.id,
                        page: count - 1,
                        total: count,
                        updated: Date.now(),
                        completed: true,
                      });
                      onClose();
                    } else done();
                  }}
                >
                  Finish & return
                  <Check size={17} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="reader-bottom">
        <div className="reader-chapter-select">
          <BookOpen size={17} />
          <select
            aria-label="Choose chapter"
            value={chapter.id}
            onChange={(e) => {
              const c = session.manga.chapters.find(
                (c) => c.id === e.target.value,
              );
              if (c) onChapter(c);
            }}
          >
            {session.manga.chapters.map((c) => (
              <option key={c.id} value={c.id}>
                Chapter {c.number}
              </option>
            ))}
          </select>
        </div>
        <div className="page-controls">
          <button
            className="icon-button"
            aria-label="Previous page"
            disabled={page === 0}
            onClick={() => go(page - 1)}
          >
            <ChevronLeft size={20} />
          </button>
          <span>
            <strong>{page + 1}</strong> <span>/ {count}</span>
          </span>
          <button
            className="icon-button"
            aria-label="Next page"
            disabled={page === count - 1}
            onClick={() => go(page + 1)}
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="reader-page-slider">
          <input
            aria-label="Go to page"
            type="range"
            min="0"
            max={count - 1}
            value={page}
            onChange={(e) => go(Number(e.target.value))}
          />
          <span>{Math.round(((page + 1) / count) * 100)}%</span>
        </div>
      </div>
      {settings && (
        <>
          <button
            className="reader-settings-scrim"
            aria-label="Close reader settings"
            onClick={() => setSettings(false)}
          />
          <aside className="reader-settings">
            <div className="section-heading">
              <h2>Read your way</h2>
              <button
                className="icon-button"
                aria-label="Close settings"
                onClick={() => setSettings(false)}
              >
                <X size={19} />
              </button>
            </div>
            <p>A little comfort goes a long way.</p>
            <label className="reader-setting">
              Reading mode
              <div className="segmented">
                <button
                  className={p.mode === "vertical" ? "active" : ""}
                  onClick={() => {
                    onPreferences({ ...p, mode: "vertical" });
                    initial.current = true;
                  }}
                >
                  <List size={16} />
                  Scroll
                </button>
                <button
                  className={p.mode === "paged" ? "active" : ""}
                  onClick={() => onPreferences({ ...p, mode: "paged" })}
                >
                  <BookOpen size={16} />
                  Single page
                </button>
              </div>
            </label>
            <label className="reader-setting">
              Reading direction
              <div className="segmented">
                <button
                  className={p.direction === "ltr" ? "active" : ""}
                  onClick={() => onPreferences({ ...p, direction: "ltr" })}
                >
                  Left to right
                </button>
                <button
                  className={p.direction === "rtl" ? "active" : ""}
                  onClick={() => onPreferences({ ...p, direction: "rtl" })}
                >
                  Right to left
                </button>
              </div>
            </label>
            <span className="setting-hint">
              Direction controls arrow-key navigation in single-page mode.
            </span>
            <label className="reader-setting">
              Page width <span>{p.width}px</span>
              <input
                aria-label="Page width"
                type="range"
                min="400"
                max="1200"
                step="50"
                value={p.width}
                onChange={(e) =>
                  onPreferences({ ...p, width: Number(e.target.value) })
                }
              />
            </label>
            <label className="reader-setting">
              Brightness <span>{p.dim}%</span>
              <input
                aria-label="Page brightness"
                type="range"
                min="40"
                max="100"
                value={p.dim}
                onChange={(e) =>
                  onPreferences({ ...p, dim: Number(e.target.value) })
                }
              />
            </label>
            <label className="reader-setting">
              Background
              <div className="theme-picker">
                {(["dark", "light", "sepia"] as const).map((t) => (
                  <button
                    aria-label={t + " reader background"}
                    aria-pressed={p.theme === t}
                    className={
                      "theme-" + t + " " + (p.theme === t ? "active" : "")
                    }
                    key={t}
                    onClick={() => onPreferences({ ...p, theme: t })}
                  >
                    {t === "dark" ? <Moon size={19} /> : <Sun size={19} />}
                    <span>
                      {t === "dark"
                        ? "Midnight"
                        : t === "light"
                          ? "Paper"
                          : "Warm"}
                    </span>
                  </button>
                ))}
              </div>
            </label>
            <div className="reader-setting switch-setting">
              Space between pages
              <button
                className={"switch " + (p.gap ? "on" : "")}
                role="switch"
                aria-label="Space between pages"
                aria-checked={p.gap}
                onClick={() => onPreferences({ ...p, gap: !p.gap })}
              >
                <span />
              </button>
            </div>
            <div className="keyboard-hints">
              <span>← →</span> Change page in single-page mode
              <br />
              <span>F</span> Full screen <span>H</span> Hide controls
              <br />
              <span>Esc</span> Back to your library
            </div>
          </aside>
        </>
      )}
      {message && (
        <div className="toast" role="status">
          {message}
          <button
            aria-label="Dismiss notification"
            onClick={() => setMessage("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
