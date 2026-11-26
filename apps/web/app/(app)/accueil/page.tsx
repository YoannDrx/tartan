import { redirect } from "next/navigation";
import { requireSpace } from "@/features/shell/space";

export default async function AccueilPage() {
  const { staff, spaces, space } = await requireSpace();
  const home = spaces[0];
  if (home && home.organizationId !== space.organizationId) {
    redirect(`/${home.role === "athlete" ? "aujourdhui" : "suivi"}?espace=${home.organizationId}`);
  }
  redirect(staff ? "/suivi" : "/aujourdhui");
}
