import type { ExerciseGuide, SnapshotItem } from "@tartan/contracts";
import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { config } from "./config";
import { WEEK_MS } from "./query-client";

// Versioned first-party illustrations are public. No athlete data or signed video URL is cached here.
export const guideIllustrationQuery = (guide: ExerciseGuide) =>
  queryOptions({
    queryKey: ["exercise-guide-illustration", config.apiUrl, guide.illustration.path],
    staleTime: Infinity,
    gcTime: WEEK_MS,
    queryFn: async ({ signal }) => {
      const response = await fetch(`${config.apiUrl}${guide.illustration.path}`, { signal });
      if (!response.ok || !response.headers.get("content-type")?.includes("image/svg+xml"))
        throw new Error("guide_illustration_unavailable");
      const xml = await response.text();
      if (xml.length > 500_000 || !/<svg\b/.test(xml)) throw new Error("guide_illustration_invalid");
      return xml;
    },
  });

export const prefetchSessionIllustrations = (
  client: QueryClient,
  session: { blocks: readonly { items: readonly Pick<SnapshotItem, "guide">[] }[] },
) =>
  Promise.all(
    session.blocks.flatMap((block) =>
      block.items.flatMap((item) =>
        item.guide?.illustration.status === "ready" ? [client.prefetchQuery(guideIllustrationQuery(item.guide))] : [],
      ),
    ),
  );
