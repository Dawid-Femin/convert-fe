import { ImageIcon } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t mt-auto py-6 text-center text-sm text-muted-foreground">
      <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ImageIcon className="h-4 w-4" />
          <span>ImageConvert &copy; {new Date().getFullYear()}</span>
        </div>
        <div className="flex gap-4">
          <a href="#" className="hover:text-foreground transition-colors">Regulamin</a>
          <a href="#" className="hover:text-foreground transition-colors">Prywatność</a>
          <a href="#" className="hover:text-foreground transition-colors">Kontakt</a>
        </div>
      </div>
    </footer>
  );
}
