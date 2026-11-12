import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { LaneNumber } from "@/components/lane-number";
import { GameLauncher } from "@/features/game/game-launcher";
import { PublicPage } from "@/features/shell/public-page";

export const metadata: Metadata = {
  title: m.game.title,
  description: m.game.description,
  alternates: { canonical: "https://tartan.coach/jeu" },
  openGraph: {
    title: m.game.title,
    description: m.game.description,
    url: "https://tartan.coach/jeu",
    images: [{ url: "https://tartan.coach/brand/og-jeu.png", width: 1200, height: 630, alt: m.game.title }],
  },
};

// Tartan Meeting : le jeu du site, sans compte ni donnée envoyée. Le record reste sur l'appareil.
export default function GamePage() {
  return (
    <PublicPage title={m.game.title} lead={m.game.lead} site width="wide">
      <div className="flex max-w-[960px] flex-col gap-10">
        <GameLauncher />
        <section aria-labelledby="regles" className="flex max-w-[960px] flex-col gap-4">
          <h2 id="regles" className="t-h2">
            {m.game.howTitle}
          </h2>
          <div className="grid gap-8 tablet:grid-cols-2 desktop:grid-cols-3">
            {(["hurdles", "longJump", "tripleJump", "highJump", "poleVault"] as const).map((id) => (
              <section key={id} aria-labelledby={`regles-${id}`} className="flex flex-col gap-3">
                <h3 id={`regles-${id}`} className="t-section">
                  {m.game.events[id].title}
                </h3>
                <ol className="flex flex-col gap-2">
                  {m.game.events[id].how.map((line, index) => (
                    <li key={line} className="flex items-baseline gap-3">
                      <LaneNumber n={index + 1} className="text-[24px]" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
          <p className="text-soft">{m.game.pauseHint}</p>
        </section>
      </div>
    </PublicPage>
  );
}
