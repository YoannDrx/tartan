import { cn } from "@/lib/cn";

// Un titre dont le dernier mot porte le marqueur : la signature de Tartan sur chaque écran.
export const Marked = ({ text, className }: { text: string; className?: string }) => {
  const at = text.trimEnd().lastIndexOf(" ");
  if (at < 0) return <span className={cn("marked", className)}>{text}</span>;
  return (
    <>
      {text.slice(0, at + 1)}
      <span className={cn("marked", className)}>{text.slice(at + 1)}</span>
    </>
  );
};
