import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";

export interface MathRange {
  from: number;
  to: number;
  contentFrom: number;
  contentTo: number;
  display: boolean;
}

/** Native tokens exclude code examples, escaped dollars, and incomplete math. */
export function mathRanges(state: EditorState, complete = false): MathRange[] {
  const tree = complete ? ensureSyntaxTree(state, state.doc.length, 100) : syntaxTree(state);
  if (!tree) return [];
  const ranges: MathRange[] = [];
  let opening: { from: number; to: number } | undefined;
  tree.iterate({
    enter(node) {
      if (node.name.includes("formatting-math-begin")) {
        opening = { from: node.from, to: node.to };
      } else if (opening && node.name.includes("formatting-math-end")) {
        if (opening.to - opening.from === node.to - node.from) {
          ranges.push({
            from: opening.from,
            to: node.to,
            contentFrom: opening.to,
            contentTo: node.from,
            display: opening.to - opening.from > 1,
          });
        }
        opening = undefined;
      }
    },
  });
  return ranges;
}
