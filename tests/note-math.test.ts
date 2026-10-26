import assert from "node:assert/strict";
import { test } from "node:test";
import { noteMath } from "../src/note-math.ts";

test("note definitions exclude code, comments, escaped math, and later blocks", () => {
  const source = [
    "$x = 1$", "`$x = 2$`", "```text", "$$x = 3$$", "```",
    "<!-- $x = 4$ -->", "%% $x = 5$ %%", String.raw`\$x = 6\$`,
    "> $$", "> A = [[1,2],[3,4]]", "> $$", "$exp(x)$", "$$x = 9$$",
  ].join("\n");
  const ranges = noteMath(source);
  assert.deepEqual(ranges.map(range => range.source.trim()), ["x = 1", "A = [[1,2],[3,4]]", "exp(x)", "x = 9"]);
  for (const range of ranges) assert.ok(source.slice(range.from, range.to).startsWith("$"));
});
