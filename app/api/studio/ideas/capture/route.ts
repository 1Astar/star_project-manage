import { captureIdea } from "@/lib/studio/capture-idea";
import { mapStudioError, readStudioBody, studioOk } from "@/lib/studio/route-utils";
import type { IdeaCapturePayload } from "@/lib/studio/idea-capture";

export async function POST(request: Request) {
  const body = await readStudioBody<IdeaCapturePayload>(request);
  if (!body?.title?.trim()) {
    return mapStudioError(new Error("title 必填"));
  }

  try {
    const result = await captureIdea(body);
    return studioOk({
      message: "已进入灵感收件箱",
      ...result,
    });
  } catch (error) {
    return mapStudioError(error);
  }
}
