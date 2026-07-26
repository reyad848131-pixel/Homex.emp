"use client";

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

// A finger/stylus/mouse signature pad. Draws on a <canvas> and reports the
// signature as a base64 PNG via onChange (null when cleared). Uses Pointer
// Events so it works uniformly for touch (iPad), pen, and mouse; touch-action
// is disabled so drawing doesn't scroll the page.
export function SignaturePad({
  onChange,
  clearLabel = "مسح",
  className,
}: {
  onChange: (dataUrl: string | null) => void;
  clearLabel?: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111827";
    }
  }, []);

  const pointFrom = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    drawing.current = true;
    last.current = pointFrom(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pointFrom(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    hasDrawn.current = true;
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    if (hasDrawn.current) onChange(canvasRef.current!.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn.current = false;
    onChange(null);
  };

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        className="w-full h-40 bg-white border-2 border-dashed border-gray-300 rounded-lg cursor-crosshair touch-none select-none"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="flex justify-end mt-1.5">
        <button
          type="button"
          onClick={clear}
          className="text-xs text-gray-500 hover:text-gray-800 font-semibold px-3 py-1 rounded border border-gray-200 hover:bg-gray-50"
        >
          {clearLabel}
        </button>
      </div>
    </div>
  );
}
