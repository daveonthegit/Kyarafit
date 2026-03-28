import { redirect } from "next/navigation";

export default async function ClosetItemRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/elements/${id}`);
}
