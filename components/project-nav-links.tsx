import Link from "next/link";
import { PROJECT_NAV_ITEMS } from "@/lib/project-nav-items";

function isActive(pathname: string, href: string, segment: string, base: string) {
  if (segment === "") {
    return pathname === base || pathname === `${base}/`;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ProjectNavLinks({
  base,
  pathname,
}: {
  base: string;
  pathname: string;
}) {
  return (
    <nav className="flex flex-wrap gap-1">
      {PROJECT_NAV_ITEMS.map((item) => {
        const href = item.segment ? `${base}/${item.segment}` : base;
        const active = isActive(pathname, href, item.segment, base);
        const highlighted = "highlight" in item && item.highlight;

        return (
          <Link
            key={href}
            href={href}
            prefetch
            className={
              active
                ? highlighted
                  ? "rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white"
                  : "rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
                : highlighted
                  ? "rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-800 hover:bg-violet-100"
                  : "rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }
          >
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/"
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
      >
        全部项目
      </Link>
    </nav>
  );
}
