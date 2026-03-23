import { AlertTriangle } from "lucide-react";

const ALPHA_FORMATS = ["png", "webp", "avif", "gif", "tiff"];
const NO_ALPHA_FORMATS = ["jpeg", "bmp"];
const ANIMATED_FORMATS = ["gif"];
const STATIC_FORMATS = ["jpeg", "png", "webp", "avif", "tiff", "bmp", "svg"];

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
  return warnings;
}

export function getVideoWarnings(
  source: string,
  target: string,
  sourceResolution?: string,
  targetResolution?: string,
): string[] {
  const warnings: string[] = [];
  if (!source || !target) return warnings;

  if (targetResolution && sourceResolution) {
    const targetH = parseInt(targetResolution.split("x")[1] || "0");
    const sourceH = parseInt(sourceResolution.split("x")[1] || "0");
    if (targetH > sourceH && sourceH > 0) {
      warnings.push("Upscaling won't improve quality — it will only increase file size");
    }
  }
  return warnings;
}

export function ConversionWarnings({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return (
    <div className="flex flex-col gap-1 pl-13">
      {warnings.map((w) => (
        <p key={w} className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {w}
        </p>
      ))}
    </div>
  );
}
