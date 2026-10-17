"use client";

import { useEffect, useRef, useState } from "react";

// A plain <img> that transparently retries a few times when the source fails to
// load. Used for freshly uploaded Cloudinary photos: the CDN edge can briefly
// 404 for a second or two right after upload, before the new asset propagates —
// which otherwise leaves a broken image until the user manually refreshes.
export function RetryImg({ src, alt, className }: { src: string; alt?: string; className?: string }) {
  const [attempt, setAttempt] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAttempt(0);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [src]);

  // Cache-bust each retry so the browser actually re-requests the image.
  const url = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}r=${attempt}`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt || ""}
      className={className}
      onError={() => { if (attempt < 8) timer.current = setTimeout(() => setAttempt((a) => a + 1), 1200); }}
    />
  );
}
