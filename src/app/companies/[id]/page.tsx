import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

/** Legacy path: employer profiles live under `/employers/[id]`. */
export default async function CompanyProfileAliasRedirect({ params }: PageProps) {
  const { id } = await params;
  redirect(`/employers/${id}`);
}
