import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { AppTabsParamList } from './types';
import { SearchStack } from './SearchStack';
import { RepairsStack } from './RepairsStack';
import MapScreen from '@screens/map/MapScreen';
import SavedScreen from '@screens/saved/SavedScreen';
import AccountScreen from '@screens/account/AccountScreen';
import { useTheme } from '@theme/index';

const Tabs = createBottomTabNavigator<AppTabsParamList>();

/** The five primary destinations. Nested stacks (Search, Repairs) keep their own
 *  back history per tab. Icon strings map to a vector-icon set at render time. */
export function AppTabs() {
  const { colors } = useTheme();
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
      }}
    >
      <Tabs.Screen name="SearchTab" component={SearchStack} options={{ title: 'Search' }} />
      <Tabs.Screen name="MapTab" component={MapScreen} options={{ title: 'Map' }} />
      <Tabs.Screen name="SavedTab" component={SavedScreen} options={{ title: 'Saved' }} />
      <Tabs.Screen name="RepairsTab" component={RepairsStack} options={{ title: 'Repairs' }} />
      <Tabs.Screen name="AccountTab" component={AccountScreen} options={{ title: 'Account' }} />
    </Tabs.Navigator>
  );
}
