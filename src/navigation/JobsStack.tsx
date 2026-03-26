import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import JobListScreen from '../screens/jobs/JobListScreen';
import JobDetailScreen from '../screens/jobs/JobDetailScreen';
import CreateJobCardScreen from '../screens/jobs/CreateJobCardScreen';

export type JobsStackParamList = {
  JobList: undefined;
  JobDetail: { jobId: string };
  CreateJobCard: undefined;
};

const Stack = createNativeStackNavigator<JobsStackParamList>();

export default function JobsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#1e293b',
        headerTitleStyle: { fontWeight: '600', fontSize: 18 },
      }}
    >
      <Stack.Screen
        name="JobList"
        component={JobListScreen}
        options={{ title: 'Job Cards' }}
      />
      <Stack.Screen
        name="JobDetail"
        component={JobDetailScreen}
        options={{ title: 'Job Detail' }}
      />
      <Stack.Screen
        name="CreateJobCard"
        component={CreateJobCardScreen}
        options={{ title: 'New Job Card' }}
      />
    </Stack.Navigator>
  );
}
