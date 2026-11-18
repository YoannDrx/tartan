"use client";

import { w } from "@tartan/i18n/web";
import {
  ChevronDown,
  ChevronUp,
  Keyboard,
  MessageSquarePlus,
  PanelRightClose,
  PanelRightOpen,
  UnfoldHorizontal,
  FoldHorizontal,
} from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";
import { IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { snapSheet, type SheetHeight } from "./immersive-layout";

const t = w.video;

const AddRemark = ({ onClick, icon }: { onClick: () => void; icon?: boolean }) =>
  icon ? (
    <IconButton tone="brand" label={t.addRemark} aria-keyshortcuts="M" onClick={onClick}>
      <MessageSquarePlus aria-hidden className="size-5" />
    </IconButton>
  ) : (
    <button
      type="button"
      aria-keyshortcuts="M"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 font-semibold text-on-accent"
    >
      <MessageSquarePlus aria-hidden className="size-5" />
      {t.addRemark}
    </button>
  );

// L'en-tête de la feuille, sur téléphone en portrait : une poignée à glisser, et les mêmes hauteurs par boutons
// (un geste de glissement a toujours une alternative d'un seul toucher).
export const SheetHeader = ({
  height,
  canAnnotate,
  onHeight,
  onDrag,
  onAddRemark,
}: {
  height: SheetHeight;
  canAnnotate: boolean;
  onHeight: (height: SheetHeight | "grow" | "shrink") => void;
  // Pendant le glissement, la hauteur en pixels suit le doigt ; `null` quand il la lâche.
  onDrag: (pixels: number | null) => void;
  onAddRemark: () => void;
}) => {
  const start = useRef<{ y: number; height: number; moved: boolean } | null>(null);
  const begin = (event: PointerEvent<HTMLDivElement>) => {
    const sheet = event.currentTarget.closest("aside");
    if (!sheet) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { y: event.clientY, height: sheet.getBoundingClientRect().height, moved: false };
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const origin = start.current;
    if (!origin) return;
    const delta = origin.y - event.clientY;
    if (Math.abs(delta) > 4) origin.moved = true;
    if (origin.moved) onDrag(Math.max(0, origin.height + delta));
  };
  const end = (event: PointerEvent<HTMLDivElement>) => {
    const origin = start.current;
    start.current = null;
    if (!origin) return;
    const overlay = event.currentTarget.closest("[data-immersive]");
    onDrag(null);
    // Un simple toucher sur la poignée ouvre ou replie la feuille.
    if (!origin.moved) onHeight(height === "rail" ? "half" : "rail");
    else if (overlay)
      onHeight(snapSheet((origin.height + origin.y - event.clientY) / overlay.getBoundingClientRect().height));
  };
  return (
    <div className="shrink-0">
      <div
        aria-hidden
        data-testid="sheet-handle"
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className="flex h-5 cursor-grab touch-none items-center justify-center"
      >
        <span className="h-1 w-10 rounded-full bg-control-line" />
      </div>
      <div className="flex items-center gap-2 px-3 pb-2">
        {/* Feuille ouverte, le champ de remarque est juste dessous : le bouton ne sert que feuille repliée. */}
        {canAnnotate && height === "rail" ? (
          <AddRemark onClick={onAddRemark} />
        ) : (
          <h2 className="t-section min-w-0 truncate px-1">{t.editor}</h2>
        )}
        <p role="status" className="sr-only">
          {t.sheet.state[height]}
        </p>
        <div className="ml-auto flex gap-1">
          {/* À la borne, le bouton s'annonce inactif sans perdre le focus du clavier. */}
          <IconButton
            tone="dark"
            label={t.sheet.shrink}
            aria-disabled={height === "rail"}
            className="aria-disabled:opacity-50"
            onClick={() => onHeight("shrink")}
          >
            <ChevronDown aria-hidden className="size-5" />
          </IconButton>
          <IconButton
            tone="dark"
            label={t.sheet.grow}
            aria-disabled={height === "full"}
            className="aria-disabled:opacity-50"
            onClick={() => onHeight("grow")}
          >
            <ChevronUp aria-hidden className="size-5" />
          </IconButton>
        </div>
      </div>
    </div>
  );
};

// L'en-tête du panneau latéral, sur ordinateur et en paysage : replié, il devient un rail fin.
export const PanelHeader = ({
  collapsed,
  wide,
  canAnnotate,
  onCollapsed,
  onWide,
  onAddRemark,
}: {
  collapsed: boolean;
  wide: boolean;
  canAnnotate: boolean;
  onCollapsed: (collapsed: boolean) => void;
  onWide: (wide: boolean) => void;
  onAddRemark: () => void;
}) => (
  <div className={cn("flex shrink-0 items-center py-2", collapsed ? "flex-col gap-2" : "gap-1 px-3")}>
    {/* Le même bouton replie et déplie : le focus du clavier ne se perd pas d'un état à l'autre. */}
    <IconButton
      tone="dark"
      label={collapsed ? t.panel.expand : t.panel.collapse}
      aria-expanded={!collapsed}
      onClick={() => onCollapsed(!collapsed)}
    >
      {collapsed ? (
        <PanelRightOpen aria-hidden className="size-5" />
      ) : (
        <PanelRightClose aria-hidden className="size-5" />
      )}
    </IconButton>
    {collapsed ? (
      canAnnotate ? (
        <AddRemark icon onClick={onAddRemark} />
      ) : null
    ) : (
      <IconButton
        tone="dark"
        label={wide ? t.panel.narrow : t.panel.widen}
        aria-pressed={wide}
        onClick={() => onWide(!wide)}
      >
        {wide ? <FoldHorizontal aria-hidden className="size-5" /> : <UnfoldHorizontal aria-hidden className="size-5" />}
      </IconButton>
    )}
  </div>
);

const SHORTCUTS = [
  [t.shortcuts.keys.space, t.shortcuts.actions.play],
  [t.shortcuts.keys.left, t.shortcuts.actions.previous],
  [t.shortcuts.keys.right, t.shortcuts.actions.next],
  [t.shortcuts.keys.fullscreen, t.shortcuts.actions.fullscreen],
  [t.shortcuts.keys.remark, t.shortcuts.actions.remark],
  [t.shortcuts.keys.escape, t.shortcuts.actions.escape],
] as const;

// L'aide des raccourcis : un dialogue, donc lisible au clavier et par un lecteur d'écran.
export const ShortcutsHelp = ({ className }: { className?: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={t.shortcuts.title}
      description={t.shortcuts.note}
      trigger={
        <IconButton tone="darkRound" label={t.shortcuts.title} className={className}>
          <Keyboard aria-hidden className="size-5" />
        </IconButton>
      }
    >
      <dl className="flex flex-col divide-y divide-card-line">
        {SHORTCUTS.map(([key, action]) => (
          <div key={key} className="flex min-h-11 items-center justify-between gap-4 py-2">
            <dt>{action}</dt>
            <dd>
              <kbd className="inline-flex min-w-9 justify-center rounded-thumb border border-control-line px-2 py-1 font-[family-name:inherit] text-[14px] font-semibold">
                {key}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
};
