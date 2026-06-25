import { notFound } from "next/navigation";
import { validateShareToken } from "@/lib/actions";
import { ShareWorkspace } from "@/components/share-workspace";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await validateShareToken(token);
  if (!data || !data.bundle) notFound();

  return (
    <ShareWorkspace
      token={token}
      link={data.link}
      bundle={data.bundle}
    />
  );
}
