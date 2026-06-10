import React, { useState, useRef } from 'react';
import type { CalculatorVariable } from '../utils/evaluator';

interface CalculatorPanelProps {
  calcVariables: CalculatorVariable[];
  onAddCalcVariable: (name: string, expression: string) => string | null;
  onDeleteCalcVariable: (name: string) => void;
  onReorderCalcVariables: (newVars: CalculatorVariable[]) => void;
  onUpdateCalcVariable: (oldName: string, newName: string, newExpression: string) => string | null;
}

export const CalculatorPanel: React.FC<CalculatorPanelProps> = ({
  calcVariables,
  onAddCalcVariable,
  onDeleteCalcVariable,
  onReorderCalcVariables,
  onUpdateCalcVariable,
}) => {
  const [nameInput, setNameInput] = useState('');
  const [exprInput, setExprInput] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);

  // Edit states
  const [editingVarName, setEditingVarName] = useState<string | null>(null);
  const [editNameInput, setEditNameInput] = useState('');
  const [editExprInput, setEditExprInput] = useState('');

  const handleStartEdit = (v: CalculatorVariable) => {
    setEditingVarName(v.name);
    setEditNameInput(v.name);
    setEditExprInput(v.expression);
    setErrorText(null);
  };

  const handleSaveEdit = (oldName: string) => {
    setErrorText(null);
    const newName = editNameInput.trim();
    const newExpr = editExprInput.trim();

    if (!newName || !newExpr) {
      setErrorText("Both name and formula are required.");
      return;
    }

    const err = onUpdateCalcVariable(oldName, newName, newExpr);
    if (err) {
      setErrorText(err);
    } else {
      setEditingVarName(null);
      setErrorText(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingVarName(null);
    setErrorText(null);
  };

  // Drag and drop states
  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragIndex.current = index;
    setDraggingIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (index: number) => {
    dragOverIndex.current = index;
  };

  const handleDragEnd = () => {
    if (dragIndex.current !== null && dragOverIndex.current !== null && dragIndex.current !== dragOverIndex.current) {
      const list = [...calcVariables];
      const [removed] = list.splice(dragIndex.current, 1);
      list.splice(dragOverIndex.current, 0, removed);
      onReorderCalcVariables(list);
    }
    dragIndex.current = null;
    dragOverIndex.current = null;
    setDraggingIdx(null);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);

    const name = nameInput.trim();
    const expr = exprInput.trim();

    if (!name || !expr) {
      setErrorText("Both name and formula are required.");
      return;
    }

    const err = onAddCalcVariable(name, expr);
    if (err) {
      setErrorText(err);
    } else {
      setNameInput('');
      setExprInput('');
      setErrorText(null);
    }
  };

  return (
    <div className="calculator-panel">
      {calcVariables.length === 0 ? (
        <div className="empty-message">
          No variables defined. Create a variable (e.g. <code>k = dist(A,B)</code>) below or using the terminal.
        </div>
      ) : (
        <div className="calc-variables-list">
          {calcVariables.map((v, idx) => {
            const isDragging = draggingIdx === idx;
            const hasError = !!v.error;
            const isEditing = editingVarName === v.name;
            return (
              <div
                key={v.name}
                className={`calc-var-item ${isDragging ? 'dragging' : ''} ${hasError ? 'has-error' : ''} ${isEditing ? 'is-editing' : ''}`}
                draggable={!isEditing}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragEnter={() => handleDragEnter(idx)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                onDoubleClick={() => {
                  if (!isEditing) handleStartEdit(v);
                }}
                style={{
                  borderLeft: `3px solid ${hasError ? 'var(--accent-red)' : 'var(--accent-green)'}`,
                }}
              >
                {/* Drag handle dots */}
                <div className="calc-drag-handle" title={isEditing ? "Editing mode" : "Drag to reorder"}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="8" cy="6" r="2" />
                    <circle cx="16" cy="6" r="2" />
                    <circle cx="8" cy="12" r="2" />
                    <circle cx="16" cy="12" r="2" />
                    <circle cx="8" cy="18" r="2" />
                    <circle cx="16" cy="18" r="2" />
                  </svg>
                </div>

                {isEditing ? (
                  <div className="calc-var-edit-container" style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0 }}>
                    <input
                      type="text"
                      className="calc-name-input"
                      style={{ width: '45px', padding: '4px', margin: 0 }}
                      value={editNameInput}
                      onChange={(e) => setEditNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveEdit(v.name);
                        } else if (e.key === 'Escape') {
                          handleCancelEdit();
                        }
                      }}
                    />
                    <span className="calc-var-separator">=</span>
                    <input
                      type="text"
                      className="calc-expr-input"
                      style={{ flex: 1, minWidth: 0, padding: '4px', margin: 0 }}
                      value={editExprInput}
                      onChange={(e) => setEditExprInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveEdit(v.name);
                        } else if (e.key === 'Escape') {
                          handleCancelEdit();
                        }
                      }}
                    />
                    <button
                      className="calc-save-btn"
                      onClick={() => handleSaveEdit(v.name)}
                      title="Save changes"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-green)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                    <button
                      className="calc-cancel-btn"
                      onClick={handleCancelEdit}
                      title="Cancel editing"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="calc-var-info">
                      <div className="calc-var-header">
                        <span className="calc-var-name">{v.name}</span>
                        <span className="calc-var-separator">=</span>
                        <span className="calc-var-expr" title={v.expression}>{v.expression}</span>
                      </div>
                      {v.error && (
                        <div className="calc-var-error-msg">{v.error}</div>
                      )}
                    </div>

                    <div className="calc-var-result-container">
                      <div className={`calc-var-value ${hasError ? 'error' : ''}`}>
                        {v.value}
                      </div>
                      <button
                        className="calc-delete-btn"
                        onClick={() => onDeleteCalcVariable(v.name)}
                        title={`Delete variable ${v.name}`}
                      >
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Add Form */}
      <form className="calc-add-form" onSubmit={handleAdd}>
        <div className="calc-add-inputs">
          <input
            type="text"
            className="calc-name-input"
            placeholder="name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
          />
          <span className="calc-equals-symbol">=</span>
          <input
            type="text"
            className="calc-expr-input"
            placeholder="formula (e.g. dist(A, B))"
            value={exprInput}
            onChange={(e) => setExprInput(e.target.value)}
          />
          <button type="submit" className="calc-submit-btn" title="Add Variable">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
        {errorText && <div className="calc-form-error">{errorText}</div>}
      </form>
    </div>
  );
};
