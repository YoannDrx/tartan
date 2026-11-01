import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { m } from "@tartan/i18n";
import { Chip, EmptyState, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { AthleteDialog } from "@/features/athletes/athlete-forms";
import { requireStaffSpace } from "@/features/shell/space";
import { requireOrgMember } from "@/server/access";
import { listAthletes } from "@/server/athlete.service";
import { listGroups } from "@/server/org.service";

export const metadata: Metadata = { title: m.athletes.title };

export default async function AthletesPage() {
  const { actor, organizationId } = await requireStaffSpace();
  const access = await requireOrgMember(actor.userId, organizationId, "viewTracking");
  const [athletes, groups] = await Promise.all([listAthletes(actor.userId, organizationId), listGroups(access)]);
  const canManage = access.role !== "assistant";
  const addButton = (
    <Button size="sm">
      <Plus aria-hidden className="size-5" />
      {m.athletes.new}
    </Button>
  );
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={m.athletes.title}
        actions={canManage ? <AthleteDialog trigger={addButton} groups={groups} title={m.athletes.new} /> : null}
      />
      {athletes.length === 0 ? (
        <EmptyState
          action={
            <Button asChild size="sm" variant="secondary">
              <Link href="/reglages#invitations">{m.home.inviteAthletes}</Link>
            </Button>
          }
        >
          {m.athletes.empty}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border rounded-block border border-border bg-surface">
          {athletes.map((a) => (
            <li key={a.id}>
              <Link
                href={`/athletes/${a.id}`}
                className="flex min-h-11 flex-wrap items-center gap-3 p-3 text-ink no-underline hover:bg-bg"
              >
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-sunk font-semibold"
                >
                  {a.firstName[0]}
                  {a.lastName[0]}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">
                    {a.firstName} {a.lastName}
                  </span>
                  <span className="t-caption font-normal text-muted">
                    {a.groups.map((g) => g.name).join(", ") || "Sans groupe"}
                  </span>
                </span>
                {!a.hasAccount ? <Chip tone="warning">{m.athletes.noAccount}</Chip> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
