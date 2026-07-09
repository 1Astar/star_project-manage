import { APP_COPYRIGHT, appVersionLabel } from "@/lib/app-meta";
import { cn } from "@/lib/utils";

export function AppBrandFooter({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "compact";
}) {
  if (variant === "compact") {
    return (
      <div className={cn("space-y-1 text-[11px] leading-relaxed text-stone-400", className)}>
        <div className="font-medium text-stone-500">{appVersionLabel()}</div>
        <div>{APP_COPYRIGHT}</div>
      </div>
    );
  }

  return (
    <footer
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-t border-stone-200/80 py-4 text-xs text-stone-400",
        className
      )}
    >
      <span className="font-medium text-stone-500">{appVersionLabel()}</span>
      <span>{APP_COPYRIGHT}</span>
    </footer>
  );
}
