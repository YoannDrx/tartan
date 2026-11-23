import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// Les appareils de la page d'accueil, dessinés ici en CSS : un ordinateur portable pour le coach, un téléphone pour
// l'athlète. Aucune image ni marque d'un fabricant ; les couleurs sont les encres de `packages/design-tokens`. La
// capture reste brute (`images/provenance.json`) : le cadre l'entoure, il n'est jamais incrusté dans le PNG. Toutes
// les mesures suivent la largeur de l'appareil (`cqw`), pour qu'il garde ses proportions de 320 à 1 200 px.

// Ordinateur portable : un écran 16:10 dans son cadre, la caméra au-dessus, le socle plus large que l'écran.
export const Laptop = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("@container", className)}>
    <div className="mx-[4.5cqw] rounded-t-[2.2cqw] bg-ink-3 px-[0.7cqw] pt-[0.7cqw]">
      <div className="relative rounded-t-[1.6cqw] bg-ink px-[1.8cqw] pb-[2.2cqw] pt-[2.2cqw]">
        <span aria-hidden className="absolute left-1/2 top-[0.8cqw] size-[0.7cqw] -translate-x-1/2 rounded-full bg-ink-3" />
        <div className="overflow-hidden rounded-[0.3cqw] bg-ink">{children}</div>
      </div>
    </div>
    <div aria-hidden className="relative h-[2.4cqw] rounded-b-[2.4cqw] rounded-t-[0.4cqw] bg-ink-2">
      <span className="absolute left-1/2 top-0 h-[0.8cqw] w-[15cqw] -translate-x-1/2 rounded-b-[0.8cqw] bg-ink-3" />
    </div>
  </div>
);

// Téléphone : bords arrondis, un cadre fin, les boutons sur les tranches. Une capture de la web app commence sous la
// barre d'état : l'appareil la réserve, vide, avec l'îlot de la caméra. Une capture du simulateur la porte déjà
// (`statusBar={false}`). Aucune heure ni icône inventée.
export const Phone = ({
  children,
  className,
  statusBar = true,
}: {
  children: ReactNode;
  className?: string;
  statusBar?: boolean;
}) => (
  <div className={cn("@container", className)}>
    <div className="relative mx-[1.4cqw]">
      <span aria-hidden className="absolute -left-[1.4cqw] top-[17%] h-[4.5%] w-[1.6cqw] rounded-l-[0.8cqw] bg-ink-3" />
      <span aria-hidden className="absolute -left-[1.4cqw] top-[24%] h-[8%] w-[1.6cqw] rounded-l-[0.8cqw] bg-ink-3" />
      <span aria-hidden className="absolute -left-[1.4cqw] top-[34%] h-[8%] w-[1.6cqw] rounded-l-[0.8cqw] bg-ink-3" />
      <span aria-hidden className="absolute -right-[1.4cqw] top-[27%] h-[12%] w-[1.6cqw] rounded-r-[0.8cqw] bg-ink-3" />
      <div className="relative rounded-[16cqw] bg-ink-3 p-[1.2cqw]">
        <div className="rounded-[14.8cqw] bg-ink p-[2.4cqw]">
          <div className="overflow-hidden rounded-[12.4cqw] bg-ink">
            {statusBar ? (
              <div aria-hidden className="flex h-[11cqw] items-start justify-center pt-[2.6cqw]">
                <span className="h-[7.4cqw] w-[28cqw] rounded-full bg-ink-2" />
              </div>
            ) : null}
            {children}
          </div>
        </div>
      </div>
    </div>
  </div>
);
