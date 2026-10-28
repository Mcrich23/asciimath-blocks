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
    assert.equal(toTex(source), expected);
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

test("highlight wraps AsciiMath expressions without changing their grammar", () => {
  const mark = (tex: string) => `\\bbox[yellow,2px,color:black]{${tex}}`;
  const examples = [
    ["x + highlight(y^2) = z", `x + ${mark("y^{2}")} = z`],
    ["highlight((a+b)/(c+d))", mark(String.raw`\frac{a + b}{c + d}`)],
    ["highlight(x)/2", `\\frac{${mark("x")}}{2}`],
    ["sqrt(highlight(x + 1))", `\\sqrt{${mark("x + 1")}}`],
    ["highlight(x)^2", `${mark("x")}^{2}`],
    ["highlight(x + highlight(y))", mark(`x + ${mark("y")}`)],
    ["[[highlight(1),2],[3,4]]", `\\left [ \\begin{matrix} ${mark("1")} & 2 \\\\ 3 & 4 \\end{matrix} \\right ]`],
  ];
  for (const [source, expected] of examples) {
    assert.equal(isLatex(source), false);
    assert.equal(toTex(source), expected);
    for (const display of [false, true]) {
      const latex = toLatex(source, display);
      assert.equal(toTex(latex, display), latex);
      assert.ok(latex.includes(expected));
    }
  }
  assert.equal(toTex("highlight(x\n\n+ y)", true), mark("x + y"));
  assert.equal(toTex("highlight(x)\n\ny", true), `\\begin{gathered}${mark("x")} \\\\[1.15em] y\\end{gathered}`);
});

test("highlight supports custom symbols and preserves labels and native LaTeX", () => {
  const converter = createMathConverter(parseCustomSymbols(String.raw`IR = \mathbb{R}`));
  assert.equal(converter.toTex("highlight(x in IR)"), String.raw`\bbox[yellow,2px,color:black]{x \in {\mathbb{R}}}`);
  assert.equal(toTex('"highlight(x)" + text(highlight)'), String.raw`\text{highlight(x)} + \text{highlight}`);
  const latex = String.raw`\bbox[yellow]{\frac{a}{b}}`;
  assert.equal(toTex(latex), latex);
  assert.throws(() => createMathConverter(parseCustomSymbols("highlight = x")), /AsciiMath function/);
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
    assert.equal(converter.toTex(source), expected);
    assert.doesNotMatch(converter.toTex(source), /\p{Surrogate}|[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/u);
    const latex = converter.toLatex(source, false);
    assert.equal(converter.toTex(latex), latex);
  }
  assert.equal(toTex('"𝐶−1︀" + text(𝐷−1︀)'), String.raw`\text{𝐶−1︀} + \text{𝐷−1︀}`);
  assert.equal(toTex("C\u{E0100}"), "C");
  assert.equal(toTex(String.raw`\mathbb{Z} + 𝐶 − 1`), String.raw`\mathbb{Z} + 𝐶 − 1`);
});

test("expanded uses earlier definitions in note order and preserves grouping", () => {
  const converter = createMathConverter();
  assert.equal(converter.toTex("exp(x)^2", false, ["x = a+b"]), String.raw`{\left(a + b\right)}^{2}`);
  assert.equal(converter.toTex("1/exp(x)", false, ["x = a+b"]), String.raw`\frac{1}{{\left(a + b\right)}}`);
  assert.equal(converter.toTex("exp(x)", false, ["x = 1", "x := 2"]), "{2}");
  assert.equal(converter.toTex("exp(x)"), "x");
  assert.equal(converter.toTex("exp(x)\n\nx = 9", true), String.raw`\begin{gathered}x \\[1.15em] x = 9\end{gathered}`);
  assert.equal(converter.toTex("x = 1\n\nexp(x)\n\nx = 2\n\nexp(x)", true), String.raw`\begin{gathered}x = 1 \\[1.15em] {1} \\[1.15em] x = 2 \\[1.15em] {2}\end{gathered}`);
  assert.equal(converter.toTex("exp(y)", false, ["x = 1", "y = exp(x) + 2", "x = 9"]), String.raw`{\left({1} + 2\right)}`);
  assert.equal(converter.toTex("exp(x)"), "x", "definitions do not leak between notes");
});

