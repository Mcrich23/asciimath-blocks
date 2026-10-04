import type { EditorView } from "@codemirror/view";
import { refreshMathPreview } from "./editor-preview.ts";
import { MarkdownView, type Editor, type Workspace } from "obsidian";

interface NativeMathElement extends HTMLElement {
  cmView?: {
    widget?: {
      render?: (element: HTMLElement) => void;
    };
  };
}

/** Refresh cached output after settings or lifecycle changes, without editing notes. */
export function refreshMath(workspace: Workspace): void {
  workspace.getLeavesOfType("markdown").forEach(leaf => {
    if (!(leaf.view instanceof MarkdownView)) return;
    leaf.view.previewMode.rerender(true);
    const cm = (leaf.view.editor as Editor & { cm?: EditorView }).cm;
    cm?.dispatch({ effects: refreshMathPreview.of(null) });

    // Obsidian caches native Live Preview widgets. This optional internal hook
    // redraws those widgets while preserving their click handlers and layout.
    // New expressions still use the MathJax filter if this hook changes upstream.
    leaf.view.containerEl
      .querySelectorAll<NativeMathElement>(".markdown-source-view .math")
      .forEach(element => {
        const widget = element.cmView?.widget;
        if (typeof widget?.render === "function") {
          widget.render(element);
        }
      });
  });
}
