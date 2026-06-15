"use client";

import { useCallback, useRef, useState } from "react";
import jsQR from "jsqr";
import {
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

/**
 * Lightweight client-side QR string extractor.
 *
 * Workflow:
 *  1. User drops / picks an image file.
 *  2. The image is loaded into an off-screen <canvas>.
 *  3. jsQR scans the pixel buffer and returns the embedded string.
 *  4. The image is never uploaded or stored — only the decoded string is
 *     surfaced via `onDecoded`.
 *
 * This intentionally runs entirely in the browser: no server round-trip,
 * no temp file, and the user's QR payload never leaves their machine.
 */
export function QrisImageUpload({
  onDecoded,
}: {
  onDecoded: (payload: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setPreview(null);
    setError(null);
    setSuccess(null);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const decodeFile = useCallback(
    async (file: File) => {
      setError(null);
      setSuccess(null);

      if (!file.type.startsWith("image/")) {
        setError("File harus berupa gambar (PNG / JPG / WebP).");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("Ukuran gambar maksimal 10 MB.");
        return;
      }

      setBusy(true);

      let objectUrl: string | null = null;
      try {
        objectUrl = URL.createObjectURL(file);
        setPreview(objectUrl);

        const img = await loadImage(objectUrl);

        // Scale down huge images — keeps decoding fast and reliable.
        const maxDim = 1280;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Browser tidak mendukung canvas 2D.");
        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);

        const result = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "attemptBoth",
        });

        if (!result || !result.data) {
          throw new Error(
            "QR code tidak terdeteksi. Pastikan gambar jelas dan tidak blur.",
          );
        }

        const payload = result.data.trim();
        if (payload.length < 20) {
          throw new Error(
            "String QR terlalu pendek — bukan QRIS yang valid.",
          );
        }

        setSuccess(
          `QR terdeteksi (${payload.length} karakter). String telah dimasukkan ke kolom di atas.`,
        );
        onDecoded(payload);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Gagal membaca gambar.";
        setError(msg);
        setPreview(null);
      } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        setBusy(false);
      }
    },
    [onDecoded],
  );

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void decodeFile(file);
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void decodeFile(file);
  }

  return (
    <div className="space-y-2">
      <label className="text-text-secondary text-sm font-medium">
        Upload Gambar QRIS
      </label>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "border-border bg-bg-surface/40 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
          dragOver && "border-primary bg-primary/5",
          busy && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onPick}
          className="hidden"
        />

        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Preview QRIS"
            className="border-border max-h-40 max-w-full rounded-md border object-contain"
          />
        ) : (
          <UploadCloud className="text-text-muted h-7 w-7" />
        )}

        <div className="space-y-0.5">
          <p className="text-text-primary text-sm font-medium">
            {busy
              ? "Membaca QR…"
              : preview
                ? "Gambar dipilih"
                : "Klik atau drop gambar QRIS"}
          </p>
          <p className="text-text-muted text-xs">
            PNG / JPG / WebP · maks 10 MB · gambar tidak diupload ke server
          </p>
        </div>
      </label>

      {busy && (
        <div className="text-text-muted flex items-center gap-2 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Mendecode QR dari gambar…
        </div>
      )}

      {success && !busy && (
        <div className="text-success flex items-start gap-2 text-xs">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{success}</span>
          <button
            type="button"
            onClick={reset}
            className="text-text-muted hover:text-text-primary"
            aria-label="Reset upload"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && !busy && (
        <div className="text-danger flex items-start gap-2 text-xs">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={reset}
            className="text-text-muted hover:text-text-primary"
            aria-label="Dismiss error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {preview && !busy && (success || error) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={reset}
          leftIcon={<ImageIcon className="h-3.5 w-3.5" />}
        >
          Pilih gambar lain
        </Button>
      )}
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal memuat gambar."));
    img.src = src;
  });
}
