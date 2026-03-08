/**
 * Professional Button Component
 * 
 * Provides consistent button styling with loading states
 */

import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';

interface ProfessionalButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export default function ProfessionalButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'medium',
  style,
  textStyle,
  icon,
  fullWidth = false,
}: ProfessionalButtonProps) {
  const isDisabled = disabled || loading;

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          button: styles.primaryButton,
          text: styles.primaryText,
          disabled: styles.primaryDisabled,
        };
      case 'secondary':
        return {
          button: styles.secondaryButton,
          text: styles.secondaryText,
          disabled: styles.secondaryDisabled,
        };
      case 'danger':
        return {
          button: styles.dangerButton,
          text: styles.dangerText,
          disabled: styles.dangerDisabled,
        };
      case 'outline':
        return {
          button: styles.outlineButton,
          text: styles.outlineText,
          disabled: styles.outlineDisabled,
        };
      default:
        return {
          button: styles.primaryButton,
          text: styles.primaryText,
          disabled: styles.primaryDisabled,
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          button: styles.smallButton,
          text: styles.smallText,
        };
      case 'large':
        return {
          button: styles.largeButton,
          text: styles.largeText,
        };
      default:
        return {
          button: styles.mediumButton,
          text: styles.mediumText,
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const buttonStyles = [
    styles.baseButton,
    sizeStyles.button,
    variantStyles.button,
    fullWidth && styles.fullWidth,
    isDisabled && variantStyles.disabled,
    style,
  ];

  const textStyles = [
    styles.baseText,
    sizeStyles.text,
    variantStyles.text,
    textStyle,
  ];

  return (
    <Pressable
      style={buttonStyles}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyles.text.color} />
      ) : (
        <>
          {icon && <>{icon}</>}
          <Text style={textStyles}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  baseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  baseText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  // Sizes
  smallButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 80,
  },
  smallText: {
    fontSize: 14,
  },
  mediumButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    minWidth: 120,
  },
  mediumText: {
    fontSize: 16,
  },
  largeButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    minWidth: 160,
  },
  largeText: {
    fontSize: 18,
  },
  // Variants
  primaryButton: {
    backgroundColor: '#0EA5E9',
  },
  primaryText: {
    color: '#FFFFFF',
  },
  primaryDisabled: {
    backgroundColor: '#94A3B8',
    elevation: 0,
  },
  secondaryButton: {
    backgroundColor: '#1E293B',
  },
  secondaryText: {
    color: '#FFFFFF',
  },
  secondaryDisabled: {
    backgroundColor: '#475569',
    elevation: 0,
  },
  dangerButton: {
    backgroundColor: '#EF4444',
  },
  dangerText: {
    color: '#FFFFFF',
  },
  dangerDisabled: {
    backgroundColor: '#F87171',
    elevation: 0,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#0EA5E9',
  },
  outlineText: {
    color: '#0EA5E9',
  },
  outlineDisabled: {
    borderColor: '#94A3B8',
    backgroundColor: 'transparent',
  },
  // Utilities
  fullWidth: {
    width: '100%',
  },
});