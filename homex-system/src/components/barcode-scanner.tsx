"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { ScanLine, X, Camera, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// In-app barcode scanner. Opens the device camera INSIDE the app (never the
// phone's own camera app), reads the project QR (encoded as "quote:<id>") and
// opens that project's page with all its sections; it still understands the
// older per-item QR ("item:<id>") for backward compatibility. Any signed-in
// user can scan to VIEW; only the foreman/owner can edit once there. Closing
// fully releases the camera stream.
export function BarcodeScanner({ className }: { className?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className={className || "inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-teal-600 text-white text-sm font-bold hover:bg-teal-700"}>
        <ScanLine className="w-4 h-4" /> {t("scanTitle")}
      </button>
      {open && <ScannerModal onClose={() => setOpen(false)} onHit={(path) => { setOpen(false); router.push(path); }} />}
    </>
  );
}

function ScannerModal({ onClose, onHit }: { onClose: () => void; onHit: (path: string) => void }) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) { stream.getTracks().forEach((tr) => tr.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
          tick();
        }
      } catch {
        if (!cancelled) setError(t("scanNoCamera"));
      }
    }

    function tick() {
      const v = videoRef.current, c = canvasRef.current;
      if (v && c && v.readyState === v.HAVE_ENOUGH_DATA) {
        const w = v.videoWidth, h = v.videoHeight;
        c.width = w; c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (ctx && w && h) {
          ctx.drawImage(v, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
          if (code && code.data) {
            const data = code.data.trim();
            const mq = data.match(/^quote:([A-Za-z0-9_-]+)$/);
            if (mq) { onHit(`/project/${mq[1]}`); return; }
            const mi = data.match(/^item:([A-Za-z0-9_-]+)$/);
            if (mi) { onHit(`/item/${mi[1]}`); return; }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, [onHit, t]);

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <span className="font-bold flex items-center gap-2"><Camera className="w-4 h-4 text-teal-600" /> {t("scanTitle")}</span>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="relative bg-black aspect-square">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-white gap-2">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
              <p className="text-sm font-bold">{error}</p>
            </div>
          ) : (
            <>
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-0 pointer-events-none grid place-items-center">
                <div className="w-48 h-48 border-2 border-teal-400 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
            </>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>
        <p className="text-xs text-gray-500 text-center p-3">{t("scanHint")}</p>
      </div>
    </div>
  );
}
