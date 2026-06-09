export type ObjectType = 'point' | 'line' | 'circle' | 'polygon' | 'angle';

export interface PointObject {
  id: string;
  name: string;
  type: 'point';
  x: number;
  y: number;
  color: string;
  visible: boolean;
  fill?: boolean;
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

export type GeometricObject =
  | PointObject
  | LineObject
  | CircleObject
  | PolygonObject
  | AngleObject;

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
