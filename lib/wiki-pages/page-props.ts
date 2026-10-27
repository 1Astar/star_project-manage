export const WIKI_PAGE_STATUSES = ["调研中", "进行中", "已完成", "搁置"] as const;

export type WikiPageStatus = (typeof WIKI_PAGE_STATUSES)[number] | "";

export type WikiPageProps = {
  status: WikiPageStatus;
  capability: string;
};

const EMPTY: WikiPageProps = { status: "", capability: "" };
const MARK = /<!--star-page\s+([\s\S]*?)-->\s*/;

export function emptyWikiPageProps(): WikiPageProps {
  return { ...EMPTY };
}

export function parseWikiPageProps(raw: string): WikiPageProps {
  try {
    const parsed = JSON.parse(raw) as Partial<WikiPageProps>;
    const status = String(parsed.status ?? "").trim();
    const allowed = WIKI_PAGE_STATUSES as readonly string[];
    return {
      status: allowed.includes(status) ? (status as WikiPageStatus) : "",
      capability: String(parsed.capability ?? "").trim(),
    };
  } catch {
    return emptyWikiPageProps();
  }
}

export function splitPageProps(body: string): { props: WikiPageProps; markdown: string } {
  const src = body ?? "";
  const m = src.match(MARK);
  if (!m || m.index !== 0) {
    return { props: emptyWikiPageProps(), markdown: src };
  }
  return {
    props: parseWikiPageProps(m[1] ?? "{}"),
    markdown: src.slice(m[0].length),
  };
}

export function joinPageProps(props: WikiPageProps, markdown: string): string {
  const status = props.status.trim();
  const capability = props.capability.trim();
  const md = markdown ?? "";
  if (!status && !capability) return md;
  const json = JSON.stringify({
    ...(status ? { status } : {}),
    ...(capability ? { capability } : {}),
  });
  return `<!--star-page ${json}-->\n${md}`;
}
