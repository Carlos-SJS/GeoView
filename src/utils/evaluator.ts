import type { GeometricObject } from '../types';
import { resolveVectorEndpoints, getPolygonArea, getPolygonPerimeter, getAngleValue } from './geometry';

type Token =
  | { type: 'NUMBER'; value: number }
  | { type: 'NAME'; value: string }
  | { type: 'OPERATOR'; value: string }
  | { type: 'LPAREN' }
  | { type: 'RPAREN' }
  | { type: 'COMMA' }
  | { type: 'EOF' };

function tokenize(str: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < str.length) {
    const char = str[i];
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      let numStr = '';
      while (i < str.length && /[0-9.]/.test(str[i])) {
        numStr += str[i];
        i++;
      }
      const val = parseFloat(numStr);
      if (isNaN(val)) {
        throw new Error(`Invalid number: ${numStr}`);
      }
      tokens.push({ type: 'NUMBER', value: val });
      continue;
    }
    if (/[a-zA-Z_]/.test(char)) {
      let nameStr = '';
      while (i < str.length && /[a-zA-Z0-9_]/.test(str[i])) {
        nameStr += str[i];
        i++;
      }
      tokens.push({ type: 'NAME', value: nameStr });
      continue;
    }
    if (['+', '-', '*', '/', '^'].includes(char)) {
      tokens.push({ type: 'OPERATOR', value: char });
      i++;
      continue;
    }
    if (char === '(') {
      tokens.push({ type: 'LPAREN' });
      i++;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'RPAREN' });
      i++;
      continue;
    }
    if (char === ',') {
      tokens.push({ type: 'COMMA' });
      i++;
      continue;
    }
    throw new Error(`Unexpected character: '${char}'`);
  }
  tokens.push({ type: 'EOF' });
  return tokens;
}

export type ASTNode =
  | { type: 'NUMBER'; value: number }
  | { type: 'VARIABLE'; name: string }
  | { type: 'BINARY'; op: string; left: ASTNode; right: ASTNode }
  | { type: 'UNARY'; op: string; expr: ASTNode }
  | { type: 'CALL'; name: string; args: ASTNode[] };

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private next(): Token {
    return this.tokens[this.pos++];
  }

  private consume(type: Token['type'], expectedValue?: string): Token {
    const tok = this.peek();
    if (tok.type !== type || (expectedValue !== undefined && (tok as any).value !== expectedValue)) {
      throw new Error(`Expected token of type ${type}${expectedValue ? ` with value ${expectedValue}` : ''}, got ${tok.type}`);
    }
    return this.next();
  }

  parse(): ASTNode {
    const node = this.parseExpression();
    if (this.peek().type !== 'EOF') {
      throw new Error(`Unexpected token at end of expression: ${JSON.stringify(this.peek())}`);
    }
    return node;
  }

  private parseExpression(): ASTNode {
    let node = this.parseTerm();
    while (true) {
      const tok = this.peek();
      if (tok.type === 'OPERATOR' && (tok.value === '+' || tok.value === '-')) {
        this.next();
        const right = this.parseTerm();
        node = { type: 'BINARY', op: tok.value, left: node, right };
      } else {
        break;
      }
    }
    return node;
  }

  private parseTerm(): ASTNode {
    let node = this.parseFactor();
    while (true) {
      const tok = this.peek();
      if (tok.type === 'OPERATOR' && (tok.value === '*' || tok.value === '/')) {
        this.next();
        const right = this.parseFactor();
        node = { type: 'BINARY', op: tok.value, left: node, right };
      } else {
        break;
      }
    }
    return node;
  }

  private parseFactor(): ASTNode {
    let node = this.parsePrimary();
    const tok = this.peek();
    if (tok.type === 'OPERATOR' && tok.value === '^') {
      this.next();
      const right = this.parseFactor();
      node = { type: 'BINARY', op: '^', left: node, right };
    }
    return node;
  }

  private parsePrimary(): ASTNode {
    const tok = this.peek();
    if (tok.type === 'NUMBER') {
      return { type: 'NUMBER', value: (this.next() as any).value as number };
    }

    if (tok.type === 'OPERATOR' && (tok.value === '+' || tok.value === '-')) {
      const op = (this.next() as any).value as string;
      const expr = this.parsePrimary();
      return { type: 'UNARY', op, expr };
    }

    if (tok.type === 'LPAREN') {
      this.next();
      const node = this.parseExpression();
      this.consume('RPAREN');
      return node;
    }

    if (tok.type === 'NAME') {
      const name = (this.next() as any).value as string;
      if (this.peek().type === 'LPAREN') {
        this.next(); // Consume '('
        const args: ASTNode[] = [];
        if (this.peek().type !== 'RPAREN') {
          args.push(this.parseExpression());
          while (this.peek().type === 'COMMA') {
            this.next();
            args.push(this.parseExpression());
          }
        }
        this.consume('RPAREN');
        return { type: 'CALL', name, args };
      }
      return { type: 'VARIABLE', name };
    }

    throw new Error(`Unexpected token in expression: ${JSON.stringify(tok)}`);
  }
}

