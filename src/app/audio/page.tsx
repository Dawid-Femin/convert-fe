"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Download, Loader2, X, Trash2, Music } from "lucide-react";
import {
  getAudioFormats,
  submitAudioConversion,
  getAudioJobStatus,
  downloadAudioJob,
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
  bitrate: number;
  status: Status;
  jobId?: string;
  progress: number;
  result?: Blob;
  error?: string;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const BITRATE_FORMATS = ["mp3", "aac", "ogg", "opus"];
const POLL_INTERVAL = 1500;

const AUDIO_MIME_TO_FORMAT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/flac": "flac",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/x-ms-wma": "wma",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/opus": "opus",
  "audio/aiff": "aiff",
  "audio/x-aiff": "aiff",
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function baseName(filename: string) {
  return filename.replace(/\.[^.]+$/, "");
}

export default function AudioPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [globalFormat, setGlobalFormat] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const { data: formats } = useQuery({
    queryKey: ["audioFormats"],
    queryFn: getAudioFormats,
  });

  const updateFile = useCallback((id: string, patch: Partial<FileEntry>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

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
          const status = await getAudioJobStatus(entry.jobId);
          if (status.status === "completed") {
            const blob = await downloadAudioJob(entry.jobId);
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
          toast.error(`${file.name} exceeds 100MB limit`);
          continue;
        }
        const sourceFormat = AUDIO_MIME_TO_FORMAT[file.type] ?? "";
        if (!sourceFormat) {
          toast.error(`${file.name}: unsupported audio format`);
          continue;
        }
        entries.push({
          id: crypto.randomUUID(),
          file,
          sourceFormat,
          targetFormat: globalFormat === sourceFormat ? "" : globalFormat,
          bitrate: 192,
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
        const bitrate = BITRATE_FORMATS.includes(entry.targetFormat)
          ? entry.bitrate
          : undefined;
        const { jobId } = await submitAudioConversion(
          entry.file,
          entry.targetFormat,
          bitrate,
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
      <section className="w-full rounded-lg border bg-gradient-to-br from-muted/50 to-muted px-6 py-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Convert your audio files</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Drop files below to convert between MP3, WAV, FLAC, AAC, OGG and more — up to 100MB per file.
        </p>
      </section>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Audio Converter</CardTitle>
          <CardDescription>
            Upload audio files and convert them to different formats
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            role="button"
            tabIndex={0}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById("audio-input")?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ")
                document.getElementById("audio-input")?.click();
            }}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Upload className="h-8 w-8" />
              <p>Drop audio files here or click to browse</p>
              <p className="text-xs">MP3, WAV, FLAC, AAC, OGG, WMA, M4A, OPUS, AIFF</p>
            </div>
            <input
              id="audio-input"
              type="file"
              accept="audio/*"
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

              <div className="space-y-2">
                {files.map((entry) => {
                  const showBitrate =
                    BITRATE_FORMATS.includes(entry.targetFormat) &&
                    entry.status === "ready";

                  return (
                    <div key={entry.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center gap-3">
                        <Music className="h-10 w-10 text-muted-foreground shrink-0" />

                        <div className="min-w-0 flex-1">
                          <span className="text-sm truncate block">
                            {entry.file.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {entry.sourceFormat.toUpperCase()}
                          </span>
                        </div>

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

                        <span className="text-xs text-muted-foreground text-right shrink-0 whitespace-nowrap">
                          {formatSize(entry.file.size)}
                          {entry.status === "completed" && entry.result && (
                            <>
                              {" → "}
                              {formatSize(entry.result.size)}
                              {" "}
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
                                    ((entry.result.size - entry.file.size) /
                                      entry.file.size) *
                                      100,
                                  ),
                                )}
                                %)
                              </span>
                            </>
                          )}
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

                      {(entry.status === "pending" || entry.status === "active") && (
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className="bg-primary h-1.5 rounded-full transition-all"
                            style={{ width: `${entry.progress}%` }}
                          />
                        </div>
                      )}

                      {showBitrate && (
                        <div className="flex items-center gap-3 pl-13">
                          <span className="text-xs text-muted-foreground w-24 shrink-0">
                            Bitrate: {entry.bitrate} kbps
                          </span>
                          <Slider
                            min={32}
                            max={320}
                            step={32}
                            value={[entry.bitrate]}
                            onValueChange={(v) =>
                              updateFile(entry.id, { bitrate: Array.isArray(v) ? v[0] : v })
                            }
                            className="flex-1"
                          />
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
