import { convertIdeaToRequirement } from "@/lib/studio/idea-to-requirement";
import { mapStudioError, readStudioBody, studioOk } from "@/lib/studio/route-utils";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await readStudioBody<{
    acceptance?: string | null;
    detail?: string | null;
    markReviewing?: boolean;
  }>(request);

  try {
    const result = await convertIdeaToRequirement(id, {
      acceptance: body?.acceptance,
      detail: body?.detail,
      markReviewing: body?.markReviewing,
    });
    return studioOk(result, 201);
  } catch (error) {
    return mapStudioError(error);
  }
}
