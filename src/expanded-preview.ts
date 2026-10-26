import { debounce, finishRenderMath, MarkdownView, renderMath, type Plugin } from "obsidian";
import { noteMath } from "./note-math.ts";
import type { toLatex } from "./math.ts";

/** Native rendered sections carry the note path and source line numbers. */
export function registerExpandedPreview(plugin: Plugin, convert: typeof toLatex): void {
  const refresh = debounce(() => {
    plugin.app.workspace.getLeavesOfType("markdown").forEach(leaf => {
      if (leaf.view instanceof MarkdownView && leaf.view.getMode() === "preview") leaf.view.previewMode.rerender(true);
    });
  }, 150, true);
  plugin.register(() => refresh.cancel());
  plugin.registerEvent(plugin.app.workspace.on("editor-change", editor => {
    if (editor.getValue().includes("exp")) refresh();
  }));
  plugin.registerMarkdownPostProcessor(async (element, context) => {
    const maths = [
      ...(element.matches(".math") ? [element] : []),
      ...Array.from(element.querySelectorAll<HTMLElement>(".math")),
    ];
    if (!maths.length) return;
    const file = plugin.app.vault.getFileByPath(context.sourcePath);
    if (!file) return;
    const view = plugin.app.workspace.getLeavesOfType("markdown")
      .map(leaf => leaf.view)
      .find((view): view is MarkdownView => view instanceof MarkdownView && view.file?.path === file.path && view.getMode() === "source");
    const source = view?.editor.getValue() ?? await plugin.app.vault.cachedRead(file);
    if (!source.includes("exp")) return;
    const ranges = noteMath(source);
    const used = new Set<number>();
    for (const math of maths) {
      const info = context.getSectionInfo(math);
      if (!info) continue;
      const start = source.split("\n").slice(0, info.lineStart).join("\n").length + (info.lineStart ? 1 : 0);
      const end = source.split("\n").slice(0, info.lineEnd + 1).join("\n").length;
      const index = ranges.findIndex((range, index) => !used.has(index) && range.from >= start && range.from <= end);
      if (index < 0) continue;
      used.add(index);
      const range = ranges[index];
      if (!range.source.includes("exp")) continue;
      try {
        const tex = convert(range.source, range.display, ranges.slice(0, index).map(range => range.source));
        math.replaceChildren(renderMath(tex, range.display));
      } catch (error) {
        console.error("Could not expand AsciiMath:", error);
      }
    }
    await finishRenderMath();
  }, 200);
}
