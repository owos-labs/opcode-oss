import type { Vec2 } from "./visibility.ts";

/** Combat character on the 2D map: a single point (no radius, no footprint). */
export type CharacterActor = {
  id: string;
  position: Vec2;
};

export function actorPoint(actor: CharacterActor): Vec2 {
  return actor.position;
}