export function getExpressionDependencies(
  exprStr: string,
  canvasObjects: Record<string, GeometricObject>
): string[] {
  try {
    const tokens = tokenize(exprStr);
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    const deps = new Set<string>();
    const traverse = (node: ASTNode) => {
      if (node.type === 'VARIABLE') {
        if (!(node.name in canvasObjects)) {
          deps.add(node.name);
        }
      } else if (node.type === 'BINARY') {
        traverse(node.left);
        traverse(node.right);
      } else if (node.type === 'UNARY') {
        traverse(node.expr);
      } else if (node.type === 'CALL') {
        node.args.forEach(traverse);
      }
    };
    traverse(ast);
    return Array.from(deps);
  } catch {
    return [];
  }
}

export interface CalculatorVariable {
  name: string;
  expression: string;
  value: number | string;
  error?: string;
}

export function evaluateAST(
  node: ASTNode,
  canvasObjects: Record<string, GeometricObject>,
  variableValues: Record<string, number>
): number {
  switch (node.type) {
    case 'NUMBER':
      return node.value;
    case 'VARIABLE': {
      if (node.name in variableValues) {
        return variableValues[node.name];
      }
      if (node.name in canvasObjects) {
        throw new Error(`Cannot use geometric object "${node.name}" directly as a numeric value.`);
      }
      throw new Error(`Undefined variable: "${node.name}"`);
    }
    case 'UNARY': {
      const val = evaluateAST(node.expr, canvasObjects, variableValues);
      if (node.op === '+') return val;
      if (node.op === '-') return -val;
      throw new Error(`Unknown unary operator: ${node.op}`);
    }
    case 'BINARY': {
      const leftVal = evaluateAST(node.left, canvasObjects, variableValues);
      const rightVal = evaluateAST(node.right, canvasObjects, variableValues);
      switch (node.op) {
        case '+': return leftVal + rightVal;
        case '-': return leftVal - rightVal;
        case '*': return leftVal * rightVal;
        case '/':
          if (Math.abs(rightVal) < 1e-15) throw new Error("Division by zero");
          return leftVal / rightVal;
        case '^': return Math.pow(leftVal, rightVal);
        default:
          throw new Error(`Unknown binary operator: ${node.op}`);
      }
    }
    case 'CALL': {
      if (node.name === 'dot') {
        if (node.args.length !== 2) throw new Error("dot requires 2 arguments");
        const arg0 = node.args[0];
        const arg1 = node.args[1];
        if (arg0.type !== 'VARIABLE' || arg1.type !== 'VARIABLE') {
          throw new Error("dot arguments must be vector variables");
        }
        const v = canvasObjects[arg0.name];
        const w = canvasObjects[arg1.name];
        if (!v || v.type !== 'vector' || !w || w.type !== 'vector') {
          throw new Error("dot arguments must be defined vectors");
        }
        const epsV = resolveVectorEndpoints(v, canvasObjects);
        const epsW = resolveVectorEndpoints(w, canvasObjects);
        if (!epsV || !epsW) throw new Error("Could not resolve vector coordinates");
        return (epsV.p2.x - epsV.p1.x) * (epsW.p2.x - epsW.p1.x) + (epsV.p2.y - epsV.p1.y) * (epsW.p2.y - epsW.p1.y);
      }
      if (node.name === 'cross') {
        if (node.args.length !== 2) throw new Error("cross requires 2 arguments");
        const arg0 = node.args[0];
        const arg1 = node.args[1];
        if (arg0.type !== 'VARIABLE' || arg1.type !== 'VARIABLE') {
          throw new Error("cross arguments must be vector variables");
        }
        const v = canvasObjects[arg0.name];
        const w = canvasObjects[arg1.name];
        if (!v || v.type !== 'vector' || !w || w.type !== 'vector') {
          throw new Error("cross arguments must be defined vectors");
        }
        const epsV = resolveVectorEndpoints(v, canvasObjects);
        const epsW = resolveVectorEndpoints(w, canvasObjects);
        if (!epsV || !epsW) throw new Error("Could not resolve vector coordinates");
        return (epsV.p2.x - epsV.p1.x) * (epsW.p2.y - epsW.p1.y) - (epsV.p2.y - epsV.p1.y) * (epsW.p2.x - epsW.p1.x);
      }
      if (node.name === 'abs') {
        if (node.args.length !== 1) throw new Error("abs requires 1 argument");
        const arg = node.args[0];
        if (arg.type === 'VARIABLE') {
          const v = canvasObjects[arg.name];
          if (v && v.type === 'vector') {
            const eps = resolveVectorEndpoints(v, canvasObjects);
            if (!eps) throw new Error("Could not resolve vector coordinates");
            return Math.hypot(eps.p2.x - eps.p1.x, eps.p2.y - eps.p1.y);
          }
        }
        const val = evaluateAST(arg, canvasObjects, variableValues);
        return Math.abs(val);
      }
      if (node.name === 'dist') {
        if (node.args.length !== 2) throw new Error("dist requires 2 arguments");
        const arg0 = node.args[0];
        const arg1 = node.args[1];
        if (arg0.type !== 'VARIABLE' || arg1.type !== 'VARIABLE') {
          throw new Error("dist arguments must be point variables");
        }
        const p1 = canvasObjects[arg0.name];
        const p2 = canvasObjects[arg1.name];
        if (!p1 || p1.type !== 'point' || !p2 || p2.type !== 'point') {
          throw new Error("dist arguments must be defined points");
        }
        return Math.hypot(p2.x - p1.x, p2.y - p1.y);
      }
      if (node.name === 'area') {
        if (node.args.length !== 1) throw new Error("area requires 1 argument");
        const arg = node.args[0];
        if (arg.type !== 'VARIABLE') {
          throw new Error("area argument must be a polygon or circle variable");
        }
        const shape = canvasObjects[arg.name];
        if (!shape) throw new Error(`Variable "${arg.name}" is not defined`);
        if (shape.type === 'polygon') {
          const areaVal = getPolygonArea(shape.points, canvasObjects);
          if (areaVal === null) throw new Error("Could not calculate polygon area");
          return areaVal;
        } else if (shape.type === 'circle') {
          return Math.PI * shape.radius * shape.radius;
        } else {
          throw new Error("area argument must be a polygon or circle");
        }
      }
      if (node.name === 'perimeter') {
        if (node.args.length !== 1) throw new Error("perimeter requires 1 argument");
        const arg = node.args[0];
        if (arg.type !== 'VARIABLE') {
          throw new Error("perimeter argument must be a polygon or circle variable");
        }
        const shape = canvasObjects[arg.name];
        if (!shape) throw new Error(`Variable "${arg.name}" is not defined`);
        if (shape.type === 'polygon') {
          const perimVal = getPolygonPerimeter(shape.points, canvasObjects);
          if (perimVal === null) throw new Error("Could not calculate polygon perimeter");
          return perimVal;
        } else if (shape.type === 'circle') {
          return 2 * Math.PI * shape.radius;
        } else {
          throw new Error("perimeter argument must be a polygon or circle");
        }
      }
      if (node.name === 'angle') {
        if (node.args.length !== 3) throw new Error("angle requires 3 arguments");
        const arg0 = node.args[0];
        const arg1 = node.args[1];
        const arg2 = node.args[2];
        if (arg0.type !== 'VARIABLE' || arg1.type !== 'VARIABLE' || arg2.type !== 'VARIABLE') {
          throw new Error("angle arguments must be point variables");
        }
        const pA = canvasObjects[arg0.name];
        const pB = canvasObjects[arg1.name];
        const pC = canvasObjects[arg2.name];
        if (!pA || pA.type !== 'point' || !pB || pB.type !== 'point' || !pC || pC.type !== 'point') {
          throw new Error("angle arguments must be defined points");
        }
        const angVal = getAngleValue(arg0.name, arg1.name, arg2.name, canvasObjects);
        if (angVal === null) throw new Error("Could not calculate angle value");
        return angVal;
      }
      if (['sin', 'cos', 'tan', 'sind', 'cosd', 'tand', 'sqrt'].includes(node.name)) {
        if (node.args.length !== 1) throw new Error(`${node.name} requires 1 argument`);
        const val = evaluateAST(node.args[0], canvasObjects, variableValues);
        switch (node.name) {
          case 'sin': return Math.sin(val);
          case 'cos': return Math.cos(val);
          case 'tan': return Math.tan(val);
          case 'sind': return Math.sin(val * Math.PI / 180);
          case 'cosd': return Math.cos(val * Math.PI / 180);
          case 'tand': return Math.tan(val * Math.PI / 180);
          case 'sqrt':
            if (val < 0) throw new Error("Cannot take square root of a negative number");
            return Math.sqrt(val);
        }
      }
      throw new Error(`Unknown function: "${node.name}"`);
    }
    default:
      throw new Error("Unknown AST node type");
  }
}

