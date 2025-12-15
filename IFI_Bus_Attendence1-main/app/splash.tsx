import React, { useEffect } from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onLoadComplete?: () => void;
}

export default function SplashScreen({ onLoadComplete }: SplashScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onLoadComplete?.();
    }, 3000); // Show splash for 3 seconds

    return () => clearTimeout(timer);
  }, [onLoadComplete]);

  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/intimate_fashions.jpg')}
        style={styles.image}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  image: {
    width: width,
    height: height,
  },
});