import { PluginSettingTab, Setting, type Plugin } from "obsidian";

interface SymbolSettingsHost extends Plugin {
  customSymbols: string;
  saveSymbols(source: string): Promise<void>;
}

export class SymbolSettingsTab extends PluginSettingTab {
  constructor(private readonly host: SymbolSettingsHost) {
    super(host.app, host);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    let draft = this.host.customSymbols;
    const setting = new Setting(containerEl)
      .setName("Custom symbols")
      .setDesc("One per line: name = LaTeX. Names use letters and numbers, starting with a letter. Names are case-sensitive.");
    setting.settingEl.addClass("asciimath-symbols-setting");
    setting.addTextArea(text => {
      text.setPlaceholder("symbol = LaTeX")
        .setValue(draft)
        .onChange(value => { draft = value; status.setText(""); });
      text.inputEl.setAttribute("aria-label", "Custom symbol mappings");
      text.inputEl.spellcheck = false;
    });
    const status = containerEl.createEl("p", { cls: "asciimath-symbols-status" });
    status.setAttribute("aria-live", "polite");
    new Setting(containerEl)
      .setDesc("Use LaTeX without dollar signs. Save to update open notes.")
      .addButton(button => button.setButtonText("Save symbols").setCta().onClick(async () => {
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
      }));
  }
}
