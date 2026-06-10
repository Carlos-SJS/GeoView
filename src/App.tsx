import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Viewport } from './components/Viewport';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Terminal } from './components/Terminal';
import type { GeometricObject, ViewportState, TerminalLog } from './types';
import { parseScript } from './parser';
import { getUnionBoundingBox, getObjectBoundingBox } from './utils/geometry';
import { ACCENT_PALETTE, ONE_DARK_COLORS } from './utils/theme';
import { type CalculatorVariable, evaluateAllVariables } from './utils/evaluator';
import './App.css';

// Initial state is empty by default
const INITIAL_OBJECTS: Record<string, GeometricObject> = {};

function App() {
  const [objects, setObjects] = useState<Record<string, GeometricObject>>(() => {
    try {
      const saved = localStorage.getItem('geoview_objects');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse geoview_objects', e);
    }
    return INITIAL_OBJECTS;
  });
  const [past, setPast] = useState<Record<string, GeometricObject>[]>([]);
  const [future, setFuture] = useState<Record<string, GeometricObject>[]>([]);
  const dragStartObjects = useRef<Record<string, GeometricObject> | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ViewportState>(() => {
    try {
      const saved = localStorage.getItem('geoview_viewport');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse geoview_viewport', e);
    }
    // Centered defaults
    const canvasWidth = window.innerWidth - 340;
    const canvasHeight = window.innerHeight - 300;
    return {
      scale: 40,
      offsetX: canvasWidth / 2,
      offsetY: canvasHeight / 2,
    };
  });
  const [logs, setLogs] = useState<TerminalLog[]>([]);
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);

  // Track window size to compute canvas dimensions for zooming
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    
    // Set initial offset only if not loaded from localStorage
    const saved = localStorage.getItem('geoview_viewport');
    if (!saved) {
      const canvasWidth = window.innerWidth - 340; 
      const canvasHeight = window.innerHeight - 300; 
      setViewport({
        scale: 40,
        offsetX: canvasWidth / 2,
        offsetY: canvasHeight / 2,
      });
    }

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [calcVariables, setCalcVariables] = useState<CalculatorVariable[]>(() => {
    try {
      const saved = localStorage.getItem('geoview_calc_variables');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse geoview_calc_variables', e);
    }
    return [];
  });

  // Local storage persistence effects
  useEffect(() => {
    localStorage.setItem('geoview_objects', JSON.stringify(objects));
  }, [objects]);

  useEffect(() => {
    localStorage.setItem('geoview_calc_variables', JSON.stringify(calcVariables));
  }, [calcVariables]);

  useEffect(() => {
    localStorage.setItem('geoview_viewport', JSON.stringify(viewport));
  }, [viewport]);

  // Reactive re-evaluation of calculator variables whenever objects change
  useEffect(() => {
    setCalcVariables(prev => evaluateAllVariables(prev, objects));
  }, [objects]);

  const handleAddCalcVariable = (name: string, expression: string): string | null => {
    const trimmedName = name.trim();
    const trimmedExpr = expression.trim();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmedName)) {
      return "Invalid variable name. Must start with a letter/underscore.";
    }
    const canvasNames = new Set(Object.values(objects).map(o => o.name));
    if (canvasNames.has(trimmedName)) {
      return `Name "${trimmedName}" is already in use by a canvas element.`;
    }
    if (calcVariables.some(v => v.name === trimmedName)) {
      return `Calculator variable "${trimmedName}" is already defined.`;
    }

    const newVar: CalculatorVariable = {
      name: trimmedName,
      expression: trimmedExpr,
      value: 'NaN',
    };

    const newList = evaluateAllVariables([...calcVariables, newVar], objects);
    
    // Check if the newly added variable has an error
    const addedVar = newList.find(v => v.name === trimmedName);
    if (addedVar && addedVar.error && addedVar.error.includes("Circular dependency")) {
      return "Circular dependency detected.";
    }

    setCalcVariables(newList);
    return null;
  };

  const handleDeleteCalcVariable = (name: string) => {
    const updated = calcVariables.filter(v => v.name !== name);
    setCalcVariables(evaluateAllVariables(updated, objects));
  };

  const handleReorderCalcVariables = (newVars: CalculatorVariable[]) => {
    setCalcVariables(evaluateAllVariables(newVars, objects));
  };

  const pushToHistory = (newObjects: Record<string, GeometricObject>) => {
    setPast(prev => [...prev, objects]);
    setObjects(newObjects);
    setFuture([]);
  };

  const handleUndo = () => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    
    setFuture(prev => [objects, ...prev]);
    setObjects(previous);
    setPast(newPast);
    
    if (selectedId && !Object.values(previous).some(o => o.id === selectedId)) {
      setSelectedId(null);
    }
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    
    setPast(prev => [...prev, objects]);
    setObjects(next);
    setFuture(newFuture);
  };

  const handleStartDrag = () => {
    dragStartObjects.current = { ...objects };
  };

  const handleCommitDrag = (updatedMap: Record<string, GeometricObject>) => {
    if (!dragStartObjects.current) return;
    
    let hasMoved = false;
    for (const key of Object.keys(updatedMap)) {
      const startObj = dragStartObjects.current[key];
      const finalObj = updatedMap[key];
      if (!startObj || JSON.stringify(startObj) !== JSON.stringify(finalObj)) {
        hasMoved = true;
        break;
      }
    }
    
    if (hasMoved) {
      const finalObjects = {
        ...objects,
        ...updatedMap
      };
      const snapshot = dragStartObjects.current;
      setPast(prev => [...prev, snapshot]);
      setObjects(finalObjects);
      setFuture([]);
    }
    
    dragStartObjects.current = null;
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.ctrlKey) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          handleRedo();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [past, future, objects]);

  const getCanvasDimensions = () => {
    // Sidebar: 340px, Properties panel: 320px (only when selectedId is non-null)
    const rightPanelWidth = selectedId ? 320 : 0;
    const width = Math.max(200, windowSize.width - 340 - rightPanelWidth);
    
    // Terminal: 260px when expanded, 94px when collapsed. Header/margins: 40px
    const terminalHeight = isTerminalCollapsed ? 94 : 260;
    const height = Math.max(200, windowSize.height - terminalHeight - 40);
    return { width, height };
  };

  // Execute terminal script
  const handleExecuteCommand = (commandText: string): boolean => {
    const lines = commandText
      .split(/[\n;]/)
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('//') && !line.startsWith('#'));

    if (lines.length === 0) return true;

    // Transactional copies
    let currentObjects = { ...objects };
    let currentCalcVariables = [...calcVariables];
    const errors: string[] = [];
    const newlyCreatedObjects: GeometricObject[] = [];
    let clearState = false;
    let undoState = false;
    let redoState = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check for undo/redo
      if (line.toLowerCase() === 'undo' || line.toLowerCase() === 'undo()') {
        undoState = true;
        continue;
      }
      if (line.toLowerCase() === 'redo' || line.toLowerCase() === 'redo()') {
        redoState = true;
        continue;
      }

      // Check for delete calculator variable / geometry object
      const deleteMatch = line.match(/^delete\s+([a-zA-Z0-9_]+)$/) || line.match(/^delete\s*\(\s*([a-zA-Z0-9_]+)\s*\)$/);
      if (deleteMatch) {
        const nameToDelete = deleteMatch[1].trim();
        let deleted = false;
        
        if (currentCalcVariables.some(v => v.name === nameToDelete)) {
          currentCalcVariables = currentCalcVariables.filter(v => v.name !== nameToDelete);
          deleted = true;
        }
        
        if (currentObjects[nameToDelete]) {
          delete currentObjects[nameToDelete];
          deleted = true;
        }

        if (!deleted) {
          errors.push(`Line ${lineNum}: Cannot delete "${nameToDelete}". Object is not defined.`);
        }
        continue;
      }

      // Check for calculator variable assignment
      const calcMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
      let isCalculatorAssign = false;
      if (calcMatch) {
        const varName = calcMatch[1].trim();
        const expr = calcMatch[2].trim();
        
        const isVectorArithmetic = (() => {
          const match = expr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*([\+-])\s*([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*,\s*(.+))?$/);
          if (!match) return false;
          const leftName = match[1];
          const rightName = match[3];
          const leftObj = currentObjects[leftName];
          const rightObj = currentObjects[rightName];
          return !!(leftObj && leftObj.type === 'vector' && rightObj && rightObj.type === 'vector');
        })();
        const isGeomFunc = /^(point|line|circle|polygon|angle|vec|vector|add|sub)\s*\(/.test(expr) || /^\(/.test(expr) || isVectorArithmetic;
        
        if (!isGeomFunc) {
          isCalculatorAssign = true;
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) {
            errors.push(`Line ${lineNum}: Invalid variable name "${varName}".`);
            continue;
          }
          if (currentObjects[varName]) {
            errors.push(`Line ${lineNum}: Name "${varName}" is already in use by a canvas element.`);
            continue;
          }

          const newVar: CalculatorVariable = {
            name: varName,
            expression: expr,
            value: 'NaN',
          };

          const idx = currentCalcVariables.findIndex(v => v.name === varName);
          const updatedList = [...currentCalcVariables];
          if (idx !== -1) {
            updatedList[idx] = newVar;
          } else {
            updatedList.push(newVar);
          }

          const evaluated = evaluateAllVariables(updatedList, currentObjects);
          const addedVar = evaluated.find(v => v.name === varName);
          if (addedVar && addedVar.error && addedVar.error.includes("Circular dependency")) {
            errors.push(`Line ${lineNum}: Circular dependency detected.`);
          } else {
            currentCalcVariables = evaluated;
          }
        }
      }

      if (!isCalculatorAssign) {
        // Evaluate as geometry script line
        const res = parseScript(line, currentObjects, ACCENT_PALETTE);
        if (res.errors.length > 0) {
          res.errors.forEach(err => {
            errors.push(`Line ${lineNum}: ${err.replace(/^Line \d+:\s*/, '')}`);
          });
        } else {
          if (res.clearState) {
            currentObjects = {};
            currentCalcVariables = [];
            clearState = true;
          }
          if (res.deletedNames && res.deletedNames.length > 0) {
            res.deletedNames.forEach(name => {
              delete currentObjects[name];
            });
          }
          res.objects.forEach(obj => {
            currentObjects[obj.name] = obj;
            newlyCreatedObjects.push(obj);
          });
        }
      }
    }

    if (errors.length > 0) {
      const errStr = errors.join(' | ');
      setLogs(prev => [
        ...prev,
        { command: commandText, success: false, error: errStr, timestamp: new Date() }
      ]);
      return false;
    }

    // Apply states
    if (undoState) {
      handleUndo();
    }
    if (redoState) {
      handleRedo();
    }
    if (clearState) {
      setCalcVariables([]);
      setSelectedId(null);
    }

    if (!undoState && !redoState) {
      setCalcVariables(currentCalcVariables);
      pushToHistory(currentObjects);
      if (newlyCreatedObjects.length > 0) {
        setSelectedId(newlyCreatedObjects[newlyCreatedObjects.length - 1].id);
      }
    }

    setLogs(prev => [
      ...prev,
      { command: commandText, success: true, timestamp: new Date() }
    ]);
    return true;
  };

  const handleAddLog = (commandText: string, success: boolean, error?: string) => {
    setLogs(prev => [
      ...prev,
      { command: commandText, success, error, timestamp: new Date() }
    ]);
  };

  const handleDelete = (id: string) => {
    const obj = objects[Object.keys(objects).find(k => objects[k].id === id) || ''];
    if (!obj) return;
    
    const newObjs = { ...objects };
    delete newObjs[obj.name];
    pushToHistory(newObjs);
    
    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  const handleToggleVisibility = (id: string) => {
    const key = Object.keys(objects).find(k => objects[k].id === id);
    if (!key) return;
    
    const newObjs = {
      ...objects,
      [key]: {
        ...objects[key],
        visible: !objects[key].visible
      }
    };
    pushToHistory(newObjs);
  };

  const handleAddObjectDirect = (newObj: GeometricObject) => {
    const newObjs = {
      ...objects,
      [newObj.name]: newObj
    };
    pushToHistory(newObjs);
  };

  // Renames an object and cascades name changes to referencing objects
  const handleChangeObject = (updatedObj: GeometricObject, isCommit: boolean = true) => {
    const oldKey = Object.keys(objects).find(k => objects[k].id === updatedObj.id);
    if (!oldKey) return;
    
    const oldName = objects[oldKey].name;
    const newName = updatedObj.name;
    
    const nextObjs = { ...objects };
    
    if (oldName !== newName) {
      // Name changed -> Trigger Cascade Rename
      delete nextObjs[oldName];
      
      for (const item of Object.values(objects)) {
        if (item.id === updatedObj.id) {
          nextObjs[newName] = updatedObj;
          continue;
        }
        
        let changed = false;
        const cloned = { ...item };
        
        if (cloned.type === 'line') {
          if (cloned.p1 === oldName) { cloned.p1 = newName; changed = true; }
          if (cloned.p2 === oldName) { cloned.p2 = newName; changed = true; }
        } else if (cloned.type === 'circle') {
          if (cloned.center === oldName) { cloned.center = newName; changed = true; }
        } else if (cloned.type === 'polygon') {
          cloned.points = cloned.points.map(p => {
            if (p === oldName) { changed = true; return newName; }
            return p;
          });
        } else if (cloned.type === 'angle') {
          if (cloned.pA === oldName) { cloned.pA = newName; changed = true; }
          if (cloned.pB === oldName) { cloned.pB = newName; changed = true; }
          if (cloned.pC === oldName) { cloned.pC = newName; changed = true; }
        }
        
        if (changed) {
          nextObjs[cloned.name] = cloned;
        } else {
          nextObjs[cloned.name] = item;
        }
      }
    } else {
      nextObjs[oldKey] = updatedObj;
    }

    if (isCommit) {
      pushToHistory(nextObjs);
    } else {
      setObjects(nextObjs);
    }
  };

  // Focus Viewport on single object
  const handleFocusObject = (id: string) => {
    const obj = Object.values(objects).find(o => o.id === id);
    if (!obj) return;
    
    const box = getObjectBoundingBox(obj, objects);
    if (!box) return;
    
    const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions();
    
    const w = box.maxX - box.minX;
    const h = box.maxY - box.minY;
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    
    // Fit box with padding
    const padW = Math.max(w, 1) * 1.5;
    const padH = Math.max(h, 1) * 1.5;
    
    const newScale = Math.min(canvasWidth / padW, canvasHeight / padH);
    const clampedScale = Math.max(2, Math.min(newScale, 1000));
    
    // Center point in viewport screen coordinates (relative to canvas origin)
    const screenCenterX = canvasWidth / 2;
    const screenCenterY = canvasHeight / 2;
    
    setViewport({
      scale: clampedScale,
      offsetX: screenCenterX - cx * clampedScale,
      offsetY: screenCenterY + cy * clampedScale
    });
  };

  // Focus Viewport on all visible objects
  const handleFocusAll = () => {
    const list = Object.values(objects);
    if (list.length === 0) {
      // Reset view to origin
      const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions();
      setViewport({
        scale: 40,
        offsetX: canvasWidth / 2,
        offsetY: canvasHeight / 2
      });
      return;
    }
    
    const box = getUnionBoundingBox(list, objects);
    if (!box) return;
    
    const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions();
    
    const w = box.maxX - box.minX;
    const h = box.maxY - box.minY;
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    
    const padW = Math.max(w, 2) * 1.4;
    const padH = Math.max(h, 2) * 1.4;
    
    const newScale = Math.min(canvasWidth / padW, canvasHeight / padH);
    const clampedScale = Math.max(2, Math.min(newScale, 500));
    
    const screenCenterX = canvasWidth / 2;
    const screenCenterY = canvasHeight / 2;
    
    setViewport({
      scale: clampedScale,
      offsetX: screenCenterX - cx * clampedScale,
      offsetY: screenCenterY + cy * clampedScale
    });
  };

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to clear all geometric elements?")) {
      pushToHistory({});
      setSelectedId(null);
      setLogs(prev => [
        ...prev,
        { command: '// Canvas Cleared', success: true, timestamp: new Date() }
      ]);
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  // Adjust Viewport State offsets during Canvas drag events
  const handleViewportOffsetAdjust = (adjustedState: ViewportState) => {
    // Offset gets shifted by sidebar offset during canvas relative mouse drags, so let's preserve raw offsets.
    setViewport(adjustedState);
  };

  const handleUpdateObjects = (updatedMap: Record<string, GeometricObject>) => {
    setObjects(prev => ({
      ...prev,
      ...updatedMap
    }));
  };

  return (
    <div className="geoview-app" style={{ color: ONE_DARK_COLORS.text }}>
      <div className="app-main-layout">
        {/* Left Sidebar */}
        <Sidebar
          objects={objects}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDelete={handleDelete}
          onToggleVisibility={handleToggleVisibility}
          onAddObject={handleAddObjectDirect}
          onFocusAll={handleFocusAll}
          onClearAll={handleClearAll}
          onAddLog={handleAddLog}
          calcVariables={calcVariables}
          onAddCalcVariable={handleAddCalcVariable}
          onDeleteCalcVariable={handleDeleteCalcVariable}
          onReorderCalcVariables={handleReorderCalcVariables}
        />

        {/* Central Viewport & Bottom Terminal */}
        <div className="viewport-terminal-container">
          <Viewport
            objects={objects}
            selectedId={selectedId}
            onSelect={setSelectedId}
            viewportState={viewport}
            setViewportState={handleViewportOffsetAdjust}
            onUpdateObjects={handleUpdateObjects}
            onStartDrag={handleStartDrag}
            onCommitDrag={handleCommitDrag}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={past.length > 0}
            canRedo={future.length > 0}
          />
          <Terminal
            logs={logs}
            onExecuteCommand={handleExecuteCommand}
            onClearLogs={handleClearLogs}
            isCollapsed={isTerminalCollapsed}
            setIsCollapsed={setIsTerminalCollapsed}
          />
        </div>

        {/* Right Properties Panel (only renders when an object is selected) */}
        {selectedId && (
          <PropertiesPanel
            selectedId={selectedId}
            objects={objects}
            onChangeObject={handleChangeObject}
            onFocusObject={handleFocusObject}
            onSelect={setSelectedId}
          />
        )}
      </div>
    </div>
  );
}

export default App;