test("expanded handles matrices, Unicode, labels, and conversion to LaTeX", () => {
  const converter = createMathConverter(parseCustomSymbols(String.raw`IR = \mathbb{R}`));
  const matrix = "[[1,2],[3,4]]";
  assert.equal(converter.toTex("exp(A)", true, [`A = ${matrix}`]), `{${toTex(matrix)}}`);
  assert.equal(converter.toTex("exp(𝐴)", false, ["𝐴 := [[1,2],\n[3,4]]"]), `{${toTex(matrix)}}`);
  assert.equal(converter.toTex("highlight(exp(x))", false, ["x = IR"]), String.raw`\bbox[yellow,2px,color:black]{{{\mathbb{R}}}}`);
  const text = '"exp(x)" + text(exp(x))';
  assert.equal(converter.toTex(text, false, ["x = 5"]), toTex(text));
  assert.equal(converter.toTex(String.raw`\text{exp(x)}`, false, ["x = 5"]), String.raw`\text{exp(x)}`);
  assert.equal(converter.toTex("exp(x)", false, ["x >= 3", "x == 4", "x => 5"]), "x");
  const latex = converter.toLatex("exp(x)^2", true, ["x = a+b"]);
  assert.equal(latex, String.raw`\displaystyle{{\left(a + b\right)}^{2}}`);
  assert.equal(converter.toTex(latex), latex);
  assert.throws(() => createMathConverter(parseCustomSymbols("exp = x")), /AsciiMath function/);
});

test("expanded uses the final top-level expression in chained assignments", () => {
  const convert = (definition: string) => toTex("exp(x)", false, [definition]);
  assert.equal(convert("x = 7 = 3+4"), String.raw`{\left(3 + 4\right)}`);
  assert.equal(convert("x := 7 = 3+4 = 8"), "{8}");
  for (const value of ["[[1,2],[3,4]]", "{t|t = 4}", '(a = b)', '"a=b"', "text(a=b)", "mbox[a=b]"]) {
    assert.equal(convert(`x = 7 = ${value}`), convert(`x = ${value}`));
  }
  for (const value of ["a >= b", "a <= b", "a != b", "a == b", "a => b"]) {
    assert.equal(convert(`x = 7 = ${value}`), convert(`x = ${value}`));
  }
  assert.equal(toTex("exp(x)", false, ["x = 2", "x = 7 ="]), "{2}");
  assert.equal(toTex("x = 7 = 3+4\n\nexp(x)", true), String.raw`\begin{gathered}x = 7 = 3 + 4 \\[1.15em] {\left(3 + 4\right)}\end{gathered}`);
});

test("exp follows multiline assignments and equality continuations", () => {
  const matrix = "[(1,0),(0,1)]";
  for (const separator of ["\n", "\n\n", "\r\n\r\n"]) {
    assert.equal(toTex("exp(x)", false, [`x = 99${separator}= ${matrix}`]), `{${toTex(matrix)}}`);
    assert.equal(toTex("exp(x)", false, [`x${separator}= 7${separator}= 3+4`]), String.raw`{\left(3 + 4\right)}`);
    assert.equal(toTex("exp(x)", false, [`x :=${separator}${matrix}`]), `{${toTex(matrix)}}`);
  }
  assert.equal(toTex("exp(x)", false, ["x = a\n+ b\n+ c"]), String.raw`{\left(a + b + c\right)}`);
  assert.equal(toTex("exp(x)", false, ["x = a +\nb"]), String.raw`{\left(a + b\right)}`);
  assert.equal(toTex("exp(x)", false, ["x = a\nb"]), String.raw`{\left(a b\right)}`);
  assert.equal(toTex("exp(x)", false, ["x = 2\ny = 3"]), "{2}");
  assert.equal(toTex("exp(y)", false, ["x = 2\ny = 3"]), "{3}");
  assert.equal(toTex("x = 99\n\n= 3+4\n\nexp(x)", true), String.raw`\begin{gathered}x = 99 \\[1.15em] = 3 + 4 \\[1.15em] {\left(3 + 4\right)}\end{gathered}`);
  assert.equal(toTex("x = 2\nexp(x)", false), "x = 2 {2}");
});

