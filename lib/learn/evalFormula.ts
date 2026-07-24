/**
 * Safe arithmetic expression evaluator for the interactive `formula` widget.
 *
 * NO eval / Function — a hand-written recursive-descent parser over a tiny math
 * grammar: numbers, variables, + - * / ^, unary minus, parentheses, and a
 * whitelist of functions/constants. Anything outside the grammar returns null,
 * so a malformed or hostile expression can never execute code or hang.
 */

type Fn = (...a: number[]) => number;
const FUNCS: Record<string, { arity: number; fn: Fn }> = {
  sqrt: { arity: 1, fn: Math.sqrt },
  abs: { arity: 1, fn: Math.abs },
  sin: { arity: 1, fn: Math.sin },
  cos: { arity: 1, fn: Math.cos },
  tan: { arity: 1, fn: Math.tan },
  log: { arity: 1, fn: Math.log },
  log10: { arity: 1, fn: Math.log10 },
  exp: { arity: 1, fn: Math.exp },
  min: { arity: 2, fn: Math.min },
  max: { arity: 2, fn: Math.max },
  pow: { arity: 2, fn: Math.pow },
  round: { arity: 1, fn: Math.round },
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };

type Tok =
  | { t: "num"; v: number }
  | { t: "id"; v: string }
  | { t: "op"; v: string }
  | { t: "("; }
  | { t: ")"; }
  | { t: ","; };

function tokenize(src: string): Tok[] | null {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t") {
      i++;
      continue;
    }
    if ((c >= "0" && c <= "9") || c === ".") {
      let j = i;
      while (j < src.length && ((src[j] >= "0" && src[j] <= "9") || src[j] === ".")) j++;
      const v = Number(src.slice(i, j));
      if (!Number.isFinite(v)) return null;
      toks.push({ t: "num", v });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      toks.push({ t: "id", v: src.slice(i, j) });
      i = j;
      continue;
    }
    if ("+-*/^".includes(c)) {
      toks.push({ t: "op", v: c });
      i++;
      continue;
    }
    if (c === "(") {
      toks.push({ t: "(" });
      i++;
      continue;
    }
    if (c === ")") {
      toks.push({ t: ")" });
      i++;
      continue;
    }
    if (c === ",") {
      toks.push({ t: "," });
      i++;
      continue;
    }
    return null; // unknown character
  }
  return toks;
}

/** Evaluate `expr` with the given variable values. Returns null on any error. */
export function evalExpression(expr: string, vars: Record<string, number>): number | null {
  const toks = tokenize(expr);
  if (!toks) return null;
  let p = 0;
  const peek = () => toks[p];
  const eat = () => toks[p++];

  // grammar: expr = term (('+'|'-') term)*
  //          term = pow  (('*'|'/') pow)*
  //          pow  = unary ('^' pow)?
  //          unary= '-' unary | atom
  //          atom = num | const | var | func '(' args ')' | '(' expr ')'
  let depth = 0;
  const MAX_DEPTH = 64;

  function parseAddSub(): number | null {
    let v = parseTerm();
    if (v === null) return null;
    while (peek() && peek().t === "op" && ((peek() as { v: string }).v === "+" || (peek() as { v: string }).v === "-")) {
      const op = (eat() as { v: string }).v;
      const r = parseTerm();
      if (r === null) return null;
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }

  function parseTerm(): number | null {
    let v = parsePow();
    if (v === null) return null;
    while (peek() && peek().t === "op" && ((peek() as { v: string }).v === "*" || (peek() as { v: string }).v === "/")) {
      const op = (eat() as { v: string }).v;
      const r = parsePow();
      if (r === null) return null;
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }

  function parsePow(): number | null {
    const base = parseUnary();
    if (base === null) return null;
    if (peek() && peek().t === "op" && (peek() as { v: string }).v === "^") {
      eat();
      const exp = parsePow(); // right-associative
      if (exp === null) return null;
      return Math.pow(base, exp);
    }
    return base;
  }

  function parseUnary(): number | null {
    if (peek() && peek().t === "op" && (peek() as { v: string }).v === "-") {
      eat();
      const v = parseUnary();
      return v === null ? null : -v;
    }
    return parseAtom();
  }

  function parseAtom(): number | null {
    if (++depth > MAX_DEPTH) return null;
    const tk = peek();
    if (!tk) return null;
    if (tk.t === "num") {
      eat();
      return tk.v;
    }
    if (tk.t === "(") {
      eat();
      const v = parseAddSub();
      if (v === null || !peek() || peek().t !== ")") return null;
      eat();
      return v;
    }
    if (tk.t === "id") {
      eat();
      const name = tk.v;
      // function call?
      if (peek() && peek().t === "(") {
        const fn = FUNCS[name];
        if (!fn) return null;
        eat(); // (
        const args: number[] = [];
        if (!(peek() && peek().t === ")")) {
          for (;;) {
            const a = parseAddSub();
            if (a === null) return null;
            args.push(a);
            if (peek() && peek().t === ",") {
              eat();
              continue;
            }
            break;
          }
        }
        if (!peek() || peek().t !== ")") return null;
        eat(); // )
        if (args.length !== fn.arity) return null;
        return fn.fn(...args);
      }
      // constant or variable
      if (name.toLowerCase() in CONSTS) return CONSTS[name.toLowerCase()];
      if (name in vars) return vars[name];
      return null;
    }
    return null;
  }

  const result = parseAddSub();
  if (result === null || p !== toks.length) return null;
  return Number.isFinite(result) ? result : null;
}
