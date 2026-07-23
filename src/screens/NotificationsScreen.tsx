// src/screens/NotificationsScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { Colors, Spacing, Radius, Shadow } from '../utils/theme';
import { Notification } from '../types/database';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { it, enUS } from 'date-fns/locale';

export default function NotificationsScreen({ navigation }: any) {
  const { t, i18n } = useTranslation();
  const { profile, refreshSession } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    refreshSession?.();
    const { data } = await supabase
      .from('notifications')
      .select('*, patients(first_name, last_name)')
      .eq('recipient_id', profile?.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setNotifications(data || []);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchNotifications(); }, []));

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id);
    setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
  };

  const markAllRead = async () => {
    await supabase.from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('recipient_id', profile?.id)
      .eq('is_read', false);
    setNotifications(n => n.map(x => ({ ...x, is_read: true })));
  };

  const deleteNotification = (id: string) => {
    Alert.alert('Elimina notifica', 'Eliminare questa notifica?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        await supabase.from('notifications').delete().eq('id', id);
        setNotifications(n => n.filter(x => x.id !== id));
      }},
    ]);
  };

  const deleteAll = () => {
    Alert.alert('Elimina tutte', 'Eliminare tutte le notifiche?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        await supabase.from('notifications').delete().eq('recipient_id', profile?.id);
        setNotifications([]);
      }},
    ]);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const isIt = i18n.language === 'it';

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return Colors.red;
      case 'high': return Colors.yellow;
      default: return Colors.primary;
    }
  };

  const getPriorityIcon = (type: string) => {
    switch (type) {
      case 'nrs_alert': return '🔴';
      case 'missing_measurement': return '⚠️';
      default: return '🔔';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('notifications')}</Text>
          {unreadCount > 0 && <Text style={styles.unread}>{unreadCount} non lette</Text>}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
              <Text style={styles.markAllText}>{t('mark_all_read')}</Text>
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity style={styles.deleteAllBtn} onPress={deleteAll}>
              <Text style={styles.deleteAllText}>🗑 Elimina tutte</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={n => n.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyText}>{t('no_notifications')}</Text>
            </View>
          }
          renderItem={({ item: n }) => (
            <TouchableOpacity
              style={[styles.card, !n.is_read && styles.cardUnread]}
              onPress={() => {
                if (!n.is_read) markRead(n.id);
                if (n.patient_id) navigation.navigate('PatientDetail', { patientId: n.patient_id });
              }}>
              <View style={[styles.iconContainer, { backgroundColor: getPriorityColor(n.priority) + '20' }]}>
                <Text style={styles.icon}>{getPriorityIcon(n.type)}</Text>
              </View>
              <View style={styles.content}>
                <Text style={[styles.notifTitle, !n.is_read && styles.notifTitleBold]}>
                  {isIt ? n.title : n.title_en}
                </Text>
                <Text style={styles.notifBody} numberOfLines={2}>
                  {isIt ? n.body : n.body_en}
                </Text>
                <Text style={styles.notifTime}>
                  {formatDistanceToNow(parseISO(n.created_at), {
                    addSuffix: true,
                    locale: isIt ? it : enUS,
                  })}
                </Text>
              </View>
              {!n.is_read && <View style={[styles.unreadDot, { backgroundColor: getPriorityColor(n.priority) }]} />}
              <TouchableOpacity onPress={() => deleteNotification(n.id)} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.deleteBtnText}>🗑</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text },
  unread: { fontSize: 12, color: Colors.primary, marginTop: 2 },
  markAllBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.primary },
  markAllText: { color: Colors.primary, fontSize: 12, fontWeight: '600' },
  list: { padding: Spacing.md, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 16 },
  card: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.md, marginBottom: Spacing.sm, padding: Spacing.md, ...Shadow.sm, alignItems: 'flex-start', gap: Spacing.sm },
  cardUnread: { backgroundColor: Colors.primaryLight, borderLeftWidth: 3, borderLeftColor: Colors.primary },
  iconContainer: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  icon: { fontSize: 20 },
  content: { flex: 1 },
  notifTitle: { fontSize: 14, color: Colors.text, marginBottom: 3 },
  notifTitleBold: { fontWeight: '700' },
  notifBody: { fontSize: 13, color: Colors.textMuted, marginBottom: 4, lineHeight: 18 },
  notifTime: { fontSize: 11, color: Colors.textLight },
  unreadDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0, marginTop: 4 },
  deleteBtn: { padding: 4, flexShrink: 0 },
  deleteBtnText: { fontSize: 16 },
  deleteAllBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radius.sm, borderWidth: 1, borderColor: '#DC2626' },
  deleteAllText: { color: '#DC2626', fontSize: 12, fontWeight: '600' },
});
