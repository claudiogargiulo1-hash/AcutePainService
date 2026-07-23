// src/services/pushNotifications.ts
import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// ─── FOREGROUND HANDLER ───────────────────────────────────────────────────────
// Show notification as alert when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── REGISTER ────────────────────────────────────────────────────────────────

export async function registerForPushNotifications(profileId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  // Request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  // Get Expo push token
  let token: string;
  try {
    const result = await Notifications.getExpoPushTokenAsync({
      projectId: '39d907c6-bf0b-44ca-a628-7a2ef0ef55a9',
    });
    token = result.data;
  } catch {
    return;
  }

  const tenantCode = await AsyncStorage.getItem('tenant_code');

  // Upsert token in Supabase (one row per profile+device)
  await supabase.from('push_tokens').upsert(
    {
      profile_id: profileId,
      tenant_id: tenantCode,
      token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id,token' },
  );
}

// ─── NOTIFICATION HANDLERS ───────────────────────────────────────────────────

type NavigationRef = {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
};

export function setupNotificationHandlers(navigationRef: React.RefObject<NavigationRef>): () => void {
  // Foreground: show alert with title + body
  const foregroundSub = Notifications.addNotificationReceivedListener(notification => {
    const { title, body } = notification.request.content;
    if (title || body) {
      Alert.alert(title ?? 'APS Manager', body ?? '');
    }
  });

  // Tap on notification: navigate to the right screen
  const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data as Record<string, unknown> | undefined;
    if (!data || !navigationRef.current) return;

    const type = data.type as string | undefined;
    const patientId = data.patient_id as string | undefined;
    const patientName = data.patient_name as string | undefined;

    if (type === 'nrs_reminder' && patientId) {
      navigationRef.current.navigate('PatientDetail', { patientId });
    } else if (type === 'cpsp_followup' && patientId) {
      navigationRef.current.navigate('CPSP', { patientId, patientName: patientName ?? '' });
    }
  });

  // Return cleanup function
  return () => {
    foregroundSub.remove();
    responseSub.remove();
  };
}
