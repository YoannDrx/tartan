"use client";

import { tokens } from "@tartan/design-tokens";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Pencil, QrCode, Trash2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { groupLinkAction } from "@/features/invitations/invitation.action";
import { deleteGroupAction, saveGroupAction } from "../settings.action";
import { CopyButton, onErr, type AnyErrors } from "../shared";

const t = w.settings.groupes;

export const QrPreview = ({ link, groupName }: { link: string; groupName: string }) => {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toString(link, {
      type: "svg",
      margin: 1,
      width: 320,
      color: { dark: tokens.color.ink, light: tokens.color.surface },
    }).then(setSvg, () => setSvg(null));
  }, [link]);
  return svg ? (
    <div
      role="img"
      aria-label={t.qrLabel(groupName)}
      className="mx-auto w-full max-w-80 overflow-hidden rounded-thumb"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  ) : null;
};

type GroupValues = {
  id: string;
  name: string;
  color: string | null;
  level: string | null;
  goal: string | null;
  athleteCount: number;
};

const GroupDialog = ({ group }: { group: GroupValues }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    name: group.name,
    color: group.color ?? tokens.color.brand,
    level: group.level ?? "",
    goal: group.goal ?? "",
  });
  const { execute, isPending, result } = useAction(saveGroupAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
    onError: onErr,
  });
  const errors = result.validationErrors as AnyErrors;
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={group.name}
      trigger={
        <IconButton label={`${m.common.edit} ${group.name}`}>
          <Pencil aria-hidden className="size-4" />
        </IconButton>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          execute({ id: group.id, name: v.name, color: v.color, level: v.level || null, goal: v.goal || null });
        }}
      >
        <Field label={t.name} error={errors?.name?._errors?.[0]}>
          {(a) => <Input {...a} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}
        </Field>
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <Field label={t.color}>
            {(a) => (
              <Input
                {...a}
                type="color"
                className="w-16 p-1"
                value={v.color}
                onChange={(e) => setV({ ...v, color: e.target.value })}
              />
            )}
          </Field>
          <Field label={t.level}>
            {(a) => <Input {...a} value={v.level} onChange={(e) => setV({ ...v, level: e.target.value })} />}
          </Field>
        </div>
        <Field label={t.goal}>
          {(a) => <Input {...a} value={v.goal} onChange={(e) => setV({ ...v, goal: e.target.value })} />}
        </Field>
        <Button type="submit" disabled={isPending}>
          {m.common.save}
        </Button>
      </form>
    </Dialog>
  );
};

export const GroupRow = ({ group, canDelete }: { group: GroupValues; canDelete: boolean }) => {
  const router = useRouter();
  const [link, setLink] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const getLink = useAction(groupLinkAction, { onSuccess: ({ data }) => setLink(data?.link ?? null), onError: onErr });
  const remove = useAction(deleteGroupAction, { onSuccess: () => router.refresh(), onError: onErr });
  return (
    <li className="flex flex-wrap items-center gap-x-1 gap-y-2 py-2">
      <div className="min-w-48 flex-1">
        <div className="min-w-0 leading-snug">
          <p className="flex items-center gap-2 break-words font-semibold">
            {group.color ? (
              // Couleur choisie par le coach pour son groupe : une donnée, pas un jeton.
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
            ) : null}
            {group.name}
          </p>
          <p className="t-caption font-normal text-soft">
            {[t.athletes(group.athleteCount), group.level, group.goal].filter(Boolean).join(", ")}
          </p>
        </div>
      </div>
      {link ? <CopyButton text={link} label={m.settings.copyLink} /> : null}
      <Button
        size="sm"
        variant="secondary"
        disabled={getLink.isPending}
        onClick={() => {
          setShowQr(false);
          getLink.execute({ groupId: group.id });
        }}
      >
        {m.settings.groupLink}
      </Button>
      <IconButton
        label={m.settings.showQr}
        onClick={() => {
          setShowQr(true);
          getLink.execute({ groupId: group.id });
        }}
      >
        <QrCode aria-hidden className="size-5" />
      </IconButton>
      <GroupDialog group={group} />
      {canDelete ? (
        <ConfirmDialog
          title={t.deleteTitle(group.name)}
          onConfirm={() => remove.execute({ id: group.id })}
          trigger={
            <IconButton label={`${m.common.delete} ${group.name}`}>
              <Trash2 aria-hidden className="size-4" />
            </IconButton>
          }
        />
      ) : null}
      {link && !showQr ? (
        <Input readOnly aria-label={t.linkLabel} value={link} className="w-full" onFocus={(e) => e.target.select()} />
      ) : null}
      <Dialog open={showQr && link !== null} onOpenChange={setShowQr} title={group.name} description={t.qrDetail}>
        {link ? <QrPreview link={link} groupName={group.name} /> : null}
      </Dialog>
    </li>
  );
};

export const NewGroupForm = () => {
  const router = useRouter();
  const [name, setName] = useState("");
  const { execute, isPending, result } = useAction(saveGroupAction, {
    onSuccess: () => {
      setName("");
      router.refresh();
    },
    onError: onErr,
  });
  const errors = result.validationErrors as AnyErrors;
  return (
    <form
      noValidate
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        execute({ name });
      }}
    >
      <Field label={m.settings.newGroup} className="flex-1" error={errors?.name?._errors?.[0]}>
        {(a) => <Input {...a} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Button type="submit" size="sm" variant="secondary" disabled={isPending}>
        {m.common.add}
      </Button>
    </form>
  );
};
