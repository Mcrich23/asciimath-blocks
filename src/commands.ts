import type { EditorState } from "@codemirror/state";
import { Notice, type Editor, type EditorChange, type Plugin } from "obsidian";
import { isLatex, toLatex } from "./math.ts";
import { mathRanges, type MathRange } from "./math-ranges.ts";

function latexChange(
  editor: Editor, source: string, range: MathRange, convert: typeof toLatex,
): EditorChange | null {
  let content = source.slice(range.contentFrom, range.contentTo);
  const lineStart = source.lastIndexOf("\n", range.from - 1) + 1;
  const prefix = source.slice(lineStart, range.from);
  const quotePrefix = /^[\t ]*(?:>[\t ]*)+$/.test(prefix) ? prefix : "";
  if (quotePrefix) {
    const depth = quotePrefix.split(">").length - 1;
    content = content.replace(new RegExp(`^[\\t ]*(?:>[\\t ]*){${depth}}`, "gm"), "");
  }
  if (!content.trim() || isLatex(content)) return null;

  // Preserve the delimiters, outer whitespace, and blockquote structure.
  const leading = content.match(/^\s*/)?.[0] ?? "";
  const trailing = content.match(/\s*$/)?.[0] ?? "";
  let text = leading + convert(content, range.display) + trailing;
  if (quotePrefix) text = text.replace(/\n/g, `\n${quotePrefix}`);
  return {
    from: editor.offsetToPos(range.contentFrom),
    to: editor.offsetToPos(range.contentTo),
    text,
  };
}

export function registerConversionCommands(plugin: Plugin, convert: typeof toLatex = toLatex): void {
  const commands = [
    { id: "convert-current-math-to-latex", name: "Convert current math to LaTeX", all: false },
    { id: "convert-note-math-to-latex", name: "Convert all math in note to LaTeX", all: true },
  ];
  for (const command of commands) {
    plugin.addCommand({
      id: command.id,
      name: command.name,
      editorCheckCallback(checking, editor) {
        const source = editor.getValue();
        // Obsidian documents editor.cm access, but does not include it in its types.
        const cm = (editor as Editor & { cm?: { state: EditorState } }).cm;
        if (!cm) return false;
        let ranges = mathRanges(cm.state, true);
        if (!command.all) {
          const selections = editor.listSelections();
          if (selections.length !== 1) return false;
          const selection = selections[0];
          const anchor = editor.posToOffset(selection.anchor);
          const head = editor.posToOffset(selection.head);
          ranges = ranges.filter(range => range.from <= Math.max(anchor, head)
            && Math.min(anchor, head) <= range.to);
          if (ranges.length !== 1) return false;
        }
        try {
          const changes = ranges.map(range => latexChange(editor, source, range, convert))
            .filter((change): change is EditorChange => change !== null);
          if (changes.length === 0) return false;
          if (!checking) {
            // One transaction means one undo, even for a whole note.
            editor.transaction({ changes }, "asciimath-convert");
            new Notice(`Converted ${changes.length} math ${changes.length === 1 ? "expression" : "expressions"} to LaTeX.`);
          }
          return true;
        } catch (error) {
          if (!checking) {
            console.error("AsciiMath conversion failed:", error);
            new Notice("Could not convert this math. Check the expression and try again.");
          }
          return false;
        }
      },
    });
  }
}
