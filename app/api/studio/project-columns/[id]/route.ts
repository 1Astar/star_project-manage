import { deleteStudioProjectColumn } from "@/lib/studio/mutations";
import { mapStudioError, studioOk } from "@/lib/studio/route-utils";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    await deleteStudioProjectColumn(id);
    return studioOk({ ok: true });
  } catch (error) {
    return mapStudioError(error);
  }
}
