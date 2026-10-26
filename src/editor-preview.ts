import { StateEffect, StateField, type EditorState, type Extension, type Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet } from "@codemirror/view";
import { editorLivePreviewField, finishRenderMath, renderMath } from "obsidian";
import { mathRanges } from "./math-ranges.ts";
import type { toLatex } from "./math.ts";

class MathWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly display: boolean,
    readonly editAt: number | null,
    readonly revision: number,
  ) { super(); }

  eq(other: MathWidget): boolean {
    return this.source === other.source && this.display === other.display
      && this.editAt === other.editAt && this.revision === other.revision;
  }

  toDOM(view: EditorView): HTMLElement {
    const element = createEl(this.display ? "div" : "span", {
      cls: this.display ? "asciimath-preview asciimath-preview-block" : "asciimath-preview",
    });
    element.appendChild(renderMath(this.source, this.display));
    void finishRenderMath().then(() => view.requestMeasure());
    const editAt = this.editAt;
    if (editAt !== null) {
      element.title = "Click to edit math";
      element.addEventListener("mousedown", event => {
        event.preventDefault();
        view.dispatch({ selection: { anchor: editAt } });
        view.focus();
      });
    } else {
      element.setAttribute("aria-label", "Math preview");
    }
    return element;
  }
}

function decorations(state: EditorState, focused: boolean, revision: number, convert: typeof toLatex): DecorationSet {
  const livePreview = state.field(editorLivePreviewField, false) ?? false;
  // Native Live Preview already keeps a rendered block below its editable source.
  if (livePreview) return Decoration.none;
  const result: Range<Decoration>[] = [];
  const previous: string[] = [];
  for (const range of mathRanges(state, true)) {
    const active = focused && state.selection.ranges.some(selection =>
      selection.from <= range.to && selection.to >= range.from);
    const source = state.doc.sliceString(range.contentFrom, range.contentTo);
    const expanded = source.includes("exp");
    let rendered = source;
    if (expanded) {
      try { rendered = convert(source, range.display, previous); }
      catch { rendered = String.raw`\text{Unable to expand AsciiMath. Check this expression.}`; }
    }
    previous.push(source);
    if (active && range.display) {
      // A direct StateField decoration can add a block below the closing $$.
      result.push(Decoration.widget({
        widget: new MathWidget(rendered, true, null, revision), block: true, side: 1,
      }).range(range.to));
    } else if (!active) {
      result.push(Decoration.replace({
        widget: new MathWidget(rendered, range.display, range.contentFrom, revision), block: range.display,
      }).range(range.from, range.to));
    }
  }
  return Decoration.set(result, true);
}

const focusEffect = StateEffect.define<boolean>();
export const refreshMathPreview = StateEffect.define<null>();
export function mathPreviewExtension(convert: typeof toLatex): Extension {
  const previewField = StateField.define<{ focused: boolean; revision: number; decorations: DecorationSet }>({
    create(state) { return { focused: false, revision: 0, decorations: decorations(state, false, 0, convert) }; },
    update(value, transaction) {
      const focused = transaction.effects.reduce((current, effect) =>
        effect.is(focusEffect) ? effect.value : current, value.focused);
      const revision = value.revision + (transaction.effects.some(effect => effect.is(refreshMathPreview)) ? 1 : 0);
      return { focused, revision, decorations: decorations(transaction.state, focused, revision, convert) };
    },
    provide: field => EditorView.decorations.from(field, value => value.decorations),
  });

  return [
    previewField,
    ViewPlugin.define(view => {
      // Editor extensions can be enabled while the editor is already focused.
      let alive = true;
      queueMicrotask(() => {
        if (alive) view.dispatch({ effects: focusEffect.of(view.hasFocus) });
      });
      return { destroy() { alive = false; } };
    }),
    ViewPlugin.define(view => {
      interface NativeWidget {
        math: string;
        block: boolean;
        start: number;
        actionsEl?: HTMLElement;
        render(element: HTMLElement): void;
      }
      const originals = new Map<NativeWidget, NativeWidget["render"]>();
      const rendered = new WeakMap<HTMLElement, string>();
      let frame = 0;
      let alive = true;
      const refresh = () => {
        frame = 0;
        if (!alive || !view.state.field(editorLivePreviewField, false)) return;
        const visible = new Set<NativeWidget>();
        view.dom.querySelectorAll<HTMLElement>(".math").forEach(element => {
          const native = element as HTMLElement & {
            cmView?: { widget?: NativeWidget };
            cmTile?: { widget?: NativeWidget };
          };
          const widget = native.cmTile?.widget ?? native.cmView?.widget;
          if (!widget || typeof widget.math !== "string" || !widget.math.includes("exp")
            || typeof widget.render !== "function") return;
          visible.add(widget);
          if (!originals.has(widget)) {
            originals.set(widget, widget.render);
            // Native widgets retain their source, positions, and click-to-edit actions.
            widget.render = element => {
              const ranges = mathRanges(view.state, true);
              const index = ranges.findIndex(range => range.contentFrom <= widget.start && widget.start <= range.contentTo);
              if (index < 0) { originals.get(widget)?.call(widget, element); return; }
              try {
                const previous = ranges.slice(0, index).map(range => view.state.doc.sliceString(range.contentFrom, range.contentTo));
                const tex = convert(widget.math, widget.block, previous);
                if (rendered.get(element) === tex && element.querySelector("mjx-container")) return;
                element.toggleClass("math-block", widget.block);
                element.toggleClass("cm-embed-block", widget.block);
                element.replaceChildren(renderMath(tex, widget.block));
                rendered.set(element, tex);
                if (widget.actionsEl) element.appendChild(widget.actionsEl);
                void finishRenderMath().then(() => { if (alive) view.requestMeasure(); });
              } catch {
                originals.get(widget)?.call(widget, element);
              }
            };
          }
          widget.render(element);
        });
        originals.forEach((render, widget) => {
          if (!visible.has(widget)) { widget.render = render; originals.delete(widget); }
        });
      };
      const schedule = () => { if (!frame) frame = view.dom.win.requestAnimationFrame(refresh); };
      schedule();
      return {
        update() { schedule(); },
        destroy() {
          alive = false;
          if (frame) view.dom.win.cancelAnimationFrame(frame);
          originals.forEach((render, widget) => { widget.render = render; });
        },
      };
    }),
    EditorView.updateListener.of(update => {
      if (update.focusChanged) update.view.dispatch({ effects: focusEffect.of(update.view.hasFocus) });
    }),
  ];
}
