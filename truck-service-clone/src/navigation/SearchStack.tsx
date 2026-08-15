import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { SearchStackParamList } from './types';
import SearchHomeScreen from '@screens/search/SearchHomeScreen';
import ResultsScreen from '@screens/search/ResultsScreen';
import VendorDetailScreen from '@screens/search/VendorDetailScreen';

const Stack = createNativeStackNavigator<SearchStackParamList>();

export function SearchStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="SearchHome" component={SearchHomeScreen} options={{ title: 'Find service' }} />
      <Stack.Screen name="Results" component={ResultsScreen} options={{ title: 'Results' }} />
      <Stack.Screen name="VendorDetail" component={VendorDetailScreen} options={{ title: '' }} />
    </Stack.Navigator>
  );
}
