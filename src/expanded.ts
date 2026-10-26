const variable = String.raw`[\p{L}][\p{L}\p{N}]*(?:_(?:[\p{L}\p{N}]+|\([\p{L}\p{N}]+\)))?`;
const assignment = new RegExp(`^\\s*(${variable})\\s*(?::=|=(?!=|>))\\s*(.+)$`, "su");
const assignmentStart = new RegExp(`^\\s*${variable}\\s*(?::=|=(?!=|>))`, "u");
const expansion = new RegExp(`^exp(?:\\s*\\(\\s*(${variable})\\s*\\)|[\\t ]+(${variable})(?![\\p{L}\\p{N}_]))`, "u");
const label = /^(?:"[^"]*"|(?:text|mbox)\s*(?:\([^)]*\)|\{[^}]*\}|\[[^\]]*\]))/;

function finalAssignment(source: string): string {
  let start = 0;
  let depth = 0;
  for (let index = 0; index < source.length;) {
    const text = source.slice(index).match(label);
    if (text) { index += text[0].length; continue; }
    const char = source[index];
    if ("([{".includes(char)) depth++;
    else if (")]}".includes(char)) depth = Math.max(0, depth - 1);
    else if (char === "=" && depth === 0
      && !/[<>!=]/.test(source[index - 1] ?? "")
      && !/[=>]/.test(source[index + 1] ?? "")) start = index + 1;
    index++;
  }
  return source.slice(start).trim();
}

/** Resolve definitions in source order, with a fresh scope for each conversion. */
export function expandVariables(source: string, substitute: (value: string) => string, previous: string[] = []): string {
  const definitions = new Map<string, string>();
  let result = "";
  let line = "";
  let depth = 0;

  function finishLine(): void {
    const definition = line.match(assignment);
    if (definition) {
      const value = finalAssignment(definition[2]);
      if (value) definitions.set(definition[1], value);
    }
    result += line;
    line = "";
  }

  for (const input of [...previous, source]) {
    result = "";
    line = "";
    depth = 0;
    for (let index = 0; index < input.length;) {
      const rest = input.slice(index);
      const text = rest.match(label);
      if (text) {
        line += text[0];
        index += text[0].length;
        continue;
      }
      const call = (index === 0 || !/[\p{L}\p{N}_]/u.test(input[index - 1]))
        ? rest.match(expansion) : null;
      if (call) {
        const name = call[1] ?? call[2];
        const value = definitions.get(name);
        line += value === undefined ? name : substitute(value);
        index += call[0].length;
        continue;
      }
      const char = input[index++];
      if ("([{".includes(char)) depth++;
      else if (")]}".includes(char)) depth = Math.max(0, depth - 1);
      if (char === "\n" && depth === 0) {
        const remaining = input.slice(index);
        const next = remaining.trimStart();
        const blankLine = /^[\t ]*\r?\n/.test(remaining);
        const equality = /^(?::=|=(?!=|>))/.test(next);
        const continuing = assignmentStart.test(line) && !assignmentStart.test(next)
          && ((!blankLine && !expansion.test(next))
            || /(?:[:=+*/^,-]|\s-)[\t \r]*$/.test(line)
            || /^[+*/^,-]/.test(next));
        if (next && (equality || continuing)) line += char;
        else {
          finishLine();
          result += char;
        }
      } else line += char;
    }
    finishLine();
  }
  return result;
}
