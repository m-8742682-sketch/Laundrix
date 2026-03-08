/**
 * Professional Loading Component
 * 
 * Provides smooth loading states with proper UX feedback
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface LoadingProps {
  message?: string;
  size?: 'small' | 'large';
  color?: string;
  showText?: boolean;
}

export default function ProfessionalLoading({ 
  message = 'Loading...',
  size = 'large',
  color = '#0EA5E9',
  showText = true 
}: LoadingProps) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={['#0C1A2E', '#0D2A4A']}
        style={styles.gradient}
      >
        <ActivityIndicator size={size} color={color} />
        {showText && (
          <Text style={styles.message}>{message}</Text>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradient: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
    opacity: 0.8,
    textAlign: 'center',
  },
});