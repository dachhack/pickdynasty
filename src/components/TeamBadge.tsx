export function TeamBadge({
  emoji,
  color,
  name,
  sub,
  size = "md",
}: {
  emoji: string;
  color: string;
  name: string;
  sub?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims = size === "lg" ? "h-12 w-12 text-2xl" : size === "sm" ? "h-7 w-7 text-sm" : "h-9 w-9 text-lg";
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span
        className={`${dims} flex shrink-0 items-center justify-center rounded-full`}
        style={{ backgroundColor: `${color}22`, border: `2px solid ${color}` }}
        aria-hidden
      >
        {emoji}
      </span>
      <div className="min-w-0">
        <div className="truncate font-semibold text-slate-900">{name}</div>
        {sub ? <div className="truncate text-xs text-slate-500">{sub}</div> : null}
      </div>
    </div>
  );
}
