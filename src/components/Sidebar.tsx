import React, { useState } from 'react';
import type { GeometricObject, ObjectType } from '../types';
import { ONE_DARK_COLORS } from '../utils/theme';
import { generateDefaultName } from '../parser';
import { CalculatorPanel } from './CalculatorPanel';
import type { CalculatorVariable } from '../utils/evaluator';

interface SidebarProps {
  objects: Record<string, GeometricObject>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onAddObject: (obj: GeometricObject) => void;
  onFocusAll: () => void;
  onClearAll: () => void;
  onAddLog: (command: string, success: boolean, error?: string) => void;
  calcVariables: CalculatorVariable[];
  onAddCalcVariable: (name: string, expression: string) => string | null;
  onDeleteCalcVariable: (name: string) => void;
  onReorderCalcVariables: (newVars: CalculatorVariable[]) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  objects,
  selectedId,
  onSelect,
  onDelete,
  onToggleVisibility,
  onAddObject,
  onFocusAll,
  onClearAll,
  onAddLog,
  calcVariables,
  onAddCalcVariable,
  onDeleteCalcVariable,
  onReorderCalcVariables,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportedScriptText, setExportedScriptText] = useState('');
  const [elementsExpanded, setElementsExpanded] = useState(true);
  const [calcExpanded, setCalcExpanded] = useState(true);

  const objectsList = Object.values(objects);

  // SVG Icons
  const Icons = {
    point: (
      <svg className="obj-icon" viewBox="0 0 24 24" width="16" height="16">
        <circle cx="12" cy="12" r="7" fill="currentColor" />
        <circle cx="12" cy="12" r="3" fill="#1e2227" />
      </svg>
    ),
    line: (
      <svg className="obj-icon" viewBox="0 0 24 24" width="16" height="16">
        <line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="4" cy="20" r="3" fill="#1e2227" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="20" cy="4" r="3" fill="#1e2227" stroke="currentColor" strokeWidth="1.5" />
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
    )
  };

  // Helper to create object script command representation
  const getObjectCommand = (obj: GeometricObject): string => {
    const colorArg = `, "${obj.color}"`;
    const fillArg = obj.fill === false ? ', false' : '';
    switch (obj.type) {
      case 'point':
        return `${obj.name} = point(${obj.x}, ${obj.y}${colorArg})`;
      case 'line': {
        const p1Str = typeof obj.p1 === 'string' ? obj.p1 : `(${obj.p1.x},${obj.p1.y})`;
        const p2Str = typeof obj.p2 === 'string' ? obj.p2 : `(${obj.p2.x},${obj.p2.y})`;
        return `${obj.name} = line(${p1Str}, ${p2Str}${colorArg})`;
      }
      case 'circle': {
        const centerStr = typeof obj.center === 'string' ? obj.center : `(${obj.center.x},${obj.center.y})`;
        return `${obj.name} = circle(${centerStr}, ${obj.radius}${colorArg}${fillArg})`;
      }
      case 'polygon': {
        const ptsStr = obj.points.map(p => typeof p === 'string' ? p : `(${p.x},${p.y})`).join(', ');
        return `${obj.name} = polygon(${ptsStr}${colorArg}${fillArg})`;
      }
      case 'angle':
        return `${obj.name} = angle(${obj.pA}, ${obj.pB}, ${obj.pC}${colorArg})`;
      case 'vector': {
        const p1Str = typeof obj.p1 === 'string' ? obj.p1 : `(${obj.p1.x},${obj.p1.y})`;
        const p2Str = typeof obj.p2 === 'string' ? obj.p2 : `(${obj.p2.x},${obj.p2.y})`;
        return `${obj.name} = vec(${p1Str}, ${p2Str}${colorArg})`;
      }
    }
  };

  // Export state as a sequence of script commands
  const handleExportScript = () => {
    if (objectsList.length === 0) {
      alert("No elements on the canvas to export!");
      return;
    }

    // Order items: points first, then vectors, lines, circles, polygons, then angles
    const sorted = [...objectsList].sort((a, b) => {
      const rank = { point: 1, vector: 2, line: 3, circle: 4, polygon: 5, angle: 6 };
      return rank[a.type] - rank[b.type];
    });

    const scriptText = sorted.map(getObjectCommand).join('\n');
    setExportedScriptText(scriptText);

    // Copy to clipboard
    navigator.clipboard.writeText(scriptText)
      .then(() => {
        onAddLog(`// Exported Script:\n${scriptText}`, true);
        setShowExportModal(true);
      })
      .catch((err) => {
        console.error("Failed to copy script: ", err);
        // Show modal so they can copy manually
        setShowExportModal(true);
      });
  };

  const handleDownloadTxt = () => {
    const element = document.createElement("a");
    const file = new Blob([exportedScriptText], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = "geoview_export.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setShowExportModal(false);
  };

  // Instantiates a default object
  const createDefaultObject = (type: ObjectType) => {
    const namesSet = new Set(Object.values(objects).map(o => o.name));
    const name = generateDefaultName(type, namesSet);
    const color = ONE_DARK_COLORS.accentActive;
    const id = `${type.substr(0, 2)}_${Date.now()}`;

    let newObj: GeometricObject;

    switch (type) {
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
      case 'line':
        newObj = {
          id,
          name,
          type: 'line',
          p1: { x: -2, y: -2 },
          p2: { x: 3, y: 3 },
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
      case 'angle': {
        // Find existing points
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
          // Auto-create three helper points first
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
    }

    onAddObject(newObj);
    onSelect(newObj.id);
    setDropdownOpen(false);
  };

  // Duplicate object
  const handleDuplicate = (e: React.MouseEvent, obj: GeometricObject) => {
    e.stopPropagation();
    const namesSet = new Set(Object.values(objects).map(o => o.name));
    const newName = generateDefaultName(obj.type, namesSet);
    const newId = `${obj.type.substr(0, 2)}_${Date.now()}_dup`;

    let dupObj: GeometricObject;

    switch (obj.type) {
      case 'point':
        dupObj = { ...obj, id: newId, name: newName, x: obj.x + 1, y: obj.y + 1 };
        break;
      case 'line': {
        const p1 = typeof obj.p1 === 'string' ? obj.p1 : { x: obj.p1.x + 1, y: obj.p1.y + 1 };
        const p2 = typeof obj.p2 === 'string' ? obj.p2 : { x: obj.p2.x + 1, y: obj.p2.y + 1 };
        dupObj = { ...obj, id: newId, name: newName, p1, p2 };
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
    }

    onAddObject(dupObj);
    onSelect(dupObj.id);
  };

  const getSubText = (obj: GeometricObject): string => {
    switch (obj.type) {
      case 'point':
        return `(${obj.x.toFixed(2)}, ${obj.y.toFixed(2)})`;
      case 'line': {
        const p1s = typeof obj.p1 === 'string' ? obj.p1 : `(${obj.p1.x},${obj.p1.y})`;
        const p2s = typeof obj.p2 === 'string' ? obj.p2 : `(${obj.p2.x},${obj.p2.y})`;
        return `${p1s} ➔ ${p2s}`;
      }
      case 'vector': {
        const p1s = typeof obj.p1 === 'string' ? obj.p1 : `(${obj.p1.x},${obj.p1.y})`;
        const p2s = typeof obj.p2 === 'string' ? obj.p2 : `(${obj.p2.x},${obj.p2.y})`;
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
    }
  };

  return (
    <div className="sidebar" style={{ backgroundColor: ONE_DARK_COLORS.sidebarBackground }}>
      <div className="sidebar-header">
        <h1 className="logo-text">
          Geo<span>View</span>
        </h1>
        <div className="global-actions">
          <button className="icon-btn-header" onClick={onFocusAll} title="Fit All Objects in View">
            {Icons.viewport} <span>Fit All</span>
          </button>
          <button className="icon-btn-header" onClick={handleExportScript} title="Export Drawing as TXT Script">
            {Icons.export} <span>Export</span>
          </button>
          <button className="icon-btn-header danger" onClick={onClearAll} title="Delete All Canvas Elements">
            {Icons.clear} <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Toolbar drop-down creator */}
      <div className="creator-toolbar">
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
            <button className="dropdown-item" onClick={() => createDefaultObject('line')}>
              {Icons.line} Line Segment
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
            <button className="dropdown-item" onClick={() => createDefaultObject('angle')}>
              {Icons.angle} Angle (ABC)
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
          <div className="sidebar-section-content">
            {objectsList.length === 0 ? (
              <div className="empty-message">No elements on canvas. Use commands below or the Add button above to create geometry.</div>
            ) : (
              <div className="objects-list">
                {objectsList.map(obj => {
                  const isSelected = selectedId === obj.id;
                  return (
                    <div
                      key={obj.id}
                      className={`object-item ${isSelected ? 'selected' : ''} ${!obj.visible ? 'hidden' : ''}`}
                      onClick={() => onSelect(obj.id)}
                      style={{
                        borderLeftColor: obj.color,
                      }}
                    >
                      <div className="item-icon-container" style={{ color: obj.color }}>
                        {Icons[obj.type]}
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
                  );
                })}
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
            />
          </div>
        </div>
      </div>

      {/* Export Confirmation Fullscreen Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Export Drawing State</h2>
              <button
                onClick={() => setShowExportModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: ONE_DARK_COLORS.textMuted,
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: 0,
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>Geometric script has been successfully copied to your clipboard!</p>
              <p style={{ marginTop: '8px', fontSize: '12.5px', opacity: 0.8 }}>You can also copy the commands directly from the text box below or download them as a text file.</p>
              <textarea
                className="modal-textarea"
                readOnly
                value={exportedScriptText}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
            </div>
            <div className="modal-actions">
              <button
                className="modal-btn secondary"
                onClick={() => setShowExportModal(false)}
              >
                OK
              </button>
              <button
                className="modal-btn primary"
                onClick={handleDownloadTxt}
              >
                Download .txt File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
