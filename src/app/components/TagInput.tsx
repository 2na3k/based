import { useId, useMemo, useState } from "react";
import { parseTags } from "../lib/documents";

interface TagInputProps {
  value: string;
  onChange: (value: string) => void;
}

function tagsToValue(tags: string[]) {
  return tags.join(", ");
}

export function TagInput({ value, onChange }: TagInputProps) {
  const inputId = useId();
  const tags = useMemo(() => parseTags(value), [value]);
  const [draft, setDraft] = useState("");

  function commitDraft(nextDraft = draft) {
    const nextTags = parseTags(nextDraft);
    if (!nextTags.length) {
      setDraft("");
      return;
    }
    onChange(tagsToValue(Array.from(new Set([...tags, ...nextTags]))));
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(tagsToValue(tags.filter((current) => current !== tag)));
  }

  return (
    <div className="tag-input-wrap">
      <div className="tag-input" onClick={() => document.getElementById(inputId)?.focus()}>
        {tags.map((tag) => (
          <span key={tag} className="tag-token">
            #{tag}
          </span>
        ))}
        <input
          id={inputId}
          placeholder={tags.length ? "" : "research notes"}
          value={draft}
          onBlur={() => commitDraft()}
          onChange={(event) => {
            const nextValue = event.target.value;
            if (/[\s,]$/.test(nextValue)) {
              commitDraft(nextValue);
              return;
            }
            setDraft(nextValue);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft();
            }
            if (event.key === "Backspace" && !draft && tags.length) {
              event.preventDefault();
              const lastTag = tags.at(-1);
              if (lastTag) removeTag(lastTag);
            }
          }}
        />
      </div>
    </div>
  );
}
