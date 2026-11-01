import { m } from "@tartan/i18n";
import { SheetSkeleton } from "@/components/states";

export default function Loading() {
  return <SheetSkeleton label={m.common.loading} />;
}
