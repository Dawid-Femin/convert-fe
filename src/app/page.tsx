"use client";

import { useCallback, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Download, Loader2 } from "lucide-react";
import { getFormats, convertImage, getImageMetadata } from "@/lib/api";
import type { ImageMetadata } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

const QUALITY_FORMATS = ["jpeg", "webp", "avif"];
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [targetFormat, setTargetFormat] = useState<string>("");
  const [quality, setQuality] = useState(80);
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const { data: formats } = useQuery({
    queryKey: ["formats"],
    queryFn: getFormats,
  });

  const metadataMutation = useMutation({
    mutationFn: getImageMetadata,
    onSuccess: setMetadata,
    onError: () => toast.error("Failed to read image metadata"),
  });

  const convertMutation = useMutation({
    mutationFn: () => convertImage(file!, targetFormat, supportsQuality ? quality : undefined),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `converted.${targetFormat}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Image converted and downloaded!");
    },
    onError: () => toast.error("Failed to convert image"),
  });

  const handleFile = useCallback((f: File) => {
    if (f.size > MAX_FILE_SIZE) {
      toast.error("File size exceeds 20MB limit");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setMetadata(null);
    setTargetFormat("");
    metadataMutation.mutate(f);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const supportsQuality = QUALITY_FORMATS.includes(targetFormat);

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Image Converter</CardTitle>
          <CardDescription>
            Upload an image and convert it to a different format
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
            {preview ? (
              <img
                src={preview}
                alt="Preview"
                className="mx-auto max-h-48 rounded object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="h-8 w-8" />
                <p>Drop an image here or click to browse</p>
              </div>
            )}
            <input
              id="file-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>

          {/* Metadata */}
          {metadata && (
            <div className="text-sm text-muted-foreground grid grid-cols-2 gap-1">
              <span>Format: {metadata.format}</span>
              <span>Size: {(metadata.size / 1024).toFixed(1)} KB</span>
              <span>
                Dimensions: {metadata.width}×{metadata.height}
              </span>
              <span>Channels: {metadata.channels}</span>
            </div>
          )}

          {/* Target format */}
          {file && (
            <div className="space-y-2">
              <Label htmlFor="format">Target format</Label>
              <Select value={targetFormat} onValueChange={(v) => setTargetFormat(v ?? "")}>
                <SelectTrigger id="format">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {formats?.output.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Quality slider */}
          {supportsQuality && (
            <div className="space-y-2">
              <Label>Quality: {quality}</Label>
              <Slider
                min={1}
                max={100}
                step={1}
                value={[quality]}
                onValueChange={(v) => setQuality(Array.isArray(v) ? v[0] : v)}
              />
            </div>
          )}

          {/* Convert button */}
          {file && targetFormat && (
            <Button
              className="w-full"
              onClick={() => convertMutation.mutate()}
              disabled={convertMutation.isPending}
            >
              {convertMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {convertMutation.isPending ? "Converting..." : "Convert & Download"}
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
