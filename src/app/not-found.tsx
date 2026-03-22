import Link from "next/link";
import { ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <ImageOff className="h-16 w-16 mx-auto text-muted-foreground" />
        <h1 className="text-5xl font-bold tracking-tight">404</h1>
        <p className="text-muted-foreground text-lg">
          The page you're looking for doesn't exist.
        </p>
        <Button asChild>
          <Link href="/">Go back home</Link>
        </Button>
      </div>
    </main>
  );
}