test("exp accepts a bare variable with the same grouping and scope", () => {
  const previous = ["x = 7 = 3+4", "A = [[1,2],[3,4]]", "𝐴 = 5", "x_1 = 8", "xy = 9"];
  for (const name of ["x", "A", "𝐴", "x_1", "xy", "missing"]) {
    for (const expression of [`exp ${name}`, `exp ${name}^2`, `exp ${name}/2`, `highlight(exp ${name})`]) {
      assert.equal(toTex(expression, false, previous), toTex(expression.replace(`exp ${name}`, `exp(${name})`), false, previous));
    }
  }
  assert.equal(toTex("x = 2\nexp x", false), "x = 2 {2}");
  assert.equal(toTex("x = 2\n\nexp x", true), String.raw`\begin{gathered}x = 2 \\[1.15em] {2}\end{gathered}`);
  const labels = '"exp x" + text(exp x) + mbox[exp x]';
  assert.equal(toTex(labels, false, previous), toTex(labels));
  assert.equal(toTex("myexp x", false, previous), toTex("myexp x"));
});

test("exp resolves superscript and subscript identifiers independently", () => {
  const previous = ["E = 2", "E_1 = 3", "E_1^-1 = [[1,0],[0,1]]", "A^2 = 7", "x_(i+1)^(-2) = 9"];
  const matrix = `{${toTex("[[1,0],[0,1]]")}}`;
  for (const expression of ["exp(E_1^-1)", "exp(E_(1)^(-1))", "exp(E_{1}^{-1})", "exp E_1^-1", "exp E_1^−1"]) {
    assert.equal(toTex(expression, false, previous), matrix, expression);
  }
  assert.equal(toTex("exp(E_1)", false, previous), "{3}");
  assert.equal(toTex("exp(E)", false, previous), "{2}");
  assert.equal(toTex("exp(A^2)", false, previous), "{7}");
  assert.equal(toTex("exp A^2", false, previous), "{7}");
  assert.equal(toTex("exp E_1^2", false, previous), "{3}^{2}");
  assert.equal(toTex("exp(E_1^2)", false, previous), toTex("E_1^2"));
  assert.equal(toTex("exp(x_(i+1)^(-2))", false, previous), "{9}");
  assert.equal(toTex("exp(x_{i+1}^{-2})", false, previous), "{9}");
  assert.equal(toTex("exp(E_1^-1)", false, [...previous, "E_1^-1 = 5 = 6"]), "{6}");
  assert.equal(toTex("exp E_1^-1", false, ["E_1^-1 =\n[[1,0],[0,1]]"]), matrix);
  assert.equal(toTex('"exp E_1^-1"', false, previous), toTex('"exp E_1^-1"'));
});

test("exp collects assignments separated by and in the same math expression", () => {
  const definitions = "b_1 = [(︀3, −2, 1.4)]︀^T and b_2 = [︀(0, 0, 0)]︀^T";
  for (const [name, value] of [["b_1", "[(3,-2,1.4)]^T"], ["b_2", "[(0,0,0)]^T"]]) {
    assert.equal(toTex(`exp(${name})`, false, [definitions]), toTex(`exp(${name})`, false, [`${name} = ${value}`]));
  }
  assert.equal(toTex("b_2 = exp(b_2)", false, [definitions]), toTex("b_2 = exp(b_2)", false, ["b_2 = [(0,0,0)]^T"]));
  assert.equal(toTex("a = 2 and b = exp(a)\n\nexp(b)", true), String.raw`\begin{gathered}a = 2 \quad\text{and}\quad b = {2} \\[1.15em] {{2}}\end{gathered}`);
  assert.equal(toTex("exp(a)", false, ["a = 1 and b = 2 and a = 3"]), "{3}");
  for (const value of ['"and b = 7"', "text(and b = 7)", "{x | x = 1 and b = 7}"]) {
    assert.equal(toTex("exp(b)", false, [`a = ${value}`]), "b");
  }
});
