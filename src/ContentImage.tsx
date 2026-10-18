import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { authFor } from "./suwayomi";
export default function ContentImage({
  src,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const [revision, retry] = useState(0);
  const [resolved, setResolved] = useState("");
  const [visible, setVisible] = useState(props.loading !== "lazy");
  const authorization = src ? authFor(src) : "";
  useEffect(() => {
    const img = ref.current;
    if (!img) return;
    const listener = () => retry((x) => x + 1);
    img.addEventListener("retry", listener);
    return () => img.removeEventListener("retry", listener);
  }, []);
  useEffect(() => {
    if (!authorization || visible || !ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "1000px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [authorization, visible]);
  useEffect(() => {
    if (!authorization || !src || !visible) return;
    const controller = new AbortController();
    let blobURL = "";
    setResolved("");
    fetch(src, {
      headers: { Authorization: authorization },
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error("Image unavailable");
        return r.blob();
      })
      .then((blob) => {
        if (!controller.signal.aborted) {
          blobURL = URL.createObjectURL(blob);
          setResolved(blobURL);
        }
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setResolved("data:image/png;base64,aW52YWxpZA==");
      });
    return () => {
      controller.abort();
      if (blobURL) URL.revokeObjectURL(blobURL);
    };
  }, [src, authorization, revision, visible]);
  return (
    <img
      {...props}
      ref={ref}
      src={
        failed && !props.onError
          ? new URL(
              "./placeholder.svg",
              new URL(import.meta.env.BASE_URL, location.href),
            ).href
          : authorization
            ? resolved || undefined
            : src
      }
      onError={(e) => {
        if (props.onError) props.onError(e);
        else setFailed(true);
      }}
    />
  );
}
