import MathParser from "./parser.ts";

export interface CustomSymbol {
  name: string;
  tex: string;
}

/** A small, readable settings format; split only the first equals sign. */
export function parseCustomSymbols(source: string): CustomSymbol[] {
  const symbols: CustomSymbol[] = [];
  const names = new Set<string>();
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const separator = line.indexOf("=");
    const name = separator < 0 ? "" : line.slice(0, separator).trim();
    const tex = separator < 0 ? "" : line.slice(separator + 1).trim();
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name) || !tex) {
      throw new Error(`Line ${index + 1}: use name = LaTeX, with a name made of letters and numbers.`);
    }
    if (names.has(name)) throw new Error(`Line ${index + 1}: ${name} is defined more than once.`);
    names.add(name);
    symbols.push({ name, tex });
  }
  return symbols;
}

/** LaTeX commands outside AsciiMath text keep the expression in native TeX. */
export function isLatex(source: string): boolean {
  // Skip AsciiMath labels and its double-backslash symbol before detecting commands.
  const tokens = source.matchAll(/"[^"]*"|(?:text|mbox)\s*(?:\([^)]*\)|\{[^}]*\}|\[[^\]]*\])|\\\\|\\(?:[A-Za-z]+|[{}()[\],;!%#$&_])/g);
  for (const [token] of tokens) {
    if (token.startsWith("\\") && token !== "\\\\") return true;
  }
  return false;
}

/** Blank lines separate display rows only outside groups and text labels. */
function displayRows(source: string): string[] {
  const rows: string[] = [];
  let depth = 0;
  let start = 0;
  const tokens = source.matchAll(/"[^"]*"|(?:text|mbox)\s*(?:\([^)]*\)|\{[^}]*\}|\[[^\]]*\])|[()[\]{}]|\r?\n[\t ]*(?:\r?\n[\t ]*)+/g);
  for (const match of tokens) {
    const token = match[0];
    if (token === "(" || token === "[" || token === "{") depth++;
    else if (token === ")" || token === "]" || token === "}") depth = Math.max(0, depth - 1);
    else if (depth === 0 && /^[\r\n]/.test(token)) {
      rows.push(source.slice(start, match.index).trim());
      start = match.index + token.length;
    }
  }
  rows.push(source.slice(start).trim());
  return rows;
}

/** Each configuration gets a fresh parser so removed symbols cannot linger. */
export function createMathConverter(symbols: CustomSymbol[] = []) {
  const parser = new MathParser();
  const functions = new Set([...parser.unary_symbols, ...parser.binary_symbols].map(symbol => symbol.asciimath));
  functions.add("text");
  functions.add("mbox");
  for (const symbol of symbols) {
    if (functions.has(symbol.name)) throw new Error(`${symbol.name} is an AsciiMath function. Choose another name.`);
  }
  // Constants are native parser tokens, not replacements in the input string.
  // Group arbitrary LaTeX so powers and fractions apply to the whole symbol.
  const names = new Set(symbols.map(symbol => symbol.name));
  const constants = parser.constants as { asciimath: string; tex: string }[];
  parser.constants = [
    ...symbols.map(symbol => ({ asciimath: symbol.name, tex: `{${symbol.tex}}` })),
    ...constants.filter(symbol => !names.has(symbol.asciimath)),
  ];
  parser.sort_symbols();

  function toTex(source: string, display = false): string {
    const expression = source.trim();
    // Native Live Preview can include quote prefixes in a block's render input.
    if (expression.startsWith(">")) {
      const latex = expression.replace(/^[\t ]*(?:>[\t ]*)+/gm, "").trim();
      if (isLatex(latex)) return latex;
    }
    if (isLatex(expression)) return expression;
    const rows = display ? displayRows(expression) : [expression];
    const converted = rows.map(row => parser.parse(row));
    return converted.length > 1
      ? `\\begin{gathered}${converted.join(" \\\\[1.15em] ")}\\end{gathered}`
      : converted[0];
  }

  function toLatex(source: string, display: boolean): string {
    if (isLatex(source)) return source.trim();
    return `\\${display ? "displaystyle" : "textstyle"}{${toTex(source, display)}}`;
  }

  return { toTex, toLatex };
}

// Keep the plain converter convenient for callers that do not need settings.
export const { toTex, toLatex } = createMathConverter();
