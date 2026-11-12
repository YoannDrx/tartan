"use client";

import { m } from "@tartan/i18n";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

// Le classement du jeu, côté joueur. Rien n'est envoyé tant que le classement est fermé ; ouvert, seul un pseudo
// part avec le journal des appuis, que le serveur rejoue.

const t = m.game.leaderboard;
const DEVICE_KEY = "tartan.jeu.appareil";

// Un identifiant d'appareil tiré au hasard, gardé dans le navigateur : il permet l'effacement sans compte.
export const deviceId = (): string => {
  try {
    const stored = window.localStorage.getItem(DEVICE_KEY);
    if (stored) return stored;
    const created = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
};

export type Row = { rank: number; pseudo: string; score: number; at: string };

export const fetchLeaderboard = async (event: string, period: "week" | "all") => {
  const response = await fetch(`/api/v1/game/leaderboard?event=${event}&period=${period}`);
  if (!response.ok) return { enabled: false, rows: [] as Row[] };
  return (await response.json()) as { enabled: boolean; rows: Row[] };
};

// Le départ d'un essai classé : la graine vient du serveur. Classement fermé : `null`, la partie reste locale.
export const startRankedRun = async (event: string): Promise<{ token: string; seed: number } | null> => {
  const response = await fetch("/api/v1/game/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, device: deviceId() }),
  }).catch(() => null);
  if (!response?.ok) return null;
  return (await response.json()) as { token: string; seed: number };
};

export const ScoreEntry = ({ token, log, onSaved }: { token: string; log: number[]; onSaved: () => void }) => {
  const [pseudo, setPseudo] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const submit = async () => {
    setPending(true);
    const response = await fetch("/api/v1/game/scores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, device: deviceId(), pseudo, log }),
    }).catch(() => null);
    setPending(false);
    const body = (await response?.json().catch(() => null)) as { saved?: boolean; message?: string } | null;
    if (!response?.ok) return toast.error(body?.message ?? m.common.genericError);
    setSent(true);
    toast.ok(body?.saved ? t.saved : t.notSaved);
    onSaved();
  };
  if (sent) return null;
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Field label={t.pseudo} hint={t.pseudoHint}>
        {(a) => (
          <Input
            {...a}
            value={pseudo}
            maxLength={16}
            autoComplete="nickname"
            onChange={(e) => setPseudo(e.target.value)}
          />
        )}
      </Field>
      <Button type="submit" disabled={pending || pseudo.trim().length < 3}>
        {t.submit}
      </Button>
    </form>
  );
};

export const Leaderboard = ({
  event,
  format,
  refresh,
}: {
  event: string;
  format: (score: number) => string;
  refresh: number;
}) => {
  const [period, setPeriod] = useState<"week" | "all">("week");
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    let live = true;
    void fetchLeaderboard(event, period).then((data) => live && setRows(data.rows));
    return () => {
      live = false;
    };
  }, [event, period, refresh]);
  const erase = useCallback(async () => {
    const response = await fetch("/api/v1/game/scores", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ device: deviceId() }),
    }).catch(() => null);
    const body = (await response?.json().catch(() => null)) as { erased?: number } | null;
    if (response?.ok) toast.ok(t.erased(body?.erased ?? 0));
    setRows(null);
    void fetchLeaderboard(event, period).then((data) => setRows(data.rows));
  }, [event, period]);
  return (
    <section aria-labelledby="classement" className="on-card flex flex-col gap-3 rounded-card bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="classement" className="t-h2">
          {t.title}
        </h2>
        <div className="flex gap-2">
          {(["week", "all"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={period === value}
              onClick={() => setPeriod(value)}
              className={cn(
                "min-h-11 rounded-full px-4 font-medium",
                period === value ? "bg-accent text-on-accent" : "border border-pill-line bg-pill-off text-inherit",
              )}
            >
              {value === "week" ? t.week : t.all}
            </button>
          ))}
        </div>
      </div>
      {rows && rows.length === 0 ? <p className="text-soft">{t.empty}</p> : null}
      {rows && rows.length > 0 ? (
        <ol className="divide-y divide-card-line">
          {rows.map((row) => (
            <li key={`${row.rank}-${row.pseudo}`} className="flex items-baseline gap-3 py-2">
              <span className="t-num w-8 text-right">{row.rank}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{row.pseudo}</span>
              <span className="t-num">{format(row.score)}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <p className="t-caption font-normal text-soft">{t.privacy}</p>
      <div>
        <Button type="button" size="sm" variant="secondary" onClick={erase}>
          {t.erase}
        </Button>
      </div>
    </section>
  );
};
