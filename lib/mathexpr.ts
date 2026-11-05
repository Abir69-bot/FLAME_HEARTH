/**
 * A small arithmetic evaluator for VESTA's math_eval tool (tests/mathexpr.test.ts). It is a hand-written
 * parser, never JavaScript eval, so the only things it can do are the operators and functions below.
 *
 * Grammar: expr = term (('+'|'-') term)* · term = unary (('*'|'/'|'%') unary)* · unary = ('-'|'+') unary | power
 *          power = atom ('^' unary)? · atom = number | constant | name '(' expr (',' expr)* ')' | '(' expr ')'
 */

const FUNCS: Record<string, { args: [number, number]; fn: (...a: number[]) => number }> = {
  sqrt: { args: [1, 1], fn: Math.sqrt },
  abs: { args: [1, 1], fn: Math.abs },
  exp: { args: [1, 1], fn: Math.exp },
  ln: { args: [1, 1], fn: Math.log },
  log10: { args: [1, 1], fn: Math.log10 },
  log2: { args: [1, 1], fn: Math.log2 },
  sin: { args: [1, 1], fn: Math.sin },
  cos: { args: [1, 1], fn: Math.cos },
  tan: { args: [1, 1], fn: Math.tan },
  round: { args: [1, 1], fn: Math.round },
  floor: { args: [1, 1], fn: Math.floor },
  ceil: { args: [1, 1], fn: Math.ceil },
  min: { args: [1, 32], fn: Math.min },
  max: { args: [1, 32], fn: Math.max },
  pow: { args: [2, 2], fn: Math.pow },
};

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

export const MAX_EXPRESSION_CHARS = 400;
const MAX_DEPTH = 40;

export class MathError extends Error {}

export interface EvalResult {
  value: number;
  /** Every number typed in the expression, so the caller can check where it came from. */
  literals: number[];
}

export function evaluate(expression: string): EvalResult {
  if (expression.length > MAX_EXPRESSION_CHARS) throw new MathError(`expression is longer than ${MAX_EXPRESSION_CHARS} characters`);
  const s = expression;
  const literals: number[] = [];
  let i = 0;
  let depth = 0;

  const skip = () => {
    while (i < s.length && /\s/.test(s[i])) i++;
  };
  const peek = () => {
    skip();
    return s[i];
  };
  const enter = () => {
    if (++depth > MAX_DEPTH) throw new MathError("expression is nested too deeply");
  };

  function expr(): number {
    enter();
    let v = term();
    for (;;) {
      const c = peek();
      if (c === "+") {
        i++;
        v += term();
      } else if (c === "-") {
        i++;
        v -= term();
      } else break;
    }
    depth--;
    return v;
  }

  function term(): number {
    let v = unary();
    for (;;) {
      const c = peek();
      if (c === "*") {
        i++;
        v *= unary();
      } else if (c === "/") {
        i++;
        const d = unary();
        if (d === 0) throw new MathError("division by zero");
        v /= d;
      } else if (c === "%") {
        i++;
        const d = unary();
        if (d === 0) throw new MathError("division by zero");
        v %= d;
      } else break;
    }
    return v;
  }

  function unary(): number {
    enter();
    const c = peek();
    let v: number;
    if (c === "-") {
      i++;
      v = -unary();
    } else if (c === "+") {
      i++;
      v = unary();
    } else v = power();
    depth--;
    return v;
  }

  function power(): number {
    const base = atom();
    if (peek() === "^") {
      i++;
      return base ** unary(); // right-associative through unary → power
    }
    return base;
  }

  function atom(): number {
    const c = peek();
    if (c === "(") {
      i++;
      const v = expr();
      if (peek() !== ")") throw new MathError("missing closing bracket");
      i++;
      return v;
    }
    if (c !== undefined && /[0-9.]/.test(c)) {
      const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(s.slice(i));
      if (!m) throw new MathError(`bad number at position ${i}`);
      i += m[0].length;
      const n = Number(m[0]);
      literals.push(n);
      return n;
    }
    if (c !== undefined && /[a-zA-Z]/.test(c)) {
      const m = /^[a-zA-Z][a-zA-Z0-9]*/.exec(s.slice(i))!;
      const name = m[0].toLowerCase();
      i += m[0].length;
      if (peek() === "(") {
        const f = Object.prototype.hasOwnProperty.call(FUNCS, name) ? FUNCS[name] : undefined;
        if (!f) throw new MathError(`unknown function "${m[0]}"`);
        i++;
        const args = [expr()];
        while (peek() === ",") {
          i++;
          args.push(expr());
        }
        if (peek() !== ")") throw new MathError("missing closing bracket");
        i++;
        if (args.length < f.args[0] || args.length > f.args[1]) throw new MathError(`wrong number of arguments for ${name}`);
        return f.fn(...args);
      }
      if (Object.prototype.hasOwnProperty.call(CONSTANTS, name)) return CONSTANTS[name];
      throw new MathError(`unknown name "${m[0]}"`);
    }
    throw new MathError(c === undefined ? "expression ended early" : `unexpected "${c}" at position ${i}`);
  }

  if (!s.trim()) throw new MathError("expression is empty");
  const value = expr();
  skip();
  if (i < s.length) throw new MathError(`unexpected "${s[i]}" at position ${i}`);
  if (!Number.isFinite(value)) throw new MathError("the result is not a finite number");
  return { value, literals };
}
