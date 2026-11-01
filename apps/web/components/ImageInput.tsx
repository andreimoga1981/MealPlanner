"use client";

/* eslint-disable @next/next/no-img-element -- previews are blob: or arbitrary remote URLs */

import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_IMAGE_BYTES } from "@meal-planner/shared";
import { ImageIcon, LinkIcon, XIcon } from "./icons";

type Mode = "upload" | "url";

type Props = {
  url: string | null;
  file: File | null;
  error?: string;
  onUrlChange: (url: string | null) => void;
  onFileChange: (file: File | null) => void;
};

export function ImageInput({ url, file, error, onUrlChange, onFileChange }: Props) {
  const [mode, setMode] = useState<Mode>("upload");
  const [urlDraft, setUrlDraft] = useState("");
  const [fileError, setFileError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);

  const filePreview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
  }, [filePreview]);

  const preview = filePreview ?? url;

  function pickFile(picked: File | undefined) {
    setFileError(undefined);
    if (!picked) return;
    if (!picked.type.startsWith("image/")) return setFileError("Choose an image file (JPG, PNG, WebP…).");
    if (picked.size > MAX_IMAGE_BYTES) return setFileError("Image must be 5 MB or smaller.");
    onFileChange(picked);
    onUrlChange(null);
  }

  function applyUrl(value: string) {
    setUrlDraft(value);
    onFileChange(null);
    onUrlChange(value.trim() || null);
  }

  function clear() {
    onFileChange(null);
    onUrlChange(null);
    setUrlDraft("");
    setFileError(undefined);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-line">
        {preview ? (
          <div className="relative">
            <img src={preview} alt="Recipe preview" className="aspect-[16/9] w-full object-cover" />
            <button type="button" onClick={clear} className="btn-secondary absolute top-3 right-3 shadow-md">
              <XIcon width={16} height={16} />
              Remove photo
            </button>
          </div>
        ) : (
          <div>
            <div className="flex gap-1 border-b border-line bg-background p-1.5 text-sm" role="tablist">
              {(["upload", "url"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 font-semibold transition ${
                    mode === m ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
                  }`}
                >
                  {m === "upload" ? <ImageIcon width={16} height={16} /> : <LinkIcon width={16} height={16} />}
                  {m === "upload" ? "Upload from computer" : "Use an image URL"}
                </button>
              ))}
            </div>
            <div className="p-5">
              {mode === "upload" ? (
                <label
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    pickFile(e.dataTransfer.files[0]);
                  }}
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-leaf bg-leaf-soft/40 px-4 py-12 text-center transition hover:border-accent hover:bg-leaf-soft"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-leaf text-accent">
                    <ImageIcon width={22} height={22} />
                  </span>
                  <span className="mt-3 text-sm font-semibold">Choose a photo or drag it here</span>
                  <span className="mt-1 text-xs text-muted">JPG, PNG, WebP, GIF or AVIF · up to 5 MB</span>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => pickFile(e.target.files?.[0])}
                  />
                </label>
              ) : (
                <input
                  type="url"
                  inputMode="url"
                  placeholder="https://example.com/photo.jpg"
                  value={urlDraft}
                  onChange={(e) => applyUrl(e.target.value)}
                  className="input"
                  aria-label="Image URL"
                />
              )}
            </div>
          </div>
        )}
      </div>
      {(fileError ?? error) && <p className="field-error">{fileError ?? error}</p>}
    </div>
  );
}
