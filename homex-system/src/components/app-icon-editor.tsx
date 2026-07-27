"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";

const PREVIEW = 256; // on-screen editor size
const OUTPUT = 512;  // exported icon size

// A small icon editor: pick an image, then zoom (slider) and drag to position
// it inside a square frame. The same draw routine renders the live preview and
// the exported 512×512 PNG, so what you see is exactly what's saved.
export function AppIconEditor({
  file, onSave, onCancel, saving,
}: {
  file: File;
  onSave: (f: File) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const offset = useRef({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);

  const drawTo = useCallback((ctx: CanvasRenderingContext2D, size: number) => {
    const img = imgRef.current;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    if (!img) return;
    const base = Math.min(size / img.width, size / img.height);
    const s = base * scale;
    const w = img.width * s;
    const h = img.height * s;
    const k = size / PREVIEW;
    const x = (size - w) / 2 + offset.current.x * k;
    const y = (size - h) / 2 + offset.current.y * k;
    ctx.drawImage(img, x, y, w, h);
  }, [scale]);

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (c) drawTo(c.getContext("2d")!, PREVIEW);
  }, [drawTo]);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { imgRef.current = img; offset.current = { x: 0, y: 0 }; draw(); };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, draw]);

  useEffect(() => { draw(); }, [scale, draw]);

  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
    canvasRef.current?.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    offset.current.x += e.clientX - drag.current.x;
    offset.current.y += e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    draw();
  };
  const onUp = () => { drag.current = null; };

  const save = () => {
    const out = document.createElement("canvas");
    out.width = OUTPUT;
    out.height = OUTPUT;
    drawTo(out.getContext("2d")!, OUTPUT);
    out.toBlob((blob) => {
      if (blob) onSave(new File([blob], "app-icon.png", { type: "image/png" }));
    }, "image/png");
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold mb-3">{t("adjustIcon")}</h3>
        <div className="flex justify-center mb-4">
          <canvas
            ref={canvasRef}
            width={PREVIEW}
            height={PREVIEW}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
            className="rounded-xl border border-gray-200 dark:border-gray-600 touch-none cursor-move"
            style={{ width: PREVIEW, height: PREVIEW }}
          />
        </div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">{t("zoom")}</label>
        <input type="range" min={0.3} max={3} step={0.01} value={scale}
          onChange={(e) => setScale(parseFloat(e.target.value))}
          className="w-full accent-gray-900 mb-4" />
        <p className="text-xs text-gray-400 mb-4">{t("dragToPosition")}</p>
        <div className="flex gap-2">
          <button onClick={save} disabled={saving}
            className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-gray-800 disabled:opacity-50">
            {saving ? "..." : t("saveBtn")}
          </button>
          <button onClick={onCancel}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50">
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
