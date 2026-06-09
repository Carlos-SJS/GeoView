export const ONE_DARK_COLORS = {
  background: '#282c34',       // Main editor / canvas background
  editorBackground: '#21252b', // Command input / history console background
  sidebarBackground: '#1e2227',// Left sidebar background
  text: '#abb2bf',             // Default text color
  textLight: '#e0e6f0',        // Highlighted text color
  textMuted: '#5c6370',        // Subdued / comment text color
  selection: '#3e4451',        // Selected item background / highlighting
  border: '#181a1f',           // Borders between panels
  inputBg: '#1b1d23',          // Input boxes background
  accentActive: '#61afef',     // Primary blue accent
};

// Pretty accent colors for canvas elements (inspired by One Dark Pro)
export const ACCENT_PALETTE = [
  '#61afef', // Blue
  '#e06c75', // Red / Coral
  '#98c379', // Green
  '#d19a66', // Orange
  '#c678dd', // Purple
  '#56b6c2', // Teal
];

// Helper to convert hex colors to rgba for semi-transparent fills (e.g. polygons)
export function hexToRgba(hex: string, alpha: number): string {
  // Remove hash if exists
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
