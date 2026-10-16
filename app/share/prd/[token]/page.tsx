import { notFound } from "next/navigation";
import { getPrdByShareToken, listPrdComments } from "@/lib/prds/store";
import { PrdShareViewer } from "@/components/prd-share-viewer";
import { readDb } from "@/lib/db/local-store";

export default async function SharePrdPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const prd = await getPrdByShareToken(token);
  if (!prd) notFound();
  const [comments, db] = await Promise.all([listPrdComments(prd.id), readDb()]);
  const linkedIds = new Set(prd.linked_prototypes.map((l) => l.prototype_id));
  const prototypes = (db.prototypes ?? []).filter((p) => linkedIds.has(p.id));

  return (
    <PrdShareViewer
      prd={prd}
      comments={comments}
      shareToken={token}
      prototypes={prototypes}
    />
  );
}
