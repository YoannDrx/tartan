"use client";

import Image, { type StaticImageData } from "next/image";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { Laptop, Phone } from "./device-frame";

export type ShowcaseItem = {
  key: string;
  tab: string;
  title: string;
  body: string;
  alt: string;
  image: StaticImageData;
};

// Les écrans d'un côté de l'app, un onglet par écran : la capture dans son appareil, puis ce qu'elle apporte. Sur
// téléphone, la capture précède toujours son texte (DESIGN.md). Un seul écran à la fois : les autres captures ne se
// chargent qu'à leur tour. Flèches, Début et Fin parcourent les onglets, comme le veut le motif des onglets.
export const FeatureShowcase = ({
  label,
  items,
  device,
  priority = false,
}: {
  label: string;
  items: readonly ShowcaseItem[];
  device: "laptop" | "phone";
  priority?: boolean;
}) => {
  const id = useId();
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const choose = (index: number) => {
    const next = (index + items.length) % items.length;
    setActive(next);
    tabs.current[next]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: active + 1,
      ArrowDown: active + 1,
      ArrowLeft: active - 1,
      ArrowUp: active - 1,
      Home: 0,
      End: items.length - 1,
    };
    const to = moves[event.key];
    if (to === undefined) return;
    event.preventDefault();
    choose(to);
  };

  const Device = device === "laptop" ? Laptop : Phone;
  return (
    <div className="mt-8 desktop:mt-12">
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <button
            key={item.key}
            ref={(node) => {
              tabs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${item.key}`}
            aria-selected={index === active}
            aria-controls={`${id}-panel-${item.key}`}
            tabIndex={index === active ? 0 : -1}
            onClick={() => setActive(index)}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border-2 px-4 text-[15px] font-semibold transition-colors duration-(--duration-quick) ease-reception",
              index === active
                ? "border-accent bg-accent text-on-accent"
                : "border-on-page text-on-page hover:bg-raise",
            )}
          >
            {item.tab}
          </button>
        ))}
      </div>
      {items.map((item, index) => (
        <div
          key={item.key}
          role="tabpanel"
          id={`${id}-panel-${item.key}`}
          aria-labelledby={`${id}-tab-${item.key}`}
          hidden={index !== active}
          className={cn(
            "mt-6 grid gap-6 desktop:mt-10 desktop:items-center desktop:gap-12",
            device === "laptop"
              ? "desktop:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] desktop:gap-10"
              : "tablet:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] tablet:items-center tablet:gap-10",
          )}
        >
          <Device
            className={cn("showcase-screen", device === "phone" && "mx-auto w-[86%] max-w-[340px] tablet:w-full")}
          >
            <Image
              src={item.image}
              alt={item.alt}
              sizes={
                device === "laptop"
                  ? "(min-width: 1200px) 760px, (min-width: 1024px) 66vw, 92vw"
                  : "(min-width: 768px) 320px, 80vw"
              }
              priority={priority && index === 0}
              className="block h-auto w-full"
            />
          </Device>
          <div>
            <h3 className="text-balance font-display text-[32px] font-bold leading-[36px] desktop:text-[40px] desktop:leading-[44px]">
              {item.title}
            </h3>
            <p className="mt-3 max-w-[46ch] text-[17px] leading-[25px]">{item.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
