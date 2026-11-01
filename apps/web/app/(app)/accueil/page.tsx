import { redirect } from "next/navigation";
import { requireSpace } from "@/features/shell/space";

export default async function AccueilPage() {
  const { staff } = await requireSpace();
  redirect(staff ? "/suivi" : "/aujourdhui");
}
