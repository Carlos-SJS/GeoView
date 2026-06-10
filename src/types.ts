export type ObjectType = 'point' | 'line' | 'circle' | 'polygon' | 'angle' | 'vector';

export interface PointObject {
  id: string;
  name: string;
  type: 'point';
  x: number;
  y: number;
  color: string;
  visible: boolean;
  fill?: boolean;
  xRef?: string;
  yRef?: string;
}

export interface LineObject {
  id: string;
  name: string;
  type: 'line';
  p1: string | { x: number; y: number }; // Point name (e.g. 'A') or absolute coordinate
  p2: string | { x: number; y: number }; // Point name (e.g. 'B') or absolute coordinate
  color: string;
  visible: boolean;
  fill?: boolean;
}

export interface CircleObject {
  id: string;
  name: string;
  type: 'circle';
  center: string | { x: number; y: number }; // Point name (e.g. 'A') or absolute coordinate
  radius: number;
  color: string;
  visible: boolean;
  fill?: boolean;
  radiusRef?: string;
}

export interface PolygonObject {
  id: string;
  name: string;
  type: 'polygon';
  points: (string | { x: number; y: number })[]; // Point names or coordinates
  color: string;
  visible: boolean;
  fill?: boolean;
}

export interface AngleObject {
  id: string;
  name: string;
  type: 'angle';
  pA: string; // Point name reference
  pB: string; // Point name reference (vertex)
  pC: string; // Point name reference
  color: string;
  visible: boolean;
  fill?: boolean;
}

export interface VectorObject {
  id: string;
  name: string;
  type: 'vector';
  p1: string | { x: number; y: number }; // Start coordinate or point name (defaults to (0,0))
  p2: string | { x: number; y: number }; // End coordinate or point name
  color: string;
  visible: boolean;
  fill?: boolean;
  op?: 'add' | 'sub';                    // Operation type if derived
  v1Ref?: string;                         // First operand vector name
  v2Ref?: string;                         // Second operand vector name
}

export type GeometricObject =
  | PointObject
  | LineObject
  | CircleObject
  | PolygonObject
  | AngleObject
  | VectorObject;

export interface ViewportState {
  scale: number;    // Pixels per unit
  offsetX: number;  // X offset in screen pixels
  offsetY: number;  // Y offset in screen pixels
}

export interface CommandError {
  line: number;
  message: string;
}

export interface TerminalLog {
  command: string;
  success: boolean;
  error?: string;
  timestamp: Date;
}
