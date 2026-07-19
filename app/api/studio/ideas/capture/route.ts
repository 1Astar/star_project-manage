import { captureIdea } from "@/lib/studio/capture-idea";
import { CaptureDuplicateError } from "@/lib/studio/capture-relation";
import { mapStudioError, readStudioBody, studioOk, studioErr } from "@/lib/studio/route-utils";
import type { IdeaCapturePayload } from "@/lib/studio/idea-capture";

export async function POST(request: Request) {
  const body = await readStudioBody<IdeaCapturePayload>(request);
  if (!body?.title?.trim()) {
    return mapStudioError(new Error("title 必填"));
  }

  try {
    const result = await captureIdea(body);
    return studioOk({
      message: result.parentAutoLinked
        ? `已进入灵感收件箱，并自动挂父：${result.parentLinkReason}`
        : "已进入灵感收件箱",
      ...result,
    });
  } catch (error) {
    if (error instanceof CaptureDuplicateError) {
      return studioErr(error.message, 409, {
        code: "DUPLICATE",
        candidates: error.candidates,
        hint: "请 update_idea，或 force:true 强制新建",
      });
    }
    return mapStudioError(error);
  }
}
