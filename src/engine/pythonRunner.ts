import type { RunResult, TestCase, TestCaseResult } from '../types';

type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'FSTRING'
  | 'IDENT'
  | 'KEYWORD'
  | 'OP'
  | 'PUNC'
  | 'NEWLINE'
  | 'INDENT'
  | 'DEDENT'
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  line: number;
}

const KEYWORDS = new Set([
  'False',
  'None',
  'True',
  'and',
  'as',
  'break',
  'continue',
  'def',
  'elif',
  'else',
  'for',
  'from',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'not',
  'or',
  'pass',
  'return',
  'while',
]);

class PyError extends Error {
  line?: number;
  constructor(message: string, line?: number) {
    super(message);
    this.line = line;
  }
}

class BreakSignal {}
class ContinueSignal {}
class ReturnSignal {
  value: PyVal;
  constructor(value: PyVal) {
    this.value = value;
  }
}

type PyTuple = { __type: 'tuple'; items: PyVal[] };
type PySet = { __type: 'set'; items: PyVal[] };
type PyDict = { __type: 'dict'; entries: Map<string, { key: PyVal; val: PyVal }> };
type PyFn = {
  __type: 'fn';
  name: string;
  params: { name: string; defaultVal?: Expr }[];
  body: Stmt[];
  closure: Env;
};
type PyBuiltinFn = {
  __type: 'builtin';
  name: string;
  call: (args: PyVal[], kwargs: Record<string, PyVal>, line: number) => PyVal;
};
type PyLambda = {
  __type: 'lambda';
  params: string[];
  body: Expr;
  closure: Env;
};
type PyModule = {
  __type: 'module';
  name: string;
  exports: Record<string, PyVal>;
};

export type PyVal =
  | number
  | string
  | boolean
  | null
  | PyVal[]
  | PyTuple
  | PySet
  | PyDict
  | PyFn
  | PyBuiltinFn
  | PyLambda
  | PyModule;

function isTuple(v: PyVal): v is PyTuple {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && (v as PyTuple).__type === 'tuple';
}
function isSet(v: PyVal): v is PySet {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && (v as PySet).__type === 'set';
}
function isDict(v: PyVal): v is PyDict {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && (v as PyDict).__type === 'dict';
}
function isFn(v: PyVal): v is PyFn {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && (v as PyFn).__type === 'fn';
}
function isBuiltin(v: PyVal): v is PyBuiltinFn {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && (v as PyBuiltinFn).__type === 'builtin';
}
function isLambda(v: PyVal): v is PyLambda {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && (v as PyLambda).__type === 'lambda';
}
function isModule(v: PyVal): v is PyModule {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && (v as PyModule).__type === 'module';
}

function keyHash(v: PyVal): string {
  if (v === null) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') {
    return `${typeof v}:${String(v)}`;
  }
  if (isTuple(v)) {
    return `tuple:[${v.items.map(keyHash).join(',')}]`;
  }
  throw new PyError('Тізім немесе өзгермелі нысан кілт ретінде қолданыла алмайды (TypeError: unhashable type)');
}

function pyTruth(v: PyVal): boolean {
  if (v === null || v === false) return false;
  if (v === true) return true;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (isTuple(v) || isSet(v)) return v.items.length > 0;
  if (isDict(v)) return v.entries.size > 0;
  return true;
}

function pyEquals(a: PyVal, b: PyVal): boolean {
  if (typeof a === 'boolean' && typeof b === 'number') return (a ? 1 : 0) === b;
  if (typeof a === 'number' && typeof b === 'boolean') return a === (b ? 1 : 0);
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => pyEquals(x, b[i]));
  }
  if (isTuple(a) && isTuple(b)) {
    return a.items.length === b.items.length && a.items.every((x, i) => pyEquals(x, b.items[i]));
  }
  if (isDict(a) && isDict(b)) {
    if (a.entries.size !== b.entries.size) return false;
    for (const [k, entry] of a.entries.entries()) {
      const other = b.entries.get(k);
      if (!other || !pyEquals(entry.val, other.val)) return false;
    }
    return true;
  }
  return false;
}

function pyRepr(v: PyVal, insideContainer = false): string {
  if (v === null) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (typeof v === 'number') {
    if (Object.is(v, -0)) return '0';
    return String(v);
  }
  if (typeof v === 'string') {
    return insideContainer ? `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'` : v;
  }
  if (Array.isArray(v)) {
    return `[${v.map((item) => pyRepr(item, true)).join(', ')}]`;
  }
  if (isTuple(v)) {
    if (v.items.length === 1) return `(${pyRepr(v.items[0], true)},)`;
    return `(${v.items.map((item) => pyRepr(item, true)).join(', ')})`;
  }
  if (isSet(v)) {
    if (v.items.length === 0) return 'set()';
    return `{${v.items.map((item) => pyRepr(item, true)).join(', ')}}`;
  }
  if (isDict(v)) {
    const parts: string[] = [];
    for (const entry of v.entries.values()) {
      parts.push(`${pyRepr(entry.key, true)}: ${pyRepr(entry.val, true)}`);
    }
    return `{${parts.join(', ')}}`;
  }
  if (isFn(v)) return `<function ${v.name}>`;
  if (isBuiltin(v)) return `<built-in function ${v.name}>`;
  if (isLambda(v)) return '<function <lambda>>';
  if (isModule(v)) return `<module '${v.name}'>`;
  return String(v);
}

function toIterable(v: PyVal, line: number): PyVal[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') return Array.from(v);
  if (isTuple(v) || isSet(v)) return v.items;
  if (isDict(v)) return Array.from(v.entries.values()).map((e) => e.key);
  throw new PyError('Бұл нысан бойынша цикл жүргізу мүмкін емес (TypeError: not iterable)', line);
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const indentStack: number[] = [0];
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let parenDepth = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineNum = lineIdx + 1;
    const rawLine = lines[lineIdx];

    // Check blank or comment-only lines when parenDepth === 0
    let pos = 0;
    let indent = 0;
    while (pos < rawLine.length && (rawLine[pos] === ' ' || rawLine[pos] === '\t')) {
      indent += rawLine[pos] === '\t' ? 4 : 1;
      pos++;
    }

    if (pos === rawLine.length || rawLine[pos] === '#') {
      continue;
    }

    if (parenDepth === 0) {
      const currentIndent = indentStack[indentStack.length - 1];
      if (indent > currentIndent) {
        indentStack.push(indent);
        tokens.push({ type: 'INDENT', value: '', line: lineNum });
      } else if (indent < currentIndent) {
        while (indentStack.length > 1 && indent < indentStack[indentStack.length - 1]) {
          indentStack.pop();
          tokens.push({ type: 'DEDENT', value: '', line: lineNum });
        }
        if (indent !== indentStack[indentStack.length - 1]) {
          throw new PyError(`Шегініс қатесі (IndentationError): ${lineNum}-жолдағы бос орындар сәйкес емес`, lineNum);
        }
      }
    }

    while (pos < rawLine.length) {
      const ch = rawLine[pos];
      if (ch === ' ' || ch === '\t') {
        pos++;
        continue;
      }
      if (ch === '#') {
        break;
      }

      // f-string
      if ((ch === 'f' || ch === 'F') && (rawLine[pos + 1] === '"' || rawLine[pos + 1] === "'")) {
        const quote = rawLine[pos + 1];
        pos += 2;
        let content = '';
        let closed = false;
        while (pos < rawLine.length) {
          const c = rawLine[pos];
          if (c === '\\' && pos + 1 < rawLine.length) {
            const next = rawLine[pos + 1];
            content += next === 'n' ? '\n' : next === 't' ? '\t' : next;
            pos += 2;
            continue;
          }
          if (c === quote) {
            pos++;
            closed = true;
            break;
          }
          content += c;
          pos++;
        }
        if (!closed) {
          throw new PyError(`Жол жабылмаған (SyntaxError: unterminated f-string)`, lineNum);
        }
        tokens.push({ type: 'FSTRING', value: content, line: lineNum });
        continue;
      }

      // normal string
      if (ch === '"' || ch === "'") {
        const quote = ch;
        // triple quote check
        if (rawLine.slice(pos, pos + 3) === quote.repeat(3)) {
          pos += 3;
          let content = '';
          let closed = false;
          while (lineIdx < lines.length) {
            const cur = lines[lineIdx];
            const endIdx = cur.indexOf(quote.repeat(3), pos);
            if (endIdx !== -1) {
              content += cur.slice(pos, endIdx);
              pos = endIdx + 3;
              closed = true;
              break;
            } else {
              content += cur.slice(pos) + '\n';
              lineIdx++;
              pos = 0;
            }
          }
          if (!closed) {
            throw new PyError(`Көп жолды мәтін жабылмаған (SyntaxError)`, lineNum);
          }
          tokens.push({ type: 'STRING', value: content, line: lineNum });
          continue;
        }
        pos++;
        let content = '';
        let closed = false;
        while (pos < rawLine.length) {
          const c = rawLine[pos];
          if (c === '\\' && pos + 1 < rawLine.length) {
            const next = rawLine[pos + 1];
            content += next === 'n' ? '\n' : next === 't' ? '\t' : next === 'r' ? '\r' : next;
            pos += 2;
            continue;
          }
          if (c === quote) {
            pos++;
            closed = true;
            break;
          }
          content += c;
          pos++;
        }
        if (!closed) {
          throw new PyError(`Жол жабылмаған (SyntaxError: unterminated string)`, lineNum);
        }
        tokens.push({ type: 'STRING', value: content, line: lineNum });
        continue;
      }

      // numbers
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(rawLine[pos + 1] ?? ''))) {
        const start = pos;
        let hasDot = false;
        while (pos < rawLine.length) {
          const c = rawLine[pos];
          if (/[0-9_]/.test(c)) {
            pos++;
          } else if (c === '.' && !hasDot && rawLine[pos + 1] !== '.') {
            hasDot = true;
            pos++;
          } else if ((c === 'e' || c === 'E') && pos > start) {
            pos++;
            if (rawLine[pos] === '+' || rawLine[pos] === '-') pos++;
          } else {
            break;
          }
        }
        const rawNum = rawLine.slice(start, pos).replace(/_/g, '');
        tokens.push({ type: 'NUMBER', value: rawNum, line: lineNum });
        continue;
      }

      // identifiers & keywords (supports unicode letters too)
      if (/[\p{L}_]/u.test(ch)) {
        const start = pos;
        while (pos < rawLine.length && /[\p{L}\p{N}_]/u.test(rawLine[pos])) {
          pos++;
        }
        const word = rawLine.slice(start, pos);
        tokens.push({
          type: KEYWORDS.has(word) ? 'KEYWORD' : 'IDENT',
          value: word,
          line: lineNum,
        });
        continue;
      }

      // multi-char operators
      const three = rawLine.slice(pos, pos + 3);
      if (three === '**=' || three === '//=' || three === '<<=' || three === '>>=') {
        tokens.push({ type: 'OP', value: three, line: lineNum });
        pos += 3;
        continue;
      }
      const two = rawLine.slice(pos, pos + 2);
      if (
        ['==', '!=', '<=', '>=', '//', '**', '+=', '-=', '*=', '/=', '%=', '<<', '>>', '->'].includes(two)
      ) {
        tokens.push({ type: 'OP', value: two, line: lineNum });
        pos += 2;
        continue;
      }

      if ('+-*/%<>=&|^~'.includes(ch)) {
        tokens.push({ type: 'OP', value: ch, line: lineNum });
        pos++;
        continue;
      }

      if ('()[]{}:,.'.includes(ch)) {
        if (ch === '(' || ch === '[' || ch === '{') parenDepth++;
        if (ch === ')' || ch === ']' || ch === '}') parenDepth = Math.max(0, parenDepth - 1);
        tokens.push({ type: 'PUNC', value: ch, line: lineNum });
        pos++;
        continue;
      }

      throw new PyError(`Танылмаған таңба '${ch}' (${lineNum}-жол)`, lineNum);
    }

    if (parenDepth === 0) {
      tokens.push({ type: 'NEWLINE', value: '\n', line: lineNum });
    }
  }

  while (indentStack.length > 1) {
    indentStack.pop();
    tokens.push({ type: 'DEDENT', value: '', line: lines.length });
  }
  tokens.push({ type: 'EOF', value: '', line: lines.length });
  return tokens;
}

