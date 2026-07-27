import { notFound } from "next/navigation";
import { getStory, listFirstThoughts, listIdeaCards, listMaterials, readStoryBody } from "../../../lib/store";
import { StoryEditor } from "./StoryEditor";

export const dynamic = "force-dynamic";

export default async function StoryEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [story, materials, ideas, firstThoughts] = await Promise.all([
    getStory(id),
    listMaterials(),
    listIdeaCards(),
    listFirstThoughts(),
  ]);
  if (!story) notFound();
  const body = await readStoryBody(id);

  return (
    <StoryEditor
      story={{ ...story, body }}
      materials={materials}
      ideas={ideas}
      firstThoughts={firstThoughts}
    />
  );
}
