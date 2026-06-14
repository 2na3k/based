import { describe, expect, test } from "bun:test";
import {
  citationFootnotes,
  defaultNoteMetadata,
  markdownExcerptsForTarget,
  mergeNoteMarkdown,
  parseNoteMarkdown,
  serializeNoteFrontmatter,
  slugifyNoteTitle,
  wikiLinkTargets,
} from "./documents";
import type { KnowledgeDocument } from "./types";

function doc(id: number, title: string, source = ""): KnowledgeDocument {
  return {
    id,
    type: "paper",
    title,
    source,
    tags: [],
    createdAt: "2026-06-13T00:00:00.000Z",
    originalName: title,
    storedPath: "",
    size: 0,
    pinned: false,
  };
}

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

  test("generates citation footnotes from linked documents", () => {
    const citations = citationFootnotes("[[Paper A]] and [[Web B]]", [doc(1, "Paper A", "paper.pdf"), doc(2, "Web B", "https://example.com")]);

    expect(citations).toContain("[^cite-1]: Paper A, paper.pdf.");
    expect(citations).toContain("[^cite-2]: Web B, https://example.com.");
  });

  test("creates safe note slugs", () => {
    expect(slugifyNoteTitle("My Note: LLMs & Memory!")).toBe("my-note-llms-memory");
    expect(slugifyNoteTitle("   ")).toBe("untitled");
  });
});