// AST definitions
type Target =
  | { kind: 'var'; name: string }
  | { kind: 'index'; obj: Expr; index: Expr }
  | { kind: 'tuple'; items: Target[] };

type Stmt =
  | { kind: 'expr'; expr: Expr; line: number }
  | { kind: 'assign'; targets: Target[]; value: Expr; line: number }
  | { kind: 'augAssign'; target: Target; op: string; value: Expr; line: number }
  | { kind: 'if'; branches: { cond: Expr; body: Stmt[] }[]; elseBody?: Stmt[]; line: number }
  | { kind: 'while'; cond: Expr; body: Stmt[]; line: number }
  | { kind: 'for'; target: Target; iter: Expr; body: Stmt[]; line: number }
  | { kind: 'def'; name: string; params: { name: string; defaultExpr?: Expr }[]; body: Stmt[]; line: number }
  | { kind: 'return'; value?: Expr; line: number }
  | { kind: 'break'; line: number }
  | { kind: 'continue'; line: number }
  | { kind: 'pass'; line: number }
  | { kind: 'import'; module: string; alias?: string; names?: { name: string; alias?: string }[]; line: number };

type Expr =
  | { kind: 'literal'; val: number | string | boolean | null; line: number }
  | { kind: 'fstring'; raw: string; line: number }
  | { kind: 'ident'; name: string; line: number }
  | { kind: 'list'; items: Expr[]; line: number }
  | { kind: 'tuple'; items: Expr[]; line: number }
  | { kind: 'set'; items: Expr[]; line: number }
  | { kind: 'dict'; entries: { key: Expr; val: Expr }[]; line: number }
  | { kind: 'listcomp'; expr: Expr; target: Target; iter: Expr; cond?: Expr; line: number }
  | { kind: 'unary'; op: string; right: Expr; line: number }
  | { kind: 'binary'; op: string; left: Expr; right: Expr; line: number }
  | { kind: 'compare'; first: Expr; ops: { op: string; right: Expr }[]; line: number }
  | { kind: 'ternary'; trueExpr: Expr; cond: Expr; falseExpr: Expr; line: number }
  | { kind: 'call'; callee: Expr; args: { name?: string; expr: Expr; spread?: boolean }[]; line: number }
  | { kind: 'attr'; obj: Expr; attr: string; line: number }
  | { kind: 'index'; obj: Expr; index: Expr; line: number }
  | { kind: 'slice'; obj: Expr; start?: Expr; stop?: Expr; step?: Expr; line: number }
  | { kind: 'lambda'; params: string[]; body: Expr; line: number };

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }

  private advance(): Token {
    const t = this.peek();
    if (this.pos < this.tokens.length - 1) this.pos++;
    return t;
  }

  private match(type: TokenType, value?: string): boolean {
    const t = this.peek();
    if (t.type !== type) return false;
    if (value !== undefined && t.value !== value) return false;
    this.advance();
    return true;
  }

  private expect(type: TokenType, value?: string, msg?: string): Token {
    const t = this.peek();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new PyError(msg || `Синтаксис қатесі (SyntaxError): ${t.line}-жолда '${value ?? type}' күтілді`, t.line);
    }
    return this.advance();
  }

  private skipNewlines() {
    while (this.peek().type === 'NEWLINE') this.advance();
  }

  parseProgram(): Stmt[] {
    const stmts: Stmt[] = [];
    this.skipNewlines();
    while (this.peek().type !== 'EOF') {
      stmts.push(this.parseStmt());
      this.skipNewlines();
    }
    return stmts;
  }

  private parseBlock(): Stmt[] {
    this.expect('PUNC', ':', `':' белгісі күтілді`);
    if (this.peek().type === 'NEWLINE') {
      this.expect('NEWLINE');
      this.expect('INDENT', undefined, `Шегініс (indentation) күтілді`);
      const stmts: Stmt[] = [];
      this.skipNewlines();
      while (this.peek().type !== 'DEDENT' && this.peek().type !== 'EOF') {
        stmts.push(this.parseStmt());
        this.skipNewlines();
      }
      this.match('DEDENT');
      return stmts;
    } else {
      // single-line suite: if x > 0: print(x)
      const stmt = this.parseSimpleStmt();
      return [stmt];
    }
  }

  private parseStmt(): Stmt {
    const t = this.peek();
    if (t.type === 'KEYWORD') {
      if (t.value === 'if') return this.parseIf();
      if (t.value === 'while') return this.parseWhile();
      if (t.value === 'for') return this.parseFor();
      if (t.value === 'def') return this.parseDef();
    }
    return this.parseSimpleStmt();
  }

  private parseSimpleStmt(): Stmt {
    const t = this.peek();
    const line = t.line;
    let stmt: Stmt;

    if (t.type === 'KEYWORD') {
      if (t.value === 'return') {
        this.advance();
        if (this.peek().type === 'NEWLINE' || this.peek().type === 'EOF' || this.peek().type === 'DEDENT') {
          stmt = { kind: 'return', line };
        } else {
          const val = this.parseTupleOrExpr();
          stmt = { kind: 'return', value: val, line };
        }
        this.consumeEndOfLine();
        return stmt;
      }
      if (t.value === 'break') {
        this.advance();
        this.consumeEndOfLine();
        return { kind: 'break', line };
      }
      if (t.value === 'continue') {
        this.advance();
        this.consumeEndOfLine();
        return { kind: 'continue', line };
      }
      if (t.value === 'pass') {
        this.advance();
        this.consumeEndOfLine();
        return { kind: 'pass', line };
      }
      if (t.value === 'import') {
        this.advance();
        const mod = this.expect('IDENT').value;
        let alias: string | undefined;
        if (this.match('KEYWORD', 'as')) {
          alias = this.expect('IDENT').value;
        }
        this.consumeEndOfLine();
        return { kind: 'import', module: mod, alias, line };
      }
      if (t.value === 'from') {
        this.advance();
        const mod = this.expect('IDENT').value;
        this.expect('KEYWORD', 'import');
        const names: { name: string; alias?: string }[] = [];
        do {
          const name = this.expect('IDENT').value;
          let alias: string | undefined;
          if (this.match('KEYWORD', 'as')) {
            alias = this.expect('IDENT').value;
          }
          names.push({ name, alias });
        } while (this.match('PUNC', ','));
        this.consumeEndOfLine();
        return { kind: 'import', module: mod, names, line };
      }
    }

    const firstExpr = this.parseTupleOrExpr();

    // Check augmented assign
    const next = this.peek();
    if (next.type === 'OP' && ['+=', '-=', '*=', '/=', '//=', '%=', '**='].includes(next.value)) {
      const op = this.advance().value;
      const val = this.parseTupleOrExpr();
      this.consumeEndOfLine();
      return { kind: 'augAssign', target: this.exprToTarget(firstExpr, line), op, value: val, line };
    }

    // Check chained/normal assignment
    if (next.type === 'OP' && next.value === '=') {
      const targets: Target[] = [this.exprToTarget(firstExpr, line)];
      let rhs: Expr = firstExpr;
      while (this.match('OP', '=')) {
        const expr = this.parseTupleOrExpr();
        if (this.peek().type === 'OP' && this.peek().value === '=') {
          targets.push(this.exprToTarget(expr, line));
        } else {
          rhs = expr;
          break;
        }
      }
      this.consumeEndOfLine();
      return { kind: 'assign', targets, value: rhs, line };
    }

    this.consumeEndOfLine();
    return { kind: 'expr', expr: firstExpr, line };
  }

  private consumeEndOfLine() {
    if (this.peek().type === 'NEWLINE') this.advance();
  }

  private exprToTarget(expr: Expr, line: number): Target {
    if (expr.kind === 'ident') return { kind: 'var', name: expr.name };
    if (expr.kind === 'index') return { kind: 'index', obj: expr.obj, index: expr.index };
    if (expr.kind === 'tuple' || expr.kind === 'list') {
      return { kind: 'tuple', items: expr.items.map((item) => this.exprToTarget(item, line)) };
    }
    throw new PyError(`Меншіктеу мақсаты жарамсыз (SyntaxError: cannot assign)`, line);
  }

  private parseIf(): Stmt {
    const line = this.expect('KEYWORD', 'if').line;
    const branches: { cond: Expr; body: Stmt[] }[] = [];
    const firstCond = this.parseExpr();
    const firstBody = this.parseBlock();
    branches.push({ cond: firstCond, body: firstBody });
    this.skipNewlines();
    while (this.match('KEYWORD', 'elif')) {
      const cond = this.parseExpr();
      const body = this.parseBlock();
      branches.push({ cond, body });
      this.skipNewlines();
    }
    let elseBody: Stmt[] | undefined;
    if (this.match('KEYWORD', 'else')) {
      elseBody = this.parseBlock();
    }
    return { kind: 'if', branches, elseBody, line };
  }

  private parseWhile(): Stmt {
    const line = this.expect('KEYWORD', 'while').line;
    const cond = this.parseExpr();
    const body = this.parseBlock();
    return { kind: 'while', cond, body, line };
  }

  private parseFor(): Stmt {
    const line = this.expect('KEYWORD', 'for').line;
    const targetExpr = this.parseTargetList();
    this.expect('KEYWORD', 'in');
    const iter = this.parseTupleOrExpr();
    const body = this.parseBlock();
    return { kind: 'for', target: this.exprToTarget(targetExpr, line), iter, body, line };
  }

  private parseTargetList(): Expr {
    const line = this.peek().line;
    const first = this.parsePostfix();
    if (this.peek().type === 'PUNC' && this.peek().value === ',') {
      const items = [first];
      while (this.match('PUNC', ',')) {
        if (this.peek().type === 'KEYWORD' && this.peek().value === 'in') break;
        items.push(this.parsePostfix());
      }
      return { kind: 'tuple', items, line };
    }
    return first;
  }

  private parseDef(): Stmt {
    const line = this.expect('KEYWORD', 'def').line;
    const name = this.expect('IDENT').value;
    this.expect('PUNC', '(');
    const params: { name: string; defaultExpr?: Expr }[] = [];
    if (!this.match('PUNC', ')')) {
      do {
        if (this.peek().type === 'PUNC' && this.peek().value === ')') break;
        const pName = this.expect('IDENT').value;
        let defaultExpr: Expr | undefined;
        if (this.match('OP', '=')) {
          defaultExpr = this.parseExpr();
        }
        params.push({ name: pName, defaultExpr });
      } while (this.match('PUNC', ','));
      this.expect('PUNC', ')');
    }
    const body = this.parseBlock();
    return { kind: 'def', name, params, body, line };
  }

  private parseTupleOrExpr(): Expr {
    const line = this.peek().line;
    const first = this.parseExpr();
    if (this.peek().type === 'PUNC' && this.peek().value === ',') {
      const items = [first];
      while (this.match('PUNC', ',')) {
        const nxt = this.peek();
        if (
          nxt.type === 'NEWLINE' ||
          nxt.type === 'EOF' ||
          nxt.type === 'DEDENT' ||
          (nxt.type === 'OP' && nxt.value === '=') ||
          (nxt.type === 'PUNC' && [')', ']', '}'].includes(nxt.value))
        ) {
          break;
        }
        items.push(this.parseExpr());
      }
      return { kind: 'tuple', items, line };
    }
    return first;
  }

  private parseExpr(): Expr {
    if (this.peek().type === 'KEYWORD' && this.peek().value === 'lambda') {
      const line = this.advance().line;
      const params: string[] = [];
      if (!(this.peek().type === 'PUNC' && this.peek().value === ':')) {
        do {
          params.push(this.expect('IDENT').value);
        } while (this.match('PUNC', ','));
      }
      this.expect('PUNC', ':');
      const body = this.parseExpr();
      return { kind: 'lambda', params, body, line };
    }
    const expr = this.parseOr();
    if (this.match('KEYWORD', 'if')) {
      const line = expr.line;
      const cond = this.parseOr();
      this.expect('KEYWORD', 'else');
      const falseExpr = this.parseExpr();
      return { kind: 'ternary', trueExpr: expr, cond, falseExpr, line };
    }
    return expr;
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.match('KEYWORD', 'or')) {
      const right = this.parseAnd();
      left = { kind: 'binary', op: 'or', left, right, line: left.line };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.match('KEYWORD', 'and')) {
      const right = this.parseNot();
      left = { kind: 'binary', op: 'and', left, right, line: left.line };
    }
    return left;
  }

  private parseNot(): Expr {
    if (this.peek().type === 'KEYWORD' && this.peek().value === 'not') {
      const line = this.advance().line;
      return { kind: 'unary', op: 'not', right: this.parseNot(), line };
    }
    return this.parseCompare();
  }

  private parseCompare(): Expr {
    const first = this.parseBitOr();
    const ops: { op: string; right: Expr }[] = [];
    while (true) {
      const t = this.peek();
      if (t.type === 'OP' && ['==', '!=', '<', '<=', '>', '>='].includes(t.value)) {
        this.advance();
        ops.push({ op: t.value, right: this.parseBitOr() });
      } else if (t.type === 'KEYWORD' && t.value === 'in') {
        this.advance();
        ops.push({ op: 'in', right: this.parseBitOr() });
      } else if (t.type === 'KEYWORD' && t.value === 'not' && this.peek(1).type === 'KEYWORD' && this.peek(1).value === 'in') {
        this.advance();
        this.advance();
        ops.push({ op: 'not in', right: this.parseBitOr() });
      } else if (t.type === 'KEYWORD' && t.value === 'is') {
        this.advance();
        if (this.match('KEYWORD', 'not')) {
          ops.push({ op: 'is not', right: this.parseBitOr() });
        } else {
          ops.push({ op: 'is', right: this.parseBitOr() });
        }
      } else {
        break;
      }
    }
    if (ops.length === 0) return first;
    return { kind: 'compare', first, ops, line: first.line };
  }

  private parseBitOr(): Expr {
    let left = this.parseBitXor();
    while (this.match('OP', '|')) {
      left = { kind: 'binary', op: '|', left, right: this.parseBitXor(), line: left.line };
    }
    return left;
  }

  private parseBitXor(): Expr {
    let left = this.parseBitAnd();
    while (this.match('OP', '^')) {
      left = { kind: 'binary', op: '^', left, right: this.parseBitAnd(), line: left.line };
    }
    return left;
  }

  private parseBitAnd(): Expr {
    let left = this.parseShift();
    while (this.match('OP', '&')) {
      left = { kind: 'binary', op: '&', left, right: this.parseShift(), line: left.line };
    }
    return left;
  }

  private parseShift(): Expr {
    let left = this.parseAdd();
    while (this.peek().type === 'OP' && (this.peek().value === '<<' || this.peek().value === '>>')) {
      const op = this.advance().value;
      left = { kind: 'binary', op, left, right: this.parseAdd(), line: left.line };
    }
    return left;
  }

  private parseAdd(): Expr {
    let left = this.parseMul();
    while (this.peek().type === 'OP' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.advance().value;
      left = { kind: 'binary', op, left, right: this.parseMul(), line: left.line };
    }
    return left;
  }

  private parseMul(): Expr {
    let left = this.parseUnary();
    while (this.peek().type === 'OP' && ['*', '/', '//', '%'].includes(this.peek().value)) {
      const op = this.advance().value;
      left = { kind: 'binary', op, left, right: this.parseUnary(), line: left.line };
    }
    return left;
  }

  private parseUnary(): Expr {
    const t = this.peek();
    if (t.type === 'OP' && (t.value === '-' || t.value === '+' || t.value === '~')) {
      this.advance();
      return { kind: 'unary', op: t.value, right: this.parseUnary(), line: t.line };
    }
    return this.parsePow();
  }

  private parsePow(): Expr {
    const left = this.parsePostfix();
    if (this.match('OP', '**')) {
      return { kind: 'binary', op: '**', left, right: this.parseUnary(), line: left.line };
    }
    return left;
  }

  private parsePostfix(): Expr {
    let expr = this.parseAtom();
    while (true) {
      if (this.match('PUNC', '(')) {
        const args: { name?: string; expr: Expr; spread?: boolean }[] = [];
        if (!this.match('PUNC', ')')) {
          do {
            if (this.peek().type === 'PUNC' && this.peek().value === ')') break;
            if (this.match('OP', '*')) {
              args.push({ expr: this.parseExpr(), spread: true });
            } else if (
              this.peek().type === 'IDENT' &&
              this.peek(1).type === 'OP' &&
              this.peek(1).value === '='
            ) {
              const name = this.advance().value;
              this.advance();
              args.push({ name, expr: this.parseExpr() });
            } else {
              const firstArgExpr = this.parseExpr();
              if (args.length === 0 && this.match('KEYWORD', 'for')) {
                const targetExpr = this.parseTargetList();
                this.expect('KEYWORD', 'in');
                const iter = this.parseOr();
                let cond: Expr | undefined;
                if (this.match('KEYWORD', 'if')) {
                  cond = this.parseExpr();
                }
                args.push({
                  expr: {
                    kind: 'listcomp',
                    expr: firstArgExpr,
                    target: this.exprToTarget(targetExpr, expr.line),
                    iter,
                    cond,
                    line: expr.line,
                  },
                });
                break;
              }
              args.push({ expr: firstArgExpr });
            }
          } while (this.match('PUNC', ','));
          this.expect('PUNC', ')');
        }
        expr = { kind: 'call', callee: expr, args, line: expr.line };
      } else if (this.match('PUNC', '.')) {
        const attr = this.expect('IDENT').value;
        expr = { kind: 'attr', obj: expr, attr, line: expr.line };
      } else if (this.match('PUNC', '[')) {
        let start: Expr | undefined;
        if (!(this.peek().type === 'PUNC' && this.peek().value === ':')) {
          start = this.parseExpr();
        }
        if (this.match('PUNC', ':')) {
          let stop: Expr | undefined;
          let step: Expr | undefined;
          if (!(this.peek().type === 'PUNC' && (this.peek().value === ':' || this.peek().value === ']'))) {
            stop = this.parseExpr();
          }
          if (this.match('PUNC', ':')) {
            if (!(this.peek().type === 'PUNC' && this.peek().value === ']')) {
              step = this.parseExpr();
            }
          }
          this.expect('PUNC', ']');
          expr = { kind: 'slice', obj: expr, start, stop, step, line: expr.line };
        } else {
          this.expect('PUNC', ']');
          if (!start) throw new PyError(`Индекс бос болмауы тиіс`, expr.line);
          expr = { kind: 'index', obj: expr, index: start, line: expr.line };
        }
      } else {
        break;
      }
    }
    return expr;
  }

  private parseAtom(): Expr {
    const t = this.peek();
    if (t.type === 'NUMBER') {
      this.advance();
      return { kind: 'literal', val: Number(t.value), line: t.line };
    }
    if (t.type === 'STRING') {
      this.advance();
      return { kind: 'literal', val: t.value, line: t.line };
    }
    if (t.type === 'FSTRING') {
      this.advance();
      return { kind: 'fstring', raw: t.value, line: t.line };
    }
    if (t.type === 'KEYWORD') {
      if (t.value === 'True') {
        this.advance();
        return { kind: 'literal', val: true, line: t.line };
      }
      if (t.value === 'False') {
        this.advance();
        return { kind: 'literal', val: false, line: t.line };
      }
      if (t.value === 'None') {
        this.advance();
        return { kind: 'literal', val: null, line: t.line };
      }
    }
    if (t.type === 'IDENT') {
      this.advance();
      return { kind: 'ident', name: t.value, line: t.line };
    }
    if (this.match('PUNC', '(')) {
      if (this.match('PUNC', ')')) {
        return { kind: 'tuple', items: [], line: t.line };
      }
      const first = this.parseExpr();
      if (this.match('KEYWORD', 'for')) {
        const targetExpr = this.parseTargetList();
        this.expect('KEYWORD', 'in');
        const iter = this.parseOr();
        let cond: Expr | undefined;
        if (this.match('KEYWORD', 'if')) {
          cond = this.parseExpr();
        }
        this.expect('PUNC', ')');
        return {
          kind: 'listcomp',
          expr: first,
          target: this.exprToTarget(targetExpr, t.line),
          iter,
          cond,
          line: t.line,
        };
      }
      if (this.match('PUNC', ',')) {
        const items = [first];
        while (this.peek().type !== 'PUNC' || this.peek().value !== ')') {
          items.push(this.parseExpr());
          if (!this.match('PUNC', ',')) break;
        }
        this.expect('PUNC', ')');
        return { kind: 'tuple', items, line: t.line };
      }
      this.expect('PUNC', ')');
      return first;
    }
    if (this.match('PUNC', '[')) {
      if (this.match('PUNC', ']')) {
        return { kind: 'list', items: [], line: t.line };
      }
      const first = this.parseExpr();
      if (this.match('KEYWORD', 'for')) {
        const targetExpr = this.parseTargetList();
        this.expect('KEYWORD', 'in');
        const iter = this.parseOr();
        let cond: Expr | undefined;
        if (this.match('KEYWORD', 'if')) {
          cond = this.parseExpr();
        }
        this.expect('PUNC', ']');
        return {
          kind: 'listcomp',
          expr: first,
          target: this.exprToTarget(targetExpr, t.line),
          iter,
          cond,
          line: t.line,
        };
      }
      const items = [first];
      while (this.match('PUNC', ',')) {
        if (this.peek().type === 'PUNC' && this.peek().value === ']') break;
        items.push(this.parseExpr());
      }
      this.expect('PUNC', ']');
      return { kind: 'list', items, line: t.line };
    }
    if (this.match('PUNC', '{')) {
      if (this.match('PUNC', '}')) {
        return { kind: 'dict', entries: [], line: t.line };
      }
      const first = this.parseExpr();
      if (this.match('PUNC', ':')) {
        const firstVal = this.parseExpr();
        const entries = [{ key: first, val: firstVal }];
        while (this.match('PUNC', ',')) {
          if (this.peek().type === 'PUNC' && this.peek().value === '}') break;
          const k = this.parseExpr();
          this.expect('PUNC', ':');
          const v = this.parseExpr();
          entries.push({ key: k, val: v });
        }
        this.expect('PUNC', '}');
        return { kind: 'dict', entries, line: t.line };
      }
      const items = [first];
      while (this.match('PUNC', ',')) {
        if (this.peek().type === 'PUNC' && this.peek().value === '}') break;
        items.push(this.parseExpr());
      }
      this.expect('PUNC', '}');
      return { kind: 'set', items, line: t.line };
    }

    throw new PyError(`Күтпеген өрнек '${t.value}' (${t.line}-жол)`, t.line);
  }
}

