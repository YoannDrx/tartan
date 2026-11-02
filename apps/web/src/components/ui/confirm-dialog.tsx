"use client";

import { Dialog as Radix } from "radix-ui";
import { useState, type ReactNode } from "react";
import { m } from "@tartan/i18n";
import { Button } from "./button";
import { Dialog } from "./dialog";

// Une confirmation aux couleurs de Tartan : le `confirm` du navigateur n'est ni stylable ni fiable sur téléphone.
export const ConfirmDialog = ({
  title,
  description,
  confirmLabel = m.common.delete,
  cancelLabel = m.common.cancel,
  tone = "danger",
  trigger,
  open,
  onOpenChange,
  onConfirm,
}: {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "neutral";
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onConfirm: () => void;
}) => {
  const [innerOpen, setInnerOpen] = useState(false);
  const isOpen = open ?? innerOpen;
  const setOpen = onOpenChange ?? setInnerOpen;
  return (
    <Dialog open={isOpen} onOpenChange={setOpen} title={title} description={description} trigger={trigger}>
      <div className="flex flex-col-reverse gap-2 tablet:flex-row tablet:justify-end">
        <Radix.Close asChild>
          <Button variant="secondary">{cancelLabel}</Button>
        </Radix.Close>
        <Button
          variant={tone === "danger" ? "danger" : "primary"}
          onClick={() => {
            setOpen(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
};
