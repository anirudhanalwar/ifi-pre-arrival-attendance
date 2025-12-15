import { BarcodeScanningResult, CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router'; // Added useRouter
import * as ScreenOrientation from 'expo-screen-orientation';
import React, { useEffect, useRef, useState } from 'react'; // Added useRef
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_FRAME_SIZE = SCREEN_WIDTH * 0.7;

// API Configuration - YOU NEED TO UPDATE THESE VALUES
const API_CONFIG = {
  // For development (testing on same network as your computer)
  DEV_API_URL: 'http://192.168.0.107:5000/api/scan',
  
  // For production (when deployed to a server)
  PROD_API_URL: 'https://192.168.2.4/api/scan',
  
  // Set to true when testing on physical device with local backend
  // Set to false when using production backend
  IS_DEVELOPMENT: true,
  
  // Optional: Add API key for security (if your backend requires it)
  API_KEY: 'your-api-key-here', // Optional - only if backend needs authentication
};

// Helper function to get API URL based on environment
const getApiUrl = () => {
  return API_CONFIG.IS_DEVELOPMENT ? API_CONFIG.DEV_API_URL : API_CONFIG.PROD_API_URL;
};

export default function BarcodeScannerScreen() {
  const router = useRouter(); // Added router
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scannedData, setScannedData] = useState<string>('');
  const [scanTime, setScanTime] = useState<string>('');
  const [facing, setFacing] = useState<CameraType>('back');
  const [isActive, setIsActive] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [lastScanStatus, setLastScanStatus] = useState<'success' | 'error' | null>(null);
  
  // Ref to track if alert is showing to prevent duplicate scans
  const alertIsShowing = useRef(false);

  // Lock screen orientation to portrait
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    
    return () => {
      ScreenOrientation.unlockAsync();
    };
  }, []);

  // Handle screen focus to resume camera
  useFocusEffect(
    React.useCallback(() => {
      setIsActive(true);
      alertIsShowing.current = false;
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
      
      // Prepare headers with proper typing
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      // Add API key header if configured and not using default value
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
          deviceInfo: 'Expo-Mobile-Scanner',
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('Scan sent successfully:', result);
        setLastScanStatus('success');
        return { success: true, message: result.message || 'Scan recorded successfully' };
      } else {
        console.error('Server error:', result);
        setLastScanStatus('error');
        return { 
          success: false, 
          message: result.message || `Server error: ${response.status}` 
        };
      }
    } catch (error: any) {
      console.error('Network error:', error);
      setLastScanStatus('error');
      
      // Provide user-friendly error messages
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
    // Prevent multiple scans while alert is showing or sending
    if (scanned || isSending || alertIsShowing.current) {
      return;
    }
    
    setScanned(true);
    setScannedData(data);
    
    // Get current date/time
    const now = new Date();
    const formattedTime = now.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const isoTime = now.toISOString(); // For database
    
    setScanTime(formattedTime);
    
    // Mark that alert is showing
    alertIsShowing.current = true;
    
    // Send data to server in background
    sendScanToServer(data, isoTime, type).then(result => {
      // Auto-dismiss the scanner and show success in UI instead of alert
      if (result.success) {
        // Auto reset after 2 seconds for success
        setTimeout(() => {
          alertIsShowing.current = false;
          resetScanner();
        }, 2000);
      } else {
        // For errors, show brief alert then auto-dismiss
        setTimeout(() => {
          alertIsShowing.current = false;
          // Don't auto-reset on error, let user decide
        }, 3000);
      }
    });
  };

  const retrySend = async (employeeId: string, scanDateTime: string, scanType: string) => {
    const result = await sendScanToServer(employeeId, scanDateTime, scanType);
    
    if (result.success) {
      // Auto reset after successful retry
      setTimeout(() => {
        resetScanner();
      }, 1500);
    }
  };

  const resetScanner = () => {
    setScanned(false);
    setScannedData('');
    setScanTime('');
    setLastScanStatus(null);
    alertIsShowing.current = false;
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const navigateToManualEntry = () => {
    router.push('/manual-entry');
  };

  // Get computer IP for development (you need to fill this in)
  const getComputerIP = () => {
    // You need to find your computer's IP address manually
    // Run `ipconfig` in Windows CMD and look for "IPv4 Address"
    return '192.168.0.107'; // REPLACE WITH YOUR ACTUAL IP
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
        onBarcodeScanned={scanned || isSending ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: [
            'qr',
            'pdf417',
            'code128',
            'code39',
            'code93',
            'codabar',
            'ean13',
            'ean8',
            'itf14',
            'upc_a',
            'upc_e',
          ],
        }}
      >
        {/* Scan Frame Overlay */}
        <View style={styles.overlay}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          
          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsText}>
              Position ID card barcode within the frame
            </Text>
          </View>

          {/* Manual Entry Button Overlay */}
          <TouchableOpacity
            style={styles.manualEntryButtonOverlay}
            onPress={navigateToManualEntry}
          >
            <Text style={styles.manualEntryButtonText}>Manual Entry</Text>
          </TouchableOpacity>

          {/* Loading indicator when sending data */}
          {isSending && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Sending to server...</Text>
            </View>
          )}
        </View>
      </CameraView>

      {/* Controls Panel */}
      <View style={styles.controlsContainer}>
        {scanned ? (
          <View style={styles.scanResultContainer}>
            <Text style={styles.resultTitle}>Scanned Data:</Text>
            <Text style={styles.resultData} numberOfLines={2}>
              {scannedData || 'No data'}
            </Text>
            <Text style={styles.resultTime}>Scan Time: {scanTime}</Text>
            
            {/* Status indicator */}
            {lastScanStatus && (
              <View style={[
                styles.statusIndicator,
                lastScanStatus === 'success' ? styles.statusSuccess : styles.statusError
              ]}>
                <Text style={styles.statusText}>
                  {lastScanStatus === 'success' ? '✓ Sent successfully' : '✗ Failed to send'}
                </Text>
              </View>
            )}
            
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.scanAgainButton]}
                onPress={resetScanner}
                disabled={isSending}
              >
                {isSending ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Scan Again</Text>
                )}
              </TouchableOpacity>
              
              {lastScanStatus === 'error' && (
                <TouchableOpacity
                  style={[styles.button, styles.retryButton]}
                  onPress={() => retrySend(scannedData, new Date().toISOString(), 'retry')}
                  disabled={isSending}
                >
                  <Text style={styles.buttonText}>Retry</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={[styles.button, styles.flipButton]}
                onPress={toggleCameraFacing}
                disabled={isSending}
              >
                <Text style={styles.buttonText}>Flip Camera</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.manualEntryLink}
              onPress={navigateToManualEntry}
            >
              <Text style={styles.manualEntryLinkText}>Or enter manually →</Text>
            </TouchableOpacity>
            
            <Text style={styles.noteText}>
              {API_CONFIG.IS_DEVELOPMENT 
                ? 'Development Mode: Sending to ' + getApiUrl()
                : 'Data is being sent to your SQL Server database.'}
            </Text>
          </View>
        ) : (
          <View style={styles.readyToScanContainer}>
            <Text style={styles.readyText}>Ready to Scan</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.flipButton]}
                onPress={toggleCameraFacing}
              >
                <Text style={styles.buttonText}>Flip Camera</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.manualEntryButton]}
                onPress={navigateToManualEntry}
              >
                <Text style={styles.buttonText}>Manual Entry</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.deviceInfo}>
              {API_CONFIG.IS_DEVELOPMENT 
                ? `Dev Mode: ${getApiUrl().replace('http://', '')}`
                : 'Production Mode'}
            </Text>
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
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: SCAN_FRAME_SIZE,
    height: SCAN_FRAME_SIZE * 0.6,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
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
  instructionsContainer: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
  },
  instructionsText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  manualEntryButtonOverlay: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  manualEntryButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 10,
    fontSize: 16,
  },
  controlsContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  scanResultContainer: {
    alignItems: 'center',
  },
  readyToScanContainer: {
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  resultData: {
    fontSize: 16,
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    textAlign: 'center',
    width: '100%',
    color: '#007AFF',
    fontWeight: '500',
  },
  resultTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  statusIndicator: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    marginBottom: 15,
  },
  statusSuccess: {
    backgroundColor: '#d4edda',
  },
  statusError: {
    backgroundColor: '#f8d7da',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  readyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    marginBottom: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
  manualEntryLink: {
    marginTop: 10,
    marginBottom: 15,
  },
  manualEntryLinkText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  noteText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
    fontStyle: 'italic',
  },
  deviceInfo: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    fontFamily: 'monospace',
  },
});