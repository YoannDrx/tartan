"use client";

import { useState } from "react";
import { strengthCalculator } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { Sheet, SheetSection } from "@/components/sheet";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const number = (value: number, digits = 4) => value.toLocaleString("fr-FR", { maximumFractionDigits: digits });
export const StrengthCalculator = ({ referenceKg, stepKg = 1.25 }: { referenceKg?: number; stepKg?: number }) => {
  const [load, setLoad] = useState("");
  const [reps, setReps] = useState("");
  const [reference, setReference] = useState(referenceKg === undefined ? "" : String(referenceKg));
  const result = strengthCalculator({ load, reps, reference }, stepKg);
  return (
    <Sheet className="divide-y divide-card-line">
      <SheetSection title={m.calculator.estimateTitle}>
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={m.calculator.load}
              hint={m.calculator.loadHint}
              error={result.errors.load ? m.calculator.invalidKg : undefined}
            >
              {(props) => (
                <Input
                  {...props}
                  inputMode="decimal"
                  maxLength={16}
                  value={load}
                  onChange={(event) => setLoad(event.target.value)}
                />
              )}
            </Field>
            <Field label={m.calculator.reps} error={result.errors.reps ? m.calculator.invalidReps : undefined}>
              {(props) => (
                <Input
                  {...props}
                  inputMode="numeric"
                  maxLength={3}
                  value={reps}
                  onChange={(event) => setReps(event.target.value)}
                />
              )}
            </Field>
          </div>
          <p className="text-soft t-caption font-normal">{m.calculator.formula}</p>
          <div aria-live="polite" role="status">
            {result.estimate === null ? (
              <p className="text-soft">{m.calculator.estimateEmpty}</p>
            ) : (
              <p>
                {result.measured ? m.calculator.measured : m.calculator.estimate} :{" "}
                <strong className="t-num text-2xl">{number(result.estimate, 2)} kg</strong>
              </p>
            )}
          </div>
          <Button
            variant="secondary"
            className="self-start whitespace-normal text-left"
            disabled={!result.canUseEstimate}
            onClick={() => result.estimate !== null && setReference(result.estimate.toFixed(2))}
          >
            {m.calculator.useEstimate}
          </Button>
        </div>
      </SheetSection>
      <SheetSection title={m.calculator.tableTitle}>
        <div className="flex flex-col gap-4">
          <Field
            label={m.calculator.reference}
            hint={m.calculator.referenceHint}
            error={result.errors.reference ? m.calculator.invalidKg : undefined}
          >
            {(props) => (
              <Input
                {...props}
                inputMode="decimal"
                maxLength={16}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            )}
          </Field>
          <p className="text-soft t-caption font-normal">{m.calculator.step(number(stepKg))}</p>
          {result.rows.length ? (
            <table className="w-full table-fixed text-right tabular-nums">
              <caption className="sr-only">{m.calculator.tableTitle}</caption>
              <thead>
                <tr className="border-b border-card-line">
                  <th scope="col" className="py-2 text-left">
                    {m.calculator.percent}
                  </th>
                  <th scope="col" className="py-2">
                    {m.calculator.exact}
                  </th>
                  <th scope="col" className="py-2">
                    {m.calculator.rounded}
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.percent} className="border-b border-card-line last:border-0">
                    <th scope="row" className="py-2 text-left font-normal">
                      {row.percent} %
                    </th>
                    <td className="py-2">{number(row.exactKg)}</td>
                    <td className="py-2 font-semibold">{number(row.roundedKg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-soft">{m.calculator.tableEmpty}</p>
          )}
        </div>
      </SheetSection>
    </Sheet>
  );
};
