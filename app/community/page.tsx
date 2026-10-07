import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function CommunityRedirect({
  searchParams
}: {
  searchParams: { state?: string };
}) {
  const params = new URLSearchParams({ tab: "community" });
  if (searchParams.state) params.set("state", searchParams.state);
  redirect(`/talk?${params.toString()}`);
}