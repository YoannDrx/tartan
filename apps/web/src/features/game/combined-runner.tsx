"use client";

import { COMBINED_ORDER, type SimState, combinedTotal, pointsFor } from "@tartan/game";
import { m } from "@tartan/i18n";
import { type ComponentType, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import type { EventUi } from "./event-ui";

// Le combiné : les six épreuves à la suite, un essai chacune. Chaque marque devient des points (barème de
// packages/game), le total fait le record, gardé sur l'appareil.

const RECORD_KEY = "tartan.jeu.combine.record";
type Runner = ComponentType<{
  ui: EventUi<SimState>;
  onFinish?: (score: number) => void;
  finishAction?: React.ReactNode;
}>;

const readRecord = (): number | null => {
  try {
    const value = Number(window.localStorage.getItem(RECORD_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};

export default function CombinedRunner({ Runner, uis }: { Runner: Runner; uis: EventUi<SimState>[] }) {
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [record, setRecord] = useState<number | null>(readRecord);
  const done = scores.length === COMBINED_ORDER.length;
  const total = combinedTotal(scores);

  const finish = useCallback(
    (score: number) => {
      setScores((previous) => {
        const next = [...previous.slice(0, index), score];
        if (next.length === COMBINED_ORDER.length) {
          const sum = combinedTotal(next);
          const best = readRecord();
          if (best === null || sum > best) {
            try {
              window.localStorage.setItem(RECORD_KEY, String(sum));
            } catch {
              // Stockage bloqué : le record vaut pour la partie seulement.
            }
            setRecord(sum);
          }
        }
        return next;
      });
    },
    [index],
  );

  const ui = uis[index]!;
  const last = index === COMBINED_ORDER.length - 1;
  const next = (
    <Button type="button" onClick={() => setIndex((value) => value + 1)} className="min-h-16 min-w-40 text-[20px]">
      {m.game.combined.next(m.game.events[COMBINED_ORDER[index + 1] ?? "discus"].title)}
    </Button>
  );
  const restart = (
    <Button
      type="button"
      onClick={() => {
        setScores([]);
        setIndex(0);
      }}
      className="min-h-16 min-w-40 text-[20px]"
    >
      {m.game.combined.again}
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <p className="t-h2">
        {m.game.combined.step(index + 1, COMBINED_ORDER.length, m.game.events[COMBINED_ORDER[index]!].title)}
      </p>
      <Runner key={ui.id} ui={ui} onFinish={finish} finishAction={last ? restart : next} />
      <section aria-labelledby="combine-points" className="on-card rounded-card bg-card p-4">
        <h2 id="combine-points" className="t-h2">
          {m.game.combined.points}
        </h2>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 tablet:grid-cols-3">
          {COMBINED_ORDER.map((event, position) => (
            <div key={event}>
              <dt className="t-caption font-normal text-soft">{m.game.events[event].title}</dt>
              <dd className="t-num text-[20px]">
                {scores[position] === undefined ? "–" : String(pointsFor(event, scores[position]))}
              </dd>
            </div>
          ))}
        </dl>
        <p role="status" className="mt-3 font-semibold">
          {done ? m.game.combined.total(total) : m.game.combined.running(total)}
        </p>
        <p className="mt-1 text-soft">
          {record === null ? m.game.noRecord : m.game.combined.record(record)} {m.game.recordNote}
        </p>
      </section>
    </div>
  );
}
