import { toTex } from "./math.ts";

// Only the MathJax API we use. Keep the renderer integration at this boundary.
interface MathItem {
  math: string;
  display: boolean;
}

type MathFilter = (context: { math: MathItem }) => void;

interface InputJax {
  name: string;
  preFilters: {
    add(filter: MathFilter, priority: number): void;
    remove(filter: MathFilter): void;
  };
}

export interface MathJaxRuntime {
  startup?: { document?: { inputJax?: InputJax[] } };
}

/** Install a reversible filter in Obsidian's existing renderer. */
export function installAsciiMath(runtime: MathJaxRuntime, convert: typeof toTex = toTex): () => void {
  const tex = runtime.startup?.document?.inputJax?.find(jax => jax.name === "TeX");
  if (!tex?.preFilters) {
    throw new Error("Obsidian's MathJax renderer is unavailable.");
  }

  const filter: MathFilter = ({ math }) => {
    try {
      math.math = convert(math.math, math.display);
    } catch {
      // A malformed expression should affect only its own rendering.
      math.math = "\\text{Unable to render AsciiMath. Check this expression.}";
    }
  };

  tex.preFilters.add(filter, -100);
  return () => tex.preFilters.remove(filter);
}
