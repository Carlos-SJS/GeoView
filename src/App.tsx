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
  const [objects, setObjects] = useState<Record<string, GeometricObject>>(INITIAL_OBJECTS);
  const [past, setPast] = useState<Record<string, GeometricObject>[]>([]);
  const [future, setFuture] = useState<Record<string, GeometricObject>[]>([]);
  const dragStartObjects = useRef<Record<string, GeometricObject> | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ViewportState>({
    scale: 45,
    offsetX: 400,
    offsetY: 300,
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
    
    // Set initial offset to center origin (properties panel is closed initially, terminal is expanded)
    const canvasWidth = window.innerWidth - 340; 
    const canvasHeight = window.innerHeight - 300; 
    setViewport({
      scale: 40,
      offsetX: canvasWidth / 2,
      offsetY: canvasHeight / 2,
    });

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [calcVariables, setCalcVariables] = useState<CalculatorVariable[]>([]);

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
    // 1. Check for delete calculator variable
    const deleteMatch = commandText.match(/^delete\s+([a-zA-Z0-9_]+)$/) || commandText.match(/^delete\s*\(\s*([a-zA-Z0-9_]+)\s*\)$/);
    if (deleteMatch) {
      const nameToDelete = deleteMatch[1].trim();
      if (calcVariables.some(v => v.name === nameToDelete)) {
        handleDeleteCalcVariable(nameToDelete);
        setLogs(prev => [
          ...prev,
          { command: commandText, success: true, timestamp: new Date() }
        ]);
        return true;
      }
    }

    // 2. Check for calculator variable assignment
    const calcMatch = commandText.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
    if (calcMatch) {
      const varName = calcMatch[1].trim();
      const expr = calcMatch[2].trim();
      
      const isVectorArithmetic = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*([\+-])\s*([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*,\s*(.+))?$/.test(expr);
      const isGeomFunc = /^(point|line|circle|polygon|angle|vec|vector|add|sub)\s*\(/.test(expr) || /^\(/.test(expr) || isVectorArithmetic;
      if (!isGeomFunc) {
        const error = handleAddCalcVariable(varName, expr);
        if (error) {
          setLogs(prev => [
            ...prev,
            { command: commandText, success: false, error, timestamp: new Date() }
          ]);
          return false;
        } else {
          setLogs(prev => [
            ...prev,
            { command: commandText, success: true, timestamp: new Date() }
          ]);
          return true;
        }
      }
    }

    const res = parseScript(commandText, objects, ACCENT_PALETTE);
    
    if (res.undoState) {
      handleUndo();
      setLogs(prev => [
        ...prev,
        { command: commandText, success: true, timestamp: new Date() }
      ]);
      return true;
    }

    if (res.redoState) {
      handleRedo();
      setLogs(prev => [
        ...prev,
        { command: commandText, success: true, timestamp: new Date() }
      ]);
      return true;
    }

    if (res.errors.length > 0) {
      // Create failure log
      const errStr = res.errors.join(' | ');
      setLogs(prev => [
        ...prev,
        { command: commandText, success: false, error: errStr, timestamp: new Date() }
      ]);
      return false;
    } else {
      if (res.clearState) {
        setCalcVariables([]);
      }
      // Apply clearState and deletedNames if any
      let newObjs = res.clearState ? {} : { ...objects };
      
      if (res.deletedNames && res.deletedNames.length > 0) {
        res.deletedNames.forEach(name => {
          delete newObjs[name];
        });
      }

      // Append successful objects
      res.objects.forEach(obj => {
        newObjs[obj.name] = obj;
      });
      
      pushToHistory(newObjs);
      
      // Select last created object
      if (res.objects.length > 0) {
        setSelectedId(res.objects[res.objects.length - 1].id);
      } else if (res.clearState) {
        setSelectedId(null);
      }
      
      setLogs(prev => [
        ...prev,
        { command: commandText, success: true, timestamp: new Date() }
      ]);
      return true;
    }
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
