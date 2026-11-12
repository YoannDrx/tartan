"use client";

import { m } from "@tartan/i18n";
import { ATHLETE_IDS, ATHLETES, type AthleteId } from "@tartan/mascot/athletes";
import { CLIPS } from "@tartan/mascot/events";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { EventScene } from "@/components/event-scene";
import { LaneNumber } from "@/components/lane-number";
import { useReducedMotion } from "@/lib/use-reduced-motion";

// Le geste reste sur sa dernière image un instant avant de passer la main.
const HOLD = 0.2;

// Un athlète et son épreuve. Un seul joue son geste à la fois ; les autres restent sur leur image la plus parlante.
const GroupCard = memo(function GroupCard({
  id,
  playing,
  onDone,
}: {
  id: AthleteId;
  playing: boolean;
  onDone: () => void;
}) {
  const clip = CLIPS[id];
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (!playing) return;
    let at = 0;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      at += (now - last) / clip.duration;
      last = now;
      if (at > 1 + HOLD) {
        at = 0;
        onDone();
      }
      setTime(Math.min(1, at));
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, clip.duration, onDone]);

  return (
    <li data-athlete={id} className="w-[62vw] max-w-[250px] shrink-0 snap-center desktop:w-auto desktop:max-w-none">
      <EventScene aria-hidden id={id} t={playing ? time : clip.still} focus={290} className="w-full rounded-card" />
      <p className="mt-3 flex items-center gap-3">
        <LaneNumber n={ATHLETES[id].bib} className="text-[40px]" />
        <span className="leading-tight">
          <span className="block font-display text-[26px] font-semibold leading-7">{m.group.events[id]}</span>
          <span className="block font-medium">{m.group.athletes[id]}</span>
        </span>
      </p>
    </li>
  );
});

// Le groupe : une bande qui défile de côté sur téléphone, les six de front sur ordinateur.
// Sur téléphone, l'athlète au centre joue son geste. Quand tous tiennent à l'écran, ils se relaient.
export const GroupBand = () => {
  const band = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const [scrollable, setScrollable] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const list = band.current;
    if (!list) return;
    const nearest = () => {
      const middle = list.scrollLeft + list.clientWidth / 2;
      const cards = Array.from(list.children) as HTMLElement[];
      const gaps = cards.map((card) => Math.abs(card.offsetLeft + card.offsetWidth / 2 - middle));
      setActive(gaps.indexOf(Math.min(...gaps)));
    };
    const measure = () => {
      const scrolls = list.scrollWidth > list.clientWidth + 8;
      setScrollable(scrolls);
      if (scrolls) nearest();
    };
    const onScroll = () => {
      if (list.scrollWidth > list.clientWidth + 8) nearest();
    };
    const sight = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), {
      threshold: 0.35,
    });
    const size = new ResizeObserver(measure);
    measure();
    sight.observe(list);
    size.observe(list);
    list.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      sight.disconnect();
      size.disconnect();
      list.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Tous à l'écran : le suivant prend le relais. En bande qui défile, celui du centre rejoue.
  const next = useCallback(() => {
    if (!scrollable) setActive((index) => (index + 1) % ATHLETE_IDS.length);
  }, [scrollable]);

  return (
    <ul
      ref={band}
      tabIndex={0}
      aria-label={m.landing.group.label}
      className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 desktop:mx-0 desktop:grid desktop:grid-cols-6 desktop:overflow-visible desktop:px-0"
    >
      {ATHLETE_IDS.map((id, index) => (
        <GroupCard key={id} id={id} playing={visible && !reduced && index === active} onDone={next} />
      ))}
    </ul>
  );
};
