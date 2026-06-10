import type { GeometricObject, ObjectType } from './types';
import type { CalculatorVariable } from './utils/evaluator';

// Validates C++ variable name conventions
const CPP_VAR_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

// Matches coordinate pair: (x, y)
const COORD_REGEX = /^\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)$/;

// Matches number (int or float)
const NUMBER_REGEX = /^-?\d*\.?\d+$/;

// Splits parameters inside parentheses, keeping coordinate parentheses intact
export function parseArguments(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let parenDepth = 0;
  
  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];
    if (char === '(') {
      parenDepth++;
      current += char;
    } else if (char === ')') {
      parenDepth--;
      current += char;
    } else if (char === ',' && parenDepth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim().length > 0) {
    args.push(current.trim());
  }
  return args;
}

// Generate unique default name for an object type
export function generateDefaultName(
  type: ObjectType,
  existingNames: Set<string>
): string {
  let prefix = 'p';
  if (type === 'line') prefix = 'l';
  if (type === 'circle') prefix = 'c';
  if (type === 'polygon') prefix = 'poly';
  if (type === 'angle') prefix = 'ang';
  if (type === 'vector') prefix = 'v';
  
  let counter = 1;
  while (existingNames.has(`${prefix}${counter}`)) {
    counter++;
  }
  return `${prefix}${counter}`;
}

// Helper to extract optional color parameter from argument tokens
export function extractColorToken(tokens: string[]): string | null {
  if (tokens.length === 0) return null;
  let last = tokens[tokens.length - 1].trim();
  
  let hasQuotes = false;
  if ((last.startsWith('"') && last.endsWith('"')) || (last.startsWith("'") && last.endsWith("'"))) {
    last = last.substring(1, last.length - 1).trim();
    hasQuotes = true;
  }
  
  const CSS_COLOR_NAMES = [
    'black','silver','gray','white','maroon','red','purple','fuchsia','green','lime','olive','yellow',
    'navy','blue','teal','aqua','orange','aliceblue','antiquewhite','aquamarine','azure','beige','bisque',
    'blanchedalmond','blueviolet','brown','burlywood','cadetblue','chartreuse','chocolate','coral',
    'cornflowerblue','cornsilk','crimson','cyan','darkblue','darkcyan','darkgoldenrod','darkgray','darkgreen',
    'darkgrey','darkkhaki','darkmagenta','darkolivegreen','darkorange','darkorchid','darkred','darksalmon',
    'darkseagreen','darkslateemphasis','darkslateblue','darkslategray','darkslategrey','darkturquoise','darkviolet',
    'deeppink','deepskyblue','dimgray','dimgrey','dodgerblue','firebrick','floralwhite','forestgreen',
    'gainsboro','ghostwhite','gold','goldenrod','greenyellow','grey','honeydew','hotpink','indianred',
    'indigo','ivory','khaki','lavender','lavenderblush','lawngreen','lemonchiffon','lightblue','lightcoral',
    'lightcyan','lightgoldenrodyellow','lightgray','lightgreen','lightgrey','lightpink','lightsalmon',
    'lightseagreen','lightskyblue','lightslategray','lightslategrey','lightsteelblue','lightyellow','limegreen',
    'linen','magenta','mediumaquamarine','mediumblue','mediumorchid','mediumpurple','mediumseagreen','mediumslate',
    'mediumspringgreen','mediumturquoise','mediumvioletred','midnightblue','mintcream','mistyrose','moccasin',
    'navajowhite','oldlace','olivedrab','orangered','orchid','palegoldenrod','palegreen','paleturquoise',
    'palevioletred','papayawhip','peachpuff','peru','pink','plum','powderblue','rosybrown','royalblue',
    'saddlebrown','salmon','sandybrown','seagreen','seashell','sienna','skyblue','slateblue','indigo','purple',
    'saddlebrown','sienna','tan','teal','thistle','tomato','turquoise','violet','wheat','white','yellow','yellowgreen'
  ];
  
  const isHex = /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/.test(last);
  const isColorName = CSS_COLOR_NAMES.includes(last.toLowerCase());
  
  if (isHex || hasQuotes || isColorName) {
    tokens.pop();
    return last;
  }
  return null;
}

// Helper to extract optional boolean parameter from argument tokens (for figure fill)
export function extractBooleanToken(tokens: string[]): boolean | null {
  if (tokens.length === 0) return null;
  const last = tokens[tokens.length - 1].trim().toLowerCase();
  
  if (last === 'true') {
    tokens.pop();
    return true;
  }
  if (last === 'false') {
    tokens.pop();
    return false;
  }
  return null;
}

