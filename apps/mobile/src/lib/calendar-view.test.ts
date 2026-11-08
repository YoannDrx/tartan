import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: async () => null, setItem: async () => undefined },
}));
vi.mock("./api", () => ({ api: {} }));
vi.mock("./queries", () => ({ useMe: () => ({}) }));

const { nativeView, reconcileCalendarView } = await import("./calendar-view");
const { isPersistedCalendarRange } = await import("./calendar-range");

describe("vue du calendrier sur téléphone", () => {
  it("lit la semaine de l'ordinateur comme la liste", () => {
    expect(nativeView("week")).toBe("list");
    expect(nativeView("month")).toBe("month");
    expect(nativeView(null)).toBe("list");
  });

  it("adopte un choix plus récent venu d'un autre appareil", () => {
    expect(
      reconcileCalendarView(
        { view: "list", updatedAt: "2030-06-10T10:00:00.000Z", dirty: false },
        { calendarView: "month", calendarViewUpdatedAt: "2030-06-11T10:00:00.000Z" },
      ),
    ).toEqual({ view: "month", updatedAt: "2030-06-11T10:00:00.000Z", dirty: false });
  });

  it("garde un choix local plus récent, encore à envoyer", () => {
    expect(
      reconcileCalendarView(
        { view: "month", updatedAt: "2030-06-12T10:00:00.000Z", dirty: true },
        { calendarView: "list", calendarViewUpdatedAt: "2030-06-11T10:00:00.000Z" },
      ),
    ).toBeNull();
  });

  it("ne garde en cache que le mois courant et ses voisins", () => {
    const today = "2026-11-15";
    expect(isPersistedCalendarRange("2026-11-02", "2026-11-08", today)).toBe(true);
    expect(isPersistedCalendarRange("2026-12-01", "2026-12-31", today)).toBe(true);
    expect(isPersistedCalendarRange("2026-06-01", "2026-06-30", today)).toBe(false);
    expect(isPersistedCalendarRange("2027-03-01", "2027-03-31", today)).toBe(false);
  });
});
