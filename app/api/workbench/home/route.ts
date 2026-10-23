import { NextResponse } from "next/server";
import {
  loadWorkbenchHomePart,
  type WorkbenchHomePart,
} from "@/lib/workbench/home-sections";
import { runWithDurableReadMemo } from "@/lib/runtime/durable-read-memo";

const PARTS = new Set<WorkbenchHomePart>(["hero", "today", "library", "star"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const part = url.searchParams.get("part") as WorkbenchHomePart | null;
  if (!part || !PARTS.has(part)) {
    return NextResponse.json(
      { error: "part 须为 hero | today | library | star" },
      { status: 400 }
    );
  }

  try {
    // star 已在 loadWorkbenchStar 内超时降级；整段再加总超时，避免 Worker 挂死拖垮客户端
    const load = () => runWithDurableReadMemo(() => loadWorkbenchHomePart(part));
    const payload =
      part === "star"
        ? await Promise.race([
            load(),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error("星图接口超时，请重试")),
                10_000
              )
            ),
          ])
        : await load();
    return NextResponse.json(payload);
  } catch (e) {
    console.error("workbench home section", part, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "加载失败" },
      { status: 500 }
    );
  }
}
