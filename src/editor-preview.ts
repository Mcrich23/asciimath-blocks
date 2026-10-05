import { StateEffect, StateField, type EditorState, type Extension, type Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet } from "@codemirror/view";
import { editorLivePreviewField, finishRenderMath, renderMath } from "obsidian";
import { mathRanges } from "./math-ranges.ts";

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

function decorations(state: EditorState, focused: boolean, revision: number): DecorationSet {
  const livePreview = state.field(editorLivePreviewField, false) ?? false;
  // Native Live Preview already keeps a rendered block below its editable source.
  if (livePreview) return Decoration.none;
  const result: Range<Decoration>[] = [];
  for (const range of mathRanges(state)) {
    const active = focused && state.selection.ranges.some(selection =>
      selection.from <= range.to && selection.to >= range.from);
    const source = state.doc.sliceString(range.contentFrom, range.contentTo);
    if (active && range.display) {
      // A direct StateField decoration can add a block below the closing $$.
      result.push(Decoration.widget({
        widget: new MathWidget(source, true, null, revision), block: true, side: 1,
      }).range(range.to));
    } else if (!active) {
      result.push(Decoration.replace({
        widget: new MathWidget(source, range.display, range.contentFrom, revision), block: range.display,
      }).range(range.from, range.to));
    }
  }
  return Decoration.set(result, true);
}

const focusEffect = StateEffect.define<boolean>();
export const refreshMathPreview = StateEffect.define<null>();
const previewField = StateField.define<{ focused: boolean; revision: number; decorations: DecorationSet }>({
  create(state) { return { focused: false, revision: 0, decorations: decorations(state, false, 0) }; },
  update(value, transaction) {
    const focused = transaction.effects.reduce((current, effect) =>
      effect.is(focusEffect) ? effect.value : current, value.focused);
    const revision = value.revision + (transaction.effects.some(effect => effect.is(refreshMathPreview)) ? 1 : 0);
    return { focused, revision, decorations: decorations(transaction.state, focused, revision) };
  },
  provide: field => EditorView.decorations.from(field, value => value.decorations),
});

export const mathPreviewExtension: Extension = [
  previewField,
  ViewPlugin.define(view => {
    // Editor extensions can be enabled while the editor is already focused.
    let alive = true;
    queueMicrotask(() => {
      if (alive) view.dispatch({ effects: focusEffect.of(view.hasFocus) });
    });
    return { destroy() { alive = false; } };
  }),
  EditorView.updateListener.of(update => {
    if (update.focusChanged) update.view.dispatch({ effects: focusEffect.of(update.view.hasFocus) });
  }),
];
