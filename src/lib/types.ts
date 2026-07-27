export type {
  Material,
  Story,
  AlchemyRecord,
  Reflection,
  MaterialKind,
  IdeaCard,
  IdeaOrigin,
  IdeaDecision,
  StoryShelf,
  StoryShelfSlot,
  DecisionEntry,
  SourceRelation,
  FirstThought,
} from "./store";
import type { Material } from "./store";

export interface MaterialWithBody extends Material {
  body: string;
}
