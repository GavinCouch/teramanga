import { useState, useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  SlidersHorizontal,
  Minimize,
  Maximize,
  Menu,
  RefreshCw,
  Check,
  ArrowRight,
  X,
  List,
  Sun,
  Moon,
} from "lucide-react";
import { type Manga, type Chapter, type State, type Progress } from "./model";
import ContentImage from "./ContentImage";
import { authFor } from "./suwayomi";
export default function Reader({
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
      <ContentImage
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
                img.dispatchEvent(new Event("retry"));
                if (!authFor(src)) {
                  const u = new URL(src);
                  u.searchParams.set("_retry", String(Date.now()));
                  img.src = u.href;
                }
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
            <h2>{complete ? "Chapter completed" : "End of chapter"}</h2>
            <p>{nextChapter ? "" : ""}</p>
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
              <h2>Reader settings</h2>
              <button
                className="icon-button"
                aria-label="Close settings"
                onClick={() => setSettings(false)}
              >
                <X size={19} />
              </button>
            </div>

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
                        ? "Dark"
                        : t === "light"
                          ? "Paper"
                          : "Sepia"}
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
