export type { Material, Story, AlchemyRecord, Reflection, StorylineBeat, MaterialKind } from "./store";
import type { Material } from "./store";

export interface MaterialWithBody extends Material {
  body: string;
}
