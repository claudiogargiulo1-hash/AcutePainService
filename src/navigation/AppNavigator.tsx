// src/navigation/AppNavigator.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth, AuthContext, useAuthProvider } from '../hooks/useAuth';
import { Colors } from '../utils/theme';
import { registerForPushNotifications, setupNotificationHandlers } from '../services/pushNotifications';

// Screens
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import PatientsScreen from '../screens/PatientsScreen';
import PatientDetailScreen from '../screens/PatientDetailScreen';
import AddPatientScreen from '../screens/AddPatientScreen';
import NRSEntryScreen from '../screens/NRSEntryScreen';
import AddInterventionScreen from '../screens/AddInterventionScreen';
import ExportScreen from '../screens/ExportScreen';
import StatsScreen from '../screens/StatsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import OpioidScreen from '../screens/OpioidScreen';
import UsersScreen from '../screens/UsersScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CPSPScreen from '../screens/CPSPScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import RegisterScreen from '../screens/RegisterScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// TenantContext: allows any screen to clear the tenant and return to OnboardingScreen
export const TenantContext = React.createContext<{ clearTenant: () => void }>({ clearTenant: () => {} });
export const useTenant = () => React.useContext(TenantContext);

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textLight,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: Colors.border,
          paddingBottom: 8,
          paddingTop: 6,
          height: 64,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color }) => {
          const icons: Record<string, string> = {
            Dashboard: '🏠',
            Patients: '👥',
            Notifications: '🔔',
            Profile: '👤',
          };
          return (
            <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>
              {icons[route.name] || '•'}
            </Text>
          );
        },
      })}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="Patients" component={PatientsScreen} options={{ title: 'Pazienti' }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifiche' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profilo' }} />
    </Tab.Navigator>
  );
}

function AppStack({ navigationRef }: { navigationRef: React.RefObject<NavigationContainerRef<any>> }) {
  const { user, loading, profile } = useAuth();
  const [tenantCode, setTenantCode] = React.useState<string | null>(null);
  const [tenantChecked, setTenantChecked] = React.useState(false);

  React.useEffect(() => {
    AsyncStorage.getItem('tenant_code').then(code => {
      setTenantCode(code);
      setTenantChecked(true);
    });
  }, []);

  // Register push token and set up handlers once user logs in
  React.useEffect(() => {
    if (!user || !profile?.id) return;
    registerForPushNotifications(profile.id);
    const cleanup = setupNotificationHandlers(navigationRef);
    return cleanup;
  }, [user, profile?.id]);

  const clearTenant = React.useCallback(() => setTenantCode(null), []);

  if (loading || !tenantChecked) return (
    <View style={styles.splash}>
      <Text style={styles.splashIcon}>🩺</Text>
      <Text style={styles.splashTitle}>APS Manager</Text>
    </View>
  );

  if (!tenantCode) return (
    <OnboardingScreen onComplete={(code) => setTenantCode(code)} />
  );

  return (
    <TenantContext.Provider value={{ clearTenant }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="PatientDetail" component={PatientDetailScreen} />
            <Stack.Screen name="AddPatient" component={AddPatientScreen} />
            <Stack.Screen name="NRSEntry" component={NRSEntryScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="AddIntervention" component={AddInterventionScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Export" component={ExportScreen} />
            <Stack.Screen name="Stats" component={StatsScreen} />
            <Stack.Screen name="Opioid" component={OpioidScreen} />
            <Stack.Screen name="Users" component={UsersScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="CPSP" component={CPSPScreen} />
          </>
        )}
      </Stack.Navigator>
    </TenantContext.Provider>
  );
}

export default function AppNavigator() {
  const auth = useAuthProvider();
  const navigationRef = React.useRef<NavigationContainerRef<any>>(null);
  return (
    <AuthContext.Provider value={auth}>
      <NavigationContainer ref={navigationRef}>
        <AppStack navigationRef={navigationRef} />
      </NavigationContainer>
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary },
  splashIcon: { fontSize: 60, marginBottom: 12 },
  splashTitle: { fontSize: 28, fontWeight: '700', color: '#fff', letterSpacing: 1 },
});
