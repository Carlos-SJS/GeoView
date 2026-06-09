import React, { useRef, useEffect, useState } from 'react';
import type { GeometricObject, ViewportState } from '../types';
import {
  resolvePoint,
  getDistanceToObject,
  getDistance,
  type Point,
} from '../utils/geometry';
import { ONE_DARK_COLORS, hexToRgba } from '../utils/theme';

interface ViewportProps {
  objects: Record<string, GeometricObject>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  viewportState: ViewportState;
  setViewportState: (state: ViewportState) => void;
  onUpdateObjects: (updated: Record<string, GeometricObject>) => void;
}

export const Viewport: React.FC<ViewportProps> = ({
  objects,
  selectedId,
  onSelect,
  viewportState,
  setViewportState,
  onUpdateObjects,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [isPanning, setIsPanning] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const viewportStart = useRef({ offsetX: 0, offsetY: 0 });

  const [cursorMode, setCursorMode] = useState<'select' | 'drag'>('select');
  const [isDraggingObj, setIsDraggingObj] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const dragTargets = useRef<{
    type: 'point_object' | 'custom_property';
    name?: string;
    objId?: string;
    propPath?: string;
    polygonIndex?: number;
    initialX: number;
    initialY: number;
  }[]>([]);
  const dragStartWorld = useRef({ x: 0, y: 0 });
  const isAltPressed = useRef(false);
  const isAltTemporaryDrag = useRef(false);

  const { scale, offsetX, offsetY } = viewportState;

  // Listen to keyboard shortcut (Escape to select, Alt for temporary drag)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCursorMode('select');
      } else if (e.key === 'Alt') {
        e.preventDefault();
        if (cursorMode === 'select' && !isAltPressed.current) {
          isAltPressed.current = true;
          setCursorMode('drag');
          isAltTemporaryDrag.current = true;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        e.preventDefault();
        isAltPressed.current = false;
        if (isAltTemporaryDrag.current) {
          setCursorMode('select');
          isAltTemporaryDrag.current = false;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [cursorMode]);

  // Handle Resize with ResizeObserver to capture container resizing (e.g. terminal collapsing, properties panel toggles)
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    
    resizeObserver.observe(container);
    return () => {
      resizeObserver.unobserve(container);
      resizeObserver.disconnect();
    };
  }, []);

  // Coordinate transforms
  const worldToScreen = (wx: number, wy: number) => {
    return {
      x: wx * scale + offsetX,
      y: -wy * scale + offsetY,
    };
  };

  const screenToWorld = (sx: number, sy: number) => {
    return {
      x: (sx - offsetX) / scale,
      y: -(sy - offsetY) / scale,
    };
  };

  // Determine grid step size dynamically based on scale
  const getGridSteps = (scale: number) => {
    const targetPixels = 70; // Desired space between major lines
    const targetWorldUnits = targetPixels / scale;
    
    // Find the nearest power of 10
    const power = Math.pow(10, Math.floor(Math.log10(targetWorldUnits)));
    const ratio = targetWorldUnits / power;
    
    let majorStep = power;
    if (ratio >= 5) {
      majorStep = power * 5;
    } else if (ratio >= 2) {
      majorStep = power * 2;
    }
    
    // Minor subdivisions
    let subdivisions = 5;
    if (majorStep / power === 2) {
      subdivisions = 4; // Subdivide step=2 into 0.5s
    }
    
    return { majorStep, minorStep: majorStep / subdivisions };
  };

  // Render Canvas Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear background
    ctx.fillStyle = ONE_DARK_COLORS.background;
    ctx.fillRect(0, 0, size.width, size.height);

    const { majorStep, minorStep } = getGridSteps(scale);

    // Visible bounds in world units
    const minW = screenToWorld(0, size.height);
    const maxW = screenToWorld(size.width, 0);

    // DRAW MINOR GRID
    ctx.strokeStyle = hexToRgba('#abb2bf', 0.04);
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    const startXMinor = Math.floor(minW.x / minorStep) * minorStep;
    const endXMinor = Math.ceil(maxW.x / minorStep) * minorStep;
    for (let x = startXMinor; x <= endXMinor; x += minorStep) {
      const screenX = x * scale + offsetX;
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, size.height);
    }
    const startYMinor = Math.floor(minW.y / minorStep) * minorStep;
    const endYMinor = Math.ceil(maxW.y / minorStep) * minorStep;
    for (let y = startYMinor; y <= endYMinor; y += minorStep) {
      const screenY = -y * scale + offsetY;
      ctx.moveTo(0, screenY);
      ctx.lineTo(size.width, screenY);
    }
    ctx.stroke();

    // DRAW MAJOR GRID
    ctx.strokeStyle = hexToRgba('#abb2bf', 0.12);
    ctx.lineWidth = 1;
    ctx.beginPath();

    const startXMajor = Math.floor(minW.x / majorStep) * majorStep;
    const endXMajor = Math.ceil(maxW.x / majorStep) * majorStep;
    for (let x = startXMajor; x <= endXMajor; x += majorStep) {
      const screenX = x * scale + offsetX;
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, size.height);
    }
    const startYMajor = Math.floor(minW.y / majorStep) * majorStep;
    const endYMajor = Math.ceil(maxW.y / majorStep) * majorStep;
    for (let y = startYMajor; y <= endYMajor; y += majorStep) {
      const screenY = -y * scale + offsetY;
      ctx.moveTo(0, screenY);
      ctx.lineTo(size.width, screenY);
    }
    ctx.stroke();

    // DRAW AXES
    ctx.strokeStyle = hexToRgba('#abb2bf', 0.4);
    ctx.lineWidth = 2;
    ctx.beginPath();
    // X-axis (y = 0)
    if (offsetY >= 0 && offsetY <= size.height) {
      ctx.moveTo(0, offsetY);
      ctx.lineTo(size.width, offsetY);
    }
    // Y-axis (x = 0)
    if (offsetX >= 0 && offsetX <= size.width) {
      ctx.moveTo(offsetX, 0);
      ctx.lineTo(offsetX, size.height);
    }
    ctx.stroke();

    // DRAW GRID LABELS (PINNED TO EDGES)
    ctx.fillStyle = hexToRgba(ONE_DARK_COLORS.text, 0.75);
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // X Labels
    const clampLabelY = Math.max(8, Math.min(size.height - 20, offsetY + 6));
    for (let x = startXMajor; x <= endXMajor; x += majorStep) {
      if (Math.abs(x) < 1e-9) continue; // Skip zero, handle at origin
      const screenX = x * scale + offsetX;
      const formatted = Math.round(x * 1000) / 1000;
      ctx.fillText(formatted.toString(), screenX, clampLabelY);
    }

    // Y Labels
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const clampLabelX = Math.max(8, Math.min(size.width - 8, offsetX - 6));
    for (let y = startYMajor; y <= endYMajor; y += majorStep) {
      if (Math.abs(y) < 1e-9) continue;
      const screenY = -y * scale + offsetY;
      const formatted = Math.round(y * 1000) / 1000;
      ctx.fillText(formatted.toString(), clampLabelX, screenY);
    }

    // Origin label (0, 0)
    if (offsetX >= 0 && offsetX <= size.width && offsetY >= 0 && offsetY <= size.height) {
      ctx.fillText('0', offsetX - 6, offsetY + 6);
    }

    // DRAW GEOMETRIC OBJECTS
    const objectsList = Object.values(objects);

    // Draw Polygons, Circles, Lines, Angles first, then Points on top
    // 1. Draw Angles
    objectsList.forEach(obj => {
      if (obj.type !== 'angle' || !obj.visible) return;
      const pA = resolvePoint(obj.pA, objects);
      const pB = resolvePoint(obj.pB, objects);
      const pC = resolvePoint(obj.pC, objects);
      if (!pA || !pB || !pC) return;

      const sB = worldToScreen(pB.x, pB.y);

      // Compute angles
      const angA = Math.atan2(pA.y - pB.y, pA.x - pB.x);
      const angC = Math.atan2(pC.y - pB.y, pC.x - pB.x);
      let diff = angC - angA;
      if (diff < 0) diff += 2 * Math.PI;

      const valDeg = (diff * 180) / Math.PI;

      // Draw Arc
      const arcRadius = 35;
      ctx.strokeStyle = obj.color;
      ctx.fillStyle = hexToRgba(obj.color, 0.2);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      // Draw arc centered at B
      ctx.moveTo(sB.x, sB.y);
      // Math.atan2 Y is inverted in screen space vs world space.
      // In world space, Y is UP. In canvas, Y is DOWN.
      // So we draw screen-space arc using: -angA and -angC, with anticlockwise logic
      ctx.arc(sB.x, sB.y, arcRadius, -angA, -angC, true);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Draw text label
      const midAngle = -angA - diff / 2;
      const labelDist = arcRadius + 18;
      const labelX = sB.x + Math.cos(midAngle) * labelDist;
      const labelY = sB.y + Math.sin(midAngle) * labelDist;
      
      ctx.fillStyle = ONE_DARK_COLORS.textLight;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${valDeg.toFixed(1)}°`, labelX, labelY);
    });

    // 2. Draw Polygons
    objectsList.forEach(obj => {
      if (obj.type !== 'polygon' || !obj.visible) return;
      const pts = obj.points
        .map(p => resolvePoint(p, objects))
        .filter((p): p is Point => p !== null);
      
      if (pts.length < 2) return;

      const isSel = selectedId === obj.id;

      ctx.beginPath();
      const s0 = worldToScreen(pts[0].x, pts[0].y);
      ctx.moveTo(s0.x, s0.y);
      for (let i = 1; i < pts.length; i++) {
        const s = worldToScreen(pts[i].x, pts[i].y);
        ctx.lineTo(s.x, s.y);
      }
      ctx.closePath();

      // Fill
      if (obj.fill !== false) {
        ctx.fillStyle = hexToRgba(obj.color, isSel ? 0.25 : 0.12);
        ctx.fill();
      }

      // Stroke
      ctx.strokeStyle = obj.color;
      ctx.lineWidth = isSel ? 3.5 : 2;
      ctx.stroke();

      // Draw polygon label (near the centroid)
      let sxSum = 0, sySum = 0;
      pts.forEach(p => {
        const s = worldToScreen(p.x, p.y);
        sxSum += s.x;
        sySum += s.y;
      });
      ctx.fillStyle = ONE_DARK_COLORS.textMuted;
      ctx.font = 'italic 11px sans-serif';
      ctx.fillText(obj.name, sxSum / pts.length, sySum / pts.length);
    });

    // 3. Draw Circles
    objectsList.forEach(obj => {
      if (obj.type !== 'circle' || !obj.visible) return;
      const center = resolvePoint(obj.center, objects);
      if (!center) return;

      const sc = worldToScreen(center.x, center.y);
      const scr = obj.radius * scale;
      const isSel = selectedId === obj.id;

      // Draw fill (very light)
      if (obj.fill !== false) {
        ctx.fillStyle = hexToRgba(obj.color, isSel ? 0.08 : 0.03);
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, scr, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Draw stroke
      ctx.strokeStyle = obj.color;
      ctx.lineWidth = isSel ? 3.5 : 2;
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, scr, 0, 2 * Math.PI);
      ctx.stroke();

      // Draw Center helper dot (if center is absolute coordinate and not a point object)
      if (typeof obj.center !== 'string') {
        ctx.fillStyle = obj.color;
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, 2, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Draw label on boundary
      ctx.fillStyle = ONE_DARK_COLORS.textMuted;
      ctx.font = '11px sans-serif';
      ctx.fillText(obj.name, sc.x + scr / Math.sqrt(2) + 4, sc.y - scr / Math.sqrt(2) - 4);
    });

    // 4. Draw Lines
    objectsList.forEach(obj => {
      if (obj.type !== 'line' || !obj.visible) return;
      const p1 = resolvePoint(obj.p1, objects);
      const p2 = resolvePoint(obj.p2, objects);
      if (!p1 || !p2) return;

      const s1 = worldToScreen(p1.x, p1.y);
      const s2 = worldToScreen(p2.x, p2.y);
      const isSel = selectedId === obj.id;

      // If selected, draw backing highlight
      if (isSel) {
        ctx.strokeStyle = hexToRgba(obj.color, 0.4);
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.stroke();
      }

      // Main line segment stroke
      ctx.strokeStyle = obj.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();

      // Label at midpoint
      ctx.fillStyle = ONE_DARK_COLORS.textMuted;
      ctx.font = '11px sans-serif';
      ctx.fillText(
        obj.name,
        (s1.x + s2.x) / 2 + 5,
        (s1.y + s2.y) / 2 - 5
      );
    });

    // 5. Draw Points on top
    objectsList.forEach(obj => {
      if (obj.type !== 'point' || !obj.visible) return;
      const sc = worldToScreen(obj.x, obj.y);
      const isSel = selectedId === obj.id;

      // Glow if selected
      if (isSel) {
        ctx.fillStyle = hexToRgba(obj.color, 0.35);
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, 9, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Point core
      ctx.fillStyle = obj.color;
      ctx.strokeStyle = ONE_DARK_COLORS.background;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, 4.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Draw Name label
      ctx.fillStyle = ONE_DARK_COLORS.textLight;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.strokeStyle = '#1e2227';
      ctx.lineWidth = 2.5;
      ctx.strokeText(obj.name, sc.x + 6, sc.y - 6);
      ctx.fillText(obj.name, sc.x + 6, sc.y - 6);
    });

  }, [objects, selectedId, scale, offsetX, offsetY, size]);

  // Handle Mousedown
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.button !== 1) return; // Only left/middle click
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // World coordinates of click
    const worldClick = screenToWorld(clickX, clickY);

    if (cursorMode === 'drag') {
      const objectsList = Object.values(objects);
      
      const getScreenDistance = (obj: GeometricObject) => {
        if (obj.type === 'circle') {
          const center = resolvePoint(obj.center, objects);
          if (center) {
            const d = getDistance(worldClick, center);
            if (d <= obj.radius) return 0;
            return Math.abs(d - obj.radius) * scale;
          }
        }
        return getDistanceToObject(worldClick.x, worldClick.y, obj, objects) * scale;
      };

      const hitObjs = objectsList.filter(obj => obj.visible && getScreenDistance(obj) < 12);

      if (hitObjs.length > 0) {
        let draggedObj: GeometricObject;

        const selectedHit = hitObjs.find(obj => obj.id === selectedId);
        if (selectedHit) {
          draggedObj = selectedHit;
        } else {
          const pointHits = hitObjs.filter(obj => obj.type === 'point');
          if (pointHits.length > 0) {
            pointHits.sort((a, b) => getScreenDistance(a) - getScreenDistance(b));
            draggedObj = pointHits[0];
          } else {
            hitObjs.sort((a, b) => getScreenDistance(a) - getScreenDistance(b));
            draggedObj = hitObjs[0];
          }
        }

        onSelect(draggedObj.id);

        const targets: typeof dragTargets.current = [];

        if (draggedObj.type === 'point') {
          targets.push({
            type: 'point_object',
            name: draggedObj.name,
            initialX: draggedObj.x,
            initialY: draggedObj.y
          });
        } else if (draggedObj.type === 'circle') {
          if (typeof draggedObj.center === 'string') {
            const pt = objects[draggedObj.center];
            if (pt && pt.type === 'point') {
              targets.push({
                type: 'point_object',
                name: pt.name,
                initialX: pt.x,
                initialY: pt.y
              });
            }
          } else {
            targets.push({
              type: 'custom_property',
              objId: draggedObj.id,
              propPath: 'center',
              initialX: draggedObj.center.x,
              initialY: draggedObj.center.y
            });
          }
        } else if (draggedObj.type === 'line') {
          [draggedObj.p1, draggedObj.p2].forEach((p, idx) => {
            if (typeof p === 'string') {
              const pt = objects[p];
              if (pt && pt.type === 'point') {
                targets.push({
                  type: 'point_object',
                  name: pt.name,
                  initialX: pt.x,
                  initialY: pt.y
                });
              }
            } else {
              targets.push({
                type: 'custom_property',
                objId: draggedObj.id,
                propPath: idx === 0 ? 'p1' : 'p2',
                initialX: p.x,
                initialY: p.y
              });
            }
          });
        } else if (draggedObj.type === 'polygon') {
          draggedObj.points.forEach((p, idx) => {
            if (typeof p === 'string') {
              const pt = objects[p];
              if (pt && pt.type === 'point') {
                targets.push({
                  type: 'point_object',
                  name: pt.name,
                  initialX: pt.x,
                  initialY: pt.y
                });
              }
            } else {
              targets.push({
                type: 'custom_property',
                objId: draggedObj.id,
                propPath: 'polygon_vertex',
                polygonIndex: idx,
                initialX: p.x,
                initialY: p.y
              });
            }
          });
        } else if (draggedObj.type === 'angle') {
          [draggedObj.pA, draggedObj.pB, draggedObj.pC].forEach(p => {
            const pt = objects[p];
            if (pt && pt.type === 'point') {
              targets.push({
                type: 'point_object',
                name: pt.name,
                initialX: pt.x,
                initialY: pt.y
              });
            }
          });
        }

        const seenPoints = new Set<string>();
        const uniqueTargets: typeof targets = [];
        targets.forEach(t => {
          if (t.type === 'point_object' && t.name) {
            if (!seenPoints.has(t.name)) {
              seenPoints.add(t.name);
              uniqueTargets.push(t);
            }
          } else {
            uniqueTargets.push(t);
          }
        });

        dragTargets.current = uniqueTargets;
        dragStartWorld.current = worldClick;
        setIsDraggingObj(true);
        return;
      }
    }

    let closestId: string | null = null;
    let minDistance = Infinity;

    Object.values(objects).forEach(obj => {
      if (!obj.visible) return;
      const dist = getDistanceToObject(worldClick.x, worldClick.y, obj, objects);
      const distScreen = dist * scale;
      
      if (obj.type === 'point' && distScreen < 10) {
        if (distScreen < minDistance) {
          minDistance = distScreen;
          closestId = obj.id;
        }
      } else if (distScreen < 8) {
        if (distScreen < minDistance) {
          minDistance = distScreen;
          closestId = obj.id;
        }
      }
    });

    onSelect(closestId);

    setIsPanning(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    viewportStart.current = { offsetX, offsetY };
  };

  // Handle Mousemove (Pan or Drag)
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDraggingObj) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const currentWorld = screenToWorld(mouseX, mouseY);

      const dx = currentWorld.x - dragStartWorld.current.x;
      const dy = currentWorld.y - dragStartWorld.current.y;

      const updatedMap: Record<string, GeometricObject> = {};

      dragTargets.current.forEach(target => {
        if (target.type === 'point_object' && target.name) {
          const pt = objects[target.name];
          if (pt && pt.type === 'point') {
            updatedMap[pt.name] = {
              ...pt,
              x: target.initialX + dx,
              y: target.initialY + dy
            };
          }
        } else if (target.type === 'custom_property' && target.objId) {
          const nameKey = Object.keys(objects).find(k => objects[k].id === target.objId);
          if (nameKey) {
            const obj = { ...objects[nameKey] };
            if (target.propPath === 'center' && obj.type === 'circle') {
              obj.center = { x: target.initialX + dx, y: target.initialY + dy };
            } else if (target.propPath === 'p1' && obj.type === 'line') {
              obj.p1 = { x: target.initialX + dx, y: target.initialY + dy };
            } else if (target.propPath === 'p2' && obj.type === 'line') {
              obj.p2 = { x: target.initialX + dx, y: target.initialY + dy };
            } else if (target.propPath === 'polygon_vertex' && obj.type === 'polygon' && target.polygonIndex !== undefined) {
              const newPts = [...obj.points];
              newPts[target.polygonIndex] = { x: target.initialX + dx, y: target.initialY + dy };
              obj.points = newPts;
            }
            updatedMap[obj.name] = obj;
          }
        }
      });

      if (Object.keys(updatedMap).length > 0) {
        onUpdateObjects(updatedMap);
      }
      return;
    }

    if (!isPanning) {
      // Hover detection for dynamic cursor feedback
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const worldMouse = screenToWorld(mouseX, mouseY);
      
      const getScreenDistance = (obj: GeometricObject) => {
        if (obj.type === 'circle') {
          const center = resolvePoint(obj.center, objects);
          if (center) {
            const d = getDistance(worldMouse, center);
            if (d <= obj.radius) return 0;
            return Math.abs(d - obj.radius) * scale;
          }
        }
        return getDistanceToObject(worldMouse.x, worldMouse.y, obj, objects) * scale;
      };

      const hit = Object.values(objects).find(obj => obj.visible && getScreenDistance(obj) < 12);
      setHoveredId(hit ? hit.id : null);
      return;
    }
    
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    
    setViewportState({
      scale,
      offsetX: viewportStart.current.offsetX + dx,
      offsetY: viewportStart.current.offsetY + dy,
    });
  };

  // Handle Mouseup
  const handleMouseUp = () => {
    setIsPanning(false);
    setIsDraggingObj(false);
  };

  // Handle Wheel (Zoom centered on mouse)
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldMouse = screenToWorld(mouseX, mouseY);
    
    const zoomFactor = 1.15;
    const newScale = e.deltaY < 0 ? scale * zoomFactor : scale / zoomFactor;
    
    // Boundary check for scale to prevent crash
    if (newScale < 0.1 || newScale > 20000) return;

    // Adjust offsets so the mouse coordinate doesn't jump
    const newOffsetX = mouseX - worldMouse.x * newScale;
    const newOffsetY = mouseY + worldMouse.y * newScale;

    setViewportState({
      scale: newScale,
      offsetX: newOffsetX,
      offsetY: newOffsetY,
    });
  };

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        position: 'relative',
        backgroundColor: ONE_DARK_COLORS.background,
        overflow: 'hidden',
        cursor: cursorMode === 'drag'
          ? (isDraggingObj ? 'grabbing' : (hoveredId ? 'grab' : 'default'))
          : (isPanning ? 'grabbing' : 'grab'),
      }}
    >
      {/* Floating Toolbar on Canvas */}
      <div className="canvas-toolbar">
        <button
          className={`toolbar-btn ${cursorMode === 'select' ? 'active' : ''}`}
          onClick={() => setCursorMode('select')}
          title="Select & Pan (Press Escape to switch)"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" fill={cursorMode === 'select' ? 'currentColor' : 'none'} />
            <path d="M13 13l6 6" strokeLinecap="round" />
          </svg>
          Select
        </button>
        <button
          className={`toolbar-btn ${cursorMode === 'drag' ? 'active' : ''}`}
          onClick={() => setCursorMode('drag')}
          title="Drag Elements (Hold Alt for temporary drag)"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="5 9 2 12 5 15" />
            <polyline points="9 5 12 2 15 5" />
            <polyline points="15 19 12 22 9 19" />
            <polyline points="19 9 22 12 19 15" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <line x1="12" y1="2" x2="12" y2="22" />
          </svg>
          Drag
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={size.width}
        height={size.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ display: 'block' }}
      />
    </div>
  );
};
