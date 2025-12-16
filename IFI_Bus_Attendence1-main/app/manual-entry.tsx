import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';

const API_URL = 'http://10.207.85.76:5000/api/scan';

export default function ManualEntryScreen() {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitEntry = async () => {
    const id = employeeId.trim();
    if (!id) {
      Alert.alert('Error', 'Please enter Employee ID');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: id,
          scanDateTime: new Date().toISOString(),
          scanType: 'manual',
          deviceInfo: 'Mobile Manual Entry'
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        Alert.alert('Success', 'Entry recorded!', [
          { text: 'OK', onPress: () => {
            setEmployeeId('');
            router.back();
          }}
        ]);
      } else {
        // Check if it's a duplicate
        if (response.status === 409) {
          Alert.alert('Already Scanned', result.message);
        } else {
          Alert.alert('Error', result.message || 'Failed to save');
        }
      }
    } catch (error) {
      Alert.alert('Network Error', 'Cannot connect to server');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Manual Entry</Text>
      
      <TextInput
        style={styles.input}
        value={employeeId}
        onChangeText={setEmployeeId}
        placeholder="Enter Employee ID"
        editable={!isSubmitting}
      />
      
      <TouchableOpacity
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={submitEntry}
        disabled={isSubmitting}
      >
        <Text style={styles.buttonText}>
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Text style={styles.backButtonText}>Back to Scanner</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    padding: 15,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
});