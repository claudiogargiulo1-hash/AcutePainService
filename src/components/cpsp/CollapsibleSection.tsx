// src/components/cpsp/CollapsibleSection.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface CollapsibleSectionProps {
  title: string;
  color?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function CollapsibleSection({
  title,
  color = '#1565C0',
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={{ marginBottom: 8 }}>
      <TouchableOpacity
        onPress={() => setOpen(o => !o)}
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: color,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: open ? 10 : 10,
          borderBottomLeftRadius: open ? 0 : 10,
          borderBottomRightRadius: open ? 0 : 10,
        }}
        activeOpacity={0.8}
      >
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff', flex: 1 }}>{title}</Text>
        <Text style={{ fontSize: 16, color: '#fff', fontWeight: '700' }}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {open && (
        <View
          style={{
            backgroundColor: '#fff',
            borderWidth: 1.5,
            borderTopWidth: 0,
            borderColor: color,
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
            padding: 12,
          }}
        >
          {children}
        </View>
      )}
    </View>
  );
}