class Env {
  vars: Map<string, PyVal> = new Map();
  parent?: Env;
  constructor(parent?: Env) {
    this.parent = parent;
  }
  get(name: string): PyVal | undefined {
    if (this.vars.has(name)) return this.vars.get(name);
    return this.parent?.get(name);
  }
  has(name: string): boolean {
    if (this.vars.has(name)) return true;
    return this.parent ? this.parent.has(name) : false;
  }
  set(name: string, val: PyVal) {
    this.vars.set(name, val);
  }
}

function gcd(a: number, b: number): number {
  a = Math.abs(Math.trunc(a));
  b = Math.abs(Math.trunc(b));
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

class Interpreter {
  private output: string[] = [];
  private stdinLines: string[];
  private stdinIndex = 0;
  private steps = 0;
  private maxSteps = 120000;
  private callDepth = 0;
  private maxCallDepth = 400;
  private globalEnv: Env;

  constructor(stdin: string) {
    this.stdinLines = stdin.length > 0 ? stdin.replace(/\r\n/g, '\n').split('\n') : [];
    this.globalEnv = new Env();
    this.registerBuiltins();
  }

  private tick(line: number) {
    this.steps++;
    if (this.steps > this.maxSteps) {
      throw new PyError(`Орындау уақыты шектелді (шексіз цикл немесе тым көп қадам)`, line);
    }
  }

  private registerBuiltins() {
    const b = (name: string, call: (args: PyVal[], kwargs: Record<string, PyVal>, line: number) => PyVal): PyBuiltinFn => ({
      __type: 'builtin',
      name,
      call,
    });

    this.globalEnv.set(
      'print',
      b('print', (args, kwargs) => {
        const sep = typeof kwargs.sep === 'string' ? kwargs.sep : ' ';
        const end = typeof kwargs.end === 'string' ? kwargs.end : '\n';
        const lineStr = args.map((a) => pyRepr(a, false)).join(sep) + end;
        this.output.push(lineStr);
        return null;
      })
    );

    this.globalEnv.set(
      'input',
      b('input', (args) => {
        if (args.length > 0 && args[0] !== null) {
          // Do not pollute competitive output with prompt unless passed, wait: in interactive mode prompt is helpful if stdout? Standard competitive judges don't pass prompt, or if passed ignore or print? Let's print prompt only if non-empty.
        }
        if (this.stdinIndex >= this.stdinLines.length) {
          return '';
        }
        const line = this.stdinLines[this.stdinIndex++];
        return line;
      })
    );

    this.globalEnv.set(
      'int',
      b('int', (args, _, line) => {
        if (args.length === 0) return 0;
        const v = args[0];
        const base = args.length > 1 ? Number(args[1]) : 10;
        if (typeof v === 'number') return Math.trunc(v);
        if (typeof v === 'boolean') return v ? 1 : 0;
        if (typeof v === 'string') {
          const parsed = base === 10 ? Number(v.trim()) : parseInt(v.trim(), base);
          if (Number.isNaN(parsed)) {
            throw new PyError(`Мәнді бүтін санға айналдыру мүмкін емес (ValueError: '${v}')`, line);
          }
          return Math.trunc(parsed);
        }
        throw new PyError(`int() түрі жарамсыз (TypeError)`, line);
      })
    );

    this.globalEnv.set(
      'float',
      b('float', (args, _, line) => {
        if (args.length === 0) return 0.0;
        const v = args[0];
        if (typeof v === 'number') return v;
        if (typeof v === 'boolean') return v ? 1.0 : 0.0;
        if (typeof v === 'string') {
          const n = Number(v.trim());
          if (Number.isNaN(n)) throw new PyError(`ValueError: '${v}' нақты сан емес`, line);
          return n;
        }
        throw new PyError(`float() түрі жарамсыз`, line);
      })
    );

    this.globalEnv.set('str', b('str', (args) => (args.length === 0 ? '' : pyRepr(args[0], false))));
    this.globalEnv.set('bool', b('bool', (args) => (args.length === 0 ? false : pyTruth(args[0]))));

    this.globalEnv.set(
      'len',
      b('len', (args, _, line) => {
        const v = args[0];
        if (typeof v === 'string' || Array.isArray(v)) return v.length;
        if (isTuple(v) || isSet(v)) return v.items.length;
        if (isDict(v)) return v.entries.size;
        throw new PyError(`len() бұл нысан үшін қолданылмайды (TypeError)`, line);
      })
    );

    this.globalEnv.set(
      'range',
      b('range', (args, _, line) => {
        let start = 0;
        let stop = 0;
        let step = 1;
        if (args.length === 1) {
          stop = Number(args[0]);
        } else if (args.length === 2) {
          start = Number(args[0]);
          stop = Number(args[1]);
        } else if (args.length === 3) {
          start = Number(args[0]);
          stop = Number(args[1]);
          step = Number(args[2]);
        } else {
          throw new PyError(`range() аргумент саны қате`, line);
        }
        if (step === 0) throw new PyError(`range() қадамы 0 бола алмайды (ValueError)`, line);
        const res: number[] = [];
        if (step > 0) {
          for (let i = start; i < stop; i += step) {
            res.push(i);
            if (res.length > 50000) throw new PyError(`range() тым үлкен`, line);
          }
        } else {
          for (let i = start; i > stop; i += step) {
            res.push(i);
            if (res.length > 50000) throw new PyError(`range() тым үлкен`, line);
          }
        }
        return res;
      })
    );

    this.globalEnv.set(
      'list',
      b('list', (args, _, line) => (args.length === 0 ? [] : [...toIterable(args[0], line)]))
    );
    this.globalEnv.set(
      'tuple',
      b('tuple', (args, _, line) => ({ __type: 'tuple', items: args.length === 0 ? [] : [...toIterable(args[0], line)] }))
    );
    this.globalEnv.set(
      'set',
      b('set', (args, _, line) => {
        const seen = new Set<string>();
        const items: PyVal[] = [];
        if (args.length > 0) {
          for (const x of toIterable(args[0], line)) {
            const k = keyHash(x);
            if (!seen.has(k)) {
              seen.add(k);
              items.push(x);
            }
          }
        }
        return { __type: 'set', items };
      })
    );
    this.globalEnv.set(
      'dict',
      b('dict', () => ({ __type: 'dict', entries: new Map() }))
    );

    this.globalEnv.set(
      'sum',
      b('sum', (args, _, line) => {
        const items = toIterable(args[0], line);
        let acc = args.length > 1 ? Number(args[1]) : 0;
        for (const it of items) {
          if (typeof it !== 'number') throw new PyError(`sum() тек сандарды қосады`, line);
          acc += it;
        }
        return acc;
      })
    );

    this.globalEnv.set(
      'min',
      b('min', (args, _, line) => {
        const items = args.length === 1 ? toIterable(args[0], line) : args;
        if (items.length === 0) throw new PyError(`min() бос тізімге қолданылмайды`, line);
        return items.reduce((a, c) => (this.compareVals(c, a, '<', line) ? c : a));
      })
    );

    this.globalEnv.set(
      'max',
      b('max', (args, _, line) => {
        const items = args.length === 1 ? toIterable(args[0], line) : args;
        if (items.length === 0) throw new PyError(`max() бос тізімге қолданылмайды`, line);
        return items.reduce((a, c) => (this.compareVals(c, a, '>', line) ? c : a));
      })
    );

    this.globalEnv.set('abs', b('abs', (args) => Math.abs(Number(args[0]))));
    this.globalEnv.set(
      'round',
      b('round', (args) => {
        const n = Number(args[0]);
        const d = args.length > 1 ? Number(args[1]) : 0;
        const f = Math.pow(10, d);
        return Math.round(n * f) / f;
      })
    );
    this.globalEnv.set('pow', b('pow', (args) => Math.pow(Number(args[0]), Number(args[1]))));

    this.globalEnv.set(
      'sorted',
      b('sorted', (args, kwargs, line) => {
        const items = [...toIterable(args[0], line)];
        const keyFn = kwargs.key;
        const rev = pyTruth(kwargs.reverse ?? false);
        const decorated = items.map((item) => ({
          item,
          key: keyFn ? this.callValue(keyFn, [item], {}, line) : item,
        }));
        decorated.sort((a, b) => {
          if (this.compareVals(a.key, b.key, '<', line)) return rev ? 1 : -1;
          if (this.compareVals(a.key, b.key, '>', line)) return rev ? -1 : 1;
          return 0;
        });
        return decorated.map((d) => d.item);
      })
    );

    this.globalEnv.set(
      'reversed',
      b('reversed', (args, _, line) => [...toIterable(args[0], line)].reverse())
    );

    this.globalEnv.set(
      'enumerate',
      b('enumerate', (args, _, line) => {
        const start = args.length > 1 ? Number(args[1]) : 0;
        return toIterable(args[0], line).map((item, idx) => ({
          __type: 'tuple' as const,
          items: [start + idx, item],
        }));
      })
    );

    this.globalEnv.set(
      'zip',
      b('zip', (args, _, line) => {
        const iters = args.map((a) => toIterable(a, line));
        if (iters.length === 0) return [];
        const minLen = Math.min(...iters.map((it) => it.length));
        const res: PyTuple[] = [];
        for (let i = 0; i < minLen; i++) {
          res.push({ __type: 'tuple', items: iters.map((it) => it[i]) });
        }
        return res;
      })
    );

    this.globalEnv.set(
      'map',
      b('map', (args, _, line) => {
        const fn = args[0];
        const items = toIterable(args[1], line);
        return items.map((it) => this.callValue(fn, [it], {}, line));
      })
    );

    this.globalEnv.set(
      'filter',
      b('filter', (args, _, line) => {
        const fn = args[0];
        const items = toIterable(args[1], line);
        return items.filter((it) => pyTruth(fn === null ? it : this.callValue(fn, [it], {}, line)));
      })
    );

    this.globalEnv.set(
      'any',
      b('any', (args, _, line) => toIterable(args[0], line).some(pyTruth))
    );
    this.globalEnv.set(
      'all',
      b('all', (args, _, line) => toIterable(args[0], line).every(pyTruth))
    );
    this.globalEnv.set('ord', b('ord', (args) => String(args[0]).charCodeAt(0)));
    this.globalEnv.set('chr', b('chr', (args) => String.fromCharCode(Number(args[0]))));
    this.globalEnv.set('bin', b('bin', (args) => '0b' + Number(args[0]).toString(2)));
    this.globalEnv.set(
      'divmod',
      b('divmod', (args) => {
        const a = Number(args[0]);
        const bv = Number(args[1]);
        return { __type: 'tuple', items: [Math.floor(a / bv), ((a % bv) + bv) % bv] };
      })
    );
  }

  private getMathModule(): PyModule {
    const b = (name: string, call: (args: PyVal[], kwargs: Record<string, PyVal>, line: number) => PyVal): PyBuiltinFn => ({
      __type: 'builtin',
      name,
      call,
    });
    return {
      __type: 'module',
      name: 'math',
      exports: {
        gcd: b('gcd', (args) => gcd(Number(args[0]), Number(args[1]))),
        lcm: b('lcm', (args) => {
          const a = Math.abs(Math.trunc(Number(args[0])));
          const bv = Math.abs(Math.trunc(Number(args[1])));
          return a === 0 || bv === 0 ? 0 : (a / gcd(a, bv)) * bv;
        }),
        sqrt: b('sqrt', (args) => Math.sqrt(Number(args[0]))),
        floor: b('floor', (args) => Math.floor(Number(args[0]))),
        ceil: b('ceil', (args) => Math.ceil(Number(args[0]))),
        fabs: b('fabs', (args) => Math.abs(Number(args[0]))),
        factorial: b('factorial', (args) => {
          let n = Math.trunc(Number(args[0]));
          let res = 1;
          for (let i = 2; i <= n; i++) res *= i;
          return res;
        }),
        pi: Math.PI,
        e: Math.E,
        inf: Infinity,
      },
    };
  }

  run(stmts: Stmt[]): string {
    for (const s of stmts) {
      this.execStmt(s, this.globalEnv);
    }
    return this.output.join('');
  }

  private execBlock(stmts: Stmt[], env: Env) {
    for (const s of stmts) {
      this.execStmt(s, env);
    }
  }

  private assignTarget(target: Target, val: PyVal, env: Env, line: number) {
    if (target.kind === 'var') {
      env.set(target.name, val);
      return;
    }
    if (target.kind === 'index') {
      const obj = this.evalExpr(target.obj, env);
      const idx = this.evalExpr(target.index, env);
      if (Array.isArray(obj)) {
        let i = Number(idx);
        if (i < 0) i += obj.length;
        if (i < 0 || i >= obj.length) throw new PyError(`Тізім индексі шектен тыс (IndexError)`, line);
        obj[i] = val;
        return;
      }
      if (isDict(obj)) {
        obj.entries.set(keyHash(idx), { key: idx, val });
        return;
      }
      throw new PyError(`Бұл нысан элементін өзгерту мүмкін емес (TypeError)`, line);
    }
    if (target.kind === 'tuple') {
      const items = toIterable(val, line);
      if (items.length !== target.items.length) {
        throw new PyError(`Мәндер саны айнымалылар санына сәйкес емес (ValueError: ${items.length} != ${target.items.length})`, line);
      }
      for (let i = 0; i < target.items.length; i++) {
        this.assignTarget(target.items[i], items[i], env, line);
      }
    }
  }

  private readTarget(target: Target, env: Env, line: number): PyVal {
    if (target.kind === 'var') {
      const val = env.get(target.name);
      if (val === undefined) throw new PyError(`Айнымалы табылмады: '${target.name}' (NameError)`, line);
      return val;
    }
    if (target.kind === 'index') {
      return this.evalIndex(this.evalExpr(target.obj, env), this.evalExpr(target.index, env), line);
    }
    throw new PyError(`Жарамсыз мақсат`, line);
  }

  private execStmt(stmt: Stmt, env: Env) {
    this.tick(stmt.line);
    switch (stmt.kind) {
      case 'pass':
        return;
      case 'break':
        throw new BreakSignal();
      case 'continue':
        throw new ContinueSignal();
      case 'return': {
        const v = stmt.value ? this.evalExpr(stmt.value, env) : null;
        throw new ReturnSignal(v);
      }
      case 'expr':
        this.evalExpr(stmt.expr, env);
        return;
      case 'assign': {
        const val = this.evalExpr(stmt.value, env);
        for (const t of stmt.targets) {
          this.assignTarget(t, val, env, stmt.line);
        }
        return;
      }
      case 'augAssign': {
        const cur = this.readTarget(stmt.target, env, stmt.line);
        const rhs = this.evalExpr(stmt.value, env);
        const op = stmt.op.slice(0, -1);
        const nextVal = this.applyBinary(op, cur, rhs, stmt.line);
        this.assignTarget(stmt.target, nextVal, env, stmt.line);
        return;
      }
      case 'if': {
        for (const br of stmt.branches) {
          if (pyTruth(this.evalExpr(br.cond, env))) {
            this.execBlock(br.body, env);
            return;
          }
        }
        if (stmt.elseBody) {
          this.execBlock(stmt.elseBody, env);
        }
        return;
      }
      case 'while': {
        while (pyTruth(this.evalExpr(stmt.cond, env))) {
          this.tick(stmt.line);
          try {
            this.execBlock(stmt.body, env);
          } catch (sig) {
            if (sig instanceof BreakSignal) break;
            if (sig instanceof ContinueSignal) continue;
            throw sig;
          }
        }
        return;
      }
      case 'for': {
        const iterVal = this.evalExpr(stmt.iter, env);
        const items = toIterable(iterVal, stmt.line);
        for (const item of items) {
          this.tick(stmt.line);
          this.assignTarget(stmt.target, item, env, stmt.line);
          try {
            this.execBlock(stmt.body, env);
          } catch (sig) {
            if (sig instanceof BreakSignal) break;
            if (sig instanceof ContinueSignal) continue;
            throw sig;
          }
        }
        return;
      }
      case 'def': {
        const params = stmt.params.map((p) => ({ name: p.name, defaultVal: p.defaultExpr }));
        const fn: PyFn = {
          __type: 'fn',
          name: stmt.name,
          params,
          body: stmt.body,
          closure: env,
        };
        env.set(stmt.name, fn);
        return;
      }
      case 'import': {
        if (stmt.module === 'math') {
          const mod = this.getMathModule();
          if (stmt.names) {
            for (const n of stmt.names) {
              if (n.name in mod.exports) {
                env.set(n.alias ?? n.name, mod.exports[n.name]);
              }
            }
          } else {
            env.set(stmt.alias ?? stmt.module, mod);
          }
        }
        return;
      }
    }
  }

  private evalExpr(expr: Expr, env: Env): PyVal {
    this.tick(expr.line);
    switch (expr.kind) {
      case 'literal':
        return expr.val;
      case 'fstring':
        return this.evalFString(expr.raw, env, expr.line);
      case 'ident': {
        const v = env.get(expr.name);
        if (v === undefined) {
          throw new PyError(`Айнымалы немесе функция табылмады: '${expr.name}' (NameError)`, expr.line);
        }
        return v;
      }
      case 'list':
        return expr.items.map((it) => this.evalExpr(it, env));
      case 'tuple':
        return { __type: 'tuple', items: expr.items.map((it) => this.evalExpr(it, env)) };
      case 'set': {
        const seen = new Set<string>();
        const items: PyVal[] = [];
        for (const it of expr.items) {
          const v = this.evalExpr(it, env);
          const k = keyHash(v);
          if (!seen.has(k)) {
            seen.add(k);
            items.push(v);
          }
        }
        return { __type: 'set', items };
      }
      case 'dict': {
        const entries = new Map<string, { key: PyVal; val: PyVal }>();
        for (const e of expr.entries) {
          const k = this.evalExpr(e.key, env);
          const v = this.evalExpr(e.val, env);
          entries.set(keyHash(k), { key: k, val: v });
        }
        return { __type: 'dict', entries };
      }
      case 'listcomp': {
        const compEnv = new Env(env);
        const items = toIterable(this.evalExpr(expr.iter, env), expr.line);
        const res: PyVal[] = [];
        for (const item of items) {
          this.tick(expr.line);
          this.assignTarget(expr.target, item, compEnv, expr.line);
          if (!expr.cond || pyTruth(this.evalExpr(expr.cond, compEnv))) {
            res.push(this.evalExpr(expr.expr, compEnv));
          }
        }
        return res;
      }
      case 'unary': {
        const r = this.evalExpr(expr.right, env);
        if (expr.op === 'not') return !pyTruth(r);
        if (expr.op === '-') return -Number(r);
        if (expr.op === '+') return +Number(r);
        if (expr.op === '~') return ~Math.trunc(Number(r));
        return r;
      }
      case 'binary': {
        if (expr.op === 'and') {
          const l = this.evalExpr(expr.left, env);
          return pyTruth(l) ? this.evalExpr(expr.right, env) : l;
        }
        if (expr.op === 'or') {
          const l = this.evalExpr(expr.left, env);
          return pyTruth(l) ? l : this.evalExpr(expr.right, env);
        }
        const l = this.evalExpr(expr.left, env);
        const r = this.evalExpr(expr.right, env);
        return this.applyBinary(expr.op, l, r, expr.line);
      }
      case 'compare': {
        let left = this.evalExpr(expr.first, env);
        for (const step of expr.ops) {
          const right = this.evalExpr(step.right, env);
          if (!this.compareVals(left, right, step.op, expr.line)) return false;
          left = right;
        }
        return true;
      }
      case 'ternary': {
        return pyTruth(this.evalExpr(expr.cond, env))
          ? this.evalExpr(expr.trueExpr, env)
          : this.evalExpr(expr.falseExpr, env);
      }
      case 'lambda':
        return { __type: 'lambda', params: expr.params, body: expr.body, closure: env };
      case 'attr': {
        const obj = this.evalExpr(expr.obj, env);
        return this.evalAttr(obj, expr.attr, expr.line);
      }
      case 'index': {
        const obj = this.evalExpr(expr.obj, env);
        const idx = this.evalExpr(expr.index, env);
        return this.evalIndex(obj, idx, expr.line);
      }
      case 'slice': {
        const obj = this.evalExpr(expr.obj, env);
        const start = expr.start ? Number(this.evalExpr(expr.start, env)) : undefined;
        const stop = expr.stop ? Number(this.evalExpr(expr.stop, env)) : undefined;
        const step = expr.step ? Number(this.evalExpr(expr.step, env)) : 1;
        return this.evalSlice(obj, start, stop, step, expr.line);
      }
      case 'call': {
        const callee = this.evalExpr(expr.callee, env);
        const posArgs: PyVal[] = [];
        const kwargs: Record<string, PyVal> = {};
        for (const a of expr.args) {
          const val = this.evalExpr(a.expr, env);
          if (a.spread) {
            posArgs.push(...toIterable(val, expr.line));
          } else if (a.name) {
            kwargs[a.name] = val;
          } else {
            posArgs.push(val);
          }
        }
        return this.callValue(callee, posArgs, kwargs, expr.line);
      }
    }
  }

  private evalFString(raw: string, env: Env, line: number): string {
    let out = '';
    let i = 0;
    while (i < raw.length) {
      if (raw[i] === '{') {
        if (raw[i + 1] === '{') {
          out += '{';
          i += 2;
          continue;
        }
        let depth = 1;
        let j = i + 1;
        while (j < raw.length && depth > 0) {
          if (raw[j] === '{') depth++;
          else if (raw[j] === '}') depth--;
          j++;
        }
        const inner = raw.slice(i + 1, j - 1);
        const colonIdx = inner.indexOf(':');
        const exprText = colonIdx !== -1 ? inner.slice(0, colonIdx) : inner;
        const fmt = colonIdx !== -1 ? inner.slice(colonIdx + 1) : '';
        const parser = new Parser(tokenize(exprText));
        const ast = parser.parseProgram();
        if (ast.length > 0 && ast[0].kind === 'expr') {
          const val = this.evalExpr(ast[0].expr, env);
          const matchFloat = fmt.match(/^\.(\d+)f$/);
          if (matchFloat && typeof val === 'number') {
            out += val.toFixed(Number(matchFloat[1]));
          } else {
            out += pyRepr(val, false);
          }
        }
        i = j;
      } else if (raw[i] === '}' && raw[i + 1] === '}') {
        out += '}';
        i += 2;
      } else {
        out += raw[i];
        i++;
      }
    }
    return out;
  }

  private callValue(callee: PyVal, args: PyVal[], kwargs: Record<string, PyVal>, line: number): PyVal {
    if (isBuiltin(callee)) {
      return callee.call(args, kwargs, line);
    }
    if (isLambda(callee)) {
      const fnEnv = new Env(callee.closure);
      callee.params.forEach((p, i) => fnEnv.set(p, args[i] ?? null));
      return this.evalExpr(callee.body, fnEnv);
    }
    if (isFn(callee)) {
      this.callDepth++;
      if (this.callDepth > this.maxCallDepth) {
        throw new PyError(`Рекурсия тым терең (RecursionError: max depth exceeded)`, line);
      }
      try {
        const fnEnv = new Env(callee.closure);
        for (let i = 0; i < callee.params.length; i++) {
          const p = callee.params[i];
          if (i < args.length) {
            fnEnv.set(p.name, args[i]);
          } else if (p.name in kwargs) {
            fnEnv.set(p.name, kwargs[p.name]);
          } else if (p.defaultVal) {
            fnEnv.set(p.name, this.evalExpr(p.defaultVal, callee.closure));
          } else {
            throw new PyError(`'${callee.name}' функциясына '${p.name}' аргументі жетіспейді`, line);
          }
        }
        try {
          this.execBlock(callee.body, fnEnv);
        } catch (sig) {
          if (sig instanceof ReturnSignal) {
            return sig.value;
          }
          throw sig;
        }
        return null;
      } finally {
        this.callDepth--;
      }
    }
    throw new PyError(`Бұл нысанды функция ретінде шақыру мүмкін емес (TypeError)`, line);
  }

  private applyBinary(op: string, l: PyVal, r: PyVal, line: number): PyVal {
    if (op === '+') {
      if (typeof l === 'string' && typeof r === 'string') return l + r;
      if (Array.isArray(l) && Array.isArray(r)) return [...l, ...r];
      if (isTuple(l) && isTuple(r)) return { __type: 'tuple', items: [...l.items, ...r.items] };
      if ((typeof l === 'number' || typeof l === 'boolean') && (typeof r === 'number' || typeof r === 'boolean')) {
        return Number(l) + Number(r);
      }
      throw new PyError(`'+' операциясы бұл түрлерге жарамсыз`, line);
    }
    if (op === '*') {
      if (typeof l === 'string' && typeof r === 'number') return l.repeat(Math.max(0, Math.trunc(r)));
      if (typeof l === 'number' && typeof r === 'string') return r.repeat(Math.max(0, Math.trunc(l)));
      if (Array.isArray(l) && typeof r === 'number') {
        const out: PyVal[] = [];
        for (let i = 0; i < Math.trunc(r); i++) out.push(...l);
        return out;
      }
      if (typeof l === 'number' && Array.isArray(r)) {
        const out: PyVal[] = [];
        for (let i = 0; i < Math.trunc(l); i++) out.push(...r);
        return out;
      }
      return Number(l) * Number(r);
    }
    const ln = Number(l);
    const rn = Number(r);
    switch (op) {
      case '-':
        return ln - rn;
      case '/':
        if (rn === 0) throw new PyError(`Нөлге бөлу қатесі (ZeroDivisionError)`, line);
        return ln / rn;
      case '//':
        if (rn === 0) throw new PyError(`Нөлге бөлу қатесі (ZeroDivisionError)`, line);
        return Math.floor(ln / rn);
      case '%':
        if (rn === 0) throw new PyError(`Нөлге бөлу қатесі (ZeroDivisionError)`, line);
        return ((ln % rn) + rn) % rn;
      case '**':
        return Math.pow(ln, rn);
      case '&':
        return Math.trunc(ln) & Math.trunc(rn);
      case '|':
        return Math.trunc(ln) | Math.trunc(rn);
      case '^':
        return Math.trunc(ln) ^ Math.trunc(rn);
      case '<<':
        return Math.trunc(ln) << Math.trunc(rn);
      case '>>':
        return Math.trunc(ln) >> Math.trunc(rn);
    }
    throw new PyError(`Белгісіз оператор '${op}'`, line);
  }

  private compareVals(l: PyVal, r: PyVal, op: string, line: number): boolean {
    switch (op) {
      case '==':
        return pyEquals(l, r);
      case '!=':
        return !pyEquals(l, r);
      case 'is':
        return l === r;
      case 'is not':
        return l !== r;
      case '<':
        return (l as number | string) < (r as number | string);
      case '<=':
        return (l as number | string) <= (r as number | string);
      case '>':
        return (l as number | string) > (r as number | string);
      case '>=':
        return (l as number | string) >= (r as number | string);
      case 'in':
      case 'not in': {
        let found = false;
        if (typeof r === 'string' && typeof l === 'string') {
          found = r.includes(l);
        } else if (isDict(r)) {
          found = r.entries.has(keyHash(l));
        } else {
          found = toIterable(r, line).some((it) => pyEquals(it, l));
        }
        return op === 'in' ? found : !found;
      }
    }
    return false;
  }

  private evalIndex(obj: PyVal, idx: PyVal, line: number): PyVal {
    if (isDict(obj)) {
      const k = keyHash(idx);
      const entry = obj.entries.get(k);
      if (!entry) throw new PyError(`Кілт табылмады (KeyError: ${pyRepr(idx, true)})`, line);
      return entry.val;
    }
    let i = Number(idx);
    if (typeof obj === 'string') {
      if (i < 0) i += obj.length;
      if (i < 0 || i >= obj.length) throw new PyError(`Жол индексі шектен тыс (IndexError)`, line);
      return obj[i];
    }
    if (Array.isArray(obj)) {
      if (i < 0) i += obj.length;
      if (i < 0 || i >= obj.length) throw new PyError(`Тізім индексі шектен тыс (IndexError)`, line);
      return obj[i];
    }
    if (isTuple(obj)) {
      if (i < 0) i += obj.items.length;
      if (i < 0 || i >= obj.items.length) throw new PyError(`Кортеж индексі шектен тыс (IndexError)`, line);
      return obj.items[i];
    }
    throw new PyError(`Бұл нысанды индекстеу мүмкін емес (TypeError)`, line);
  }

  private evalSlice(obj: PyVal, start: number | undefined, stop: number | undefined, step: number, line: number): PyVal {
    if (step === 0) throw new PyError(`Кесінді қадамы 0 бола алмайды`, line);
    const items = typeof obj === 'string' ? Array.from(obj) : Array.isArray(obj) ? obj : isTuple(obj) ? obj.items : null;
    if (!items) throw new PyError(`Кесінді (slice) бұл нысанға қолданылмайды`, line);
    const len = items.length;
    let s = start === undefined ? (step > 0 ? 0 : len - 1) : start < 0 ? Math.max(step > 0 ? 0 : -1, len + start) : Math.min(len, start);
    let e = stop === undefined ? (step > 0 ? len : -1) : stop < 0 ? Math.max(-1, len + stop) : Math.min(len, stop);
    if (step < 0 && start === undefined) s = len - 1;
    if (step < 0 && stop === undefined) e = -1;
    const res: PyVal[] = [];
    if (step > 0) {
      for (let i = s; i < e; i += step) if (i >= 0 && i < len) res.push(items[i]);
    } else {
      for (let i = s; i > e; i += step) if (i >= 0 && i < len) res.push(items[i]);
    }
    if (typeof obj === 'string') return res.join('');
    if (isTuple(obj)) return { __type: 'tuple', items: res };
    return res;
  }

  private evalAttr(obj: PyVal, attr: string, line: number): PyVal {
    const b = (name: string, call: (args: PyVal[], kwargs: Record<string, PyVal>, ln: number) => PyVal): PyBuiltinFn => ({
      __type: 'builtin',
      name,
      call,
    });

    if (isModule(obj)) {
      if (attr in obj.exports) return obj.exports[attr];
      throw new PyError(`'${obj.name}' модулінде '${attr}' жоқ`, line);
    }

    if (typeof obj === 'string') {
      switch (attr) {
        case 'split':
          return b('split', (args) => {
            if (args.length === 0) {
              const t = obj.trim();
              return t === '' ? [] : t.split(/\s+/);
            }
            return obj.split(String(args[0]));
          });
        case 'strip':
          return b('strip', () => obj.trim());
        case 'lstrip':
          return b('lstrip', () => obj.trimStart());
        case 'rstrip':
          return b('rstrip', () => obj.trimEnd());
        case 'upper':
          return b('upper', () => obj.toUpperCase());
        case 'lower':
          return b('lower', () => obj.toLowerCase());
        case 'join':
          return b('join', (args, _, ln) => toIterable(args[0], ln).map((x) => pyRepr(x, false)).join(obj));
        case 'replace':
          return b('replace', (args) => obj.split(String(args[0])).join(String(args[1])));
        case 'find':
          return b('find', (args) => obj.indexOf(String(args[0])));
        case 'count':
          return b('count', (args) => {
            const sub = String(args[0]);
            if (!sub) return obj.length + 1;
            return obj.split(sub).length - 1;
          });
        case 'isdigit':
          return b('isdigit', () => /^\d+$/.test(obj));
        case 'isalpha':
          return b('isalpha', () => /^[\p{L}]+$/u.test(obj));
        case 'startswith':
          return b('startswith', (args) => obj.startsWith(String(args[0])));
        case 'endswith':
          return b('endswith', (args) => obj.endsWith(String(args[0])));
      }
    }

    if (Array.isArray(obj)) {
      switch (attr) {
        case 'append':
          return b('append', (args) => {
            obj.push(args[0]);
            return null;
          });
        case 'extend':
          return b('extend', (args, _, ln) => {
            obj.push(...toIterable(args[0], ln));
            return null;
          });
        case 'pop':
          return b('pop', (args, _, ln) => {
            if (obj.length === 0) throw new PyError(`Бос тізімнен pop() жасау мүмкін емес`, ln);
            if (args.length === 0) return obj.pop() ?? null;
            let idx = Number(args[0]);
            if (idx < 0) idx += obj.length;
            return obj.splice(idx, 1)[0];
          });
        case 'insert':
          return b('insert', (args) => {
            obj.splice(Number(args[0]), 0, args[1]);
            return null;
          });
        case 'remove':
          return b('remove', (args, _, ln) => {
            const idx = obj.findIndex((x) => pyEquals(x, args[0]));
            if (idx === -1) throw new PyError(`Тізімде элемент табылмады (ValueError)`, ln);
            obj.splice(idx, 1);
            return null;
          });
        case 'sort':
          return b('sort', (_, kwargs, ln) => {
            const rev = pyTruth(kwargs.reverse ?? false);
            const keyFn = kwargs.key;
            obj.sort((a, bVal) => {
              const ka = keyFn ? this.callValue(keyFn, [a], {}, ln) : a;
              const kb = keyFn ? this.callValue(keyFn, [bVal], {}, ln) : bVal;
              if (this.compareVals(ka, kb, '<', ln)) return rev ? 1 : -1;
              if (this.compareVals(ka, kb, '>', ln)) return rev ? -1 : 1;
              return 0;
            });
            return null;
          });
        case 'reverse':
          return b('reverse', () => {
            obj.reverse();
            return null;
          });
        case 'index':
          return b('index', (args, _, ln) => {
            const idx = obj.findIndex((x) => pyEquals(x, args[0]));
            if (idx === -1) throw new PyError(`Элемент тізімде жоқ`, ln);
            return idx;
          });
        case 'count':
          return b('count', (args) => obj.filter((x) => pyEquals(x, args[0])).length);
        case 'copy':
          return b('copy', () => [...obj]);
        case 'clear':
          return b('clear', () => {
            obj.length = 0;
            return null;
          });
      }
    }

    if (isDict(obj)) {
      switch (attr) {
        case 'get':
          return b('get', (args) => {
            const entry = obj.entries.get(keyHash(args[0]));
            return entry ? entry.val : args.length > 1 ? args[1] : null;
          });
        case 'keys':
          return b('keys', () => Array.from(obj.entries.values()).map((e) => e.key));
        case 'values':
          return b('values', () => Array.from(obj.entries.values()).map((e) => e.val));
        case 'items':
          return b('items', () =>
            Array.from(obj.entries.values()).map((e) => ({ __type: 'tuple' as const, items: [e.key, e.val] }))
          );
      }
    }

    if (isSet(obj)) {
      switch (attr) {
        case 'add':
          return b('add', (args) => {
            const k = keyHash(args[0]);
            if (!obj.items.some((x) => keyHash(x) === k)) obj.items.push(args[0]);
            return null;
          });
        case 'remove':
        case 'discard':
          return b('discard', (args) => {
            const idx = obj.items.findIndex((x) => pyEquals(x, args[0]));
            if (idx !== -1) obj.items.splice(idx, 1);
            return null;
          });
      }
    }

    throw new PyError(`'${attr}' атрибуты немесе әдісі табылмады (AttributeError)`, line);
  }
}

export function runPython(code: string, stdin = ''): RunResult {
  const start = performance.now();
  try {
    const tokens = tokenize(code);
    const parser = new Parser(tokens);
    const ast = parser.parseProgram();
    const interpreter = new Interpreter(stdin);
    const output = interpreter.run(ast);
    const elapsed = Math.max(0.1, Number((performance.now() - start).toFixed(2)));
    return {
      success: true,
      output,
      executionTimeMs: elapsed,
    };
  } catch (err) {
    const elapsed = Math.max(0.1, Number((performance.now() - start).toFixed(2)));
    if (err instanceof PyError) {
      return {
        success: false,
        output: '',
        error: err.message,
        errorLine: err.line,
        executionTimeMs: elapsed,
      };
    }
    return {
      success: false,
      output: '',
      error: err instanceof Error ? err.message : 'Белгісіз орындалу қатесі',
      executionTimeMs: elapsed,
    };
  }
}

function normalizeOutput(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd();
}

export function judgePython(code: string, testCases: TestCase[]): TestCaseResult[] {
  return testCases.map((tc, index) => {
    const res = runPython(code, tc.input);
    const actual = normalizeOutput(res.output);
    const expected = normalizeOutput(tc.expectedOutput);
    const passed = res.success && actual === expected;
    return {
      testId: tc.id,
      index: index + 1,
      passed,
      input: tc.input,
      expectedOutput: expected,
      actualOutput: actual,
      error: res.error,
      isHidden: tc.isHidden,
      executionTimeMs: res.executionTimeMs,
    };
  });
}
