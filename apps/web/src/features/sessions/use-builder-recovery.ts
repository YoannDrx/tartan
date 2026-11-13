"use client";

import { sessionDraft, sessionDraftBlock, sessionSequence, athleteOverrideInput } from "@tartan/contracts";
import { z } from "zod";
import { useEffect, useRef, useState } from "react";

// Une saisie incomplète se conserve aussi : les exigences de publication restent
// dans le contrat serveur. La profondeur et la taille restent bornées ici.
const [exercise, recovery, repeat] = sessionSequence.element.options;
const editableRecovery = recovery.extend({ durationS: z.number().min(0).max(3600) });
const repeatFields = { name: z.string().max(80), rounds: z.number().min(0).max(50) };
const inner = repeat.extend({ ...repeatFields, children: z.array(z.union([exercise, editableRecovery])).max(60) });
const outer = repeat.extend({
  ...repeatFields,
  children: z.array(z.union([exercise, editableRecovery, inner])).max(60),
});
const editableSequence = z.array(z.union([exercise, editableRecovery, outer])).max(60);
export const recoveryForm = z.object({
  draft: sessionDraft.extend({
    title: z.string().max(120),
    blocks: z
      .array(sessionDraftBlock.extend({ name: z.string().max(80), sequence: editableSequence.optional() }))
      .max(12),
  }),
  date: z.string().max(40),
  startTime: z.string().max(20),
  location: z.string().max(120),
  duration: z.string().max(20),
  scheduling: z.boolean(),
  publishAt: z.string().max(50),
  groups: z.array(z.string()).max(200),
  athletes: z.array(z.string()).max(200),
  overrides: z.array(athleteOverrideInput).max(500),
  expectedVersion: z.number().optional(),
});
export type RecoveryForm = z.infer<typeof recoveryForm>;
const envelope = z.object({ revision: z.string(), expiresAt: z.number(), pending: z.boolean(), form: recoveryForm });
type Stored = z.infer<typeof envelope>;
export const BUILDER_RECOVERY_PREFIX = "tartan.builder.web.";
const TTL = 7 * 24 * 3600 * 1000;

const read = (key: string): Stored | null => {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  if (raw.length > 500_000) throw new Error("draft_too_large");
  const saved = envelope.parse(JSON.parse(raw));
  if (saved.expiresAt <= Date.now()) {
    localStorage.removeItem(key);
    return null;
  }
  return saved;
};

export function useBuilderRecovery(
  userId: string,
  organizationId: string,
  sessionId: string | undefined,
  form: RecoveryForm,
  dirty: boolean,
) {
  const key = `${BUILDER_RECOVERY_PREFIX}${userId}.${organizationId}.${sessionId ?? "new"}`;
  const [candidate, setCandidate] = useState<Stored | null>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<"saving" | "saved" | "error" | "idle">("idle");
  const revision = useRef<string | null>(null);
  const paused = useRef(false);
  useEffect(() => {
    paused.current = false;
    const stop = () => {
      paused.current = true;
    };
    window.addEventListener("tartan:clear-builder-drafts", stop);
    return () => {
      paused.current = true;
      window.removeEventListener("tartan:clear-builder-drafts", stop);
    };
  }, []);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const currentForm = JSON.stringify(form);
  useEffect(() => {
    try {
      const saved = read(key);
      revision.current = saved?.revision ?? null;
      // La copie locale est proposée, jamais injectée silencieusement dans le serveur.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCandidate(saved);
      setReady(!saved);
    } catch {
      setState("error");
    }
  }, [key]);

  const persist = (value: RecoveryForm, pending: boolean) => {
    const operation = queue.current
      .catch(() => undefined)
      .then(async () => {
        if (!navigator.locks) throw new Error("draft_lock_unavailable");
        await navigator.locks.request(key, () => {
          if (paused.current) throw new Error("draft_account_closed");
          if ((read(key)?.revision ?? null) !== revision.current) throw new Error("draft_conflict");
          const saved = envelope.parse({
            revision: crypto.randomUUID(),
            expiresAt: Date.now() + TTL,
            pending,
            form: value,
          });
          localStorage.setItem(key, JSON.stringify(saved));
          revision.current = saved.revision;
        });
      });
    queue.current = operation;
    return operation;
  };
  useEffect(() => {
    if (!ready || !dirty) return;
    // Pas de délai : l'état n'affiche « conservé » qu'après l'écriture effective.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState("saving");
    let current = true;
    void persist(JSON.parse(currentForm), false)
      .then(() => {
        if (current) setState("saved");
      })
      .catch(() => {
        if (current) setState("error");
      });
    return () => {
      current = false;
    };
    // persist passe par la file et la révision communes ; seule la donnée sérialisée déclenche l'écriture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentForm, dirty, ready, key]);
  const clear = async () => {
    await queue.current.catch(() => undefined);
    if (!navigator.locks) throw new Error("draft_lock_unavailable");
    await navigator.locks.request(key, () => {
      if ((read(key)?.revision ?? null) !== revision.current) throw new Error("draft_conflict");
      localStorage.removeItem(key);
      revision.current = null;
    });
    setCandidate(null);
    setReady(true);
    setState("idle");
  };
  return {
    candidate,
    state,
    accept: () => {
      setCandidate(null);
      setReady(true);
    },
    discard: clear,
    beforeSubmit: () => persist(form, true).catch(() => setState("error")),
    saved: () => clear().catch(() => setState("error")),
  };
}
