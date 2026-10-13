import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function FollowingRedirect(props: {

    params: Promise<{ handle: string }>;

}) {
  const params = await props.params;

  redirect(`/u/${encodeURIComponent(params.handle)}?tab=following`);
}