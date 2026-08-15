import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RepairsStackParamList } from './types';
import RepairsListScreen from '@screens/repairs/RepairsListScreen';
import StartRepairScreen from '@screens/repairs/StartRepairScreen';
import RepairTicketScreen from '@screens/repairs/RepairTicketScreen';

const Stack = createNativeStackNavigator<RepairsStackParamList>();

export function RepairsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="RepairsList" component={RepairsListScreen} options={{ title: 'Repairs' }} />
      <Stack.Screen name="StartRepair" component={StartRepairScreen} options={{ title: 'Start repair', presentation: 'modal' }} />
      <Stack.Screen name="RepairTicket" component={RepairTicketScreen} options={{ title: 'Repair ticket' }} />
    </Stack.Navigator>
  );
}
