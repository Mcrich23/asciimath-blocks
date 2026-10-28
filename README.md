# AsciiMath Blocks

Write AsciiMath in Obsidian's standard `$...$` expressions and `$$...$$` blocks.
The plugin renders inline and display math using Obsidian's fonts and theme,
with support for native LaTeX and custom symbols.

```text
The radius is $sqrt(x^2 + y^2)$.

$$
(a+b)/(c+d)
$$
```

## Installation

1. Extract the plugin ZIP and copy the `asciimath-blocks` folder into
   `<vault>/.obsidian/plugins/`. The folder should contain `main.js`,
   `manifest.json`, and `styles.css`.
2. Restart Obsidian.
3. Open **Settings → Community plugins**, enable community plugins if needed,
   then enable **AsciiMath Blocks**.

You can also build the plugin from source and copy those three files into the
same folder. Requires Obsidian 1.9.10 or newer. Mobile has not been tested.

## Writing and editing math

Use `$...$` for inline math and `$$...$$` for display math. In Live Preview and
Source mode, inactive expressions are rendered automatically. Click an
expression or move the cursor into it to edit its source. Inline math shows
its source while being edited; display blocks keep an updating preview below
the closing `$$`. Reading view always shows rendered math.

Rendering does not modify notes or undo history. Other text in Source mode
keeps its usual formatting.

In an AsciiMath display block, leave an empty line between expressions to
render them on separate rows:

```text
$$
[(3,10),(6,-1)][(0),(1)]

= [(10),(-1)]
$$
```

Single line breaks are treated as spaces. Blank lines inside matrix brackets,
grouping brackets, or text labels do not start a new row. Native LaTeX keeps
its usual line-break syntax.

### AsciiMath examples

| Expression | Meaning |
| --- | --- |
| `(a+b)/(c+d)` | A fraction |
| `sqrt(x)` | Square root |
| `x^2 + y^2 = r^2` | Powers |
| `sin^2 theta + cos^2 theta = 1` | Functions and Greek letters |
| `sum_(n=1)^oo 1/n^2 = pi^2/6` | A sum with limits |
| `[[1,2],[3,4]]` | A matrix |
| `"for all" x in RR` | Text and symbols |
| `x + highlight(y^2) = z` | Highlight part of an equation |

Parentheses group expressions. Unicode math letters and minus signs are also
supported. See [AsciiMath](https://asciimath.org/) for the full syntax.

### Highlighting

Wrap part of an equation in `highlight(...)` for a yellow background with black
text, readable in light and dark themes. Everything inside stays AsciiMath:

```text
$x + highlight(y^2) = z$

$$
highlight((a+b)/(c+d)) = sqrt(x)
$$
```

Highlights work inline and in display blocks, including inside fractions,
roots, and matrices. The LaTeX conversion commands preserve them.

### Expanding variables

Use `exp(x)` to insert the latest definition of `x` above it in the same
note. Parentheses are optional: `exp x` works too, including in expressions
such as `exp x/2` or `exp x^2`. Definitions use `x = ...` or `x := ...` inside
math, including earlier inline expressions and display blocks:

```text
$x = a+b$

$$
exp(x)^2
$$
```

This renders the square of the whole expression `a+b`. Matrices work too:
define `$A = [[1,2],[3,4]]$`, then use `exp(A)` in a later block.
Multiple definitions can share one expression: `$a = 2 and b = 3$` defines
both `a` and `b` for later expansion.

Definitions are case-sensitive. A later definition applies only below it.
Subscripts and superscripts can be part of a name: define `E_1^-1 = ...`,
then use `exp(E_1^-1)` or `exp E_1^-1`. Grouped scripts such as `E_(1)^(-1)`
refer to the same name. A bare call uses the full defined name first;
otherwise, `exp x^2` squares the expansion of `x`. Use `exp(x^2)` to look up
only the identifier `x^2`.
For chained assignments such as `x = 7 = 3+4`, expansion uses the final
expression, `3+4`. Equals signs inside groups or text labels stay in that expression.
Assignments can span lines, including a value below `x =` and subsequent
`= ...` rows separated by blank lines. For example, `x = 99` followed by
`= [(1,0),(0,1)]` in the same block defines `x` as that final matrix.
Undefined variables stay as written. Expansion inserts one definition; bare
variables inside that definition stay symbolic. Use explicit `exp(...)`
inside a definition when you want to include another definition's current value.
Quoted labels, code examples, and native LaTeX are left alone. Notes and undo
history are unchanged; the LaTeX conversion commands preserve expanded output.

### Native LaTeX

LaTeX works in the same delimiters:

```text
$$
\frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$
```

An expression containing a LaTeX command such as `\frac`, `\sqrt`, or `\alpha`
is rendered entirely as LaTeX. Expressions without LaTeX commands use AsciiMath
by default, including custom symbols. Quoted AsciiMath labels stay text.

For ambiguous syntax, use `\displaystyle{...}` in a block or `\textstyle{...}`
inline to force LaTeX. For example, `a/b` is an AsciiMath fraction, while
`\displaystyle{a/b}` keeps the LaTeX slash.

## Custom symbols

Open **Settings → AsciiMath Blocks**, enter one mapping per line, and click
**Save symbols**:

```text
cross = \text{ x }
```

Then `$a cross b$` inserts the mapped LaTeX between the variables. Open previews
update after saving. Mappings are stored per vault and apply to AsciiMath
rendering and the LaTeX conversion commands.

Names are case-sensitive and use letters and numbers, starting with a letter.
Values are standard LaTeX without dollar delimiters. Existing AsciiMath
functions such as `sqrt` keep their meaning. Quoted labels such as `"cross"`
remain text. Delete a mapping's line and save to remove it; save an empty box
to restore the default symbols.

## Convert to LaTeX

Open the command palette and search for **AsciiMath Blocks**:

- **Convert current math to LaTeX** converts the expression containing the
  cursor, or a single selected expression.
- **Convert all math in note to LaTeX** converts every complete AsciiMath
  expression in the current note.

The commands preserve dollar delimiters, skip code examples and existing
LaTeX, and support undo. A whole-note conversion is one undo step. Commands
appear only when there is AsciiMath to convert.

Converted expressions include custom symbol definitions and use standard
LaTeX style commands. They continue rendering if a mapping changes or the
plugin is disabled. Without conversion, notes containing AsciiMath require
this plugin to render correctly.

## Development

Use Node.js 22.18 or newer and a separate development vault.

```sh
npm ci
npm run dev     # Watch and rebuild
npm run build   # Type-check and bundle
npm test        # Run tests
```

Copy `main.js`, `manifest.json`, and `styles.css` into the development vault's
plugin folder. Disable and re-enable the plugin after rebuilding.

The plugin runs locally and makes no network requests. It uses Obsidian's
MathJax renderer; plugins that replace MathJax may conflict with it.

## License

The plugin is [MIT licensed](LICENSE). AsciiMath conversion uses
[asciimath2tex](https://github.com/christianp/asciimath2tex) by Christian
Lawson-Perfect, licensed under [Apache 2.0](licenses/asciimath2tex.txt).
Its attribution and license are included in the bundled plugin.
