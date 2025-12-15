import { useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

// Use the same API configuration from scanner
const API_CONFIG = {
  DEV_API_URL: 'http://192.168.0.107:3000/api/scan',
  PROD_API_URL: 'https://192.168.2.4/api/scan',
  IS_DEVELOPMENT: false,
  API_KEY: 'your-api-key-here',
};

const getApiUrl = () => {
  return API_CONFIG.IS_DEVELOPMENT ? API_CONFIG.DEV_API_URL : API_CONFIG.PROD_API_URL;
};

export default function ManualEntryScreen() {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lock screen orientation to portrait
  React.useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    
    return () => {
      ScreenOrientation.unlockAsync();
    };
  }, []);

  const sendManualEntryToServer = async (id: string) => {
    setIsSubmitting(true);
    
    try {
      const apiUrl = getApiUrl();
      const now = new Date();
      const isoTime = now.toISOString();
      const formattedTime = now.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      // Prepare headers
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
          employeeId: id,
          scanDateTime: isoTime,
          scanType: 'manual',
          deviceInfo: 'Expo-Mobile-Manual-Entry',
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        Alert.alert(
          'Success!',
          `Manual entry recorded successfully!\n\nEmployee: ${id}\nTime: ${formattedTime}`,
          [
            { 
              text: 'OK', 
              onPress: () => {
                setEmployeeId('');
                router.back();
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'Error',
          `Failed to record entry: ${result.message || `Server error: ${response.status}`}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Network Error',
        'Cannot connect to server. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => {
    const trimmedId = employeeId.trim();
    
    if (!trimmedId) {
      Alert.alert('Error', 'Please enter an Employee ID');
      return;
    }
    
    Alert.alert(
      'Confirm Entry',
      `Employee ID: ${trimmedId}\n\nIs this correct?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Submit', 
          onPress: () => sendManualEntryToServer(trimmedId),
          style: 'default'
        }
      ]
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Manual Entry</Text>
          <Text style={styles.subtitle}>Enter employee ID manually</Text>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Employee ID</Text>
          <TextInput
            style={styles.input}
            value={employeeId}
            onChangeText={setEmployeeId}
            placeholder="Enter employee ID or code"
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            editable={!isSubmitting}
          />
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.submitButton, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.buttonText}>
              {isSubmitting ? 'Submitting...' : 'Submit Entry'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => router.back()}
            disabled={isSubmitting}
          >
            <Text style={[styles.buttonText, styles.cancelButtonText]}>Back to Scanner</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.noteContainer}>
          <Text style={styles.noteTitle}>Note:</Text>
          <Text style={styles.noteText}>
            • Make sure the employee ID is correct before submitting
          </Text>
          <Text style={styles.noteText}>
            • This entry will be recorded in the same database as scanned entries
          </Text>
          <Text style={styles.noteText}>
            • The timestamp will be recorded automatically
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 40,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButton: {
    backgroundColor: '#007AFF',
  },
  cancelButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  cancelButtonText: {
    color: '#333',
  },
  noteContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  noteText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    lineHeight: 20,
  },
});