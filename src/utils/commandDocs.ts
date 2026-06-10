export interface DocItem {
  name: string;
  syntax: string;
  description: string;
  example: string;
}

export interface DocCategory {
  title: string;
  items: DocItem[];
}

export const COMMAND_DOCS: DocCategory[] = [
  {
    title: 'Geometry Commands',
    items: [
      { name: 'Point', syntax: 'point(x, y) or (x, y)', description: 'Create a point at coordinates (x, y). Support using calculator variables as x/y parameters.', example: 'A = point(2, 3) or B = point(a, b)' },
      { name: 'Line', syntax: 'line(p1, p2) or line(x1, y1, x2, y2)', description: 'Create a line segment between two points or coordinates.', example: 'l1 = line(A, B)' },
      { name: 'Circle', syntax: 'circle(center, radius) or circle(x, y, radius)', description: 'Create a circle with center point and radius. Radius can be a calculator variable reference.', example: 'c1 = circle(A, 4) or c2 = circle((0,0), r)' },
      { name: 'Polygon', syntax: 'polygon(p1, p2, p3, ...)', description: 'Create a polygon through a set of points.', example: 'poly1 = polygon(A, B, (3, 0))' },
      { name: 'Angle', syntax: 'angle(A, B, C)', description: 'Measure angle ABC at vertex B.', example: 'ang1 = angle(A, B, C)' },
      { name: 'Vector', syntax: 'vec(p2) or vec(p1, p2)', description: 'Create a vector pointing from p1 (default (0,0)) to p2.', example: 'v1 = vec(A)' },
      { name: 'Vector Add', syntax: 'add(v, w) or v + w', description: 'Add two vectors together dynamically.', example: 'v3 = v1 + v2' },
      { name: 'Vector Sub', syntax: 'sub(v, w) or v - w', description: 'Subtract vector w from vector v dynamically.', example: 'v3 = v1 - v2' },
    ]
  },
  {
    title: 'Calculator Functions',
    items: [
      { name: 'Distance', syntax: 'dist(p1, p2)', description: 'Euclidean distance between points p1 and p2.', example: 'd = dist(A, B)' },
      { name: 'Area', syntax: 'area(shape)', description: 'Area of a circle or polygon.', example: 'a = area(poly1)' },
      { name: 'Perimeter', syntax: 'perimeter(shape)', description: 'Circumference of a circle or perimeter of a polygon.', example: 'p = perimeter(c1)' },
      { name: 'Angle Measure', syntax: 'angle(A, B, C)', description: 'Clockwise angle ABC at vertex B in degrees.', example: 'ang = angle(A, B, C)' },
      { name: 'Magnitude', syntax: 'abs(v)', description: 'Length of a vector.', example: 'len = abs(v1)' },
      { name: 'Absolute Value', syntax: 'abs(x)', description: 'Absolute value of a scalar number.', example: 'val = abs(-5)' },
      { name: 'Square Root', syntax: 'sqrt(x)', description: 'Square root of a number.', example: 's = sqrt(16)' },
      { name: 'Dot Product', syntax: 'dot(v, w)', description: 'Dot product of two vectors.', example: 'k = dot(v1, v2)' },
      { name: 'Cross Product', syntax: 'cross(v, w)', description: '2D scalar cross product (v_x * w_y - v_y * w_x).', example: 'c = cross(v1, v2)' },
      { name: 'Trig (Rad)', syntax: 'sin(x), cos(x), tan(x)', description: 'Trigonometric functions in radians.', example: 's = sin(pi / 2)' },
      { name: 'Trig (Deg)', syntax: 'sind(x), cosd(x), tand(x)', description: 'Trigonometric functions in degrees.', example: 's = sind(90)' },
      { name: 'Inverse Trig (Rad)', syntax: 'asin(x), acos(x)', description: 'Inverse trigonometric functions in radians.', example: 'a = asin(0.5)' },
      { name: 'Inverse Trig (Deg)', syntax: 'asind(x), acosd(x)', description: 'Inverse trigonometric functions in degrees.', example: 'a = asind(0.5)' },
    ]
  },
  {
    title: 'Constants',
    items: [
      { name: 'Pi', syntax: 'pi or PI', description: 'Mathematical constant Pi (~3.14159). Reserved, cannot be renamed.', example: 'c = 2 * pi * r' },
      { name: 'Euler\'s Number', syntax: 'e or E', description: 'Mathematical constant e (~2.71828). Reserved, cannot be renamed.', example: 'y = e^x' },
    ]
  },
  {
    title: 'Console Commands',
    items: [
      { name: 'Help', syntax: 'help', description: 'Opens the command documentation window.', example: 'help' },
      { name: 'Undo', syntax: 'undo', description: 'Undoes the last action.', example: 'undo' },
      { name: 'Redo', syntax: 'redo', description: 'Redoes the last undone action.', example: 'redo' },
      { name: 'Delete', syntax: 'delete(name) or delete name', description: 'Deletes a geometry object or calculator variable.', example: 'delete A' },
      { name: 'Clear', syntax: 'clear', description: 'Clears all elements and variables.', example: 'clear' },
    ]
  }
];
