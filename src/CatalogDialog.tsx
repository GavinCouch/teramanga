import { useState, useRef, useEffect } from "react";
import {
  X,
  Layers,
  Plus,
  Upload,
  LoaderCircle,
  ChevronDown,
  Download,
  CircleHelp,
} from "lucide-react";
import {
  type Repo,
  type Manga,
  validateCatalog,
  fetchJSON,
  exportFile,
} from "./model";
export default function CatalogDialog({
  existing,
  onAdd,
  onClose,
}: {
  existing: Repo[];
  onAdd: (r: Repo) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = Array.from(
          document.querySelectorAll<HTMLElement>(
            "[role=dialog] button:not(:disabled),[role=dialog] input:not([hidden]),[role=dialog] a[href]",
          ),
        ).filter((e) => e.offsetParent !== null);
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
          e.preventDefault();
          items[0]?.focus();
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

        <h2>Add JSON catalog</h2>
        <p>Import manga, chapters, and image URLs from a JSON catalog.</p>
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
                      title: "Title",
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
          <span>For Keiyoushi extensions, use Repositories instead.</span>
        </div>
      </section>
    </div>
  );
}