export function evaluateAllVariables(
  variables: CalculatorVariable[],
  canvasObjects: Record<string, GeometricObject>
): CalculatorVariable[] {
  const varMap = new Map<string, CalculatorVariable>();
  variables.forEach(v => varMap.set(v.name, v));

  const adj = new Map<string, string[]>();
  variables.forEach(v => {
    const deps = getExpressionDependencies(v.expression, canvasObjects);
    adj.set(v.name, deps);
  });

  const visited = new Map<string, number>();
  const order: string[] = [];
  const cycleDetected = new Set<string>();

  function dfs(u: string): boolean {
    visited.set(u, 1);
    const neighbors = adj.get(u) || [];
    for (const v of neighbors) {
      if (varMap.has(v)) {
        const state = visited.get(v) || 0;
        if (state === 1) {
          cycleDetected.add(u);
          cycleDetected.add(v);
          return true;
        } else if (state === 0) {
          if (dfs(v)) {
            cycleDetected.add(u);
            return true;
          }
        }
      }
    }
    visited.set(u, 2);
    order.push(u);
    return false;
  }

  variables.forEach(v => {
    if ((visited.get(v.name) || 0) === 0) {
      dfs(v.name);
    }
  });

  const evaluatedValues: Record<string, number> = {};
  const resultsMap = new Map<string, CalculatorVariable>();

  order.forEach(name => {
    const v = varMap.get(name);
    if (!v) return;

    if (cycleDetected.has(name)) {
      resultsMap.set(name, {
        ...v,
        value: 'NaN',
        error: 'Circular dependency detected'
      });
      return;
    }

    try {
      const tokens = tokenize(v.expression);
      const parser = new Parser(tokens);
      const ast = parser.parse();
      
      const val = evaluateAST(ast, canvasObjects, evaluatedValues);
      evaluatedValues[name] = val;
      
      resultsMap.set(name, {
        ...v,
        value: Math.round(val * 1000) / 1000,
        error: undefined
      });
    } catch (e: any) {
      resultsMap.set(name, {
        ...v,
        value: 'NaN',
        error: e.message
      });
    }
  });

  variables.forEach(v => {
    if (!resultsMap.has(v.name)) {
      resultsMap.set(v.name, {
        ...v,
        value: 'NaN',
        error: cycleDetected.has(v.name) ? 'Circular dependency detected' : 'Evaluation error'
      });
    }
  });

  return variables.map(v => resultsMap.get(v.name)!);
}