export interface ParseResult {
  objects: GeometricObject[];
  errors: string[];
  clearState?: boolean;
  deletedNames?: string[];
  undoState?: boolean;
  redoState?: boolean;
}

/**
 * Parses a script string of geometry commands.
 * Supports multi-line commands separated by newlines, spaces, or semicolons.
 */
export function parseScript(
  scriptText: string,
  existingObjects: Record<string, GeometricObject>,
  themeColors: string[],
  calcVariables: CalculatorVariable[] = []
): ParseResult {
  const errors: string[] = [];
  const parsedObjects: GeometricObject[] = [];
  let clearState = false;
  const deletedNames: string[] = [];
  
  // Clone existing objects map to resolve references during batch evaluation
  const activeObjects = { ...existingObjects };
  const getActiveNamesSet = () => new Set(Object.values(activeObjects).map(o => o.name));
  
  // Color helper (cycling through theme colors)
  let colorIndex = Object.keys(existingObjects).length;
  const getNextColor = () => {
    const color = themeColors[colorIndex % themeColors.length];
    colorIndex++;
    return color;
  };

  // Split commands by newlines or semicolons
  const lines = scriptText
    .split(/[\n;]/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineNum = lineIdx + 1;
    
    try {
      // Check for undo command
      if (line.toLowerCase() === 'undo' || line.toLowerCase() === 'undo()') {
        return {
          objects: [],
          errors: [],
          undoState: true
        };
      }

      // Check for redo command
      if (line.toLowerCase() === 'redo' || line.toLowerCase() === 'redo()') {
        return {
          objects: [],
          errors: [],
          redoState: true
        };
      }

      // Check for clear command
      if (line.toLowerCase() === 'clear' || line.toLowerCase() === 'clear()') {
        parsedObjects.length = 0;
        for (const key of Object.keys(activeObjects)) {
          delete activeObjects[key];
        }
        clearState = true;
        deletedNames.length = 0;
        continue;
      }

      // Check for delete command: "delete <name>" or "delete(<name>)"
      const deleteMatch = line.match(/^delete\s+([a-zA-Z0-9_]+)$/) || line.match(/^delete\s*\(\s*([a-zA-Z0-9_]+)\s*\)$/);
      if (deleteMatch) {
        const nameToDelete = deleteMatch[1].trim();
        
        if (!activeObjects[nameToDelete]) {
          throw new Error(`Cannot delete "${nameToDelete}". Object is not defined.`);
        }
        
        delete activeObjects[nameToDelete];
        deletedNames.push(nameToDelete);
        
        const idx = parsedObjects.findIndex(o => o.name === nameToDelete);
        if (idx !== -1) {
          parsedObjects.splice(idx, 1);
        }
        continue;
      }
      // 1. Check for assignment: name = function(...)
      const assignMatch = line.match(/^([a-zA-Z0-9_]+)\s*=\s*(.+)$/);
      let name: string | null = null;
      let expr = line;

      if (assignMatch) {
        name = assignMatch[1].trim();
        expr = assignMatch[2].trim();

        // Validate name structure
        if (!CPP_VAR_REGEX.test(name)) {
          throw new Error(`Invalid variable name "${name}". Must start with a letter or underscore and contain only alphanumeric characters and underscores.`);
        }
        
        // Forbid reserved names
        if (['pi', 'e'].includes(name.toLowerCase())) {
          throw new Error(`Name "${name}" is a reserved mathematical constant.`);
        }

        // Validate name uniqueness
        if (getActiveNamesSet().has(name)) {
          throw new Error(`Variable name "${name}" is already in use.`);
        }
      }

      // Preprocess expression to convert v + w or v - w into add(v, w) or sub(v, w)
      // e.g., "v1 + v2" -> "add(v1, v2)", "v1 - v2, \"red\"" -> "sub(v1, v2, \"red\")"
      const opMatch = expr.match(/^([a-zA-Z0-9_]+)\s*([\+-])\s*([a-zA-Z0-9_]+)(?:\s*,\s*(.+))?$/);
      if (opMatch) {
        const left = opMatch[1];
        const op = opMatch[2];
        const right = opMatch[3];
        const extra = opMatch[4] ? `, ${opMatch[4]}` : '';
        if (op === '+') {
          expr = `add(${left}, ${right}${extra})`;
        } else {
          expr = `sub(${left}, ${right}${extra})`;
        }
      }

      // 2. Parse function call: funcName(args) or coordinate shortcut (x, y) or (x, y, color)
      let funcName = '';
      let argTokens: string[] = [];
      
      const coordShortcutMatch = expr.match(/^\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)(?:\s*,\s*([^)]+))?\s*\)$/);
      if (coordShortcutMatch) {
        funcName = 'point';
        argTokens = [coordShortcutMatch[1], coordShortcutMatch[2]];
        if (coordShortcutMatch[3]) {
          argTokens.push(coordShortcutMatch[3].trim());
        }
      } else {
        const funcMatch = expr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)$/);
        if (!funcMatch) {
          throw new Error(`Syntax error: could not parse expression "${expr}". Expected format "func(args)" or coordinate pair "(x,y)".`);
        }
        funcName = funcMatch[1].toLowerCase();
        const argsStr = funcMatch[2].trim();
        argTokens = parseArguments(argsStr);
      }

      // Extract optional fill parameter (boolean)
      const fillParam = extractBooleanToken(argTokens);

      // Extract optional color parameter
      const colorParam = extractColorToken(argTokens);

      let createdObject: GeometricObject;

      // 3. Process commands
      switch (funcName) {
        case 'point': {
          if (argTokens.length !== 2) {
            throw new Error(`"point" requires exactly 2 arguments: point(x, y). Received ${argTokens.length}.`);
          }
          const [xs, ys] = argTokens;
          const isXVar = CPP_VAR_REGEX.test(xs) && !NUMBER_REGEX.test(xs);
          const isYVar = CPP_VAR_REGEX.test(ys) && !NUMBER_REGEX.test(ys);
          
          let x = 0;
          let y = 0;
          let xRef: string | undefined = undefined;
          let yRef: string | undefined = undefined;

          if (isXVar) {
            const v = calcVariables.find(v => v.name === xs);
            if (!v) {
              throw new Error(`Variable "${xs}" is not defined.`);
            }
            x = typeof v.value === 'number' ? v.value : parseFloat(v.value as string) || 0;
            xRef = xs;
          } else {
            if (!NUMBER_REGEX.test(xs)) {
              throw new Error(`"point" x-coordinate must be a number or variable. Received: point(${xs}, ${ys})`);
            }
            x = parseFloat(xs);
          }

          if (isYVar) {
            const v = calcVariables.find(v => v.name === ys);
            if (!v) {
              throw new Error(`Variable "${ys}" is not defined.`);
            }
            y = typeof v.value === 'number' ? v.value : parseFloat(v.value as string) || 0;
            yRef = ys;
          } else {
            if (!NUMBER_REGEX.test(ys)) {
              throw new Error(`"point" y-coordinate must be a number or variable. Received: point(${xs}, ${ys})`);
            }
            y = parseFloat(ys);
          }
          
          const finalName = name || generateDefaultName('point', getActiveNamesSet());
          createdObject = {
            id: `pt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: finalName,
            type: 'point',
            x,
            y,
            color: colorParam || getNextColor(),
            fill: fillParam !== false,
            visible: true,
            xRef,
            yRef
          };
          break;
        }

        case 'line': {
          if (argTokens.length !== 2 && argTokens.length !== 4) {
            throw new Error(`"line" requires either 2 points/coordinates, or 4 coordinate values: line(p1, p2) or line(x1, y1, x2, y2).`);
          }

          let p1: string | { x: number; y: number };
          let p2: string | { x: number; y: number };

          if (argTokens.length === 2) {
            const [arg1, arg2] = argTokens;

            // Handle arg1
            const coord1 = arg1.match(COORD_REGEX);
            if (coord1) {
              p1 = { x: parseFloat(coord1[1]), y: parseFloat(coord1[2]) };
            } else if (CPP_VAR_REGEX.test(arg1)) {
              // Check if point exists in active objects
              const pt = Object.values(activeObjects).find(o => o.name === arg1);
              if (!pt || pt.type !== 'point') {
                throw new Error(`Point reference "${arg1}" is not defined.`);
              }
              p1 = arg1;
            } else {
              throw new Error(`Invalid line argument "${arg1}". Expected point name or coordinate pair like (x,y).`);
            }

            // Handle arg2
            const coord2 = arg2.match(COORD_REGEX);
            if (coord2) {
              p2 = { x: parseFloat(coord2[1]), y: parseFloat(coord2[2]) };
            } else if (CPP_VAR_REGEX.test(arg2)) {
              const pt = Object.values(activeObjects).find(o => o.name === arg2);
              if (!pt || pt.type !== 'point') {
                throw new Error(`Point reference "${arg2}" is not defined.`);
              }
              p2 = arg2;
            } else {
              throw new Error(`Invalid line argument "${arg2}". Expected point name or coordinate pair like (x,y).`);
            }
          } else {
            // 4 arguments: x1, y1, x2, y2
            const [x1s, y1s, x2s, y2s] = argTokens;
            if (!NUMBER_REGEX.test(x1s) || !NUMBER_REGEX.test(y1s) || !NUMBER_REGEX.test(x2s) || !NUMBER_REGEX.test(y2s)) {
              throw new Error(`Coordinates must be numbers in line(${x1s}, ${y1s}, ${x2s}, ${y2s})`);
            }
            p1 = { x: parseFloat(x1s), y: parseFloat(y1s) };
            p2 = { x: parseFloat(x2s), y: parseFloat(y2s) };
          }

          const finalName = name || generateDefaultName('line', getActiveNamesSet());
          createdObject = {
            id: `ln_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: finalName,
            type: 'line',
            p1,
            p2,
            color: colorParam || getNextColor(),
            fill: fillParam !== false,
            visible: true
          };
          break;
        }

        case 'circle': {
          if (argTokens.length !== 2 && argTokens.length !== 3) {
            throw new Error(`"circle" requires 2 or 3 arguments: circle(center_point, radius) or circle(x, y, radius).`);
          }

          let center: string | { x: number; y: number };
          let radius = 0;
          let radiusRef: string | undefined = undefined;

          if (argTokens.length === 2) {
            const [centerArg, radiusArg] = argTokens;
            
            // Resolve center (point reference or coordinate)
            const coord = centerArg.match(COORD_REGEX);
            if (coord) {
              center = { x: parseFloat(coord[1]), y: parseFloat(coord[2]) };
            } else if (CPP_VAR_REGEX.test(centerArg)) {
              const pt = Object.values(activeObjects).find(o => o.name === centerArg);
              if (!pt || pt.type !== 'point') {
                throw new Error(`Point reference "${centerArg}" is not defined.`);
              }
              center = centerArg;
            } else {
              throw new Error(`Invalid circle center "${centerArg}". Expected point name or coordinate pair.`);
            }

            // Resolve radius
            const isRVar = CPP_VAR_REGEX.test(radiusArg) && !NUMBER_REGEX.test(radiusArg);
            if (isRVar) {
              const v = calcVariables.find(v => v.name === radiusArg);
              if (!v) {
                throw new Error(`Variable "${radiusArg}" is not defined.`);
              }
              radius = typeof v.value === 'number' ? v.value : parseFloat(v.value as string) || 0;
              radiusRef = radiusArg;
            } else {
              if (!NUMBER_REGEX.test(radiusArg)) {
                throw new Error(`Circle radius must be a number or variable. Received "${radiusArg}".`);
              }
              radius = parseFloat(radiusArg);
            }
          } else {
            // 3 arguments: x, y, r
            const [xs, ys, rs] = argTokens;
            if (!NUMBER_REGEX.test(xs) || !NUMBER_REGEX.test(ys)) {
              throw new Error(`Circle coordinates must be numbers. Received circle(${xs}, ${ys}, ${rs}).`);
            }
            center = { x: parseFloat(xs), y: parseFloat(ys) };

            const isRVar = CPP_VAR_REGEX.test(rs) && !NUMBER_REGEX.test(rs);
            if (isRVar) {
              const v = calcVariables.find(v => v.name === rs);
              if (!v) {
                throw new Error(`Variable "${rs}" is not defined.`);
              }
              radius = typeof v.value === 'number' ? v.value : parseFloat(v.value as string) || 0;
              radiusRef = rs;
            } else {
              if (!NUMBER_REGEX.test(rs)) {
                throw new Error(`Circle radius must be a number or variable. Received "${rs}".`);
              }
              radius = parseFloat(rs);
            }
          }

          if (radius <= 0) {
            throw new Error(`Circle radius must be greater than 0. Received ${radius}.`);
          }

          const finalName = name || generateDefaultName('circle', getActiveNamesSet());
          createdObject = {
            id: `cr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: finalName,
            type: 'circle',
            center,
            radius,
            color: colorParam || getNextColor(),
            fill: fillParam !== false,
            visible: true,
            radiusRef
          };
          break;
        }

        case 'polygon': {
          if (argTokens.length < 3) {
            throw new Error(`"polygon" requires at least 3 vertices. Received ${argTokens.length}.`);
          }

          const points: (string | { x: number; y: number })[] = [];
          
          for (const arg of argTokens) {
            const coord = arg.match(COORD_REGEX);
            if (coord) {
              points.push({ x: parseFloat(coord[1]), y: parseFloat(coord[2]) });
            } else if (CPP_VAR_REGEX.test(arg)) {
              const pt = Object.values(activeObjects).find(o => o.name === arg);
              if (!pt || pt.type !== 'point') {
                throw new Error(`Point reference "${arg}" is not defined.`);
              }
              points.push(arg);
            } else {
              throw new Error(`Invalid polygon vertex "${arg}". Expected point name or coordinate pair.`);
            }
          }

          const finalName = name || generateDefaultName('polygon', getActiveNamesSet());
          createdObject = {
            id: `pl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: finalName,
            type: 'polygon',
            points,
            color: colorParam || getNextColor(),
            fill: fillParam !== false,
            visible: true
          };
          break;
        }

        case 'angle': {
          if (argTokens.length !== 3) {
            throw new Error(`"angle" requires exactly 3 point references in order: angle(A, B, C). Received ${argTokens.length}.`);
          }
          const [pA, pB, pC] = argTokens;
          
          for (const pRef of [pA, pB, pC]) {
            if (!CPP_VAR_REGEX.test(pRef)) {
              throw new Error(`Invalid point reference "${pRef}" in angle. Expected point variable names.`);
            }
            const pt = Object.values(activeObjects).find(o => o.name === pRef);
            if (!pt || pt.type !== 'point') {
              throw new Error(`Point reference "${pRef}" is not defined.`);
            }
          }

          const finalName = name || generateDefaultName('angle', getActiveNamesSet());
          createdObject = {
            id: `an_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: finalName,
            type: 'angle',
            pA,
            pB,
            pC,
            color: colorParam || getNextColor(),
            fill: fillParam !== false,
            visible: true
          };
          break;
        }

        case 'vec':
        case 'vector': {
          if (argTokens.length !== 1 && argTokens.length !== 2) {
            throw new Error(`"vec" requires 1 or 2 arguments: vec(p2) or vec(p1, p2).`);
          }

          let p1: string | { x: number; y: number } = { x: 0, y: 0 };
          let p2: string | { x: number; y: number };

          if (argTokens.length === 1) {
            const arg = argTokens[0];
            const coord = arg.match(COORD_REGEX);
            if (coord) {
              p2 = { x: parseFloat(coord[1]), y: parseFloat(coord[2]) };
            } else if (CPP_VAR_REGEX.test(arg)) {
              const pt = Object.values(activeObjects).find(o => o.name === arg);
              if (!pt || pt.type !== 'point') {
                throw new Error(`Point reference "${arg}" is not defined.`);
              }
              p2 = arg;
            } else {
              throw new Error(`Invalid vector argument "${arg}". Expected point name or coordinate pair.`);
            }
          } else {
            const [arg1, arg2] = argTokens;

            const coord1 = arg1.match(COORD_REGEX);
            if (coord1) {
              p1 = { x: parseFloat(coord1[1]), y: parseFloat(coord1[2]) };
            } else if (CPP_VAR_REGEX.test(arg1)) {
              const pt = Object.values(activeObjects).find(o => o.name === arg1);
              if (!pt || pt.type !== 'point') {
                throw new Error(`Point reference "${arg1}" is not defined.`);
              }
              p1 = arg1;
            } else {
              throw new Error(`Invalid vector start point "${arg1}". Expected point name or coordinate pair.`);
            }

            const coord2 = arg2.match(COORD_REGEX);
            if (coord2) {
              p2 = { x: parseFloat(coord2[1]), y: parseFloat(coord2[2]) };
            } else if (CPP_VAR_REGEX.test(arg2)) {
              const pt = Object.values(activeObjects).find(o => o.name === arg2);
              if (!pt || pt.type !== 'point') {
                throw new Error(`Point reference "${arg2}" is not defined.`);
              }
              p2 = arg2;
            } else {
              throw new Error(`Invalid vector end point "${arg2}". Expected point name or coordinate pair.`);
            }
          }

          const finalName = name || generateDefaultName('vector', getActiveNamesSet());
          createdObject = {
            id: `vc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: finalName,
            type: 'vector',
            p1,
            p2,
            color: colorParam || getNextColor(),
            visible: true
          };
          break;
        }

        case 'add': {
          if (argTokens.length !== 2) {
            throw new Error(`"add" requires exactly 2 vector references: add(v, w).`);
          }
          const [vName, wName] = argTokens;
          const vecV = Object.values(activeObjects).find(o => o.name === vName);
          if (!vecV || vecV.type !== 'vector') {
            throw new Error(`Vector reference "${vName}" is not defined or is not a vector.`);
          }
          const vecW = Object.values(activeObjects).find(o => o.name === wName);
          if (!vecW || vecW.type !== 'vector') {
            throw new Error(`Vector reference "${wName}" is not defined or is not a vector.`);
          }

          const finalName = name || generateDefaultName('vector', getActiveNamesSet());
          createdObject = {
            id: `vc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: finalName,
            type: 'vector',
            p1: { x: 0, y: 0 },
            p2: { x: 0, y: 0 },
            color: colorParam || getNextColor(),
            visible: true,
            op: 'add',
            v1Ref: vName,
            v2Ref: wName
          };
          break;
        }

        case 'sub': {
          if (argTokens.length !== 2) {
            throw new Error(`"sub" requires exactly 2 vector references: sub(v, w).`);
          }
          const [vName, wName] = argTokens;
          const vecV = Object.values(activeObjects).find(o => o.name === vName);
          if (!vecV || vecV.type !== 'vector') {
            throw new Error(`Vector reference "${vName}" is not defined or is not a vector.`);
          }
          const vecW = Object.values(activeObjects).find(o => o.name === wName);
          if (!vecW || vecW.type !== 'vector') {
            throw new Error(`Vector reference "${wName}" is not defined or is not a vector.`);
          }

          const finalName = name || generateDefaultName('vector', getActiveNamesSet());
          createdObject = {
            id: `vc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: finalName,
            type: 'vector',
            p1: { x: 0, y: 0 },
            p2: { x: 0, y: 0 },
            color: colorParam || getNextColor(),
            visible: true,
            op: 'sub',
            v1Ref: vName,
            v2Ref: wName
          };
          break;
        }

        default:
          throw new Error(`Unknown geometry function "${funcName}". Supported functions are: point, line, circle, polygon, angle, vec, add, sub.`);
      }

      // Add to rolling list of parsed objects and active set
      parsedObjects.push(createdObject);
      activeObjects[createdObject.name] = createdObject;

    } catch (e: any) {
      errors.push(`Line ${lineNum}: ${e.message}`);
    }
  }

  return {
    objects: parsedObjects,
    errors,
    clearState,
    deletedNames
  };
}

