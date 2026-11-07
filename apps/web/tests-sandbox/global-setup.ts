import setupDatabase from "../tests/global-setup";
import { SANDBOX_ACCOUNT, stripeCli } from "./stripe-cli";

export default async function setup() {
  if (process.env.RUN_STRIPE_SANDBOX !== "1") throw new Error("sandbox_opt_in_required");
  const url = new URL(process.env.TEST_DATABASE_URL ?? "");
  if (url.hostname !== "localhost" || url.port !== "54329" || url.pathname !== "/tartan_v11_sandbox" || url.search)
    throw new Error("dedicated_local_sandbox_database_required");
  const account = await stripeCli<{ id: string }>("get", "/v1/account");
  if (account.id !== SANDBOX_ACCOUNT) throw new Error("sandbox_account_mismatch");
  setupDatabase();
}
