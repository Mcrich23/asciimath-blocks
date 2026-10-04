import { loadMathJax, Notice, Plugin } from "obsidian";
import { installAsciiMath, type MathJaxRuntime } from "./mathjax.ts";
import { refreshMath } from "./refresh.ts";
import { registerConversionCommands } from "./commands.ts";
import { mathPreviewExtension } from "./editor-preview.ts";
import { createMathConverter, parseCustomSymbols } from "./math.ts";
import { SymbolSettingsTab } from "./settings.ts";

export default class AsciiMathBlocks extends Plugin {
  private unloaded = false;
  private converter = createMathConverter();
  customSymbols = "";

  async onload(): Promise<void> {
    try {
      const data: unknown = await this.loadData();
      if (this.unloaded) return;
      if (data && typeof data === "object" && "customSymbols" in data && typeof data.customSymbols === "string") {
        this.customSymbols = data.customSymbols;
      }
      this.converter = createMathConverter(parseCustomSymbols(this.customSymbols));
    } catch (error) {
      console.error("Could not load custom symbols:", error);
      new Notice("Could not load custom symbols. Check AsciiMath Blocks settings.");
    }
    this.addSettingTab(new SymbolSettingsTab(this));
    registerConversionCommands(this, (source, display) => this.converter.toLatex(source, display));
    try {
      await loadMathJax();
      if (this.unloaded) return;

      const runtime = (window as Window & { MathJax?: MathJaxRuntime }).MathJax;
      if (!runtime) throw new Error("MathJax did not load.");

      const removeFilter = installAsciiMath(runtime, source => this.converter.toTex(source));
      this.registerEditorExtension(mathPreviewExtension);
      this.register(() => {
        removeFilter();
        refreshMath(this.app.workspace);
      });
      this.app.workspace.onLayoutReady(() => {
        if (!this.unloaded) refreshMath(this.app.workspace);
      });
    } catch (error) {
      console.error("AsciiMath Blocks could not start:", error);
      new Notice("AsciiMath Blocks could not start. Try reloading Obsidian.");
    }
  }

  async saveSymbols(source: string): Promise<void> {
    const converter = createMathConverter(parseCustomSymbols(source));
    await this.saveData({ customSymbols: source });
    this.customSymbols = source;
    this.converter = converter;
    refreshMath(this.app.workspace);
  }

  onunload(): void {
    this.unloaded = true;
  }
}
