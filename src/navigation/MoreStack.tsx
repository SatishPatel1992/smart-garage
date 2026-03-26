import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MoreScreen from '../screens/MoreScreen';
import EstimatesScreen from '../screens/estimates/EstimatesScreen';
import InventoryScreen from '../screens/inventory/InventoryScreen';
import PartsCatalogueScreen from '../screens/inventory/PartsCatalogueScreen';
import ServiceItemsScreen from '../screens/inventory/ServiceItemsScreen';
import PartFormScreen from '../screens/inventory/PartFormScreen';
import StockInOutScreen from '../screens/inventory/StockInOutScreen';
import LowStockAlertsScreen from '../screens/inventory/LowStockAlertsScreen';
import VendorsScreen from '../screens/inventory/VendorsScreen';
import VendorDetailScreen from '../screens/inventory/VendorDetailScreen';
import InventoryReportsScreen from '../screens/inventory/InventoryReportsScreen';
import PaymentsScreen from '../screens/payments/PaymentsScreen';
import ReportsScreen from '../screens/reports/ReportsScreen';
import CustomersScreen from '../screens/customers/CustomersScreen';
import CustomerProfileScreen from '../screens/customers/CustomerProfileScreen';
import VehicleHistoryScreen from '../screens/customers/VehicleHistoryScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import UsersScreen from '../screens/settings/UsersScreen';
import CreateUserScreen from '../screens/settings/CreateUserScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

export type MoreStackParamList = {
  MoreMenu: undefined;
  Profile: undefined;
  Settings: undefined;
  Users: undefined;
  CreateUser: undefined;
  Estimates: undefined;
  Inventory: undefined;
  PartsCatalogue: undefined;
  ServiceItems: undefined;
  PartForm: { partId?: string };
  StockInOut: undefined;
  LowStockAlerts: undefined;
  Vendors: undefined;
  VendorDetail: { vendorId: string };
  InventoryReports: undefined;
  Payments: undefined;
  Reports: undefined;
  Customers: undefined;
  CustomerProfile: { customerId: string };
  VehicleHistory: { vehicleId: string };
};

const Stack = createNativeStackNavigator<MoreStackParamList>();

export default function MoreStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#1e293b',
        headerTitleStyle: { fontWeight: '600', fontSize: 18 },
      }}
    >
      <Stack.Screen name="MoreMenu" component={MoreScreen} options={{ title: 'More' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="Users" component={UsersScreen} options={{ title: 'Users' }} />
      <Stack.Screen name="CreateUser" component={CreateUserScreen} options={{ title: 'Create user' }} />
      <Stack.Screen name="Estimates" component={EstimatesScreen} options={{ title: 'Estimates' }} />
      <Stack.Screen name="Inventory" component={InventoryScreen} options={{ title: 'Inventory' }} />
      <Stack.Screen name="PartsCatalogue" component={PartsCatalogueScreen} options={{ title: 'Parts catalogue' }} />
      <Stack.Screen name="ServiceItems" component={ServiceItemsScreen} options={{ title: 'Parts & labour (estimates)' }} />
      <Stack.Screen name="PartForm" component={PartFormScreen} options={{ title: 'Part' }} />
      <Stack.Screen name="StockInOut" component={StockInOutScreen} options={{ title: 'Stock in/out' }} />
      <Stack.Screen name="LowStockAlerts" component={LowStockAlertsScreen} options={{ title: 'Low-stock alerts' }} />
      <Stack.Screen name="Vendors" component={VendorsScreen} options={{ title: 'Vendors' }} />
      <Stack.Screen name="VendorDetail" component={VendorDetailScreen} options={{ title: 'Vendor' }} />
      <Stack.Screen name="InventoryReports" component={InventoryReportsScreen} options={{ title: 'Inventory reports' }} />
      <Stack.Screen name="Payments" component={PaymentsScreen} options={{ title: 'Payments' }} />
      <Stack.Screen name="Reports" component={ReportsScreen} options={{ title: 'Reports' }} />
      <Stack.Screen name="Customers" component={CustomersScreen} options={{ title: 'Customers' }} />
      <Stack.Screen name="CustomerProfile" component={CustomerProfileScreen} options={{ title: 'Customer profile' }} />
      <Stack.Screen name="VehicleHistory" component={VehicleHistoryScreen} options={{ title: 'Vehicle history' }} />
    </Stack.Navigator>
  );
}
