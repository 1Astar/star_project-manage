import {
  createStudioProjectColumn,
  deleteStudioProjectColumn,
  listStudioProjectColumns,
  type CreateProjectColumnInput,
} from "@/lib/studio/mutations";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

export async function GET() {
  try {
    const columns = await listStudioProjectColumns(true);
    return studioOk({ columns });
  } catch (error) {
    return mapStudioError(error);
  }
}

export async function POST(request: Request) {
  const body = await readStudioBody<CreateProjectColumnInput>(request);
  if (!body?.label?.trim()) return studioErr("label 必填");

  try {
    const column = await createStudioProjectColumn(body);
    return studioOk({ column }, 201);
  } catch (error) {
    return mapStudioError(error);
  }
}
