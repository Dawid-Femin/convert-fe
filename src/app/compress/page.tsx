"use client";

import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import JSZip from "jszip";
import { Upload, Download, Loader2, X, Trash2 } from "lucide-react";
import { compressImage, getImageMetadata } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";

type Status = "ready" | "compressing" | "done" | "error";

interface FileEntry {
  id: string;
  file: File;
  preview: string;
  format: string;
  quality: number;
  palette: boolean;
  status: Status;
  result?: Blob;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const QUALITY_FORMATS = ["jpeg", "webp", "avif"];
const COMPRESSIBLE_FORMATS = ["jpeg", "png", "webp", "avif", "tiff"];

const MIME_TO_FORMAT: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/tiff": "tiff",
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CompressPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const updateFile = useCallback((id: string, patch: Partial<FileEntry>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const entries: FileEntry[] = [];
    for (const file of Array.from(incoming)) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds 20MB limit`);
        continue;
      }
      const format = MIME_TO_FORMAT[file.type] ?? "";
      if (!format || !COMPRESSIBLE_FORMATS.includes(format)) {
        toast.error(`${file.name}: format not supported for compression`);
        continue;
      }
      entries.push({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        format,
        quality: format === "avif" ? 50 : 75,
        palette: false,
        status: "ready",
      });
    }
    setFiles((prev) => [...prev, ...entries]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const entry = prev.find((f) => f.id === id);
      if (entry) URL.revokeObjectURL(entry.preview);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
  }, [files]);

  const compressAllMutation = useMutation({
    mutationFn: async () => {
      const toCompress = files.filter((f) => f.status !== "done");
      if (!toCompress.length) {
        toast.error("No files to compress");
        return;
      }

      for (const entry of toCompress) {
        updateFile(entry.id, { status: "compressing" });
      }

      await Promise.allSettled(
        toCompress.map(async (entry) => {
          try {
            const quality = QUALITY_FORMATS.includes(entry.format)
              ? entry.quality
              : undefined;
            const palette = entry.format === "png" ? entry.palette : undefined;
            const blob = await compressImage(entry.file, quality, palette);
            updateFile(entry.id, { status: "done", result: blob });
          } catch {
            updateFile(entry.id, { status: "error" });
          }
        }),
      );
    },
    onSuccess: () => toast.success("Compression complete"),
  });

  const downloadFile = (entry: FileEntry) => {
    if (!entry.result) return;
    const url = URL.createObjectURL(entry.result);
    const a = document.createElement("a");
    a.href = url;
    a.download = entry.file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAll = async () => {
    const done = files.filter((f) => f.status === "done" && f.result);
    if (!done.length) return;
    const zip = new JSZip();
    done.forEach((entry) => zip.file(entry.file.name, entry.result!));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "compressed-images.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const readyCount = files.filter((f) => f.status !== "done").length;
  const doneCount = files.filter((f) => f.status === "done").length;
  const isCompressing = compressAllMutation.isPending;

  const totalOriginal = files.filter((f) => f.status === "done" && f.result).reduce((s, f) => s + f.file.size, 0);
  const totalCompressed = files.filter((f) => f.status === "done" && f.result).reduce((s, f) => s + f.result!.size, 0);

  return (
    <main className="flex-1 flex flex-col items-center p-4 gap-6 max-w-4xl mx-auto w-full">
      <section className="w-full rounded-lg border bg-gradient-to-br from-muted/50 to-muted px-6 py-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Compress your images</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Reduce file size while keeping the same format — supports JPEG, PNG, WebP, AVIF and TIFF.
        </p>
      </section>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Image Compressor</CardTitle>
          <CardDescription>
            Upload images and adjust quality to reduce file size
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            role="button"
            tabIndex={0}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById("compress-input")?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ")
                document.getElementById("compress-input")?.click();
            }}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Upload className="h-8 w-8" />
              <p>Drop images here or click to browse</p>
              <p className="text-xs">JPEG, PNG, WebP, AVIF, TIFF</p>
            </div>
            <input
              id="compress-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/tiff"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {files.length > 0 && (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  onClick={() => compressAllMutation.mutate()}
                  disabled={isCompressing || readyCount === 0}
                >
                  {isCompressing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {isCompressing ? "Compressing..." : `Compress (${readyCount})`}
                </Button>

                <div className="flex-1" />

                {doneCount > 0 && (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {formatSize(totalOriginal)} → {formatSize(totalCompressed)}{" "}
                      <span className={totalCompressed < totalOriginal ? "text-green-600" : "text-red-600"}>
                        ({totalCompressed < totalOriginal ? "-" : "+"}
                        {Math.abs(Math.round(((totalCompressed - totalOriginal) / totalOriginal) * 100))}%)
                      </span>
                    </span>
                    <Button variant="outline" onClick={downloadAll}>
                      <Download className="h-4 w-4 mr-2" />
                      Download All ({doneCount})
                    </Button>
                  </>
                )}

                <Button variant="ghost" onClick={clearAll} disabled={isCompressing}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>

              <div className="space-y-2">
                {files.map((entry) => (
                  <div key={entry.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <img
                        src={entry.preview}
                        alt={entry.file.name}
                        className="h-10 w-10 rounded object-cover shrink-0"
                      />

                      <div className="min-w-0 flex-1">
                        <span className="text-sm truncate block">{entry.file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {entry.format.toUpperCase()}
                        </span>
                      </div>

                      <span className="text-xs text-muted-foreground text-right shrink-0 whitespace-nowrap">
                        {formatSize(entry.file.size)}
                        {entry.status === "done" && entry.result && (
                          <>
                            {" → "}
                            {formatSize(entry.result.size)}{" "}
                            <span
                              className={
                                entry.result.size < entry.file.size
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              ({entry.result.size < entry.file.size ? "-" : "+"}
                              {Math.abs(
                                Math.round(
                                  ((entry.result.size - entry.file.size) / entry.file.size) * 100,
                                ),
                              )}
                              %)
                            </span>
                          </>
                        )}
                      </span>

                      <span className="w-20 text-xs text-center shrink-0">
                        {entry.status === "ready" && <span className="text-muted-foreground">Ready</span>}
                        {entry.status === "compressing" && <Loader2 className="h-4 w-4 animate-spin mx-auto" />}
                        {entry.status === "done" && <span className="text-green-600">Done</span>}
                        {entry.status === "error" && <span className="text-red-600">Error</span>}
                      </span>

                      {entry.status === "done" ? (
                        <Button size="icon" variant="ghost" onClick={() => downloadFile(entry)} aria-label="Download">
                          <Download className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeFile(entry.id)}
                          disabled={entry.status === "compressing"}
                          aria-label="Remove"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {entry.status !== "done" && QUALITY_FORMATS.includes(entry.format) && (
                      <div className="flex items-center gap-3 pl-13">
                        <span className="text-xs text-muted-foreground w-20 shrink-0">
                          Quality: {entry.quality}
                        </span>
                        <Slider
                          min={1}
                          max={100}
                          step={1}
                          value={[entry.quality]}
                          onValueChange={(v) =>
                            updateFile(entry.id, { quality: Array.isArray(v) ? v[0] : v })
                          }
                          className="flex-1"
                        />
                      </div>
                    )}

                    {entry.status !== "done" && entry.format === "png" && (
                      <label className="flex items-center gap-2 pl-13 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={entry.palette}
                          onChange={(e) => updateFile(entry.id, { palette: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-xs text-muted-foreground">
                          Reduce to 256 colors (smaller file, may affect gradients)
                        </span>
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
