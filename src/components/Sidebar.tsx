import React, { useState, useRef, useEffect } from 'react';
import type { GeometricObject, ObjectType } from '../types';
import { ONE_DARK_COLORS } from '../utils/theme';
import { generateDefaultName } from '../parser';
import { CalculatorPanel } from './CalculatorPanel';
import type { CalculatorVariable } from '../utils/evaluator';
import { resolveVectorEndpoints, getLineCoefficients, formatLineEquation } from '../utils/geometry';

interface SidebarProps {
  objects: Record<string, GeometricObject>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onAddObject: (obj: GeometricObject) => void;
  onChangeObject?: (obj: GeometricObject, isCommit?: boolean) => void;
  onReorderObjects?: (newObjects: Record<string, GeometricObject>) => void;
  onFocusAll: () => void;
  onClearAll: () => void;
  onExport: () => void;
  calcVariables: CalculatorVariable[];
  onAddCalcVariable: (name: string, expression: string) => string | null;
  onDeleteCalcVariable: (name: string) => void;
  onReorderCalcVariables: (newVars: CalculatorVariable[]) => void;
  onUpdateCalcVariable: (oldName: string, newName: string, newExpression: string) => string | null;
  isCollapsed: boolean;
  onCollapseToggle: () => void;
  dropdownOpen: boolean;
  setDropdownOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  objects,
  selectedId,
  onSelect,
  onDelete,
  onToggleVisibility,
  onAddObject,
  onChangeObject: _onChangeObject,
  onReorderObjects,
  onFocusAll,
  onClearAll,
  onExport,
  calcVariables,
  onAddCalcVariable,
  onDeleteCalcVariable,
  onReorderCalcVariables,
  onUpdateCalcVariable,
  isCollapsed,
  onCollapseToggle,
  dropdownOpen,
  setDropdownOpen,
}) => {
  const [elementsExpanded, setElementsExpanded] = useState(true);
  const [calcExpanded, setCalcExpanded] = useState(true);
  const [groupExpanded, setGroupExpanded] = useState<Record<string, boolean>>({});
  const [draggedName, setDraggedName] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    targetName: string;
    position: 'above' | 'below' | 'inside' | 'create-group';
    parentGroupName: string | null;
  } | null>(null);

  const toolbarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownOpen && toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen, setDropdownOpen]);

  const objectsList = Object.values(objects);

  // SVG Icons
  const Icons = {
    point: (
      <svg className="obj-icon" viewBox="0 0 24 24" width="16" height="16">
        <circle cx="12" cy="12" r="7" fill="currentColor" />
        <circle cx="12" cy="12" r="3" fill="#1e2227" />
      </svg>
    ),
    segment: (
      <svg className="obj-icon" viewBox="0 0 24 24" width="16" height="16">
        <line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="4" cy="20" r="3" fill="#1e2227" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="20" cy="4" r="3" fill="#1e2227" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    line: (
      <svg className="obj-icon" viewBox="0 0 24 24" width="16" height="16">
        <line x1="2" y1="22" x2="22" y2="2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <polyline points="2,16 2,22 8,22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="22,8 22,2 16,2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    circle: (
      <svg className="obj-icon" viewBox="0 0 24 24" width="16" height="16">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      </svg>
    ),
    polygon: (
      <svg className="obj-icon" viewBox="0 0 24 24" width="16" height="16">
        <polygon points="12,4 20,18 4,18" fill="none" stroke="currentColor" strokeWidth="2.5" />
      </svg>
    ),
    rectangle: (
      <svg className="obj-icon" viewBox="0 0 24 24" width="16" height="16">
        <rect x="3" y="6" width="18" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" />
      </svg>
    ),
    angle: (
      <svg className="obj-icon" viewBox="0 0 24 24" width="16" height="16">
        <path d="M12 20 L20 12 M12 20 L4 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M9 17 A4 4 0 0 1 15 17" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    vector: (
      <svg className="obj-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="4" y1="20" x2="18" y2="6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <polyline points="12 6 18 6 18 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="4" cy="20" r="1.5" fill="currentColor" />
      </svg>
    ),
    group: (
      <svg className="obj-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
    convexhull: (
      <svg className="obj-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L20 7L22 17L12 22L2 17L4 7Z" />
      </svg>
    ),
    visible: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    hidden: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    ),
    trash: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    ),
    duplicate: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    ),
    plus: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
    viewport: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '2px' }}>
        <path d="M15 3h6v6M9 21H3v-6M21 15v6h-6M3 9V3h6" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    export: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
    clear: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    undo: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M3 7v6h6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    redo: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M21 7v6h-6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    collapse: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="9" y1="3" x2="9" y2="21" />
        <path d="M16 15l-3-3 3-3" />
      </svg>
    )
  };

  // Instantiates a default object
  const createDefaultObject = (type: ObjectType | 'rectangle') => {
    const namesSet = new Set(Object.values(objects).map(o => o.name));
    const name = generateDefaultName(type === 'rectangle' ? 'rect' : type, namesSet);
    const color = ONE_DARK_COLORS.accentActive;
    const id = `${(type === 'rectangle' ? 'pl' : type).substr(0, 2)}_${Date.now()}`;

    let newObj: GeometricObject;

    switch (type) {
      case 'rectangle':
        newObj = {
          id,
          name,
          type: 'polygon',
          points: [
            { x: -3, y: -2 },
            { x: 3, y: -2 },
            { x: 3, y: 2 },
            { x: -3, y: 2 }
          ],
          color,
          visible: true
        };
        break;
      case 'vector':
        newObj = {
          id,
          name,
          type: 'vector',
          p1: { x: 0, y: 0 },
          p2: { x: 3, y: 3 },
          color,
          visible: true
        };
        break;
      case 'point':
        newObj = { id, name, type: 'point', x: 0, y: 0, color, visible: true };
        break;
      case 'segment':
        newObj = {
          id,
          name,
          type: 'segment',
          p1: { x: -2, y: -2 },
          p2: { x: 3, y: 3 },
          color,
          visible: true
        };
        break;
      case 'line':
        newObj = {
          id,
          name,
          type: 'line',
          definitionType: 'points',
          p1: { x: -3, y: 1 },
          p2: { x: 3, y: -1 },
          color,
          visible: true
        };
        break;
      case 'circle':
        newObj = {
          id,
          name,
          type: 'circle',
          center: { x: 0, y: 0 },
          radius: 4,
          color,
          visible: true
        };
        break;
      case 'polygon':
        newObj = {
          id,
          name,
          type: 'polygon',
          points: [
            { x: -3, y: -2 },
            { x: 3, y: -2 },
            { x: 0, y: 3 }
          ],
          color,
          visible: true
        };
        break;
      case 'group':
        newObj = {
          id,
          name,
          type: 'group',
          elements: [],
          color,
          visible: true
        };
        break;
      case 'angle': {
        const pts = objectsList.filter(o => o.type === 'point') as any[];
        if (pts.length >= 3) {
          newObj = {
            id,
            name,
            type: 'angle',
            pA: pts[0].name,
            pB: pts[1].name,
            pC: pts[2].name,
            color,
            visible: true
          };
        } else {
          const nameA = generateDefaultName('point', namesSet);
          const ptA: GeometricObject = {
            id: `pt_${Date.now()}_a`,
            name: nameA,
            type: 'point',
            x: -2,
            y: 0,
            color,
            visible: true
          };
          namesSet.add(nameA);
          onAddObject(ptA);

          const nameB = generateDefaultName('point', namesSet);
          const ptB: GeometricObject = {
            id: `pt_${Date.now()}_b`,
            name: nameB,
            type: 'point',
            x: 0,
            y: 0,
            color,
            visible: true
          };
          namesSet.add(nameB);
          onAddObject(ptB);

          const nameC = generateDefaultName('point', namesSet);
          const ptC: GeometricObject = {
            id: `pt_${Date.now()}_c`,
            name: nameC,
            type: 'point',
            x: 0,
            y: 3,
            color,
            visible: true
          };
          namesSet.add(nameC);
          onAddObject(ptC);

          newObj = {
            id,
            name,
            type: 'angle',
            pA: nameA,
            pB: nameB,
            pC: nameC,
            color,
            visible: true
          };
        }
        break;
      }
      default:
        newObj = {
          id,
          name,
          type: 'point',
          x: 0,
          y: 0,
          color,
          visible: true
        };
    }

    onAddObject(newObj);
    onSelect(newObj.id);
    setDropdownOpen(false);
  };

  // Duplicate object
  const handleDuplicate = (e: React.MouseEvent, obj: GeometricObject) => {
    e.stopPropagation();
    const namesSet = new Set(Object.values(objects).map(o => o.name));
    const isRect = obj.type === 'polygon' && obj.name.toLowerCase().startsWith('rect');
    const newName = generateDefaultName(isRect ? 'rect' : obj.type, namesSet);
    const newId = `${obj.type.substr(0, 2)}_${Date.now()}_dup`;

    let dupObj: GeometricObject;

    switch (obj.type) {
      case 'point':
        dupObj = { ...obj, id: newId, name: newName, x: obj.x + 1, y: obj.y + 1 };
        break;
      case 'segment': {
        const p1 = typeof obj.p1 === 'string' ? obj.p1 : { x: obj.p1.x + 1, y: obj.p1.y + 1 };
        const p2 = typeof obj.p2 === 'string' ? obj.p2 : { x: obj.p2.x + 1, y: obj.p2.y + 1 };
        dupObj = { ...obj, id: newId, name: newName, p1, p2 };
        break;
      }
      case 'line': {
        const ln = obj as any;
        if (ln.definitionType === 'points') {
          const p1 = typeof ln.p1 === 'string' ? ln.p1 : { x: ln.p1.x + 1, y: ln.p1.y + 1 };
          const p2 = typeof ln.p2 === 'string' ? ln.p2 : { x: ln.p2.x + 1, y: ln.p2.y + 1 };
          dupObj = { ...ln, id: newId, name: newName, p1, p2 };
        } else if (ln.definitionType === 'vector' && ln.p1 !== undefined) {
          const p1 = typeof ln.p1 === 'string' ? ln.p1 : { x: ln.p1.x + 1, y: ln.p1.y + 1 };
          dupObj = { ...ln, id: newId, name: newName, p1 };
        } else {
          let newC = ln.c;
          if (!ln.cRef && typeof ln.c === 'number') {
            newC = ln.c + 1;
          }
          dupObj = { ...ln, id: newId, name: newName, c: newC };
        }
        break;
      }
      case 'circle': {
        const center = typeof obj.center === 'string' ? obj.center : { x: obj.center.x + 1, y: obj.center.y + 1 };
        dupObj = { ...obj, id: newId, name: newName, center };
        break;
      }
      case 'polygon': {
        const points = obj.points.map(p => typeof p === 'string' ? p : { x: p.x + 1, y: p.y + 1 });
        dupObj = { ...obj, id: newId, name: newName, points };
        break;
      }
      case 'angle':
        dupObj = { ...obj, id: newId, name: newName };
        break;
      case 'vector': {
        const p1 = typeof obj.p1 === 'string' ? obj.p1 : { x: obj.p1.x + 1, y: obj.p1.y + 1 };
        const p2 = typeof obj.p2 === 'string' ? obj.p2 : { x: obj.p2.x + 1, y: obj.p2.y + 1 };
        dupObj = { ...obj, id: newId, name: newName, p1, p2 };
        break;
      }
      case 'group':
        dupObj = { ...obj, id: newId, name: newName, elements: [...(obj as any).elements] };
        break;
      case 'convexhull':
        dupObj = { ...obj, id: newId, name: newName };
        break;
    }

    onAddObject(dupObj);
    onSelect(dupObj.id);
  };

  const getSubText = (obj: GeometricObject): string => {
    switch (obj.type) {
      case 'point':
        return `(${obj.x.toFixed(2)}, ${obj.y.toFixed(2)})`;
      case 'segment': {
        const p1s = typeof obj.p1 === 'string' ? obj.p1 : `(${obj.p1.x},${obj.p1.y})`;
        const p2s = typeof obj.p2 === 'string' ? obj.p2 : `(${obj.p2.x},${obj.p2.y})`;
        return `${p1s} ➔ ${p2s}`;
      }
      case 'line': {
        const coefs = getLineCoefficients(obj as any, objects);
        if (!coefs) return 'line: Undefined';
        return formatLineEquation(coefs.a, coefs.b, coefs.c);
      }
      case 'vector': {
        const eps = resolveVectorEndpoints(obj, objects);
        if (!eps) return 'vec: Undefined';
        const p1s = `(${eps.p1.x.toFixed(1)}, ${eps.p1.y.toFixed(1)})`;
        const p2s = `(${eps.p2.x.toFixed(1)}, ${eps.p2.y.toFixed(1)})`;
        if (obj.op && obj.v1Ref && obj.v2Ref) {
          const sign = obj.op === 'add' ? '+' : '-';
          return `${obj.v1Ref} ${sign} ${obj.v2Ref} [${p1s} ➔ ${p2s}]`;
        }
        return `vec: ${p1s} ➔ ${p2s}`;
      }
      case 'circle': {
        const c = typeof obj.center === 'string' ? obj.center : `(${obj.center.x},${obj.center.y})`;
        return `center: ${c}, r: ${obj.radius}`;
      }
      case 'polygon':
        return `${obj.points.length} vertices`;
      case 'angle':
        return `∠${obj.pA}${obj.pB}${obj.pC}`;
      case 'group':
        return `${(obj as any).elements.length} elements`;
      case 'convexhull': {
        const src = (obj as any).source;
        return typeof src === 'string' ? `hull (${src})` : `hull (${src.length} pts)`;
      }
    }
  };

  // Drag and drop event handlers
  const handleItemDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    obj: GeometricObject,
    parentGroupName: string | null
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const currentDragged = e.dataTransfer.getData('text/plain') || draggedName;
    if (!currentDragged || currentDragged === obj.name) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const height = rect.height;

    let position: 'above' | 'below' | 'inside' | 'create-group';

    if (obj.type === 'group') {
      if (mouseY < height * 0.35) {
        position = 'above';
      } else if (mouseY > height * 0.65) {
        position = 'below';
      } else {
        position = 'inside';
      }
    } else {
      if (mouseY < height * 0.35) {
        position = 'above';
      } else if (mouseY > height * 0.65) {
        position = 'below';
      } else {
        position = 'create-group';
      }
    }

    setDropTarget({
      targetName: obj.name,
      position,
      parentGroupName,
    });
  };

  const handleItemDrop = (
    e: React.DragEvent<HTMLDivElement>,
    targetObj: GeometricObject,
    parentGroupName: string | null
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const sourceName = e.dataTransfer.getData('text/plain') || draggedName;
    if (!sourceName || sourceName === targetObj.name || !dropTarget) {
      setDraggedName(null);
      setDropTarget(null);
      return;
    }

    const { position } = dropTarget;
    const sourceObj = objects[sourceName];
    if (!sourceObj) {
      setDraggedName(null);
      setDropTarget(null);
      return;
    }

    let currentObjects = { ...objects };

    // Remove sourceName from any existing group it belongs to
    for (const key of Object.keys(currentObjects)) {
      const o = currentObjects[key];
      if (o.type === 'group' && o.elements.includes(sourceName)) {
        currentObjects[key] = {
          ...o,
          elements: o.elements.filter(eName => eName !== sourceName)
        };
      }
    }

    if (position === 'inside' && targetObj.type === 'group') {
      // Add sourceName to targetObj group
      const targetGrp = currentObjects[targetObj.name] as any;
      if (targetGrp && !targetGrp.elements.includes(sourceName)) {
        currentObjects[targetObj.name] = {
          ...targetGrp,
          elements: [...targetGrp.elements, sourceName]
        };
      }
    } else if (position === 'create-group') {
      // Create new group containing [targetObj.name, sourceName]
      const namesSet = new Set(Object.values(currentObjects).map(o => o.name));
      const newGroupName = generateDefaultName('group', namesSet);
      const newGrpId = `grp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

      // Remove targetObj from its parent group if targetObj was inside a group
      for (const key of Object.keys(currentObjects)) {
        const o = currentObjects[key];
        if (o.type === 'group' && o.elements.includes(targetObj.name)) {
          currentObjects[key] = {
            ...o,
            elements: o.elements.filter(eName => eName !== targetObj.name)
          };
        }
      }

      const newGroup: GeometricObject = {
        id: newGrpId,
        name: newGroupName,
        type: 'group',
        elements: [targetObj.name, sourceName],
        color: ONE_DARK_COLORS.accentActive,
        visible: true
      };

      // Insert newGroup into currentObjects map right after targetObj
      const keys = Object.keys(currentObjects);
      const targetIdx = keys.indexOf(targetObj.name);
      const insertIdx = targetIdx !== -1 ? targetIdx + 1 : keys.length;
      keys.splice(insertIdx, 0, newGroupName);

      const reorderedMap: Record<string, GeometricObject> = {};
      keys.forEach(k => {
        if (k === newGroupName) {
          reorderedMap[k] = newGroup;
        } else {
          reorderedMap[k] = currentObjects[k];
        }
      });
      currentObjects = reorderedMap;
    } else if (position === 'above' || position === 'below') {
      if (parentGroupName && currentObjects[parentGroupName]) {
        // Reordering inside parentGroupName
        const parentGrp = currentObjects[parentGroupName] as any;
        if (parentGrp && parentGrp.type === 'group') {
          const filteredElements = parentGrp.elements.filter((eName: string) => eName !== sourceName);
          const targetIdx = filteredElements.indexOf(targetObj.name);
          const insertIdx = position === 'above' ? Math.max(0, targetIdx) : targetIdx + 1;
          filteredElements.splice(insertIdx, 0, sourceName);

          currentObjects[parentGroupName] = {
            ...parentGrp,
            elements: filteredElements
          };
        }
      } else {
        // Top-level reordering
        const keys = Object.keys(currentObjects).filter(k => k !== sourceName);
        const targetIdx = keys.indexOf(targetObj.name);
        const insertIdx = position === 'above' ? Math.max(0, targetIdx) : targetIdx + 1;
        keys.splice(insertIdx, 0, sourceName);

        const reorderedMap: Record<string, GeometricObject> = {};
        keys.forEach(k => {
          reorderedMap[k] = currentObjects[k];
        });
        currentObjects = reorderedMap;
      }
    }

    if (onReorderObjects) {
      onReorderObjects(currentObjects);
    }

    setDraggedName(null);
    setDropTarget(null);
  };

  // Grouping structure calculations
  const groupObjs = objectsList.filter(o => o.type === 'group');
  const childElementNames = new Set<string>();
  groupObjs.forEach(g => {
    (g as any).elements.forEach((eName: string) => childElementNames.add(eName));
  });

  // Top level objects (not inside any group)
  const topLevelObjs = objectsList.filter(o => !childElementNames.has(o.name));

  const renderSingleObjectItem = (obj: GeometricObject, parentGroupName: string | null = null) => {
    const isSelected = selectedId === obj.id;
    const isGroup = obj.type === 'group';
    const isExpanded = !groupExpanded[obj.id]; // default expanded
    const isChild = parentGroupName !== null;

    const isTarget = dropTarget && dropTarget.targetName === obj.name;
    const isAbove = isTarget && dropTarget.position === 'above';
    const isBelow = isTarget && dropTarget.position === 'below';
    const isInside = isTarget && dropTarget.position === 'inside';
    const isCreateGroup = isTarget && dropTarget.position === 'create-group';

    return (
      <div key={obj.id} style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Visual drop line indicator previewing insertion above */}
        {isAbove && (
          <div
            className="drop-indicator-line drop-line-above"
            style={{ left: isChild ? '16px' : '0px', right: '0px' }}
          />
        )}

        <div
          className={`object-item ${isSelected ? 'selected' : ''} ${!obj.visible ? 'hidden' : ''} ${isChild ? 'group-child-item' : ''} ${isInside ? 'drag-over-inside' : ''} ${isCreateGroup ? 'drag-over-create-group' : ''}`}
          onClick={() => onSelect(obj.id)}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', obj.name);
            setDraggedName(obj.name);
          }}
          onDragEnd={() => {
            setDraggedName(null);
            setDropTarget(null);
          }}
          onDragOver={(e) => handleItemDragOver(e, obj, parentGroupName)}
          onDragLeave={() => {
            if (isTarget) {
              setDropTarget(null);
            }
          }}
          onDrop={(e) => handleItemDrop(e, obj, parentGroupName)}
          style={{
            borderLeftColor: obj.color,
            marginLeft: isChild ? '16px' : '0px',
          }}
        >
          {isCreateGroup && (
            <div className="create-group-badge">
              + Group with {draggedName || 'element'}
            </div>
          )}

          {isGroup && (
            <button
              className="action-btn-list"
              onClick={(e) => {
                e.stopPropagation();
                setGroupExpanded(prev => ({ ...prev, [obj.id]: !prev[obj.id] }));
              }}
              style={{ marginRight: '4px', padding: '2px' }}
              title={isExpanded ? "Collapse Group" : "Expand Group"}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}

          <div className="item-icon-container" style={{ color: obj.color }}>
            {(obj.type === 'polygon' && obj.name.toLowerCase().startsWith('rect')) ? Icons.rectangle : Icons[obj.type]}
          </div>
          
          <div className="item-details">
            <span className="item-name">{obj.name}</span>
            <span className="item-coords">{getSubText(obj)}</span>
          </div>

          <div className="item-actions">
            <button
              className="action-btn-list"
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisibility(obj.id);
              }}
              title={obj.visible ? 'Hide Object' : 'Show Object'}
            >
              {obj.visible ? Icons.visible : Icons.hidden}
            </button>
            <button
              className="action-btn-list"
              onClick={(e) => handleDuplicate(e, obj)}
              title="Duplicate Object"
            >
              {Icons.duplicate}
            </button>
            <button
              className="action-btn-list danger"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(obj.id);
              }}
              title="Delete Object"
            >
              {Icons.trash}
            </button>
          </div>
        </div>

        {/* Visual drop line indicator previewing insertion below */}
        {isBelow && (
          <div
            className="drop-indicator-line drop-line-below"
            style={{ left: isChild ? '16px' : '0px', right: '0px' }}
          />
        )}

        {/* Group child items */}
        {isGroup && isExpanded && (
          <div
            className="group-children-list"
            style={{
              marginLeft: '14px',
              paddingLeft: '6px',
              borderLeft: `2px solid ${obj.color}40`,
              marginTop: '4px',
              marginBottom: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'move';
              if (draggedName && draggedName !== obj.name && (!dropTarget || dropTarget.targetName !== obj.name)) {
                setDropTarget({
                  targetName: obj.name,
                  position: 'inside',
                  parentGroupName: null
                });
              }
            }}
            onDrop={(e) => handleItemDrop(e, obj, null)}
          >
            {(obj as any).elements.length === 0 ? (
              <div style={{ fontSize: '11px', color: ONE_DARK_COLORS.textMuted, fontStyle: 'italic', padding: '4px 8px' }}>
                Empty group. Drag objects here to add them.
              </div>
            ) : (
              (obj as any).elements.map((childName: string) => {
                const childObj = objects[childName];
                if (!childObj) return null;
                return renderSingleObjectItem(childObj, obj.name);
              })
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`} style={{ backgroundColor: ONE_DARK_COLORS.sidebarBackground }}>
      <div className="sidebar-header">
        <div className="logo-collapse-row">
          <h1 className="logo-text">
            Geo<span>View</span>
          </h1>
          <button
            className="collapse-sidebar-btn"
            onClick={onCollapseToggle}
            title="Collapse Sidebar"
          >
            {Icons.collapse}
          </button>
        </div>
        <div className="global-actions">
          <button className="icon-btn-header" onClick={onFocusAll} title="Fit All Objects in View">
            {Icons.viewport} <span>Fit All</span>
          </button>
          <button className="icon-btn-header" onClick={onExport} title="Export Drawing as TXT Script">
            {Icons.export} <span>Export</span>
          </button>
          <button className="icon-btn-header danger" onClick={onClearAll} title="Delete All Canvas Elements">
            {Icons.clear} <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Toolbar drop-down creator */}
      <div className="creator-toolbar" ref={toolbarRef}>
        <button
          className="create-btn"
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          {Icons.plus} Add New Object
          <span className="arrow-indicator">{dropdownOpen ? '▲' : '▼'}</span>
        </button>

        {dropdownOpen && (
          <div className="dropdown-menu">
            <button className="dropdown-item" onClick={() => createDefaultObject('point')}>
              {Icons.point} Point
            </button>
            <button className="dropdown-item" onClick={() => createDefaultObject('segment')}>
              {Icons.segment} Line Segment
            </button>
            <button className="dropdown-item" onClick={() => createDefaultObject('line')}>
              {Icons.line} Infinite Line
            </button>
            <button className="dropdown-item" onClick={() => createDefaultObject('vector')}>
              {Icons.vector} Vector
            </button>
            <button className="dropdown-item" onClick={() => createDefaultObject('circle')}>
              {Icons.circle} Circle
            </button>
            <button className="dropdown-item" onClick={() => createDefaultObject('polygon')}>
              {Icons.polygon} Polygon
            </button>
            <button className="dropdown-item" onClick={() => createDefaultObject('rectangle')}>
              {Icons.rectangle} Rectangle
            </button>
            <button className="dropdown-item" onClick={() => createDefaultObject('angle')}>
              {Icons.angle} Angle (ABC)
            </button>
            <button className="dropdown-item" onClick={() => createDefaultObject('group')}>
              {Icons.group} Group
            </button>
          </div>
        )}
      </div>

      <div className="sidebar-lists-wrapper">
        {/* Section 1: Canvas Elements */}
        <div className={`sidebar-section ${elementsExpanded ? 'expanded' : 'collapsed'}`}>
          <div className="sidebar-section-header" onClick={() => setElementsExpanded(!elementsExpanded)}>
            <div className="sidebar-section-title">
              <span className="collapse-arrow">{elementsExpanded ? '▼' : '▶'}</span>
              Canvas Elements ({objectsList.length})
            </div>
          </div>
          <div
            className="sidebar-section-content"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
          >
            {objectsList.length === 0 ? (
              <div className="empty-message">No elements on canvas. Use commands below or the Add button above to create geometry.</div>
            ) : (
              <div className="objects-list">
                {topLevelObjs.map(obj => renderSingleObjectItem(obj, null))}
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Calculator Variables */}
        <div className={`sidebar-section ${calcExpanded ? 'expanded' : 'collapsed'}`}>
          <div className="sidebar-section-header" onClick={() => setCalcExpanded(!calcExpanded)}>
            <div className="sidebar-section-title">
              <span className="collapse-arrow">{calcExpanded ? '▼' : '▶'}</span>
              Calculator ({calcVariables.length})
            </div>
          </div>
          <div className="sidebar-section-content">
            <CalculatorPanel
              calcVariables={calcVariables}
              onAddCalcVariable={onAddCalcVariable}
              onDeleteCalcVariable={onDeleteCalcVariable}
              onReorderCalcVariables={onReorderCalcVariables}
              onUpdateCalcVariable={onUpdateCalcVariable}
            />
          </div>
        </div>
      </div>

      {/* Export modal lifted to App.tsx */}
    </div>
  );
};
