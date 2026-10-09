import assert from "node:assert/strict";
import { test } from "node:test";
import { createMathConverter, parseCustomSymbols, isLatex, toLatex, toTex } from "../src/math.ts";
import { installAsciiMath, type MathJaxRuntime } from "../src/mathjax.ts";

test("converts representative AsciiMath expressions", () => {
  const examples = [
    ["\n (a+b)/(c+d) \n", "\\frac{a + b}{c + d}"],
    ["sqrt(x)", "\\sqrt{x}"],
    ["sin^2 theta + cos^2 theta = 1", "\\sin^{2}{\\theta} + \\cos^{2}{\\theta} = 1"],
    ["sum_(n=1)^oo 1/n^2 = pi^2/6", "\\sum_{n = 1}^{\\infty} \\frac{1}{n^{2}} = \\frac{\\pi^{2}}{6}"],
    ["[[1,2],[3,4]]", "\\left [ \\begin{matrix} 1 & 2 \\\\ 3 & 4 \\end{matrix} \\right ]"],
    ["", ""],
  ];
  for (const [source, expected] of examples) {
    assert.equal(toTex(source!), expected);
  }
});

test("tildes remain visible in text labels and survive LaTeX conversion", () => {
  for (const label of ['"~"', "text(~)", "text{~}", "text[~]", "mbox(~)"]) {
    assert.equal(toTex(label), String.raw`\text{\(\textasciitilde\)}`);
    const latex = toLatex(label, false);
    assert.equal(toTex(latex), latex);
  }
  const source = 'text(a ~ b ~~ c) + x';
  assert.equal(toTex(source, true), String.raw`\text{a \(\textasciitilde\) b \(\textasciitilde\)\(\textasciitilde\) c} + x`);
  assert.equal(toTex("a ~ b"), "a ~ b");
  assert.equal(toTex(String.raw`\text{a ~ b}`), String.raw`\text{a ~ b}`);
});

test("inline and display math are converted, and removing the filter restores the renderer", () => {
  const filters = new Set<(context: { math: { math: string; display: boolean } }) => void>();
  const runtime: MathJaxRuntime = {
    startup: { document: { inputJax: [{
      name: "TeX",
      preFilters: {
        add: filter => { filters.add(filter); },
        remove: filter => { filters.delete(filter); },
      },
    }] } },
  };
  const remove = installAsciiMath(runtime);
  const display = { math: "sqrt(x)", display: true };
  const inline = { math: "1/2", display: false };
  const multiline = { math: "sqrt(x)\n\nx^2", display: true };
  const latex = { math: String.raw`\frac{a}{b}`, display: true };
  filters.forEach(filter => {
    for (const math of [display, inline, multiline, latex]) filter({ math });
  });
  assert.equal(display.math, "\\sqrt{x}");
  assert.equal(inline.math, "\\frac{1}{2}");
  assert.equal(multiline.math, String.raw`\begin{gathered}\sqrt{x} \\[1.15em] x^{2}\end{gathered}`);
  assert.equal(latex.math, String.raw`\frac{a}{b}`);
  assert.equal(display.display, true);
  assert.equal(inline.display, false);
  remove();
  assert.equal(filters.size, 0);
});

test("blank lines make display rows and survive conversion to native LaTeX", () => {
  const rows = [
    "[(3, 10), (6, -1)][(0), (1)]",
    "= [(3(0) + 10(1)), (6(0) -1(1))]",
    "= [(10), (-1)]",
  ];
  const expected = `\\begin{gathered}${rows.map(row => toTex(row)).join(" \\\\[1.15em] ")}\\end{gathered}`;
  for (const separator of ["\n\n", "\r\n \t\r\n\r\n"]) {
    const source = `\n${rows.join(separator)}\n`;
    assert.equal(toTex(source, true), expected);
    const latex = toLatex(source, true);
    assert.equal(latex, `\\displaystyle{${expected}}`);
    assert.equal(toTex(latex, true), latex);
    assert.equal(toLatex(latex, true), latex);
  }
  const converter = createMathConverter(parseCustomSymbols(String.raw`IR = \mathbb{R}`));
  assert.equal(converter.toTex("IR\n\nIR^2", true), String.raw`\begin{gathered}{\mathbb{R}} \\[1.15em] {\mathbb{R}}^{2}\end{gathered}`);
});

test("source wrapping, inline math, matrix contents, labels, and native LaTeX keep their layout", () => {
  assert.equal(toTex("x\n+ y", true), toTex("x + y"));
  assert.equal(toTex("x\n\ny", false), toTex("x y"));
  const expressions = ["[(1,2),\n\n(3,4)]", "(x\n\n+ y)/2", '"a\n\nb" + x', "text(a\n\nb) + x", "mbox[a\n\nb] + x"];
  for (const source of expressions) assert.equal(toTex(source, true), toTex(source, false));
  const latex = String.raw`\begin{aligned}x &= 1 \\

y &= 2\end{aligned}`;
  assert.equal(toTex(latex, true), latex);
});

test("reports an unsupported renderer instead of partially installing", () => {
  assert.throws(() => installAsciiMath({}), /unavailable/);
});

