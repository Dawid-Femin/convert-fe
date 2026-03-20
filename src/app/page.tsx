"use client";

import { useCallback, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import JSZip from "jszip";
import { Upload, Download, Loader2, X, Trash2 } from "lucide-react";
import { getFormats, convertImage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Status = "ready" | "converting" | "done" | "error";

interface FileEntry {
  id: string;
  file: File;
  preview: string;
  targetFormat: string;
  status: Status;
  result?: Blob;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function baseName(filename: string) {
  return filename.replace(/\.[^.]+$/, "");
}

export default function Home() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [globalFormat, setGlobalFormat] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);

  const { data: formats } = useQuery({
    queryKey: ["formats"],
    queryFn: getFormats,
  });

  const updateFile = useCallback((id: string, patch: Partial<FileEntry>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const entries: FileEntry[] = [];
      for (const file of Array.from(incoming)) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name} exceeds 20MB limit`);
          continue;
        }
        entries.push({
          id: crypto.randomUUID(),
          file,
          preview: URL.createObjectURL(file),
          targetFormat: globalFormat,
          status: "ready",
        });
      }
      setFiles((prev) => [...prev, ...entries]);
    },
    [globalFormat],
  );

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
    setGlobalFormat("");
  }, [files]);

  const convertAllMutation = useMutation({
    mutationFn: async () => {
      const toConvert = files.filter(
        (f) => f.status !== "done" && f.targetFormat,
      );
      if (!toConvert.length) {
        toast.error("No files ready to convert");
        return;
      }

      for (const entry of toConvert) {
        updateFile(entry.id, { status: "converting" });
      }

      await Promise.allSettled(
        toConvert.map(async (entry) => {
          try {
            const blob = await convertImage(entry.file, entry.targetFormat);
            updateFile(entry.id, { status: "done", result: blob });
          } catch {
            updateFile(entry.id, { status: "error" });
          }
        }),
      );
    },
    onSuccess: () => toast.success("Conversion complete"),
  });

  const downloadFile = (entry: FileEntry) => {
    if (!entry.result) return;
    const url = URL.createObjectURL(entry.result);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName(entry.file.name)}.${entry.targetFormat}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAll = async () => {
    const done = files.filter((f) => f.status === "done" && f.result);
    if (!done.length) return;

    const zip = new JSZip();
    done.forEach((entry) => {
      zip.file(`${baseName(entry.file.name)}.${entry.targetFormat}`, entry.result!);
    });
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "converted-images.zip";
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

  const readyCount = files.filter((f) => f.targetFormat && f.status !== "done").length;
  const doneCount = files.filter((f) => f.status === "done").length;
  const isConverting = convertAllMutation.isPending;

  return (
    <main className="flex-1 flex flex-col items-center p-4 gap-6 max-w-4xl mx-auto w-full">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Image Converter</CardTitle>
          <CardDescription>
            Upload images and convert them to different formats
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById("file-input")?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ")
                document.getElementById("file-input")?.click();
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
            </div>
            <input
              id="file-input"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <>
              {/* Toolbar */}
              <div className="flex items-center gap-3 flex-wrap">
                <Select
                  value={globalFormat || null}
                  onValueChange={(v) => {
                    const fmt = v ?? "";
                    setGlobalFormat(fmt);
                    if (fmt) {
                      setFiles((prev) =>
                        prev.map((f) =>
                          f.status === "ready" ? { ...f, targetFormat: fmt } : f,
                        ),
                      );
                    }
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Convert all to" />
                  </SelectTrigger>
                  <SelectContent>
                    {formats?.output.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  onClick={() => convertAllMutation.mutate()}
                  disabled={isConverting || readyCount === 0}
                >
                  {isConverting && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  {isConverting ? "Converting..." : `Convert (${readyCount})`}
                </Button>

                <div className="flex-1" />

                {doneCount > 0 && (
                  <Button variant="outline" onClick={downloadAll}>
                    <Download className="h-4 w-4 mr-2" />
                    Download All ({doneCount})
                  </Button>
                )}

                <Button variant="ghost" onClick={clearAll} disabled={isConverting}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>

              {/* List */}
              <div className="space-y-2">
                {files.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <img
                      src={entry.preview}
                      alt={entry.file.name}
                      className="h-10 w-10 rounded object-cover shrink-0"
                    />

                    <span className="text-sm truncate min-w-0 flex-1">
                      {entry.file.name}
                    </span>

                    <Select
                      value={entry.targetFormat || null}
                      onValueChange={(v) =>
                        updateFile(entry.id, {
                          targetFormat: v ?? "",
                        })
                      }
                      disabled={entry.status === "converting" || entry.status === "done"}
                    >
                      <SelectTrigger className="w-28 shrink-0">
                        <SelectValue placeholder="Format" />
                      </SelectTrigger>
                      <SelectContent>
                        {formats?.output.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
                      {formatSize(entry.file.size)}
                    </span>

                    <span className="w-20 text-xs text-center shrink-0">
                      {entry.status === "ready" && (
                        <span className="text-muted-foreground">Ready</span>
                      )}
                      {entry.status === "converting" && (
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      )}
                      {entry.status === "done" && (
                        <span className="text-green-600">Done</span>
                      )}
                      {entry.status === "error" && (
                        <span className="text-red-600">Error</span>
                      )}
                    </span>

                    {entry.status === "done" ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => downloadFile(entry)}
                        aria-label="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeFile(entry.id)}
                        disabled={entry.status === "converting"}
                        aria-label="Remove"
                      >
                        <X className="h-4 w-4" />
                      </Button>
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
