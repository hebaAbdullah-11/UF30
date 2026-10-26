import { useEffect, useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";

export function ChatImage({ objectPath }: { objectPath: string }) {
  const { lang } = useI18n();
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    setUrl(""); setFailed(false);
    void customFetch<Blob>(`/api/chat-media/image?objectPath=${encodeURIComponent(objectPath)}`, {
      responseType: "blob", signal: controller.signal,
    }).then((blob) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [objectPath]);
  if (failed) return <p className="mt-2 text-sm" role="status">{lang === "ar" ? "تعذّر تحميل الصورة المرفقة." : "The attached image could not be loaded."}</p>;
  return url
    ? <img src={url} alt={lang === "ar" ? "الصورة المرفقة بالرسالة" : "Image attached to this message"} className="mt-2 max-h-80 max-w-full rounded-2xl object-contain" onError={() => setFailed(true)} data-testid="chat-user-image" />
    : <p className="mt-2 text-sm" role="status">{lang === "ar" ? "جارٍ تحميل الصورة…" : "Loading image…"}</p>;
}
