"use client";

import { addDays } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CheckRow, Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { duplicateWeekAction, saveCompetitionAction } from "./session.action";

export const DuplicateWeekDialog = ({ week, groups }: { week: string; groups: { id: string; name: string }[] }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toWeek, setToWeek] = useState(addDays(week, 7));
  const [groupId, setGroupId] = useState("");
  const { execute, isPending } = useAction(duplicateWeekAction, {
    onSuccess: ({ data }) => {
      toast.ok(`${data?.count ?? 0} séances dupliquées en brouillon.`);
      setOpen(false);
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={m.calendar.duplicateWeek}
      trigger={
        <Button size="sm" variant="secondary">
          {m.calendar.duplicateWeek}
        </Button>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          execute({ fromWeek: week, toWeek, targetGroupId: groupId || undefined });
        }}
      >
        <Field label="Vers la semaine du" hint="Choisis le lundi de la semaine.">
          {(a) => <Input {...a} type="date" required value={toWeek} onChange={(e) => setToWeek(e.target.value)} />}
        </Field>
        <Field label="Pour le groupe">
          {(a) => (
            <Select {...a} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">Mêmes destinataires</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button type="submit" disabled={isPending}>
          {m.calendar.duplicate}
        </Button>
      </form>
    </Dialog>
  );
};

export const CompetitionDialog = ({
  athletes,
  today,
}: {
  athletes: { id: string; firstName: string; lastName: string }[];
  today: string;
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ name: "", date: today, location: "" });
  const [selected, setSelected] = useState<string[]>([]);
  const { execute, isPending, result } = useAction(saveCompetitionAction, {
    onSuccess: () => {
      setOpen(false);
      setValues({ name: "", date: today, location: "" });
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  const errors = result.validationErrors as Record<string, { _errors?: string[] }> | undefined;
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={m.calendar.addCompetition}
      trigger={
        <Button size="sm" variant="secondary">
          {m.calendar.addCompetition}
        </Button>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          execute({ name: values.name, date: values.date, location: values.location || null, athleteIds: selected });
        }}
      >
        <Field label="Nom" error={errors?.name?._errors?.[0]}>
          {(a) => <Input {...a} value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} />}
        </Field>
        <Field label={m.builder.date}>
          {(a) => (
            <Input
              {...a}
              type="date"
              required
              value={values.date}
              onChange={(e) => setValues({ ...values, date: e.target.value })}
            />
          )}
        </Field>
        <Field label={m.builder.location}>
          {(a) => (
            <Input
              {...a}
              value={values.location}
              onChange={(e) => setValues({ ...values, location: e.target.value })}
            />
          )}
        </Field>
        {athletes.length > 0 ? (
          <fieldset>
            <legend className="t-caption mb-1">Athlètes engagés</legend>
            <div className="max-h-48 overflow-y-auto">
              {athletes.map((a) => (
                <CheckRow
                  key={a.id}
                  label={`${a.firstName} ${a.lastName}`}
                  checked={selected.includes(a.id)}
                  onChange={(e) =>
                    setSelected(e.target.checked ? [...selected, a.id] : selected.filter((id) => id !== a.id))
                  }
                />
              ))}
            </div>
          </fieldset>
        ) : null}
        <Button type="submit" disabled={isPending}>
          {m.common.add}
        </Button>
      </form>
    </Dialog>
  );
};
