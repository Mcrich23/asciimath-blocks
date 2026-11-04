import AsciiMathParser from "asciimath2tex";

function expandColumnVectors(source: string): string {
  if (!source.includes(";")) return source;
  const stack = [{ open: "", rows: [""] }];
  const append = (value: string) => {
    const rows = stack[stack.length - 1].rows;
    rows[rows.length - 1] += value;
  };
  const close = (right: string) => {
    const { open, rows } = stack.pop()!;
    const content = open === "[" && right === "]" && rows.length > 1 && rows.every(row => row.trim())
      ? rows.map(row => `(${row})`).join(",")
      : rows.join(";");
    append(open + content + right);
  };
  let end = 0;
  const tokens = source.matchAll(/"[^"]*"|(?:text|mbox)\s*(?:\([^)]*\)|\{[^}]*\}|\[[^\]]*\])|[()[\]{};]/g);
  for (const match of tokens) {
    append(source.slice(end, match.index));
    const token = match[0];
    if (token === "(" || token === "[" || token === "{") stack.push({ open: token, rows: [""] });
    else if ((token === ")" || token === "]" || token === "}") && stack.length > 1) close(token);
    else if (token === ";" && stack[stack.length - 1].open === "[") stack[stack.length - 1].rows.push("");
    else append(token);
    end = match.index + token.length;
  }
  append(source.slice(end));
  while (stack.length > 1) close("");
  return stack[0].rows[0];
}

/** Small compatibility fixes around the upstream parser, without changing notes. */
export default class MathParser extends AsciiMathParser {
  override setup_symbols(): void {
    super.setup_symbols();
    // A native unary function keeps grouping, fractions, and nesting intact.
    this.unary_symbols.push({
      asciimath: "highlight",
      tex: "\\bbox[yellow,2px,color:black]",
    });
  }

  override escape_text(source: string): string {
    // A bare tilde becomes a nonbreaking space in MathJax's TeX text mode.
    return super.escape_text(source).replace(/~/g, "\\(\\textasciitilde\\)");
  }

  override arbitrary_constant(pos = 0) {
    const token = super.arbitrary_constant(pos);
    if (!token) return token;
    // Upstream consumes one UTF-16 unit, splitting letters such as 𝐶 in half.
    const point = (this.source(token.end - 1, token.end + 1) as string).codePointAt(0);
    if (point === undefined || point <= 0xFFFF) return token;
    return { ...token, tex: String.fromCodePoint(point), end: token.end + 1 };
  }

  override matrix(pos = 0) {
    const matrix = super.matrix(pos);
    if (matrix?.rows.length === 1) {
      const inner = this.matrix(matrix.left.end);
      if (inner) {
        const right = this.right_bracket(inner.end) || this.leftright_bracket(inner.end, "right");
        if (right?.end === matrix.end) return;
      }
    }
    return matrix;
  }

  override parse(source: string): string {
    // Preserve text labels. Elsewhere, ignore pasted glyph selectors and give
    // Unicode minus its normal grammar (including negative powers/arguments).
    const expression = source.replace(
      /"[^"]*"|(?:text|mbox)\s*(?:\([^)]*\)|\{[^}]*\}|\[[^\]]*\])|−|[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/gu,
      token => {
        if (/^(?:"|text|mbox)/.test(token)) return token;
        // Spaces keep >−1 from becoming the different AsciiMath relation >-.
        return token === "−" ? " - " : "";
      },
    );
    return super.parse(expandColumnVectors(expression));
  }
}
