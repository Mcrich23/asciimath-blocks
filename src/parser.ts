import AsciiMathParser from "asciimath2tex";

/** Small compatibility fixes around the upstream parser, without changing notes. */
export default class MathParser extends AsciiMathParser {
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
    return super.parse(expression);
  }
}
