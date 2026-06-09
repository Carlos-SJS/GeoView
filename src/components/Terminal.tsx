import React, { useState, useEffect, useRef } from 'react';
import type { TerminalLog } from '../types';
import { getAutocompleteSuggestion, type Suggestion } from '../parser';
import { ONE_DARK_COLORS } from '../utils/theme';

interface TerminalProps {
  logs: TerminalLog[];
  onExecuteCommand: (commandText: string) => void;
  onClearLogs: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export const Terminal: React.FC<TerminalProps> = ({
  logs,
  onExecuteCommand,
  onClearLogs,
  isCollapsed,
  setIsCollapsed,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  
  const consoleEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom of terminal logs on new entry
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Handle input change and update autocomplete suggestions
  useEffect(() => {
    // We parse the current text in the input box.
    // If it is multi-line, we look at the last line being typed.
    const lines = inputValue.split('\n');
    const activeLine = lines[lines.length - 1] || '';
    
    // Disable suggestion tooltip if there's multiple lines or if the line is empty
    if (lines.length > 1 || activeLine.trim() === '') {
      setSuggestion(null);
      return;
    }

    const sug = getAutocompleteSuggestion(activeLine);
    setSuggestion(sug);
  }, [inputValue]);

  // Listen to logs to capture errors on execution
  useEffect(() => {
    if (logs.length > 0) {
      const lastLog = logs[logs.length - 1];
      if (!lastLog.success && lastLog.error) {
        setLastError(lastLog.error);
      } else {
        setLastError(null);
      }
    } else {
      setLastError(null);
    }
  }, [logs]);

  const handleSubmit = () => {
    if (!inputValue.trim()) return;
    onExecuteCommand(inputValue);
    setInputValue('');
    setLastError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Run on Enter, but Shift+Enter inserts newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleLoadCommand = (cmd: string) => {
    setInputValue(cmd);
  };

  return (
    <div
      className="terminal-container"
      style={{
        backgroundColor: ONE_DARK_COLORS.editorBackground,
        height: isCollapsed ? '94px' : '260px',
        transition: 'height 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
      }}
    >
      <div
        className="terminal-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <div className="terminal-title">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          Command Console & Parser
          <span style={{ marginLeft: '8px', fontSize: '9px', opacity: 0.6 }}>
            {isCollapsed ? '▲ Show Logs' : '▼ Hide Logs'}
          </span>
        </div>
        <div className="terminal-header-actions">
          <button
            className="term-clear-btn"
            onClick={(e) => {
              e.stopPropagation();
              onClearLogs();
            }}
            title="Clear Console History"
          >
            Clear Logs
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="terminal-history">
          {logs.length === 0 ? (
            <div className="terminal-welcome">
              <p className="welcome-comment">// Welcome to GeoView Terminal</p>
              <p className="welcome-comment">// Enter geometric commands below. Examples:</p>
              <p className="welcome-code">A = point(0, 0)</p>
              <p className="welcome-code">B = point(5, 5)</p>
              <p className="welcome-code">l1 = line(A, B)</p>
              <p className="welcome-code">c1 = circle(A, 3)</p>
              <p className="welcome-code">poly1 = polygon(A, B, (5, 0))</p>
              <p className="welcome-comment">// Press Enter to run. Shift+Enter for newlines. Paste multi-line scripts to run at once.</p>
            </div>
          ) : (
            <div className="logs-list">
              {logs.map((log, i) => (
                <div key={i} className={`log-item ${log.success ? 'success' : 'error'}`}>
                  <div className="log-time">{log.timestamp.toLocaleTimeString()}</div>
                  <div className="log-body">
                    <div
                      className="log-cmd"
                      onClick={() => handleLoadCommand(log.command)}
                      title="Click to load back into input"
                    >
                      <span className="prompt-char">&gt;</span> {log.command}
                    </div>
                    {!log.success && <div className="log-err-msg">{log.error}</div>}
                  </div>
                </div>
              ))}
              <div ref={consoleEndRef} />
            </div>
          )}
        </div>
      )}

      {!isCollapsed && lastError && (
        <div className="terminal-error-alert">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px', flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="error-text">Execution Error: {lastError}</span>
        </div>
      )}

      {/* Input controls with suggestion tooltip (Always visible) */}
      <div className="terminal-input-wrapper">
        {suggestion && (
          <div className="autocomplete-tooltip" style={{ backgroundColor: ONE_DARK_COLORS.selection }}>
            <span className="tooltip-syntax">{suggestion.syntax}</span>
            <span className="tooltip-divider">|</span>
            <span className="tooltip-desc">{suggestion.description}</span>
          </div>
        )}

        <div className="input-row">
          <span className="term-prompt">&gt;</span>
          <textarea
            className="terminal-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type geometry commands (e.g. point(1, 2) or A = circle((0,0), 5))"
            rows={Math.min(5, inputValue.split('\n').length || 1)}
          />
          <button className="run-command-btn" onClick={handleSubmit}>
            Run
          </button>
        </div>
      </div>
    </div>
  );
};
