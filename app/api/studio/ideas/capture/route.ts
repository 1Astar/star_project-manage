import { captureIdeaViaGitHubIssue } from "@/lib/github/sync-ideas";
import { mapStudioError, readStudioBody, studioOk } from "@/lib/studio/route-utils";
import type { IdeaCapturePayload } from "@/lib/studio/idea-capture";

export async function POST(request: Request) {
  const body = await readStudioBody<IdeaCapturePayload>(request);
  if (!body?.title?.trim()) {
    return mapStudioError(new Error("title 必填"));
  }

  try {
    const result = await captureIdeaViaGitHubIssue(body);
    return studioOk({
      message: "已提交到 GitHub Issue 中转，请同步收件箱",
      ...result,
    });
  } catch (error) {
    return mapStudioError(error);
  }
}
