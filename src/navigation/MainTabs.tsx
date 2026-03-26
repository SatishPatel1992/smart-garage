import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import DashboardScreen from '../screens/DashboardScreen';
import JobsStack from './JobsStack';
import BillingScreen from '../screens/billing/BillingScreen';
import MoreStack from './MoreStack';

export type MainTabParamList = {
  Dashboard: undefined;
  Jobs: undefined | { screen: 'JobDetail'; params: { jobId: string } };
  Billing: undefined;
  More: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
        },
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Jobs"
        component={JobsStack}
        options={{
          tabBarLabel: 'Jobs',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Billing"
        component={BillingScreen}
        options={{
          tabBarLabel: 'Billing',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreStack}
        options={{
          tabBarLabel: 'More',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
