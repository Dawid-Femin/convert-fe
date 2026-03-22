"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Download, Loader2, X, Trash2, Video } from "lucide-react";
import {
  getVideoFormats,
  submitVideoConversion,
  getVideoJobStatus,
  downloadVideoJob,
} from "@/lib/api";
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
import { Slider } from "@/components/ui/slider";

type Status = "ready" | "uploading" | "pending" | "active" | "completed" | "failed";

interface FileEntry {
  id: string;
  file: File;
  sourceFormat: string;
  targetFormat: string;
  quality: number;
  resolution: string;
  status: Status;
  jobId?: string;
  progress: number;
  result?: Blob;
  error?: string;
}

const MAX_FILE_SIZE = 500 * 1024 * 1024;
const QUALITY_FORMATS = ["mp4", "webm"];
const POLL_INTERVAL = 1500;

const RESOLUTIONS = [
  { label: "Original", value: "" },
  { label: "1920×1080", value: "1920x1080" },
  { label: "1280×720", value: "1280x720" },
  { label: "854×480", value: "854x480" },
  { label: "640×360", value: "640x360" },
];

const VIDEO_MIME_TO_FORMAT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/x-msvideo": "avi",
  "video/quicktime": "mov",
  "video/x-matroska": "mkv",
  "video/webm": "webm",
  "video/x-flv": "flv",
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function baseName(filename: string) {
  return filename.replace(/\.[^.]+$/, "");
}

