import { Tabs } from 'expo-router';

import { TabIcon } from '@/components/tab-icon';
import { copy } from '@/lib/copy';
import { colors, fontSize } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontSize: fontSize.title, fontWeight: '700' },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: fontSize.caption, fontWeight: '700' },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: copy.stock,
          tabBarIcon: ({ color }) => <TabIcon name="stock" color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: copy.orders,
          tabBarIcon: ({ color }) => <TabIcon name="orders" color={color} />,
        }}
      />
      <Tabs.Screen
        name="intakes"
        options={{
          title: copy.supplierDeliveries,
          tabBarLabel: copy.intakeShort,
          tabBarIcon: ({ color }) => <TabIcon name="intake" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: copy.history,
          tabBarIcon: ({ color }) => <TabIcon name="history" color={color} />,
        }}
      />
      <Tabs.Screen
        name="charts"
        options={{
          href: null,
          title: copy.quantityOverTime,
        }}
      />
    </Tabs>
  );
}