/**
 * Helper to generate suggestion text depending on prefix typed
 */
export interface Suggestion {
  syntax: string;
  description: string;
}

const SYNTAX_SUGGESTIONS: Record<string, Suggestion> = {
  point: { syntax: 'point(x, y)', description: 'Create a point at coordinates (x, y)' },
  line: { syntax: 'line(p1, p2) or line(x1, y1, x2, y2)', description: 'Create a line segment between points/coordinates' },
  circle: { syntax: 'circle(center, radius) or circle(x, y, radius)', description: 'Create a circle with center point and radius' },
  polygon: { syntax: 'polygon(p1, p2, p3, ...)', description: 'Create a polygon through a set of points' },
  angle: { syntax: 'angle(A, B, C)', description: 'Measure angle ABC at vertex B' },
  vec: { syntax: 'vec(p2) or vec(p1, p2)', description: 'Create a vector starting at p1 (default (0,0)) pointing to p2' },
  add: { syntax: 'add(v, w) or v + w', description: 'Add two vectors together' },
  sub: { syntax: 'sub(v, w) or v - w', description: 'Subtract vector w from vector v (starts at tip of w, points to tip of v)' },
};

export function getAutocompleteSuggestion(typed: string): Suggestion | null {
  // Strip assignments like "A = "
  const expr = typed.replace(/^[^=]*=\s*/, '').trim().toLowerCase();
  
  if (!expr) return null;
  
  // Find which function the user is typing
  for (const [key, sug] of Object.entries(SYNTAX_SUGGESTIONS)) {
    if (key.startsWith(expr) || expr.startsWith(key)) {
      // If the user has finished writing valid syntax, e.g. "point(5,6)", we hide the tooltip
      if (expr.includes(')') && expr.indexOf(')') === expr.lastIndexOf(')')) {
        const afterParen = expr.substring(expr.indexOf('(') + 1);
        // If it looks complete, hide it
        if (!afterParen.endsWith(',') && afterParen.split(',').length >= 2) {
          return null;
        }
      }
      return sug;
    }
  }
  return null;
}
