import { describe, expect, test } from "bun:test";
import {
  defaultNoteMetadata,
  markdownExcerptsForTarget,
  mergeNoteMarkdown,
  parseNoteMarkdown,
  serializeNoteFrontmatter,
  slugifyNoteTitle,
  wikiLinkTargets,
} from "./documents";

describe("note markdown helpers", () => {
  test("round-trips frontmatter metadata and body", () => {
    const metadata = defaultNoteMetadata({
      name: "Research note",
      description: "Small summary",
      tags: ["llm", "paper"],
      created: "2026-06-13T00:00:00.000Z",
    });
    const markdown = `${serializeNoteFrontmatter(metadata)}# Body`;

    expect(parseNoteMarkdown(markdown)).toEqual({
      metadata,
      body: "# Body",
    });
  });

  test("merges updated metadata without losing note body", () => {
    const markdown = `${serializeNoteFrontmatter(defaultNoteMetadata({ name: "Old" }))}Body`;
    const next = mergeNoteMarkdown(markdown, defaultNoteMetadata({ name: "New", tags: ["x"] }));

    expect(parseNoteMarkdown(next).metadata.name).toBe("New");
    expect(parseNoteMarkdown(next).metadata.tags).toEqual(["x"]);
    expect(parseNoteMarkdown(next).body).toBe("Body");
  });

  test("preserves leading blank lines when merging note metadata", () => {
    const markdown = `${serializeNoteFrontmatter(defaultNoteMetadata({ name: "Old" }))}\nBody`;
    const next = mergeNoteMarkdown(markdown, defaultNoteMetadata({ name: "New" }));

    expect(parseNoteMarkdown(next).body).toBe("\nBody");
  });

  test("parses wiki links and matching excerpts", () => {
    const markdown = "Use [[Source One]] here.\nIgnore [[Other]].\nAgain [[Source One|label]].";

    expect(wikiLinkTargets(markdown)).toEqual(["Source One", "Other"]);
    expect(markdownExcerptsForTarget(markdown, "Source One")).toEqual([
      "Use [[Source One]] here.",
      "Again [[Source One|label]].",
    ]);
  });

  test("creates safe note slugs", () => {
    expect(slugifyNoteTitle("My Note: LLMs & Memory!")).toBe("my-note-llms-memory");
    expect(slugifyNoteTitle("   ")).toBe("untitled");
  });
});
