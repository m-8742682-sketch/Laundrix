/**
 * Laundrix Theme Constants
 * 
 * Centralized design system matching the beautiful login page aesthetic
 */

export const Colors = {
  // Primary brand colors
  primary: '#0EA5E9',
  primaryDark: '#0284C7',
  primaryLight: '#38BDF8',
  primaryLighter: '#7DD3FC',
  
  // Gradient colors (for LinearGradient)
  gradientStart: '#38BDF8',
  gradientMid: '#0EA5E9',
  gradientEnd: '#0284C7',
  
  // Success gradient
  successStart: '#22c55e',
  successEnd: '#16a34a',
  
  // Warning gradient
  warningStart: '#f59e0b',
  warningEnd: '#d97706',
  
  // Backgrounds
  bgPrimary: '#ffffff',
  bgSecondary: '#F8FAFC',
  bgTertiary: '#f1f5f9',
  
  // Decorative background circles
  decorLight: '#E0F7FA',    // Light cyan
  decorMedium: '#B3E5FC',   // Medium cyan
  decorDark: '#81D4FA',     // Darker cyan
  
  // Text colors
  textPrimary: '#0f172a',     // Near black
  textSecondary: '#64748b',   // Medium gray
  textTertiary: '#94a3b8',    // Light gray
  textWhite: '#ffffff',
  
  // Status colors
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  
  // Border colors
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  borderDark: '#cbd5e1',
  
  // Overlay
  overlay: 'rgba(0, 0, 0, 0.4)',
  overlayLight: 'rgba(0, 0, 0, 0.2)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  full: 999,
};

export const Shadows = {
  none: {},
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
};

export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    color: Colors.textPrimary,
  },
  h2: {
    fontSize: 24,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
    color: Colors.textPrimary,
  },
  h3: {
    fontSize: 20,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
    color: Colors.textPrimary,
  },
  h4: {
    fontSize: 18,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
    color: Colors.textPrimary,
  },
  body: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  bodyBold: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textTertiary,
    lineHeight: 18,
  },
  captionBold: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  small: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textTertiary,
    lineHeight: 16,
  },
};

export const AnimationDuration = {
  fast: 300,
  normal: 600,
  slow: 800,
};

export const AnimationTiming = {
  entrance: {
    duration: 800,
    tension: 50,
    friction: 8,
  },
  pulse: {
    duration: 2000,
    scale: 1.05,
  },
};