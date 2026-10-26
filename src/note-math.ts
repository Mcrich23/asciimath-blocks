export interface NoteMath {
  from: number;
  to: number;
  source: string;
  display: boolean;
}

/** Locate math while skipping fenced code, inline code, comments, and escapes. */
export function noteMath(source: string): NoteMath[] {
  const ranges: NoteMath[] = [];
  let fence = "";
  let index = 0;
  while (index < source.length) {
    const startOfLine = index === 0 || source[index - 1] === "\n";
    if (startOfLine) {
      const line = source.slice(index).match(/^[^\n]*/)![0];
      const marker = line.match(/^[\t ]*(?:>[\t ]*)*(`{3,}|~{3,})/);
      if (marker && (!fence || (marker[1][0] === fence[0] && marker[1].length >= fence.length))) {
        fence = fence ? "" : marker[1];
        index += line.length + 1;
        continue;
      }
      if (fence) { index += line.length + 1; continue; }
    }
    if (source.startsWith("<!--", index) || source.startsWith("%%", index)) {
      const close = source.startsWith("%%", index) ? "%%" : "-->";
      const end = source.indexOf(close, index + (close === "%%" ? 2 : 4));
      index = end < 0 ? source.length : end + close.length;
      continue;
    }
    if (source[index] === "\\") { index += 2; continue; }
    if (source[index] === "`") {
      const run = source.slice(index).match(/^`+/)![0];
      const end = source.indexOf(run, index + run.length);
      index = end < 0 ? index + run.length : end + run.length;
      continue;
    }
    if (source[index] !== "$") { index++; continue; }
    const delimiter = source.startsWith("$$", index) ? "$$" : "$";
    let end = index + delimiter.length;
    for (; end < source.length; end++) {
      if (source[end] === "\\") { end++; continue; }
      if (delimiter === "$" && source[end] === "\n") break;
      if (source.startsWith(delimiter, end)) break;
    }
    if (source.startsWith(delimiter, end)) {
      ranges.push({
        from: index, to: end + delimiter.length,
        source: source.slice(index + delimiter.length, end).replace(/^[\t ]*(?:>[\t ]*)+/gm, ""),
        display: delimiter === "$$",
      });
      index = end + delimiter.length;
    } else index += delimiter.length;
  }
  return ranges;
}
