import { AlertTriangle, Info } from "lucide-react";

const ALPHA_FORMATS = ["png", "webp", "avif", "gif", "tiff"];
const NO_ALPHA_FORMATS = ["jpeg", "bmp"];
const ANIMATED_FORMATS = ["gif"];
const STATIC_FORMATS = ["jpeg", "png", "webp", "avif", "tiff", "bmp", "svg"];
const LOSSY_FORMATS = ["jpeg", "webp", "avif"];
const LOSSLESS_FORMATS = ["png", "bmp", "tiff"];
const LEGACY_VIDEO_FORMATS = ["avi", "flv", "wmv", "3gp", "vob"];

export function getImageWarnings(source: string, target: string): string[] {
  const warnings: string[] = [];
  if (!source || !target) return warnings;

  if (ALPHA_FORMATS.includes(source) && NO_ALPHA_FORMATS.includes(target)) {
    warnings.push("Transparency will be lost — JPEG/BMP don't support alpha channel");
  }
  if (source === "svg" && target !== "svg") {
    warnings.push("Vector scalability will be lost when converting to a raster format");
  }
  if (source !== "svg" && target === "svg") {
    warnings.push("Raster to SVG conversion won't produce true vector graphics");
  }
  if (ANIMATED_FORMATS.includes(source) && STATIC_FORMATS.includes(target)) {
    warnings.push("Animation will be lost — only the first frame will be kept");
  }
  if (source === "tiff" && target !== "tiff") {
    warnings.push("TIFF metadata and 16-bit color depth may be lost during conversion");
  }
  return warnings;
}

export function getImageInfos(source: string, target: string): string[] {
  const infos: string[] = [];
  if (!source || !target) return infos;

  if (LOSSY_FORMATS.includes(source) && LOSSLESS_FORMATS.includes(target)) {
    infos.push("Converting from a lossy to a lossless format will increase file size without improving quality");
  }
  if (target === "bmp") {
    infos.push("BMP is uncompressed — the output file will be significantly larger");
  }
  return infos;
}

export function getVideoWarnings(source: string, target: string): string[] {
  const warnings: string[] = [];
  if (!source || !target) return warnings;

  if (LEGACY_VIDEO_FORMATS.includes(target)) {
    warnings.push(`${target.toUpperCase()} is a legacy format with lower compression efficiency — consider using MP4 or WebM instead`);
  }
  return warnings;
}

export function ConversionWarnings({ warnings, infos }: { warnings: string[]; infos?: string[] }) {
  if (!warnings.length && !infos?.length) return null;
  return (
    <div className="flex flex-col gap-1 pl-13">
      {warnings.map((w) => (
        <p key={w} className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {w}
        </p>
      ))}
      {infos?.map((i) => (
        <p key={i} className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
          <Info className="h-3 w-3 shrink-0" />
          {i}
        </p>
      ))}
    </div>
  );
}
