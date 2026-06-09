import type { GeometricObject } from '../types';

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Resolves a point reference or a coordinate tuple to a Point object
export function resolvePoint(
  ref: string | { x: number; y: number },
  objects: Record<string, GeometricObject>
): Point | null {
  if (typeof ref === 'string') {
    const obj = objects[ref];
    if (obj && obj.type === 'point') {
      return { x: obj.x, y: obj.y };
    }
    return null;
  }
  return ref;
}

// Distance between two points
export function getDistance(p1: Point, p2: Point): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

// Distance between cursor and point
export function getDistanceToPoint(px: number, py: number, pt: Point): number {
  return Math.hypot(px - pt.x, py - pt.y);
}

// Distance from point to line segment
export function getDistanceToSegment(px: number, py: number, a: Point, b: Point): number {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (l2 === 0) return Math.hypot(px - a.x, py - a.y);
  
  // Projection factor t clamped to [0, 1]
  let t = ((px - a.x) * (b.x - a.x) + (py - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  
  const projX = a.x + t * (b.x - a.x);
  const projY = a.y + t * (b.y - a.y);
  
  return Math.hypot(px - projX, py - projY);
}

// Inside polygon test (Ray Casting)
export function isPointInPolygon(p: Point, vs: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i].x, yi = vs[i].y;
    const xj = vs[j].x, yj = vs[j].y;
    
    const intersect = ((yi > p.y) !== (yj > p.y))
        && (p.x < (xj - xi) * (p.y - yi) / (yj - yi + 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Line length helper
export function getLineLength(
  p1: string | Point,
  p2: string | Point,
  objects: Record<string, GeometricObject>
): number | null {
  const pt1 = resolvePoint(p1, objects);
  const pt2 = resolvePoint(p2, objects);
  if (!pt1 || !pt2) return null;
  return getDistance(pt1, pt2);
}

// Line equation Ax + By + C = 0 formatted
export function getLineEquation(
  p1: string | Point,
  p2: string | Point,
  objects: Record<string, GeometricObject>
): string {
  const pt1 = resolvePoint(p1, objects);
  const pt2 = resolvePoint(p2, objects);
  if (!pt1 || !pt2) return 'Undefined';
  
  const dx = pt2.x - pt1.x;
  const dy = pt2.y - pt1.y;
  
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) {
    return 'Point Line';
  }
  
  let A = dy;
  let B = -dx;
  let C = dx * pt1.y - dy * pt1.x;
  
  // Normalize equation (make A > 0, or if A = 0, B > 0)
  if (A < -1e-9 || (Math.abs(A) < 1e-9 && B < -1e-9)) {
    A = -A;
    B = -B;
    C = -C;
  }
  
  // Make values nicer by dividing by GCD if integers, or rounding slightly
  const formatCoef = (val: number, isFirst: boolean, varChar: string) => {
    if (Math.abs(val) < 1e-5) return '';
    const rounded = Math.round(val * 1000) / 1000;
    const sign = rounded < 0 ? '-' : (isFirst ? '' : '+');
    const absVal = Math.abs(rounded);
    const coefStr = absVal === 1 ? '' : absVal.toString();
    return ` ${sign} ${coefStr}${varChar}`;
  };
  
  const aStr = formatCoef(A, true, 'x');
  const bStr = formatCoef(B, aStr === '', 'y');
  
  let cStr = '';
  if (Math.abs(C) >= 1e-5) {
    const roundedC = Math.round(C * 1000) / 1000;
    cStr = roundedC < 0 ? ` - ${Math.abs(roundedC)}` : ` + ${roundedC}`;
  }
  
  const fullEq = `${aStr}${bStr}${cStr} = 0`.trim();
  // Strip starting plus sign if any
  return fullEq.startsWith('+') ? fullEq.substring(1).trim() : fullEq;
}

// Polygon area (Shoelace formula)
export function getPolygonArea(points: (string | Point)[], objects: Record<string, GeometricObject>): number | null {
  const resolved = points.map(p => resolvePoint(p, objects)).filter((p): p is Point => p !== null);
  if (resolved.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < resolved.length; i++) {
    const j = (i + 1) % resolved.length;
    area += resolved[i].x * resolved[j].y;
    area -= resolved[j].x * resolved[i].y;
  }
  return Math.abs(area) / 2;
}

// Polygon perimeter
export function getPolygonPerimeter(points: (string | Point)[], objects: Record<string, GeometricObject>): number | null {
  const resolved = points.map(p => resolvePoint(p, objects)).filter((p): p is Point => p !== null);
  if (resolved.length < 2) return 0;
  
  let perimeter = 0;
  for (let i = 0; i < resolved.length; i++) {
    const j = (i + 1) % resolved.length;
    perimeter += getDistance(resolved[i], resolved[j]);
  }
  return perimeter;
}

// Polygon centroid
export function getPolygonCentroid(points: (string | Point)[], objects: Record<string, GeometricObject>): Point | null {
  const resolved = points.map(p => resolvePoint(p, objects)).filter((p): p is Point => p !== null);
  if (resolved.length < 3) {
    if (resolved.length === 2) {
      return { x: (resolved[0].x + resolved[1].x) / 2, y: (resolved[0].y + resolved[1].y) / 2 };
    }
    if (resolved.length === 1) {
      return resolved[0];
    }
    return null;
  }
  
  let area = 0;
  let cx = 0;
  let cy = 0;
  
  for (let i = 0; i < resolved.length; i++) {
    const j = (i + 1) % resolved.length;
    const factor = resolved[i].x * resolved[j].y - resolved[j].x * resolved[i].y;
    area += factor;
    cx += (resolved[i].x + resolved[j].x) * factor;
    cy += (resolved[i].y + resolved[j].y) * factor;
  }
  
  area = area / 2;
  if (Math.abs(area) < 1e-9) {
    // Collinear points, average them
    let sx = 0, sy = 0;
    resolved.forEach(p => { sx += p.x; sy += p.y; });
    return { x: sx / resolved.length, y: sy / resolved.length };
  }
  
  cx = cx / (6 * area);
  cy = cy / (6 * area);
  
  return { x: cx, y: cy };
}

// Angle ABC value in degrees (directed angle from BA to BC counter-clockwise)
export function getAngleValue(pA: string, pB: string, pC: string, objects: Record<string, GeometricObject>): number | null {
  const ptA = resolvePoint(pA, objects);
  const ptB = resolvePoint(pB, objects);
  const ptC = resolvePoint(pC, objects);
  if (!ptA || !ptB || !ptC) return null;
  
  const angA = Math.atan2(ptA.y - ptB.y, ptA.x - ptB.x);
  const angC = Math.atan2(ptC.y - ptB.y, ptC.x - ptB.x);
  
  let diff = angC - angA;
  if (diff < 0) diff += 2 * Math.PI;
  
  return (diff * 180) / Math.PI;
}

// Get bounding box of a single object
export function getObjectBoundingBox(obj: GeometricObject, objects: Record<string, GeometricObject>): BoundingBox | null {
  if (!obj.visible) return null;
  
  switch (obj.type) {
    case 'point': {
      return { minX: obj.x, minY: obj.y, maxX: obj.x, maxY: obj.y };
    }
    case 'line': {
      const p1 = resolvePoint(obj.p1, objects);
      const p2 = resolvePoint(obj.p2, objects);
      if (!p1 || !p2) return null;
      return {
        minX: Math.min(p1.x, p2.x),
        minY: Math.min(p1.y, p2.y),
        maxX: Math.max(p1.x, p2.x),
        maxY: Math.max(p1.y, p2.y),
      };
    }
    case 'circle': {
      const center = resolvePoint(obj.center, objects);
      if (!center) return null;
      const r = obj.radius;
      return {
        minX: center.x - r,
        minY: center.y - r,
        maxX: center.x + r,
        maxY: center.y + r,
      };
    }
    case 'polygon': {
      const pts = obj.points.map(p => resolvePoint(p, objects)).filter((p): p is Point => p !== null);
      if (pts.length === 0) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      pts.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
      return { minX, minY, maxX, maxY };
    }
    case 'angle': {
      // Bounding box of the 3 points forming the angle
      const ptA = resolvePoint(obj.pA, objects);
      const ptB = resolvePoint(obj.pB, objects);
      const ptC = resolvePoint(obj.pC, objects);
      if (!ptA || !ptB || !ptC) return null;
      return {
        minX: Math.min(ptA.x, ptB.x, ptC.x),
        minY: Math.min(ptA.y, ptB.y, ptC.y),
        maxX: Math.max(ptA.x, ptB.x, ptC.x),
        maxY: Math.max(ptA.y, ptB.y, ptC.y),
      };
    }
    default:
      return null;
  }
}

// Get union bounding box of all objects
export function getUnionBoundingBox(
  objectsList: GeometricObject[],
  objects: Record<string, GeometricObject>
): BoundingBox | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let hasBounds = false;
  
  objectsList.forEach(obj => {
    const box = getObjectBoundingBox(obj, objects);
    if (box) {
      minX = Math.min(minX, box.minX);
      minY = Math.min(minY, box.minY);
      maxX = Math.max(maxX, box.maxX);
      maxY = Math.max(maxY, box.maxY);
      hasBounds = true;
    }
  });
  
  if (!hasBounds) return null;
  return { minX, minY, maxX, maxY };
}

// Get distance from cursor (px, py) to object for selection
export function getDistanceToObject(
  px: number,
  py: number,
  obj: GeometricObject,
  objects: Record<string, GeometricObject>
): number {
  if (!obj.visible) return Infinity;

  switch (obj.type) {
    case 'point': {
      return getDistanceToPoint(px, py, obj);
    }
    case 'line':
    case 'vector': {
      const p1 = resolvePoint(obj.p1, objects);
      const p2 = resolvePoint(obj.p2, objects);
      if (!p1 || !p2) return Infinity;
      return getDistanceToSegment(px, py, p1, p2);
    }
    case 'circle': {
      const center = resolvePoint(obj.center, objects);
      if (!center) return Infinity;
      const d = getDistanceToPoint(px, py, center);
      // Distance is distance to boundary of circle
      return Math.abs(d - obj.radius);
    }
    case 'polygon': {
      const pts = obj.points.map(p => resolvePoint(p, objects)).filter((p): p is Point => p !== null);
      if (pts.length === 0) return Infinity;
      
      // Check if point is inside polygon
      if (isPointInPolygon({ x: px, y: py }, pts)) {
        return 0; // High priority select if clicked inside
      }
      
      // Otherwise find distance to closest segment boundary
      let minDistance = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const next = (i + 1) % pts.length;
        const d = getDistanceToSegment(px, py, pts[i], pts[next]);
        if (d < minDistance) minDistance = d;
      }
      return minDistance;
    }
    case 'angle': {
      // Distance to angle vertex B
      const ptB = resolvePoint(obj.pB, objects);
      if (!ptB) return Infinity;
      
      const distToVertex = getDistanceToPoint(px, py, ptB);
      // Let's also check distance to the arc representation.
      // Arc radius is usually around 30-50 pixels.
      return distToVertex;
    }
    default:
      return Infinity;
  }
}
