import { describe, expect, it, vi } from "vitest";
import { createRestReminder } from "./rest-reminder";

const deps = () => {
  let n = 0;
  return {
    schedule: vi.fn(async (_at: number): Promise<string | null> => `rappel-${++n}`),
    cancel: vi.fn(async (_id: string) => undefined),
  };
};

describe("rappel de fin de récupération", () => {
  it("programme la notification à l'heure de fin quand l'app passe en arrière-plan", async () => {
    const d = deps();
    const reminder = createRestReminder(d);
    await reminder.background(90_000, 10_000);
    expect(d.schedule).toHaveBeenCalledWith(90_000);
    expect(reminder.scheduledId()).toBe("rappel-1");
  });

  it("ne programme rien sans récupération en cours, ni quand elle s'achève dans la seconde", async () => {
    const d = deps();
    const reminder = createRestReminder(d);
    await reminder.background(null, 10_000);
    await reminder.background(10_500, 10_000);
    await reminder.background(9_000, 10_000);
    expect(d.schedule).not.toHaveBeenCalled();
  });

  it("ne programme qu'un rappel, même si l'app passe deux fois hors du premier plan", async () => {
    const d = deps();
    const reminder = createRestReminder(d);
    await reminder.background(90_000, 10_000);
    await reminder.background(90_000, 11_000);
    expect(d.schedule).toHaveBeenCalledTimes(1);
  });

  it("retire le rappel au retour au premier plan", async () => {
    const d = deps();
    const reminder = createRestReminder(d);
    await reminder.background(90_000, 10_000);
    await reminder.clear();
    expect(d.cancel).toHaveBeenCalledWith("rappel-1");
    expect(reminder.scheduledId()).toBeNull();
  });

  it("retire aussitôt un rappel programmé après le retour au premier plan", async () => {
    let resolve: (id: string) => void = () => undefined;
    const d = {
      schedule: vi.fn(() => new Promise<string | null>((r) => (resolve = r))),
      cancel: vi.fn(async (_id: string) => undefined),
    };
    const reminder = createRestReminder(d);
    const pending = reminder.background(90_000, 10_000);
    await reminder.clear();
    resolve("tardif");
    await pending;
    expect(d.cancel).toHaveBeenCalledWith("tardif");
    expect(reminder.scheduledId()).toBeNull();
  });

  it("garde la vibration seule quand l'appareil refuse la notification", async () => {
    const d = { schedule: vi.fn(async () => null), cancel: vi.fn(async () => undefined) };
    const reminder = createRestReminder(d);
    await reminder.background(90_000, 10_000);
    expect(reminder.scheduledId()).toBeNull();
    await reminder.clear();
    expect(d.cancel).not.toHaveBeenCalled();
  });

  it("n'échoue pas quand la programmation lève une erreur", async () => {
    const d = { schedule: vi.fn(async () => Promise.reject(new Error("refus"))), cancel: vi.fn(async () => undefined) };
    const reminder = createRestReminder(d);
    await expect(reminder.background(90_000, 10_000)).resolves.toBeUndefined();
    expect(reminder.scheduledId()).toBeNull();
  });
});
