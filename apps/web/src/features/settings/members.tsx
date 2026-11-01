"use client";

import { m } from "@tartan/i18n";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Rows } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CheckRow, Field, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { leaveOrganizationAction, removeCoachAction, updateMemberAction } from "./settings.action";

type Member = {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "coach" | "assistant" | "athlete" | "guardian";
  groupIds: string[];
};
type Group = { id: string; name: string };

const onErr = ({ error }: { error: { serverError?: string } }) => toast.error(error.serverError ?? m.errors.invalid);

const MemberDialog = ({ member, groups }: { member: Member; groups: Group[] }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"coach" | "assistant">(member.role === "assistant" ? "assistant" : "coach");
  const [groupIds, setGroupIds] = useState(member.groupIds);
  const update = useAction(updateMemberAction, {
    onSuccess: () => {
      toast.ok(m.settings.memberSaved);
      setOpen(false);
      router.refresh();
    },
    onError: onErr,
  });
  const remove = useAction(removeCoachAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
    onError: onErr,
  });
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={member.name || member.email}
      trigger={
        <Button size="sm" variant="quiet">
          {m.common.edit}
        </Button>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          update.execute({ memberId: member.userId, role, groupIds });
        }}
      >
        <Field label={m.settings.memberRole}>
          {(a) => (
            <Select {...a} value={role} onChange={(e) => setRole(e.target.value as "coach" | "assistant")}>
              <option value="coach">{m.roles.coach}</option>
              <option value="assistant">{m.roles.assistant}</option>
            </Select>
          )}
        </Field>
        <fieldset className="flex flex-col">
          <legend className="t-caption mb-1">{m.settings.memberGroups}</legend>
          {groups.map((group) => (
            <CheckRow
              key={group.id}
              label={group.name}
              checked={groupIds.includes(group.id)}
              onChange={(e) =>
                setGroupIds(e.target.checked ? [...groupIds, group.id] : groupIds.filter((id) => id !== group.id))
              }
            />
          ))}
        </fieldset>
        <div className="flex flex-wrap justify-between gap-2">
          <Button type="submit" disabled={update.isPending}>
            {m.common.save}
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={remove.isPending}
            onClick={() => remove.execute({ memberId: member.userId })}
          >
            {m.settings.memberRemove}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

export const MemberList = ({ members, groups }: { members: Member[]; groups: Group[] }) => (
  <Rows>
    {members.map((member) => (
      <li key={member.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
        <div className="min-w-48 flex-1 leading-tight">
          <p className="break-all font-semibold">{member.name || member.email}</p>
          <p className="t-caption font-normal text-soft">
            {m.roles[member.role]}
            {member.role === "owner"
              ? ""
              : `, ${groups
                  .filter((g) => member.groupIds.includes(g.id))
                  .map((g) => g.name)
                  .join(", ") || m.settings.memberNoGroup}`}
          </p>
        </div>
        {member.role === "owner" ? null : <MemberDialog member={member} groups={groups} />}
      </li>
    ))}
  </Rows>
);

export const LeaveSpace = ({ name }: { name: string }) => {
  const leave = useAction(leaveOrganizationAction, {
    onSuccess: () => {
      window.location.href = "/accueil";
    },
    onError: onErr,
  });
  return (
    <Dialog
      title={m.settings.leaveSpace}
      description={m.settings.leaveDetail(name)}
      trigger={
        <Button size="sm" variant="danger">
          {m.settings.leaveSpace}
        </Button>
      }
    >
      <Button variant="danger" disabled={leave.isPending} onClick={() => leave.execute()}>
        {m.settings.leaveConfirm(name)}
      </Button>
    </Dialog>
  );
};
