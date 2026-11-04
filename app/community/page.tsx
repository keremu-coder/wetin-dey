import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CommunityRedirect(props: {

    searchParams: Promise<{ state?: string }>;

}) {
  const searchParams = await props.searchParams;

  const params = new URLSearchParams({ tab: "community" });
  if (searchParams.state) params.set("state", searchParams.state);
  redirect(`/talk?${params.toString()}`);
}