test("converted LaTeX keeps its layout and is never converted twice", () => {
  const inline = toLatex("sqrt(x)", false);
  const block = toLatex("a/b", true);
  assert.equal(inline, "\\textstyle{\\sqrt{x}}");
  assert.equal(block, "\\displaystyle{\\frac{a}{b}}");
  assert.equal(toTex(inline), inline);
  assert.equal(toTex(block), block);
  assert.equal(toTex(`\n> ${block}\n> `), block);
  assert.equal(toTex("\\textstyle{a\n> b}"), "\\textstyle{a\n> b}");
  assert.equal(toLatex(inline, false), inline);
  assert.equal(toLatex(block, true), block);
});


test("custom symbols are parser atoms and leave text and explicit LaTeX alone", () => {
  const converter = createMathConverter(parseCustomSymbols(String.raw`IR = \mathbb{R}
IRR = \mathbb{R}^{2}
XY = x+y`));
  assert.equal(converter.toTex("x in IR"), "x \\in {\\mathbb{R}}");
  assert.equal(converter.toTex("IR^2/2"), "\\frac{{\\mathbb{R}}^{2}}{2}");
  assert.equal(converter.toTex("sqrt(IR)"), "\\sqrt{{\\mathbb{R}}}");
  assert.equal(converter.toTex("IRR"), "{\\mathbb{R}^{2}}");
  assert.equal(converter.toTex("XY^2"), "{x+y}^{2}");
  assert.equal(converter.toTex('"IR" + text(IR)'), "\\text{IR} + \\text{IR}");
  const converted = converter.toLatex("IR", false);
  assert.equal(converted, "\\textstyle{{\\mathbb{R}}}");
  assert.equal(converter.toTex(converted), converted);
  assert.equal(createMathConverter().toTex("IR"), "I R");
});

test("symbol settings handle whitespace and equals signs and reject unusable definitions", () => {
  assert.deepEqual(parseCustomSymbols("\n IR = \\mathbb{R}\r\nEQ = a=b \n"), [
    { name: "IR", tex: "\\mathbb{R}" }, { name: "EQ", tex: "a=b" },
  ]);
  assert.deepEqual(parseCustomSymbols(" \n"), []);
  assert.throws(() => parseCustomSymbols("IR ="), /Line 1/);
  assert.throws(() => parseCustomSymbols("IR"), /Line 1/);
  assert.throws(() => parseCustomSymbols("IR_R = R"), /Line 1/);
  assert.throws(() => parseCustomSymbols("IR = R\nIR = N"), /Line 2.*more than once/);
  assert.throws(() => createMathConverter(parseCustomSymbols("sqrt = R")), /AsciiMath function/);
});


test("native LaTeX passes through while AsciiMath text and backslash symbols keep their meaning", () => {
  const examples = [
    String.raw`\frac{a+b}{c+d}`,
    String.raw`\text{hello}`,
    String.raw`x \in \mathbb{R}`,
    String.raw`x = \sqrt{y} + \alpha`,
    String.raw`\begin{pmatrix}1 & 2 \\ 3 & 4\end{pmatrix}`,
    String.raw`\left\{x \mid x > 0\right\}`,
    String.raw`x\,y`,
    String.raw`\{1,2\}`,
    String.raw`50\%`,
  ];
  const converter = createMathConverter(parseCustomSymbols(String.raw`IR = \mathbb{R}`));
  for (const source of examples) {
    assert.equal(isLatex(source), true);
    assert.equal(converter.toTex(source), source);
    assert.equal(converter.toLatex(source, true), source);
  }
  assert.equal(toTex(String.raw`\text{say "sqrt(x)"}`), String.raw`\text{say "sqrt(x)"}`);
  assert.equal(toTex(String.raw`> \frac{a}{b}
> `), String.raw`\frac{a}{b}`);
  assert.equal(isLatex(String.raw`"\alpha" + text(\beta) + mbox{\gamma}`), false);
  assert.equal(toTex(String.raw`A \\ B`), String.raw`A \backslash B`);
  assert.equal(toTex("sqrt(x)"), String.raw`\sqrt{x}`);
});


test("pasted Unicode set-builder expressions preserve letters and correctly parse negative bounds", () => {
  const converter = createMathConverter(parseCustomSymbols(String.raw`IZ = \mathbb{Z}`));
  const examples = [
    ["𝐶= {x|x in IZ and x^2 >4}︀", String.raw`𝐶 = \left \lbrace x \mid x \in {\mathbb{Z}} \quad\text{and}\quad x^{2} > 4 \right \rbrace`],
    ["𝐷:= {x|x in IZ and x>−1}", String.raw`𝐷 := \left \lbrace x \mid x \in {\mathbb{Z}} \quad\text{and}\quad x > - 1 \right \rbrace`],
    ["𝐶^−2 + sqrt(−1)", String.raw`𝐶^{- 2} + \sqrt{- 1}`],
    ["𝒙_1 + 𝛼", "𝒙_{1} + 𝛼"],
  ];
  for (const [source, expected] of examples) {
    assert.equal(converter.toTex(source!), expected);
    assert.doesNotMatch(converter.toTex(source!), /\p{Surrogate}|[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/u);
    const latex = converter.toLatex(source!, false);
    assert.equal(converter.toTex(latex), latex);
  }
  assert.equal(toTex('"𝐶−1︀" + text(𝐷−1︀)'), String.raw`\text{𝐶−1︀} + \text{𝐷−1︀}`);
  assert.equal(toTex("C\u{E0100}"), "C");
  assert.equal(toTex(String.raw`\mathbb{Z} + 𝐶 − 1`), String.raw`\mathbb{Z} + 𝐶 − 1`);
});