export default function VideoPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [globalFormat, setGlobalFormat] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const { data: formats } = useQuery({
    queryKey: ["videoFormats"],
    queryFn: getVideoFormats,
  });

  const updateFile = useCallback((id: string, patch: Partial<FileEntry>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  // Poll active jobs
  useEffect(() => {
    const activeJobs = files.filter(
      (f) => f.jobId && (f.status === "pending" || f.status === "active"),
    );

    if (!activeJobs.length) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(async () => {
      for (const entry of activeJobs) {
        if (!entry.jobId) continue;
        try {
          const status = await getVideoJobStatus(entry.jobId);
          if (status.status === "completed") {
            const blob = await downloadVideoJob(entry.jobId);
            updateFile(entry.id, { status: "completed", progress: 100, result: blob });
          } else if (status.status === "failed") {
            updateFile(entry.id, { status: "failed", error: status.error });
          } else {
            updateFile(entry.id, {
              status: status.status === "active" ? "active" : "pending",
              progress: status.progress,
            });
          }
        } catch {
          // keep polling
        }
      }
    }, POLL_INTERVAL);

    return () => clearInterval(pollRef.current);
  }, [files, updateFile]);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const entries: FileEntry[] = [];
      for (const file of Array.from(incoming)) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name} exceeds 500MB limit`);
          continue;
        }
        const sourceFormat = VIDEO_MIME_TO_FORMAT[file.type] ?? "";
        if (!sourceFormat) {
          toast.error(`${file.name}: unsupported video format`);
          continue;
        }
        entries.push({
          id: crypto.randomUUID(),
          file,
          sourceFormat,
          targetFormat: globalFormat === sourceFormat ? "" : globalFormat,
          quality: 23,
          resolution: "",
          status: "ready",
          progress: 0,
        });
      }
      setFiles((prev) => [...prev, ...entries]);
    },
    [globalFormat],
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
    setGlobalFormat("");
  }, []);

  const convertAll = useCallback(async () => {
    const toConvert = files.filter((f) => f.status === "ready" && f.targetFormat);
    if (!toConvert.length) {
      toast.error("No files ready to convert");
      return;
    }

    for (const entry of toConvert) {
      updateFile(entry.id, { status: "uploading" });
      try {
        const quality = QUALITY_FORMATS.includes(entry.targetFormat)
          ? entry.quality
          : undefined;
        const resolution = entry.resolution || undefined;
        const { jobId } = await submitVideoConversion(
          entry.file,
          entry.targetFormat,
          quality,
          resolution,
        );
        updateFile(entry.id, { status: "pending", jobId });
      } catch {
        updateFile(entry.id, { status: "failed", error: "Upload failed" });
      }
    }
  }, [files, updateFile]);

  const downloadFile = (entry: FileEntry) => {
    if (!entry.result) return;
    const url = URL.createObjectURL(entry.result);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName(entry.file.name)}.${entry.targetFormat}`;
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

  const readyCount = files.filter((f) => f.targetFormat && f.status === "ready").length;
  const doneCount = files.filter((f) => f.status === "completed").length;
  const isProcessing = files.some(
    (f) => f.status === "uploading" || f.status === "pending" || f.status === "active",
  );

  return (
    <main className="flex-1 flex flex-col items-center p-4 gap-6 max-w-4xl mx-auto w-full">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Video Converter</CardTitle>
          <CardDescription>
            Upload videos and convert them to different formats (max 500MB)
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
            onClick={() => document.getElementById("video-input")?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ")
                document.getElementById("video-input")?.click();
            }}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Upload className="h-8 w-8" />
              <p>Drop videos here or click to browse</p>
              <p className="text-xs">MP4, AVI, MOV, MKV, WebM, FLV</p>
            </div>
            <input
              id="video-input"
              type="file"
              accept="video/*"
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
                          f.status === "ready" && f.sourceFormat !== fmt
                            ? { ...f, targetFormat: fmt }
                            : f.status === "ready" && f.sourceFormat === fmt
                              ? { ...f, targetFormat: "" }
                              : f,
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
                  onClick={convertAll}
                  disabled={isProcessing || readyCount === 0}
                >
                  {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {isProcessing ? "Processing..." : `Convert (${readyCount})`}
                </Button>

                <div className="flex-1" />

                <Button variant="ghost" onClick={clearAll} disabled={isProcessing}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>

              {/* File list */}
              <div className="space-y-2">
                {files.map((entry) => {
                  const showQuality =
                    QUALITY_FORMATS.includes(entry.targetFormat) &&
                    entry.status === "ready";

                  return (
                    <div key={entry.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center gap-3">
                        <Video className="h-10 w-10 text-muted-foreground shrink-0" />

                        <span className="text-sm truncate min-w-0 flex-1">
                          {entry.file.name}
                        </span>

                        <Select
                          value={entry.targetFormat || null}
                          onValueChange={(v) =>
                            updateFile(entry.id, { targetFormat: v ?? "" })
                          }
                          disabled={entry.status !== "ready"}
                        >
                          <SelectTrigger className="w-28 shrink-0">
                            <SelectValue placeholder="Format" />
                          </SelectTrigger>
                          <SelectContent>
                            {formats?.output
                              .filter((f) => f !== entry.sourceFormat)
                              .map((f) => (
                                <SelectItem key={f} value={f}>
                                  {f.toUpperCase()}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>

                        <span className="text-xs text-muted-foreground w-20 text-right shrink-0">
                          {formatSize(entry.file.size)}
                        </span>

                        <span className="w-24 text-xs text-center shrink-0">
                          {entry.status === "ready" && (
                            <span className="text-muted-foreground">Ready</span>
                          )}
                          {entry.status === "uploading" && (
                            <span className="text-muted-foreground">Uploading…</span>
                          )}
                          {(entry.status === "pending" || entry.status === "active") && (
                            <span className="flex items-center justify-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              {entry.progress}%
                            </span>
                          )}
                          {entry.status === "completed" && (
                            <span className="text-green-600">Done</span>
                          )}
                          {entry.status === "failed" && (
                            <span className="text-red-600" title={entry.error}>Error</span>
                          )}
                        </span>

                        {entry.status === "completed" ? (
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
                            disabled={entry.status !== "ready"}
                            aria-label="Remove"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      {/* Progress bar for active conversions */}
                      {(entry.status === "pending" || entry.status === "active") && (
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className="bg-primary h-1.5 rounded-full transition-all"
                            style={{ width: `${entry.progress}%` }}
                          />
                        </div>
                      )}

                      {/* Quality + Resolution controls */}
                      {entry.status === "ready" && entry.targetFormat && (
                        <div className="flex items-center gap-4 pl-13 flex-wrap">
                          {showQuality && (
                            <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                              <span className="text-xs text-muted-foreground w-20 shrink-0">
                                Quality (CRF): {entry.quality}
                              </span>
                              <Slider
                                min={0}
                                max={51}
                                step={1}
                                value={[entry.quality]}
                                onValueChange={(v) =>
                                  updateFile(entry.id, { quality: Array.isArray(v) ? v[0] : v })
                                }
                                className="flex-1"
                              />
                            </div>
                          )}
                          <Select
                            value={entry.resolution || null}
                            onValueChange={(v) => updateFile(entry.id, { resolution: v })}
                          >
                            <SelectTrigger className="w-36 shrink-0">
                              <SelectValue placeholder="Resolution" />
                            </SelectTrigger>
                            <SelectContent>
                              {RESOLUTIONS.map((r) => (
                                <SelectItem key={r.value} value={r.value || "original"}>
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
