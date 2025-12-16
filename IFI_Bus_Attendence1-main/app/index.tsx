import { BarcodeScanningResult, CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Vibration,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Platform-specific configurations - FIXED: No undefined values
const SCAN_FRAME_SIZE = Platform.select({
  ios: SCREEN_WIDTH * 0.8,      // iOS needs slightly larger frame
  android: SCREEN_WIDTH * 0.7,
}) || SCREEN_WIDTH * 0.7; // Default fallback

const BARCODE_TYPES = Platform.select({
  ios: ['code128', 'code39', 'ean13'] as const,  // iOS supports fewer types
  android: ['code39', 'code93', 'code128', 'codabar', 'ean13', 'ean8', 'upc_a', 'upc_e', 'itf14'] as const,
}) || ['code128', 'code39', 'ean13']; // Default fallback

// API Configuration
const API_CONFIG = {
  DEV_API_URL: 'http://10.207.85.76:5000/api/scan',
  PROD_API_URL: 'http://localhost:5000',
  IS_DEVELOPMENT: true,
  API_KEY: 'your-api-key-here',
};

const getApiUrl = () => {
  return API_CONFIG.IS_DEVELOPMENT ? API_CONFIG.DEV_API_URL : API_CONFIG.PROD_API_URL;
};

const isValidEmployeeId = (data: string): boolean => {
  const fiveDigitRegex = /^\d{5}$/;
  return fiveDigitRegex.test(data);
};

export default function BarcodeScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scannedData, setScannedData] = useState<string>('');
  const [scanTime, setScanTime] = useState<string>('');
  const [facing, setFacing] = useState<CameraType>('back');
  const [isActive, setIsActive] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [lastScanStatus, setLastScanStatus] = useState<'success' | 'error' | 'duplicate' | null>(null);
  const [scanType, setScanType] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [focusMode, setFocusMode] = useState<'on' | 'off'>('on');
  const [scanConfirmationCount, setScanConfirmationCount] = useState(0);
  const [isConfirmingScan, setIsConfirmingScan] = useState(false);
  
  // Platform-specific confirmation threshold - FIXED: No undefined values
  const CONFIRMATION_THRESHOLD = Platform.select({
    ios: 1,      // iOS: accept after 1 good scan
    android: 2,  // Android: require 2 consistent scans
  }) || 2; // Default fallback
  
  // Refs for multiple-frame confirmation
  const lastCodeRef = useRef<string | null>(null);
  const confirmationCountRef = useRef<number>(0);
  const confirmationTimeoutRef = useRef<number | null>(null);
  
  // Animation refs
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Ref to track if we're currently processing a scan
  const isProcessing = useRef(false);
  
  // Track recent scans client-side for immediate feedback
  const recentScans = useRef<Set<string>>(new Set());

  // Lock screen orientation to portrait
  useEffect(() => {
    // ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    
    return () => {
      ScreenOrientation.unlockAsync();
      if (confirmationTimeoutRef.current) {
        clearTimeout(confirmationTimeoutRef.current);
      }
    };
  }, []);

  // Start scanning animations
  useEffect(() => {
    if (!scanned && !isProcessing.current) {
      startScanningAnimations();
    } else {
      stopScanningAnimations();
    }
  }, [scanned, isProcessing.current]);

  const startScanningAnimations = () => {
    // Scanning line animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Pulse animation for corners
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopScanningAnimations = () => {
    scanLineAnim.stopAnimation();
    pulseAnim.stopAnimation();
  };

  // Handle screen focus to resume camera
  useFocusEffect(
    React.useCallback(() => {
      setIsActive(true);
      isProcessing.current = false;
      lastCodeRef.current = null;
      confirmationCountRef.current = 0;
      setScanConfirmationCount(0);
      setIsConfirmingScan(false);
      
      if (confirmationTimeoutRef.current) {
        clearTimeout(confirmationTimeoutRef.current);
      }
      
      return () => {
        setIsActive(false);
      };
    }, [])
  );

  const sendScanToServer = async (employeeId: string, scanDateTime: string, scanType: string) => {
    setIsSending(true);
    setLastScanStatus(null);
    
    try {
      const apiUrl = getApiUrl();
      
      console.log('Sending scan to:', apiUrl);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (API_CONFIG.API_KEY && API_CONFIG.API_KEY !== 'your-api-key-here') {
        headers['Authorization'] = `Bearer ${API_CONFIG.API_KEY}`;
      }
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          employeeId,
          scanDateTime,
          scanType,
          deviceInfo: `Expo-Mobile-Scanner-${Platform.OS}`,
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('Scan sent successfully:', result);
        setLastScanStatus('success');
        Vibration.vibrate(100);
        
        recentScans.current.add(employeeId);
        
        setTimeout(() => {
          recentScans.current.delete(employeeId);
        }, 5 * 60 * 1000);
        
        return { success: true, message: result.message || 'Scan recorded successfully' };
      } else if (response.status === 409) {
        console.log('Duplicate scan detected:', result);
        setLastScanStatus('duplicate');
        Vibration.vibrate([100, 50, 100]);
        return { 
          success: false, 
          message: result.message || 'Employee was recently scanned',
          isDuplicate: true
        };
      } else {
        console.error('Server error:', result);
        setLastScanStatus('error');
        Vibration.vibrate([100, 50, 100, 50, 100]);
        return { 
          success: false, 
          message: result.message || `Server error: ${response.status}` 
        };
      }
    } catch (error: any) {
      console.error('Network error:', error);
      setLastScanStatus('error');
      Vibration.vibrate([100, 50, 100, 50, 100]);
      
      let errorMessage = 'Network error. Please check your connection.';
      
      if (error.message?.includes('Network request failed')) {
        errorMessage = 'Cannot connect to server. Check if backend is running and accessible.';
      }
      
      return { success: false, message: errorMessage };
    } finally {
      setIsSending(false);
    }
  };

  const handleBarCodeScanned = async ({ type, data }: BarcodeScanningResult) => {
    // Prevent multiple scans while processing
    if (isProcessing.current || isSending || scanned) {
      return;
    }
    
    // Log for debugging
    console.log(`[${Platform.OS}] Scan detected:`, data, 'Type:', type);
    
    // 1. Validate the scanned data (5 digits only)
    if (!isValidEmployeeId(data)) {
      console.log('Invalid scan - not 5 digits:', data);
      setValidationError('Invalid ID format. Must be 5 digits');
      Vibration.vibrate(50);
      
      setTimeout(() => {
        setValidationError('');
      }, 1500);
      return;
    }
    
    // 2. Platform-specific confirmation logic
    if (data === lastCodeRef.current) {
      confirmationCountRef.current++;
    } else {
      lastCodeRef.current = data;
      confirmationCountRef.current = 1;
    }
    
    setScanConfirmationCount(confirmationCountRef.current);
    
    // Show confirming UI feedback
    setIsConfirmingScan(true);
    
    // Clear any existing timeout
    if (confirmationTimeoutRef.current) {
      clearTimeout(confirmationTimeoutRef.current);
    }
    
    // Set timeout to reset confirmation if no repeated scan
    const timeoutDuration = Platform.select({
      ios: 500,    // iOS: shorter timeout for faster feedback
      android: 1000,
    }) || 1000; // Default fallback
    
    confirmationTimeoutRef.current = setTimeout(() => {
      lastCodeRef.current = null;
      confirmationCountRef.current = 0;
      setScanConfirmationCount(0);
      setIsConfirmingScan(false);
    }, timeoutDuration);
    
    // Only proceed if we have enough consistent scans based on platform
    if (confirmationCountRef.current < CONFIRMATION_THRESHOLD) {
      return;
    }
    
    // Clear the timeout since we're proceeding
    if (confirmationTimeoutRef.current) {
      clearTimeout(confirmationTimeoutRef.current);
    }
    
    // 3. Client-side duplicate check
    if (recentScans.current.has(data)) {
      console.log('Duplicate scan detected (client-side):', data);
      isProcessing.current = true;
      setScanned(true);
      setScannedData(data);
      setScanType(type);
      setLastScanStatus('duplicate');
      setIsConfirmingScan(false);
      
      const now = new Date();
      const formattedTime = now.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setScanTime(formattedTime);
      
      setTimeout(() => {
        isProcessing.current = false;
        resetScanner();
      }, 3000);
      
      return;
    }
    
    // 4. If validation and confirmation passes, process the scan
    isProcessing.current = true;
    setScanned(true);
    setScannedData(data);
    setScanType(type);
    setIsConfirmingScan(false);
    
    const now = new Date();
    const formattedTime = now.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const isoTime = now.toISOString();
    
    setScanTime(formattedTime);
    
    // Show confirmation dialog
    Alert.alert(
      'Confirm Employee ID',
      `Employee ID: ${data}\n\nIs this correct?`,
      [
        { 
          text: 'Cancel', 
          style: 'destructive',
          onPress: () => {
            isProcessing.current = false;
            resetScanner();
          }
        },
        { 
          text: 'Yes, Submit', 
          style: 'default',
          onPress: () => {
            sendScanToServer(data, isoTime, type).then(result => {
              if (result.success) {
                setTimeout(() => {
                  isProcessing.current = false;
                  resetScanner();
                }, 2000);
              } else if (result.isDuplicate) {
                setTimeout(() => {
                  isProcessing.current = false;
                  resetScanner();
                }, 3000);
              } else {
                isProcessing.current = false;
              }
            }).catch(() => {
              isProcessing.current = false;
            });
          }
        }
      ],
      { cancelable: false }
    );
  };

  const retrySend = async () => {
    const isoTime = new Date().toISOString();
    const result = await sendScanToServer(scannedData, isoTime, scanType);
    
    if (result.success) {
      setTimeout(() => {
        resetScanner();
      }, 1500);
    }
  };

  const resetScanner = () => {
    setScanned(false);
    setScannedData('');
    setScanTime('');
    setScanType('');
    setLastScanStatus(null);
    setValidationError('');
    setScanConfirmationCount(0);
    setIsConfirmingScan(false);
    isProcessing.current = false;
    lastCodeRef.current = null;
    confirmationCountRef.current = 0;
    
    if (confirmationTimeoutRef.current) {
      clearTimeout(confirmationTimeoutRef.current);
    }
    
    startScanningAnimations();
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const toggleTorch = () => {
    setTorchEnabled(current => !current);
  };

  const toggleFocus = () => {
    setFocusMode(current => current === 'on' ? 'off' : 'on');
  };

  const navigateToManualEntry = () => {
    router.push('/manual-entry');
  };

  const getScanConfirmationMessage = () => {
    if (scanConfirmationCount === 1) {
      return 'Scan detected...';
    } else if (scanConfirmationCount >= 2) {
      return '✓ Scan confirmed!';
    }
    return '';
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={64} color="#007AFF" />
        <Text style={styles.permissionText}>
          We need your permission to use the camera
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isActive) {
    return (
      <View style={styles.container}>
        <Text>Camera is not active</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing={facing}
        onBarcodeScanned={isProcessing.current || isSending ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
  barcodeTypes: [...BARCODE_TYPES], // Spread operator creates mutable copy
}}
        enableTorch={torchEnabled}
        focusable={focusMode === 'on'}
        // Platform-specific camera props - FIXED: Added proper typing
        zoom={0} // Default zoom for both platforms
        autofocus="on" // Standard autofocus that works on both
      >
        {/* Scan Frame Overlay */}
        <View style={styles.overlay}>
          <View style={[styles.scanFrame, { width: SCAN_FRAME_SIZE }]}>
            {/* Animated corners */}
            <Animated.View style={[styles.corner, styles.topLeft, { transform: [{ scale: pulseAnim }] }]} />
            <Animated.View style={[styles.corner, styles.topRight, { transform: [{ scale: pulseAnim }] }]} />
            <Animated.View style={[styles.corner, styles.bottomLeft, { transform: [{ scale: pulseAnim }] }]} />
            <Animated.View style={[styles.corner, styles.bottomRight, { transform: [{ scale: pulseAnim }] }]} />
            
            {/* Scanning line */}
            <Animated.View 
              style={[
                styles.scanLine,
                {
                  transform: [{
                    translateY: scanLineAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, SCAN_FRAME_SIZE * 0.6]
                    })
                  }]
                }
              ]} 
            />
          </View>
          
          {/* Instructions and status */}
          <View style={styles.instructionsContainer}>
            {isConfirmingScan ? (
              <View style={styles.confirmingContainer}>
                <Text style={styles.confirmingText}>
                  {getScanConfirmationMessage()}
                </Text>
                <Text style={styles.confirmingSubText}>
                  {Platform.OS === 'ios' ? 'Processing...' : 'Hold steady for confirmation...'}
                </Text>
              </View>
            ) : validationError ? (
              <Text style={styles.errorText}>
                {validationError}
              </Text>
            ) : (
              <>
                <Text style={styles.instructionsText}>
                  Scan 5-digit Employee ID
                </Text>
                <Text style={styles.instructionsSubText}>
                  {Platform.OS === 'ios' ? 'Hold steady over barcode' : 'Position barcode within frame'}
                </Text>
              </>
            )}
          </View>

          {/* Camera Controls Overlay */}
          <View style={styles.controlsOverlay}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={toggleTorch}
            >
              <Ionicons name={torchEnabled ? "flash" : "flash-outline"} size={24} color="white" />
              <Text style={styles.controlButtonText}>
                {torchEnabled ? 'Flash On' : 'Flash Off'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.controlButton}
              onPress={toggleFocus}
            >
              <Ionicons name={focusMode === 'on' ? "scan-circle" : "scan-circle-outline"} size={24} color="white" />
              <Text style={styles.controlButtonText}>
                {focusMode === 'on' ? 'Auto Focus' : 'Manual Focus'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.controlButton}
              onPress={navigateToManualEntry}
            >
              <Ionicons name="keypad-outline" size={24} color="white" />
              <Text style={styles.controlButtonText}>Manual Entry</Text>
            </TouchableOpacity>
          </View>

          {/* Loading indicator when sending data */}
          {isSending && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Sending to server...</Text>
            </View>
          )}
        </View>
      </CameraView>

      {/* Bottom Controls Panel */}
      <View style={styles.controlsContainer}>
        {scanned ? (
          <View style={styles.scanResultContainer}>
            <View style={styles.resultHeader}>
              <Ionicons name="checkmark-circle" size={24} color="#34C759" />
              <Text style={styles.resultTitle}>Scan Complete</Text>
            </View>
            
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>Employee ID</Text>
              <Text style={styles.resultData}>{scannedData}</Text>
              
              <View style={styles.resultDetails}>
                <View style={styles.detailItem}>
                  <Ionicons name="time-outline" size={14} color="#666" />
                  <Text style={styles.detailText}>{scanTime}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="barcode-outline" size={14} color="#666" />
                  <Text style={styles.detailText}>{scanType}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="phone-portrait-outline" size={14} color="#666" />
                  <Text style={styles.detailText}>{Platform.OS}</Text>
                </View>
              </View>
            </View>
            
            {/* Status indicator */}
            {lastScanStatus && (
              <View style={[
                styles.statusIndicator,
                lastScanStatus === 'success' ? styles.statusSuccess : 
                lastScanStatus === 'duplicate' ? styles.statusDuplicate : 
                styles.statusError
              ]}>
                <Ionicons 
                  name={
                    lastScanStatus === 'success' ? 'checkmark-circle' :
                    lastScanStatus === 'duplicate' ? 'alert-circle' : 'close-circle'
                  } 
                  size={18} 
                  color={
                    lastScanStatus === 'success' ? '#155724' :
                    lastScanStatus === 'duplicate' ? '#856404' : '#721c24'
                  } 
                />
                <Text style={[
                  styles.statusText,
                  lastScanStatus === 'duplicate' && { color: '#856404' }
                ]}>
                  {lastScanStatus === 'success' ? ' Scan recorded successfully' : 
                   lastScanStatus === 'duplicate' ? ' Employee already scanned recently' : 
                   ' Failed to send scan'}
                </Text>
              </View>
            )}
            
            <View style={styles.buttonRow}>
              {lastScanStatus === 'error' && (
                <TouchableOpacity
                  style={[styles.button, styles.retryButton]}
                  onPress={retrySend}
                  disabled={isSending}
                >
                  <Ionicons name="refresh" size={20} color="white" />
                  <Text style={styles.buttonText}> Retry</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={[styles.button, styles.scanAgainButton]}
                onPress={resetScanner}
                disabled={isSending}
              >
                {isSending ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Ionicons name="scan-outline" size={20} color="white" />
                    <Text style={styles.buttonText}> Scan Again</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.flipCameraButton}
              onPress={toggleCameraFacing}
            >
              <Ionicons name="camera-reverse-outline" size={20} color="#007AFF" />
              <Text style={styles.flipCameraText}>Flip Camera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.readyToScanContainer}>
            <View style={styles.statusIndicator}>
              <Ionicons name="scan-outline" size={24} color="#007AFF" />
              <Text style={styles.readyText}>Ready to Scan</Text>
              <Text style={styles.platformBadge}>
                ({Platform.OS.toUpperCase()})
              </Text>
            </View>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.flipButton]}
                onPress={toggleCameraFacing}
              >
                <Ionicons name="camera-reverse-outline" size={20} color="white" />
                <Text style={styles.buttonText}> Flip Camera</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.manualEntryButton]}
                onPress={navigateToManualEntry}
              >
                <Ionicons name="keypad-outline" size={20} color="white" />
                <Text style={styles.buttonText}> Manual Entry</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.infoContainer}>
              <Text style={styles.validationNote}>
                Only 5-digit employee IDs accepted (00000-99999)
              </Text>
              <Text style={styles.deviceInfo}>
                {API_CONFIG.IS_DEVELOPMENT 
                  ? `Dev Mode: ${getApiUrl().replace('http://', '')} • ${Platform.OS}`
                  : `Production • ${Platform.OS}`}
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  permissionText: {
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 20,
    color: '#333',
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    height: SCREEN_WIDTH * 0.6, // Height remains proportional
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#007AFF',
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  instructionsContainer: {
    position: 'absolute',
    bottom: 100,
    alignItems: 'center',
    width: '100%',
  },
  instructionsText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 8,
  },
  instructionsSubText: {
    color: '#ddd',
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  confirmingContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,122,255,0.9)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  confirmingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  confirmingSubText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  controlsOverlay: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  controlButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    minWidth: 80,
  },
  controlButtonText: {
    color: 'white',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  controlsContainer: {
    backgroundColor: 'white',
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  scanResultContainer: {
    alignItems: 'center',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#333',
  },
  resultCard: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 16,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  resultLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  resultData: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 4,
  },
  resultDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: '#666',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
    width: '100%',
    justifyContent: 'center',
  },
  statusSuccess: {
    backgroundColor: '#d4edda',
    borderWidth: 1,
    borderColor: '#c3e6cb',
  },
  statusDuplicate: {
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  statusError: {
    backgroundColor: '#f8d7da',
    borderWidth: 1,
    borderColor: '#f5c6cb',
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  readyToScanContainer: {
    alignItems: 'center',
  },
  readyText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#007AFF',
    marginLeft: 8,
  },
  platformBadge: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    marginBottom: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scanAgainButton: {
    backgroundColor: '#34C759',
  },
  retryButton: {
    backgroundColor: '#FF9500',
  },
  flipButton: {
    backgroundColor: '#007AFF',
  },
  manualEntryButton: {
    backgroundColor: '#5856D6',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  flipCameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    marginTop: 8,
  },
  flipCameraText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  validationNote: {
    fontSize: 13,
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: 4,
    fontWeight: '500',
  },
  deviceInfo: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'monospace',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
});