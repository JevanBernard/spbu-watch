"use client";

import { useEffect, useRef } from "react";
import type { StationDTO } from "@/lib/api-types";
import { NearbyCard } from "./StationCard";

export interface NearbyItem {
  station: StationDTO;
  /** Metres from the visitor, or null when the position is unknown. */
  distance: number | null;
}

/**
 * Nearby stations as a row of cards you swipe sideways (a column on wide screens). The card in the middle is the
 * one shown on the map; tapping a card opens its details. Ordered by distance only, never by stock.
 */
export default function NearbyCarousel({
  items,
  activeId,
  onActivate,
  onOpen,
}: {
  items: NearbyItem[];
  activeId: string | null;
  /** The reader swiped another card into the middle: show it on the map. */
  onActivate: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const row = useRef<HTMLUListElement>(null);
  const cards = useRef(new Map<string, HTMLLIElement>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // When the active station changes from outside (a pin was tapped), bring its card to the middle.
  useEffect(() => {
    const ul = row.current;
    const el = activeId ? cards.current.get(activeId) : null;
    if (!ul || !el) return;
    const target = el.offsetLeft - (ul.clientWidth - el.clientWidth) / 2;
    if (Math.abs(ul.scrollLeft - target) > 4) ul.scrollTo({ left: target, behavior: "smooth" });
  }, [activeId]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // After the swipe settles, the card closest to the middle becomes the active one.
  const onScroll = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const ul = row.current;
      if (!ul) return;
      const middle = ul.scrollLeft + ul.clientWidth / 2;
      let best: { id: string; gap: number } | null = null;
      for (const [id, el] of cards.current) {
        const gap = Math.abs(el.offsetLeft + el.clientWidth / 2 - middle);
        if (!best || gap < best.gap) best = { id, gap };
      }
      if (best && best.id !== activeId) onActivate(best.id);
    }, 140);
  };

  return (
    <ul
      ref={row}
      onScroll={onScroll}
      className="no-scrollbar relative flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-2 pb-2 md:block md:space-y-3 md:overflow-visible"
    >
      {items.map(({ station, distance }) => (
        <li
          key={station.id}
          ref={(el) => {
            if (el) cards.current.set(station.id, el);
            else cards.current.delete(station.id);
          }}
          className="w-[80%] max-w-xs shrink-0 snap-center md:w-full md:max-w-none"
        >
          <NearbyCard
            station={station}
            distance={distance}
            active={station.id === activeId}
            onOpen={() => onOpen(station.id)}
          />
        </li>
      ))}
    </ul>
  );
}
