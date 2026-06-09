import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Viewport } from './components/Viewport';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Terminal } from './components/Terminal';
import type { GeometricObject, ViewportState, TerminalLog } from './types';
import { parseScript } from './parser';
import { getUnionBoundingBox, getObjectBoundingBox } from './utils/geometry';
import { ACCENT_PALETTE, ONE_DARK_COLORS } from './utils/theme';
import './App.css';

// Initial state is empty by default
const INITIAL_OBJECTS: Record<string, GeometricObject> = {};

function App() {
  const [objects, setObjects] = useState<Record<string, GeometricObject>>(INITIAL_OBJECTS);
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
  const handleExecuteCommand = (commandText: string) => {
    const res = parseScript(commandText, objects, ACCENT_PALETTE);
    
    if (res.errors.length > 0) {
      // Create failure log
      const errStr = res.errors.join(' | ');
      setLogs(prev => [
        ...prev,
        { command: commandText, success: false, error: errStr, timestamp: new Date() }
      ]);
    } else {
      // Append successful objects
      const newObjs = { ...objects };
      res.objects.forEach(obj => {
        newObjs[obj.name] = obj;
      });
      setObjects(newObjs);
      
      // Select last created object
      if (res.objects.length > 0) {
        setSelectedId(res.objects[res.objects.length - 1].id);
      }
      
      setLogs(prev => [
        ...prev,
        { command: commandText, success: true, timestamp: new Date() }
      ]);
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
    setObjects(newObjs);
    
    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  const handleToggleVisibility = (id: string) => {
    const key = Object.keys(objects).find(k => objects[k].id === id);
    if (!key) return;
    
    setObjects(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        visible: !prev[key].visible
      }
    }));
  };

  const handleAddObjectDirect = (newObj: GeometricObject) => {
    setObjects(prev => ({
      ...prev,
      [newObj.name]: newObj
    }));
  };

  // Renames an object and cascades name changes to referencing objects
  const handleChangeObject = (updatedObj: GeometricObject) => {
    const oldKey = Object.keys(objects).find(k => objects[k].id === updatedObj.id);
    if (!oldKey) return;
    
    const oldName = objects[oldKey].name;
    const newName = updatedObj.name;
    
    if (oldName !== newName) {
      // Name changed -> Trigger Cascade Rename
      const nextObjs = { ...objects };
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
      setObjects(nextObjs);
    } else {
      // Normal property change (coordinates, color, radius)
      setObjects(prev => ({
        ...prev,
        [oldKey]: updatedObj
      }));
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
      setObjects({});
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
        />

        {/* Central Viewport & Bottom Terminal */}
        <div className="viewport-terminal-container">
          <Viewport
            objects={objects}
            selectedId={selectedId}
            onSelect={setSelectedId}
            viewportState={viewport}
            setViewportState={handleViewportOffsetAdjust}
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
