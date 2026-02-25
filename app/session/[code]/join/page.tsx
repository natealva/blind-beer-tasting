import { redirect } from "next/navigation";

export default async function SessionJoinRedirect({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/session/${code}`);
}
