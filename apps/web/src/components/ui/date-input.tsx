"use client";

import {
  formatDateInput,
  isDateInRange,
  maskDateInput,
  monthGrid,
  parseDateInput,
  shiftMonth,
  addDays,
} from "@tartan/domain";
import { m } from "@tartan/i18n";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ComponentProps, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { todayIso } from "@/lib/dates";
import { Input } from "./field";

const t = m.datePicker;
const YEARS_PER_PAGE = 12;
const WIDTH = 320;
const GUTTER = 16;

type DateInputProps = Omit<ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange" | "min" | "max"> & {
  value?: string;
  defaultValue?: string;
  min?: string | number;
  max?: string | number;
  onChange?: (event: { target: { value: string } }) => void;
};

// Le nom lu commence par le chiffre affiché.
const dayLabel = (iso: string) =>
  `${Number(iso.slice(8))} ${t.months[Number(iso.slice(5, 7)) - 1]?.toLowerCase()} ${iso.slice(0, 4)}`;
const monthOf = (iso: string) => ({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) });

const iconButton =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-raise disabled:opacity-40";

export const DateInput = ({
  value,
  defaultValue,
  onChange,
  name,
  min: minValue,
  max: maxValue,
  required,
  disabled,
  readOnly,
  className,
  ...props
}: DateInputProps) => {
  const min = minValue === undefined ? undefined : String(minValue);
  const max = maxValue === undefined ? undefined : String(maxValue);
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue ?? "");
  const iso = controlled ? value : inner;
  const [text, setText] = useState(formatDateInput(iso));
  const [invalid, setInvalid] = useState(false);
  const [view, setView] = useState(() => monthOf(parseDateInput(iso) ?? todayIso()));
  const [years, setYears] = useState(false);
  const [focusDay, setFocusDay] = useState<string | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const today = todayIso();

  // Une valeur modifiée de l'extérieur (reprise de brouillon, remise à zéro) remplace la saisie en cours.
  const [syncedIso, setSyncedIso] = useState(iso);
  if (iso !== syncedIso) {
    setSyncedIso(iso);
    if (parseDateInput(text) !== (iso || null)) {
      setText(formatDateInput(iso));
      setInvalid(false);
    }
  }

  const commit = (next: string) => {
    if (!controlled) setInner(next);
    onChange?.({ target: { value: next } });
  };

  const place = useCallback(() => {
    const box = wrapper.current?.getBoundingClientRect();
    const element = panel.current;
    if (!box || !element) return;
    const width = Math.min(WIDTH, window.innerWidth - GUTTER * 2);
    const height = element.offsetHeight;
    const left = Math.min(Math.max(GUTTER, box.left), window.innerWidth - width - GUTTER);
    const below = box.bottom + 8;
    const top = below + height > window.innerHeight - GUTTER ? Math.max(GUTTER, box.top - height - 8) : below;
    element.style.width = `${width}px`;
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
  }, []);

  const close = () => {
    panel.current?.hidePopover();
    trigger.current?.focus();
  };

  const open = () => {
    const current = parseDateInput(iso) ?? today;
    setView(monthOf(current));
    setYears(false);
    setFocusDay(current);
    panel.current?.showPopover();
    place();
  };

  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    const follow = () => {
      if (element.matches(":popover-open")) place();
    };
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [place]);

  useEffect(() => {
    if (focusDay) panel.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus();
  }, [focusDay, view]);

  const choose = (day: string) => {
    commit(day);
    setText(formatDateInput(day));
    setInvalid(false);
    close();
  };

  const moveFocus = (day: string) => {
    if (!isDateInRange(day, min, max)) return;
    setFocusDay(day);
    setView(monthOf(day));
  };

  const onGridKey = (event: KeyboardEvent<HTMLElement>, day: string) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const delta = moves[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    moveFocus(addDays(day, delta));
  };

  const yearStart = view.year - (view.year % YEARS_PER_PAGE);
  const shown = parseDateInput(iso);
  const canClear = !required && Boolean(iso);

  return (
    <div ref={wrapper} className="relative w-full">
      {name ? <input type="hidden" name={name} value={iso} /> : null}
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={t.placeholder}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={invalid || props["aria-invalid"] || undefined}
        className={cn("t-num pr-12", className)}
        value={text}
        onChange={(event) => {
          const raw = event.target.value;
          const pasted = parseDateInput(raw) ?? parseDateInput(maskDateInput(raw));
          const display = pasted ? formatDateInput(pasted) : maskDateInput(raw);
          setText(display);
          setInvalid(display.length === 10 && !pasted);
          event.target.setCustomValidity(display.length === 10 && !pasted ? t.invalid : "");
          // Une date en cours de frappe garde la dernière valeur valide : le formulaire ne voit jamais de date à moitié.
          if (pasted && pasted !== iso) commit(pasted);
          if (!display && iso) commit("");
        }}
        onBlur={(event) => {
          if (text && !parseDateInput(text) && text.length < 10) setText(formatDateInput(iso));
          props.onBlur?.(event);
        }}
      />
      {readOnly || disabled ? null : (
        <button
          ref={trigger}
          type="button"
          aria-label={t.open}
          aria-haspopup="dialog"
          onClick={open}
          className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-[10px] hover:bg-raise"
        >
          <Calendar aria-hidden className="size-5" />
        </button>
      )}
      <div
        ref={panel}
        popover="auto"
        role="dialog"
        aria-label={t.open}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
        }}
        className="on-card fixed m-0 overflow-hidden rounded-card border border-card-line bg-card p-0 text-fg shadow-lg"
      >
        <div className="tartan-band">
          <div className="flex items-center justify-between gap-1 px-1 pt-1">
            <button
              type="button"
              className={iconButton}
              aria-label={years ? t.previousYears : t.previousMonth}
              onClick={() =>
                setView(years ? { ...view, year: view.year - YEARS_PER_PAGE } : shiftMonth(view.year, view.month, -1))
              }
            >
              <ChevronLeft aria-hidden className="size-5" />
            </button>
            <button
              type="button"
              aria-expanded={years}
              aria-label={`${t.chooseYear}, ${t.months[view.month - 1]} ${view.year}`}
              onClick={() => setYears((old) => !old)}
              className="min-h-11 flex-1 rounded-button font-display text-[24px] font-semibold leading-none hover:bg-raise"
            >
              {years ? `${yearStart} – ${yearStart + YEARS_PER_PAGE - 1}` : `${t.months[view.month - 1]} ${view.year}`}
            </button>
            <button
              type="button"
              className={iconButton}
              aria-label={years ? t.nextYears : t.nextMonth}
              onClick={() =>
                setView(years ? { ...view, year: view.year + YEARS_PER_PAGE } : shiftMonth(view.year, view.month, 1))
              }
            >
              <ChevronRight aria-hidden className="size-5" />
            </button>
          </div>
          <div aria-hidden className="mt-1 h-0.5 bg-lane" />
          <div aria-hidden className="mt-1 h-0.5 bg-lane" />
          <div aria-hidden className="h-1" />
        </div>
        <div className="p-3">
          {years ? (
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: YEARS_PER_PAGE }, (_, index) => yearStart + index).map((year) => (
                <button
                  key={year}
                  type="button"
                  aria-pressed={year === view.year}
                  onClick={() => {
                    setView({ ...view, year });
                    setYears(false);
                  }}
                  className={cn(
                    "t-num min-h-11 rounded-button font-semibold",
                    year === view.year ? "bg-cta text-on-cta" : "hover:bg-raise",
                  )}
                >
                  {year}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div aria-hidden className="grid grid-cols-7 pb-1 text-center">
                {t.weekdays.map((day) => (
                  <span key={day} className="t-caption text-soft">
                    {day}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-0.5">
                {monthGrid(view.year, view.month).map((day) => {
                  const outside = monthOf(day).month !== view.month;
                  const selected = day === shown;
                  const allowed = isDateInRange(day, min, max);
                  const tabTarget = day === (focusDay ?? shown ?? today);
                  return (
                    <button
                      key={day}
                      type="button"
                      data-day={day}
                      tabIndex={tabTarget ? 0 : -1}
                      disabled={!allowed}
                      aria-label={dayLabel(day)}
                      aria-pressed={selected}
                      aria-current={day === today ? "date" : undefined}
                      onClick={() => choose(day)}
                      onKeyDown={(event) => onGridKey(event, day)}
                      className={cn(
                        "t-num mx-auto flex size-11 items-center justify-center rounded-full text-[16px] disabled:opacity-30",
                        selected ? "bg-cta font-semibold text-on-cta" : "hover:bg-raise",
                        !selected && outside && "text-soft",
                        !selected && day === today && "border-2 border-cta font-semibold",
                      )}
                    >
                      {Number(day.slice(8))}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={!isDateInRange(today, min, max)}
              onClick={() => choose(today)}
              className="min-h-11 rounded-button px-3 font-semibold text-ctx-link underline underline-offset-4 disabled:opacity-40"
            >
              {t.today}
            </button>
            {canClear ? (
              <button
                type="button"
                onClick={() => {
                  commit("");
                  setText("");
                  close();
                }}
                className="min-h-11 rounded-button px-3 font-semibold underline underline-offset-4"
              >
                {t.clear}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

// Une date et une heure séparées ; la valeur reste au format attendu par le formulaire.
export const DateTimeInput = ({
  value,
  onChange,
  id,
  ...props
}: {
  value: string;
  onChange: (event: { target: { value: string } }) => void;
  id?: string;
} & Pick<ComponentProps<"input">, "aria-describedby" | "aria-invalid">) => {
  const [date = "", time = ""] = value.split("T");
  const emit = (nextDate: string, nextTime: string) =>
    onChange({ target: { value: nextDate ? `${nextDate}T${nextTime || "08:00"}` : "" } });
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
      <DateInput {...props} id={id} value={date} onChange={(event) => emit(event.target.value, time)} />
      <Input
        type="time"
        aria-label={m.builder.scheduleAt}
        value={time}
        onChange={(event) => emit(date, event.target.value)}
      />
    </div>
  );
};
