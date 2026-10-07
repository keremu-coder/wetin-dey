import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function FollowersRedirect({
  params
}: {
  params: { handle: string };
}) {
  redirect(`/u/${encodeURIComponent(params.handle)}?tab=followers`);
}