import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import DOMPurify from "dompurify";
import { useI18n } from "@/lib/i18n";

// This module is lazy-loaded only for an explicitly requested flowchart response.
mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  suppressErrorRendering: true,
  theme: "neutral",
  htmlLabels: false,
  flowchart: { useMaxWidth: true },
});

export default function MermaidFlowchart({ source, title }: { source: string; title: string }) {
  const { lang } = useI18n();
  const hostRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    setSvg("");
    setFailed(false);
    if (!host) return;
    const render = async () => {
      try {
        const { svg: result } = await mermaid.render(`flowchart-${crypto.randomUUID()}`, source, host);
        const clean = DOMPurify.sanitize(result, {
          USE_PROFILES: { svg: true, svgFilters: true },
          FORBID_TAGS: ["foreignObject", "script", "a", "image"],
          FORBID_ATTR: ["href", "xlink:href"],
        });
        const document = new DOMParser().parseFromString(clean, "image/svg+xml");
        const root = document.documentElement;
        if (root.localName !== "svg" || document.querySelector("parsererror")) {
          throw new Error("No visual diagram was produced.");
        }
        // An SVG image cannot inherit dimensions from the chat DOM. Supply
        // explicit dimensions so the browser decodes it at its diagram size.
        const bounds = root.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
        if (!bounds || bounds.length !== 4 || !bounds.every(Number.isFinite) || bounds[2] <= 0 || bounds[3] <= 0) {
          throw new Error("The diagram has invalid image dimensions.");
        }
        root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        root.setAttribute("width", String(Math.ceil(bounds[2])));
        root.setAttribute("height", String(Math.ceil(bounds[3])));
        if (!cancelled) setSvg(new XMLSerializer().serializeToString(root));
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        host.replaceChildren();
      }
    };
    void render();
    return () => { cancelled = true; };
  }, [source, attempt]);

  useEffect(() => {
    if (!svg) {
      setImageUrl("");
      return;
    }
    // Keep image bytes ephemeral: saved messages retain Mermaid source and
    // regenerate this SVG image on reload, without changing stored chat data.
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [svg]);

  return (
    <figure className="mt-4 rounded-2xl border border-border bg-white p-4 text-slate-900" data-testid="chat-flowchart">
      <figcaption className="mb-3 text-sm font-semibold" dir="auto">{title}</figcaption>
      {/* A real attached measuring host lets Mermaid lay out SVG text without flashing source/errors. */}
      <div ref={hostRef} aria-hidden="true" style={{ position: "fixed", left: -10000, top: 0, opacity: 0, pointerEvents: "none" }} />
      {imageUrl && !failed ? (
        <img
          src={imageUrl}
          alt={title}
          dir="ltr"
          className="mx-auto block h-auto max-w-full"
          onError={() => setFailed(true)}
          data-testid="chat-flowchart-visual"
        />
      ) : failed ? (
        <div role="alert" className="text-sm">
          <p>{lang === "ar" ? "تعذّر عرض المخطط. إجابة المحادثة محفوظة." : "The flowchart could not be displayed. Your chat answer is saved."}</p>
          <button type="button" className="mt-2 underline" onClick={() => setAttempt((value) => value + 1)}>
            {lang === "ar" ? "إعادة محاولة العرض" : "Retry diagram"}
          </button>
        </div>
      ) : (
        <p role="status" className="text-sm">{lang === "ar" ? "جارٍ رسم المخطط…" : "Drawing flowchart…"}</p>
      )}
    </figure>
  );
}
