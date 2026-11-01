import { m } from "@tartan/i18n";
import { Spinner } from "@/components/states";

export default function Loading() {
  return <Spinner label={m.common.loading} />;
}
