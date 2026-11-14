import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { EXERCISE_CATALOG } from "@tartan/domain/exercise-catalog";
import { guideIllustrationQuery, prefetchSessionIllustrations } from "./exercise-guide-media";

vi.mock("./config", () => ({ config: { apiUrl: "https://preview.example.test" } }));
vi.mock("./query-client", () => ({ WEEK_MS: 604_800_000 }));
afterEach(() => vi.unstubAllGlobals());

describe("cache natif du guide", () => {
  it("précharge les illustrations disponibles une fois et ignore celles encore en préparation", async () => {
    const guide = EXERCISE_CATALOG[0]!.guide;
    const ready = { ...guide, illustration: { ...guide.illustration, status: "ready" as const } };
    const fetcher = vi.fn().mockResolvedValue(
      new Response('<svg viewBox="0 0 10 10"></svg>', {
        headers: { "Content-Type": "image/svg+xml" },
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const client = new QueryClient();
    await prefetchSessionIllustrations(client, { blocks: [{ items: [{ guide }] }] });
    expect(fetcher).not.toHaveBeenCalled();
    await prefetchSessionIllustrations(client, { blocks: [{ items: [{ guide: ready }, { guide: ready }, {}] }] });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(guideIllustrationQuery(ready).queryKey)).toContain("<svg");
    client.clear();
  });
  it("réutilise le SVG téléchargé sans réseau pour une occurrence répétée", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response('<svg viewBox="0 0 10 10"></svg>', { headers: { "Content-Type": "image/svg+xml" } }),
      );
    vi.stubGlobal("fetch", fetcher);
    const client = new QueryClient();
    const query = guideIllustrationQuery(EXERCISE_CATALOG[0]!.guide);
    const first = await client.fetchQuery(query);
    fetcher.mockRejectedValue(new TypeError("offline"));
    expect(await client.fetchQuery(query)).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toMatch(/^https:\/\/preview\.example\.test\/exercise-guides\//);
    client.clear();
  });
  it.each([
    [404, "image/svg+xml", "missing"],
    [200, "text/html", "<html>Connexion</html>"],
    [200, "image/svg+xml", "invalid"],
    [200, "image/svg+xml", "<svg>" + " ".repeat(500_001) + "</svg>"],
  ])("ne conserve pas une réponse invalide (%s, %s)", async (status, contentType, body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status, headers: { "Content-Type": contentType } })),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const query = guideIllustrationQuery(EXERCISE_CATALOG[0]!.guide);
    await expect(client.fetchQuery(query)).rejects.toThrow(/guide_illustration_/);
    expect(client.getQueryData(query.queryKey)).toBeUndefined();
    client.clear();
  });
});
