/* eslint-disable @next/next/no-img-element -- Satori dessine l'image : next/image n'y existe pas. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { athletePaint } from "@tartan/design-tokens/athletes";
import { tokens } from "@tartan/design-tokens";
import { formatDayMonth, m } from "@tartan/i18n";
import { athleteRig } from "@tartan/mascot/athletes";
import { POSES } from "@tartan/mascot/poses";
import { svgAthlete } from "@tartan/mascot/svg";
import { ImageResponse } from "next/og";
import { disciplineAthlete } from "@/lib/discipline-athlete";
import { dataUri, figureSvg } from "@/lib/figure-svg";

// La carte de record : une image portrait, au format des stories et des messageries, que l'athlète partage depuis
// son téléphone. Le prénom, la discipline, la marque, la date, et l'athlète de l'épreuve qui lève les bras.
export const CARD = { width: 1080, height: 1350 } as const;


export const formatMark = (mark: number, unit: string) => `${String(mark).replace(".", ",")} ${unit}`;

export const recordCardImage = async (card: {
  firstName: string;
  discipline: string;
  mark: number;
  unit: string;
  date: string;
}) => {
  const [condensed, barlow, logo] = await Promise.all([
    // Des chemins écrits en entier : le traçage du déploiement n'embarque que ces fichiers.
    readFile(path.join(process.cwd(), "assets/fonts/BarlowCondensed_700Bold.ttf")),
    readFile(path.join(process.cwd(), "assets/fonts/Barlow_600SemiBold.ttf")),
    readFile(path.join(process.cwd(), "public/brand/logo-on-dark.svg")),
  ]);
  const id = disciplineAthlete(card.discipline);
  const athlete = figureSvg(
    svgAthlete(athleteRig(id, "joy"), POSES.cheer, athletePaint(id, "piste")),
    "-140 -262 280 422",
  );
  const { band, color } = tokens;
  const lane = { display: "flex", width: "100%", height: 10, backgroundColor: band.lane };
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: band.background,
        color: band.text,
        fontFamily: "Barlow",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", padding: "72px 80px 0", gap: 28 }}>
        <img src={dataUri(logo.toString())} height={72} width={258} alt="" />
        <div style={{ display: "flex", fontSize: 44, marginTop: 56 }}>{m.recordCard.label}</div>
        <div
          style={{
            display: "flex",
            fontFamily: "Barlow Condensed",
            fontSize: card.discipline.length > 18 ? 72 : 104,
            lineHeight: 1,
          }}
        >
          {card.discipline}
        </div>
        <div style={{ display: "flex" }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Barlow Condensed",
              fontSize: 230,
              lineHeight: 1,
              padding: "8px 28px 0",
              borderRadius: 24,
              backgroundColor: band.action,
              color: band.onAction,
            }}
          >
            {formatMark(card.mark, card.unit)}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 44 }}>
          {m.recordCard.byline(card.firstName, `${formatDayMonth(card.date)} ${card.date.slice(0, 4)}`)}
        </div>
      </div>
      <div style={{ display: "flex", flex: 1 }} />
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 96px" }}>
        <img src={dataUri(athlete)} width={292} height={440} alt="" />
      </div>
      <div style={{ ...lane }} />
      <div style={{ display: "flex", height: 26 }} />
      <div style={{ ...lane }} />
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: "20px 80px 32px",
          fontSize: 36,
          color: color.white,
        }}
      >
        {m.recordCard.site}
      </div>
    </div>,
    {
      ...CARD,
      fonts: [
        { name: "Barlow Condensed", data: condensed, weight: 700, style: "normal" },
        { name: "Barlow", data: barlow, weight: 600, style: "normal" },
      ],
    },
  );
};
