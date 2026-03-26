import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

type Props = { navigation: LoginScreenNavigationProp };

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert('Validation', 'Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      Alert.alert('Validation', 'Please enter a valid email address.');
      return;
    }
    if (!password) {
      Alert.alert('Validation', 'Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      await login(trimmedEmail, password);
      navigation.replace('Main');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logo}>🔧</Text>
          <Text style={styles.title}>Smart Garage</Text>
          <Text style={styles.subtitle}>
            Job cards, estimates, invoices & billing
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@garage.com"
            placeholderTextColor="#64748b"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#64748b"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            editable={!isLoading}
          />
          <TouchableOpacity
            style={styles.togglePassword}
            onPress={() => setShowPassword((prev) => !prev)}
            disabled={isLoading}
          >
            <Text style={styles.togglePasswordText}>
              {showPassword ? 'Hide' : 'Show'} password
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          Use this app for job cards, estimates, invoices and vehicle delivery.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#f8fafc',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  togglePassword: {
    alignSelf: 'flex-end',
    marginTop: -12,
    marginBottom: 20,
  },
  togglePasswordText: {
    fontSize: 13,
    color: '#64748b',
  },
  button: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a',
  },
  footer: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 'auto',
  },
});
