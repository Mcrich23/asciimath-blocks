import { ButtonComponent, PluginSettingTab, Setting, type Plugin } from "obsidian";

interface SymbolSettingsHost extends Plugin {
  customSymbols: string;
  saveSymbols(source: string): Promise<void>;
}

export class SymbolSettingsTab extends PluginSettingTab {
  constructor(private readonly host: SymbolSettingsHost) {
    super(host.app, host);
  }

  // Obsidian 1.13+ indexes these definitions for settings search.
  getSettingDefinitions() {
    return [{
      name: "Custom symbols",
      desc: "One per line: name = LaTeX. Names are case-sensitive and use letters and numbers, starting with a letter. Use LaTeX without dollar signs.",
      aliases: ["AsciiMath", "LaTeX", "symbol mappings"],
      render: (setting: Setting) => this.renderSymbols(setting),
    }];
  }

  // Older versions use the same definitions and renderer without the new API.
  display(): void {
    this.containerEl.empty();
    for (const definition of this.getSettingDefinitions()) {
      const setting = new Setting(this.containerEl)
        .setName(definition.name)
        .setDesc(definition.desc);
      definition.render(setting);
    }
  }

  private renderSymbols(setting: Setting): void {
    let draft = this.host.customSymbols;
    setting.settingEl.addClass("asciimath-symbols-setting");
    setting.addTextArea(text => {
      text.setPlaceholder("symbol = LaTeX")
        .setValue(draft)
        .onChange(value => { draft = value; status.setText(""); });
      text.inputEl.setAttribute("aria-label", "Custom symbol mappings");
      text.inputEl.spellcheck = false;
    });
    const actions = setting.controlEl.createDiv({ cls: "asciimath-symbols-actions" });
    const status = actions.createEl("p", { cls: "asciimath-symbols-status" });
    status.setAttribute("aria-live", "polite");
    const button = new ButtonComponent(actions)
      .setButtonText("Save symbols").setCta().onClick(async () => {
        button.setDisabled(true);
        status.removeClass("asciimath-symbols-error");
        try {
          await this.host.saveSymbols(draft);
          status.setText("Symbols saved.");
        } catch (error) {
          status.addClass("asciimath-symbols-error");
          status.setText(error instanceof Error ? error.message : "Could not save symbols. Try again.");
        } finally {
          button.setDisabled(false);
        }
      });
  }
}
