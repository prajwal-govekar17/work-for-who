import { redirect } from "next/navigation";

/** Legacy path: keep a single canonical employer directory at `/employers`. */
export default function CompaniesAliasRedirect() {
  redirect("/employers");
}
