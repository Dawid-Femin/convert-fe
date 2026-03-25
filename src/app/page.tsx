import Link from "next/link";
import { ImageIcon, FileDown, Video, Music } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const tools = [
  {
    href: "/image",
    icon: ImageIcon,
    title: "Image Converter",
    description: "Convert between JPEG, PNG, WebP, AVIF, TIFF and more",
  },
  {
    href: "/compress",
    icon: FileDown,
    title: "Image Compressor",
    description: "Reduce file size while keeping the same format",
  },
  {
    href: "/video",
    icon: Video,
    title: "Video Converter",
    description: "Convert between MP4, WebM, AVI, MOV, MKV and more",
  },
  {
    href: "/audio",
    icon: Music,
    title: "Audio Converter",
    description: "Convert between MP3, WAV, FLAC, AAC, OGG and more",
  },
];

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col items-center p-4 gap-8 max-w-4xl mx-auto w-full">
      <section className="w-full rounded-lg border bg-gradient-to-br from-muted/50 to-muted px-6 py-12 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Media Converter</h1>
        <p className="mt-3 text-muted-foreground">
          Free, fast and private — convert and compress your files right in the browser.
        </p>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        {tools.map(({ href, icon: Icon, title, description }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full transition-colors group-hover:border-primary/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  <div>
                    <CardTitle className="text-base">{title}</CardTitle>
                    <CardDescription className="mt-1">{description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
