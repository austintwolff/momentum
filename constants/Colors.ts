/**
 * App Color Theme - Dark Purple
 * Based on modern fintech dark UI design
 */

// Primary accent - Purple (slightly darker violet)
export const accent = '#7C3AED';
export const accentLight = '#8B5CF6';
export const accentDark = '#6D28D9';

// Backgrounds
export const bgPrimary = '#0D0D14';      // Main background (near black)
export const bgSecondary = '#1A1A24';    // Cards, elevated surfaces
export const bgTertiary = '#2D2D3A';     // Inputs, pressed states

// Text
export const textPrimary = '#FFFFFF';
export const textSecondary = '#9CA3AF';
export const textMuted = '#6B7280';

// Borders & Dividers
export const border = '#2D2D3A';
export const borderLight = '#374151';

// Status colors
export const success = '#10B981';        // Keep green for success states
export const warning = '#F59E0B';        // Amber for warnings/max level
export const error = '#EF4444';          // Red for errors/destructive
export const info = '#3B82F6';           // Blue for info

// Legacy export for compatibility
const tintColorLight = accent;
const tintColorDark = '#FFFFFF';

export default {
  light: {
    text: textPrimary,
    background: bgPrimary,
    tint: tintColorLight,
    tabIconDefault: textMuted,
    tabIconSelected: accent,
  },
  dark: {
    text: textPrimary,
    background: bgPrimary,
    tint: tintColorDark,
    tabIconDefault: textMuted,
    tabIconSelected: accent,
  },
};

// Semantic color exports for easy importing
export const colors = {
  accent,
  accentLight,
  accentDark,
  bgPrimary,
  bgSecondary,
  bgTertiary,
  textPrimary,
  textSecondary,
  textMuted,
  border,
  borderLight,
  success,
  warning,
  error,
  info,
} as const;
