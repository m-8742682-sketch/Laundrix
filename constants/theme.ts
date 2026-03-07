/**
 * Laundrix IoT Theme Constants
 * 
 * Consistent design system matching login/register pages
 * Use these constants across all pages for unified look
 */

export const THEME = {
  // Primary Colors (Blue gradient)
  primary: '#0EA5E9',      // Sky 500 - Main brand color
  primaryDark: '#0284C7',  // Sky 600
  primaryDeep: '#0369A1',  // Sky 700
  
  // Accent Colors
  accent: {
    cyan: '#4FC3F7',       // Light cyan (logo gradient start)
    cyanMid: '#29B6F6',    // Mid cyan
    cyanDark: '#0288D1',   // Dark cyan (logo gradient end)
    indigo: '#0EA5E9',     // Unified to sky blue for brand consistency
    purple: '#9333EA',     // Purple accent
    green: '#16A34A',      // Success green
    red: '#EF4444',        // Error/danger red
    orange: '#F97316',     // Warning orange
  },
  
  // Background Colors
  background: '#FFFFFF',   // Main background
  backgroundAlt: '#F8FAFC', // Slate 50 - Alt background
  surface: '#FFFFFF',      // Card/surface
  
  // Text Colors
  text: {
    primary: '#0F172A',    // Slate 900 - Main text
    secondary: '#64748B',  // Slate 500 - Muted text
    tertiary: '#94A3B8',   // Slate 400 - Placeholder
    white: '#FFFFFF',
    link: '#0284C7',       // Link color
  },
  
  // Border Colors
  border: {
    light: '#E2E8F0',      // Slate 200
    medium: '#CBD5E1',     // Slate 300
    focus: '#0EA5E9',      // Focus state
  },
  
  // Decorative Circle Colors (matching login)
  decor: {
    circle1: '#E0F7FA',    // Light cyan (opacity 0.4)
    circle2: '#B3E5FC',    // Light blue (opacity 0.3)
    circle3: '#81D4FA',    // Sky blue (opacity 0.2)
  },
  
  // Status Colors
  status: {
    available: '#06B6D4',  // Cyan 500
    inUse: '#0284C7',      // Sky blue (was Indigo 500)
    offline: '#94A3B8',    // Gray
    success: '#22C55E',    // Green 500
    warning: '#F59E0B',    // Amber 500
    error: '#EF4444',      // Red 500
  },
  
  // Input Colors
  input: {
    background: '#F8FAFC',
    backgroundFocused: '#FFFFFF',
    border: '#E2E8F0',
    borderFocused: '#0EA5E9',
    iconBg: '#E0F7FA',
  },
} as const;

// Gradient presets
export const GRADIENTS = {
  primary: ['#0EA5E9', '#0284C7', '#0369A1'] as const,
  primaryLight: ['#4FC3F7', '#29B6F6', '#0288D1'] as const,
  disabled: ['#94A3B8', '#64748B'] as const,
  dark: ['#334155', '#1E293B'] as const,
  surface: ['#FFFFFF', '#F0F9FF'] as const,
  card: ['#E0F2FE', '#FFFFFF'] as const,
  cardAlt: ['#F1F5F9', '#FFFFFF'] as const,
} as const;

// Shadow presets
export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  large: {
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  hero: {
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
} as const;

// Border radius presets
export const RADIUS = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  full: 999,
} as const;

// Spacing presets
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export default THEME;
