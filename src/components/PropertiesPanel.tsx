import React, { useState, useEffect } from 'react';
import type { GeometricObject, PointObject } from '../types';
import {
  resolvePoint,
  getLineLength,
  getLineEquation,
  getPolygonArea,
  getPolygonPerimeter,
  getPolygonCentroid,
  getAngleValue,
  type Point,
} from '../utils/geometry';
import { ACCENT_PALETTE, ONE_DARK_COLORS } from '../utils/theme';

interface PropertyNumericInputProps {
  value: number;
  onChange: (val: number) => void;
  onCommit?: (val: number) => void;
  defaultValue?: number;
  placeholder?: string;
  className?: string;
  min?: number;
}

const PropertyNumericInput: React.FC<PropertyNumericInputProps> = ({
  value,
  onChange,
  onCommit,
  defaultValue = 0,
  placeholder,
  className,
  min,
}) => {
  const [localVal, setLocalVal] = useState(value.toString());
  const [isFocused, setIsFocused] = useState(false);

  // Sync with value when NOT in focus (from dragging or selecting a new object)
  useEffect(() => {
    if (!isFocused) {
      setLocalVal(value.toString());
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalVal(raw);

    // Parse the value
    let parsed = parseFloat(raw);
    if (isNaN(parsed)) {
      parsed = defaultValue;
    }
    if (min !== undefined && parsed < min) {
      parsed = min;
    }

    onChange(parsed);
  };

  const handleBlur = () => {
    setIsFocused(false);
    let parsed = parseFloat(localVal);
    if (isNaN(parsed)) {
      parsed = defaultValue;
    }
    if (min !== undefined && parsed < min) {
      parsed = min;
    }
    setLocalVal(parsed.toString());
    if (onCommit) {
      onCommit(parsed);
    } else {
      onChange(parsed);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  return (
    <input
      type="text"
      className={className}
      value={localVal}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      placeholder={placeholder}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
};

interface PropertiesPanelProps {
  selectedId: string | null;
  objects: Record<string, GeometricObject>;
  onChangeObject: (obj: GeometricObject, isCommit?: boolean) => void;
  onFocusObject: (id: string) => void;
  onSelect: (id: string | null) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedId,
  objects,
  onChangeObject,
  onFocusObject,
  onSelect,
}) => {
  const obj = selectedId ? Object.values(objects).find(o => o.id === selectedId) || null : null;

  // Local state to prevent validation errors mid-typing
  const [nameInput, setNameInput] = useState('');
  const [nameError, setNameError] = useState('');

  // Sync local state when selected object changes
  useEffect(() => {
    if (obj) {
      setNameInput(obj.name);
      setNameError('');
    }
  }, [selectedId, obj?.name]);

  if (!obj) {
    return (
      <div className="properties-panel empty" style={{ backgroundColor: ONE_DARK_COLORS.sidebarBackground }}>
        <div className="empty-message-props">Select an object on the canvas or in the list to view and edit its properties.</div>
      </div>
    );
  }

  const allPoints = Object.values(objects).filter((o): o is PointObject => o.type === 'point');

  // Handle name change with C++ naming rules and uniqueness validation
  const handleNameBlurOrSubmit = () => {
    if (nameInput === obj.name) return;

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(nameInput)) {
      setNameError('Name must start with a letter/underscore and contain only letters, numbers, and underscores.');
      setNameInput(obj.name); // revert
      return;
    }

    const nameExists = Object.values(objects).some(o => o.id !== obj.id && o.name === nameInput);
    if (nameExists) {
      setNameError(`Name "${nameInput}" is already in use.`);
      setNameInput(obj.name); // revert
      return;
    }

    setNameError('');
    onChangeObject({
      ...obj,
      name: nameInput,
    });
  };

  const updateProp = (updatedFields: Partial<GeometricObject>, isCommit: boolean = true) => {
    onChangeObject({
      ...obj,
      ...updatedFields,
    } as GeometricObject, isCommit);
  };

  // Render object-specific editors
  const renderPointEditor = (pt: typeof obj & { type: 'point' }) => {
    return (
      <div className="props-group">
        <label className="prop-label">Coordinates</label>
        <div className="coordinate-inputs">
          <div className="input-field">
            <span className="coord-prefix">X</span>
            <PropertyNumericInput
              value={pt.x}
              onChange={(val) => updateProp({ x: val }, false)}
              onCommit={(val) => updateProp({ x: val }, true)}
              defaultValue={0}
            />
          </div>
          <div className="input-field">
            <span className="coord-prefix">Y</span>
            <PropertyNumericInput
              value={pt.y}
              onChange={(val) => updateProp({ y: val }, false)}
              onCommit={(val) => updateProp({ y: val }, true)}
              defaultValue={0}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderLineEditor = (ln: typeof obj & { type: 'line' }) => {
    const isP1Ref = typeof ln.p1 === 'string';
    const isP2Ref = typeof ln.p2 === 'string';

    const p1Val = isP1Ref ? ln.p1 : ln.p1 as Point;
    const p2Val = isP2Ref ? ln.p2 : ln.p2 as Point;

    return (
      <div className="props-group">
        <label className="prop-label">Endpoint 1 (P1)</label>
        <div className="endpoint-selector">
          <select
            value={isP1Ref ? (ln.p1 as string) : '__custom__'}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '__custom__') {
                updateProp({ p1: { x: 0, y: 0 } }, true);
              } else {
                updateProp({ p1: val }, true);
              }
            }}
          >
            <option value="__custom__">Custom Coordinates</option>
            {allPoints.map(p => (
              <option key={p.id} value={p.name}>{p.name} ({p.x}, {p.y})</option>
            ))}
          </select>
          {!isP1Ref && (
            <div className="coordinate-inputs sub-input">
              <PropertyNumericInput
                value={(p1Val as Point).x}
                onChange={(val) => updateProp({ p1: { x: val, y: (p1Val as Point).y } }, false)}
                onCommit={(val) => updateProp({ p1: { x: val, y: (p1Val as Point).y } }, true)}
                defaultValue={0}
                placeholder="X"
              />
              <PropertyNumericInput
                value={(p1Val as Point).y}
                onChange={(val) => updateProp({ p1: { x: (p1Val as Point).x, y: val } }, false)}
                onCommit={(val) => updateProp({ p1: { x: (p1Val as Point).x, y: val } }, true)}
                defaultValue={0}
                placeholder="Y"
              />
            </div>
          )}
        </div>

        <label className="prop-label" style={{ marginTop: '12px' }}>Endpoint 2 (P2)</label>
        <div className="endpoint-selector">
          <select
            value={isP2Ref ? (ln.p2 as string) : '__custom__'}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '__custom__') {
                updateProp({ p2: { x: 5, y: 5 } }, true);
              } else {
                updateProp({ p2: val }, true);
              }
            }}
          >
            <option value="__custom__">Custom Coordinates</option>
            {allPoints.map(p => (
              <option key={p.id} value={p.name}>{p.name} ({p.x}, {p.y})</option>
            ))}
          </select>
          {!isP2Ref && (
            <div className="coordinate-inputs sub-input">
              <PropertyNumericInput
                value={(p2Val as Point).x}
                onChange={(val) => updateProp({ p2: { x: val, y: (p2Val as Point).y } }, false)}
                onCommit={(val) => updateProp({ p2: { x: val, y: (p2Val as Point).y } }, true)}
                defaultValue={0}
                placeholder="X"
              />
              <PropertyNumericInput
                value={(p2Val as Point).y}
                onChange={(val) => updateProp({ p2: { x: (p2Val as Point).x, y: val } }, false)}
                onCommit={(val) => updateProp({ p2: { x: (p2Val as Point).x, y: val } }, true)}
                defaultValue={0}
                placeholder="Y"
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCircleEditor = (cr: typeof obj & { type: 'circle' }) => {
    const isCenterRef = typeof cr.center === 'string';
    const centerVal = isCenterRef ? cr.center : cr.center as Point;

    return (
      <div className="props-group">
        <label className="prop-label">Center Point</label>
        <div className="endpoint-selector">
          <select
            value={isCenterRef ? (cr.center as string) : '__custom__'}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '__custom__') {
                updateProp({ center: { x: 0, y: 0 } }, true);
              } else {
                updateProp({ center: val }, true);
              }
            }}
          >
            <option value="__custom__">Custom Coordinates</option>
            {allPoints.map(p => (
              <option key={p.id} value={p.name}>{p.name} ({p.x}, {p.y})</option>
            ))}
          </select>
          {!isCenterRef && (
            <div className="coordinate-inputs sub-input">
              <PropertyNumericInput
                value={(centerVal as Point).x}
                onChange={(val) => updateProp({ center: { x: val, y: (centerVal as Point).y } }, false)}
                onCommit={(val) => updateProp({ center: { x: val, y: (centerVal as Point).y } }, true)}
                defaultValue={0}
                placeholder="X"
              />
              <PropertyNumericInput
                value={(centerVal as Point).y}
                onChange={(val) => updateProp({ center: { x: (centerVal as Point).x, y: val } }, false)}
                onCommit={(val) => updateProp({ center: { x: (centerVal as Point).x, y: val } }, true)}
                defaultValue={0}
                placeholder="Y"
              />
            </div>
          )}
        </div>

        <label className="prop-label" style={{ marginTop: '12px' }}>Radius</label>
        <PropertyNumericInput
          className="radius-input"
          value={cr.radius}
          onChange={(val) => updateProp({ radius: val }, false)}
          onCommit={(val) => updateProp({ radius: val }, true)}
          defaultValue={0.1}
          min={0.001}
        />
      </div>
    );
  };

  const renderPolygonEditor = (poly: typeof obj & { type: 'polygon' }) => {
    const handleVertexChange = (index: number, val: string) => {
      const newPoints = [...poly.points];
      if (val === '__custom__') {
        newPoints[index] = { x: 0, y: 0 };
      } else {
        newPoints[index] = val;
      }
      updateProp({ points: newPoints }, true);
    };

    const handleCoordChange = (index: number, dim: 'x' | 'y', val: number, isCommit: boolean) => {
      const newPoints = [...poly.points];
      const current = newPoints[index];
      if (typeof current !== 'string') {
        newPoints[index] = {
          ...current,
          [dim]: val
        };
        updateProp({ points: newPoints }, isCommit);
      }
    };

    const addVertex = () => {
      updateProp({ points: [...poly.points, { x: 0, y: 0 }] }, true);
    };

    const removeVertex = (index: number) => {
      if (poly.points.length <= 3) {
        alert("A polygon must have at least 3 vertices!");
        return;
      }
      const newPoints = poly.points.filter((_, i) => i !== index);
      updateProp({ points: newPoints }, true);
    };

    return (
      <div className="props-group">
        <label className="prop-label">Vertices ({poly.points.length})</label>
        <div className="vertices-list">
          {poly.points.map((pt, i) => {
            const isRef = typeof pt === 'string';
            const ptVal = isRef ? pt : pt as Point;

            return (
              <div key={i} className="vertex-editor-item">
                <span className="vertex-index">{i + 1}</span>
                <select
                  value={isRef ? (pt as string) : '__custom__'}
                  onChange={(e) => handleVertexChange(i, e.target.value)}
                >
                  <option value="__custom__">Custom</option>
                  {allPoints.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
                {!isRef && (
                  <div className="coordinate-inputs sub-input mini">
                    <PropertyNumericInput
                      value={(ptVal as Point).x}
                      onChange={(val) => handleCoordChange(i, 'x', val, false)}
                      onCommit={(val) => handleCoordChange(i, 'x', val, true)}
                      defaultValue={0}
                      placeholder="X"
                    />
                    <PropertyNumericInput
                      value={(ptVal as Point).y}
                      onChange={(val) => handleCoordChange(i, 'y', val, false)}
                      onCommit={(val) => handleCoordChange(i, 'y', val, true)}
                      defaultValue={0}
                      placeholder="Y"
                    />
                  </div>
                )}
                <button className="del-vertex-btn" onClick={() => removeVertex(i)}>×</button>
              </div>
            );
          })}
        </div>
        <button className="add-vertex-btn" onClick={addVertex}>+ Add Vertex</button>
      </div>
    );
  };

  const renderAngleEditor = (ang: typeof obj & { type: 'angle' }) => {
    return (
      <div className="props-group">
        <label className="prop-label">Angle ABC (Vertex B)</label>
        
        <div className="angle-references">
          <div className="angle-ref-field">
            <span>Point A</span>
            <select
              value={ang.pA}
              onChange={(e) => updateProp({ pA: e.target.value })}
            >
              {allPoints.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="angle-ref-field">
            <span style={{ fontWeight: 'bold', color: ONE_DARK_COLORS.accentActive }}>Vertex B</span>
            <select
              value={ang.pB}
              onChange={(e) => updateProp({ pB: e.target.value })}
            >
              {allPoints.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="angle-ref-field">
            <span>Point C</span>
            <select
              value={ang.pC}
              onChange={(e) => updateProp({ pC: e.target.value })}
            >
              {allPoints.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  };

  // Compute stats for display
  const getComputedMetrics = () => {
    const list: { label: string; value: string }[] = [];
    
    switch (obj.type) {
      case 'point':
        list.push({ label: 'Coordinates', value: `(${obj.x.toFixed(4)}, ${obj.y.toFixed(4)})` });
        break;
      case 'line': {
        const len = getLineLength(obj.p1, obj.p2, objects);
        const eq = getLineEquation(obj.p1, obj.p2, objects);
        const pt1 = resolvePoint(obj.p1, objects);
        const pt2 = resolvePoint(obj.p2, objects);
        list.push({ label: 'Segment Length', value: len !== null ? len.toFixed(4) : 'Undefined' });
        list.push({ label: 'Line Equation', value: eq });
        if (pt1 && pt2) {
          const midX = (pt1.x + pt2.x) / 2;
          const midY = (pt1.y + pt2.y) / 2;
          list.push({ label: 'Midpoint', value: `(${midX.toFixed(4)}, ${midY.toFixed(4)})` });
        }
        break;
      }
      case 'circle': {
        const area = Math.PI * (obj.radius ** 2);
        const circumference = 2 * Math.PI * obj.radius;
        const centerPt = resolvePoint(obj.center, objects);
        list.push({ label: 'Area', value: area.toFixed(4) });
        list.push({ label: 'Circumference', value: circumference.toFixed(4) });
        if (centerPt) {
          list.push({ label: 'Center Coordinates', value: `(${centerPt.x.toFixed(4)}, ${centerPt.y.toFixed(4)})` });
        }
        break;
      }
      case 'polygon': {
        const area = getPolygonArea(obj.points, objects);
        const perm = getPolygonPerimeter(obj.points, objects);
        const centroid = getPolygonCentroid(obj.points, objects);
        list.push({ label: 'Area (Shoelace)', value: area !== null ? area.toFixed(4) : 'Undefined' });
        list.push({ label: 'Perimeter', value: perm !== null ? perm.toFixed(4) : 'Undefined' });
        if (centroid) {
          list.push({ label: 'Centroid', value: `(${centroid.x.toFixed(4)}, ${centroid.y.toFixed(4)})` });
        }
        break;
      }
      case 'angle': {
        const angleVal = getAngleValue(obj.pA, obj.pB, obj.pC, objects);
        list.push({
          label: 'Value',
          value: angleVal !== null ? `${angleVal.toFixed(4)}° (${((angleVal * Math.PI) / 180).toFixed(4)} rad)` : 'Undefined'
        });
        break;
      }
      case 'vector': {
        const pt1 = resolvePoint(obj.p1, objects);
        const pt2 = resolvePoint(obj.p2, objects);
        if (pt1 && pt2) {
          const dx = pt2.x - pt1.x;
          const dy = pt2.y - pt1.y;
          const mag = Math.sqrt(dx * dx + dy * dy);
          list.push({ label: 'Component Form', value: `[${dx.toFixed(4)}, ${dy.toFixed(4)}]` });
          list.push({ label: 'Magnitude', value: mag.toFixed(4) });
          list.push({ label: 'Start Point', value: `(${pt1.x.toFixed(4)}, ${pt1.y.toFixed(4)})` });
          list.push({ label: 'End Point', value: `(${pt2.x.toFixed(4)}, ${pt2.y.toFixed(4)})` });
        }
        break;
      }
    }
    return list;
  };

  return (
    <div className="properties-panel" style={{ backgroundColor: ONE_DARK_COLORS.sidebarBackground }}>
      <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Element Properties</span>
        <button
          onClick={() => onSelect(null)}
          style={{
            background: 'none',
            border: 'none',
            color: ONE_DARK_COLORS.textMuted,
            fontSize: '18px',
            cursor: 'pointer',
            padding: '4px',
            lineHeight: 1,
            transition: 'color 0.15s ease'
          }}
          className="close-props-btn"
          title="Close panel"
        >
          ×
        </button>
      </div>
      
      {/* Name Input & Error Banner */}
      <div className="props-group">
        <label className="prop-label">Object Name</label>
        <input
          className={`name-input-field ${nameError ? 'input-error' : ''}`}
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onBlur={handleNameBlurOrSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleNameBlurOrSubmit();
          }}
        />
        {nameError && <div className="validation-error">{nameError}</div>}
      </div>

      {/* Visibility checkbox toggle */}
      <div className="props-group row-align">
        <label className="prop-label" style={{ margin: 0 }}>Visible</label>
        <input
          type="checkbox"
          className="visibility-checkbox"
          checked={obj.visible}
          onChange={(e) => updateProp({ visible: e.target.checked })}
        />
      </div>

      {/* Fill Figure toggle (only for circle and polygon) */}
      {(obj.type === 'circle' || obj.type === 'polygon') && (
        <div className="props-group row-align">
          <label className="prop-label" style={{ margin: 0 }}>Fill Figure</label>
          <input
            type="checkbox"
            className="visibility-checkbox"
            checked={obj.fill !== false}
            onChange={(e) => updateProp({ fill: e.target.checked })}
          />
        </div>
      )}

      {/* Color Swatch Panel */}
      <div className="props-group">
        <label className="prop-label">Color Swatch</label>
        <div className="color-selectors">
          {ACCENT_PALETTE.map(c => (
            <button
              key={c}
              className={`color-swatch-btn ${obj.color === c ? 'active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => updateProp({ color: c })}
            />
          ))}
          {/* Custom color picker */}
          <div className="custom-color-container" title="Custom Color Palette" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: obj.color }}>
            <input
              type="color"
              value={obj.color}
              onChange={(e) => updateProp({ color: e.target.value })}
              className="custom-color-input"
              style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
            />
            {/* Pipette Eyedropper Icon */}
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{
                pointerEvents: 'none',
                color: '#fff',
                mixBlendMode: 'difference',
              }}
            >
              <path d="M17 2a2.5 2.5 0 0 1 3.5 3.5L13 13H9v-4L17 2z" />
              <path d="M12 17l-3.5 3.5a1 1 0 0 1-1.4 0l-2.2-2.2a1 1 0 0 1 0-1.4L8.4 13.5" />
              <line x1="16" y1="5" x2="19" y2="8" />
            </svg>
          </div>
        </div>
      </div>

      {/* Editor Section */}
      {obj.type === 'point' && renderPointEditor(obj as any)}
      {(obj.type === 'line' || obj.type === 'vector') && renderLineEditor(obj as any)}
      {obj.type === 'circle' && renderCircleEditor(obj as any)}
      {obj.type === 'polygon' && renderPolygonEditor(obj as any)}
      {obj.type === 'angle' && renderAngleEditor(obj as any)}

      {/* Dynamic Calculations Section */}
      <div className="computed-metrics-section">
        <div className="section-title">Geometric Statistics</div>
        <div className="metrics-list">
          {getComputedMetrics().map((m, idx) => (
            <div key={idx} className="metric-row">
              <span className="metric-label">{m.label}</span>
              <span className="metric-value">{m.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Focus zoom button */}
      <button className="focus-obj-btn" onClick={() => onFocusObject(obj.id)}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        Focus Object In Viewport
      </button>
    </div>
  );
};
