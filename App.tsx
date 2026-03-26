import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SettingsProvider } from './src/context/SettingsContext';
import LoginScreen from './src/screens/LoginScreen';
import MainTabs from './src/navigation/MainTabs';
import type { RootStackParamList } from './src/navigation/types';

export type { RootStackParamList };

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  const { isAuthenticated } = useAuth();
  return (
    <Stack.Navigator
      key={isAuthenticated ? 'main' : 'login'}
      screenOptions={{ headerShown: false }}
      initialRouteName={isAuthenticated ? 'Main' : 'Login'}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Main" component={MainTabs} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SettingsProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <RootNavigator />
        </NavigationContainer>
        </SettingsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
