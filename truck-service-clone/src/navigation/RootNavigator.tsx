import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';

import type { RootStackParamList } from './types';
import { useAuthStore } from '@store/authStore';
import { AuthStack } from './AuthStack';
import { AppTabs } from './AppTabs';
import FeedbackScreen from '@screens/feedback/FeedbackScreen';

const Root = createNativeStackNavigator<RootStackParamList>();

/**
 * Top-level switch. While `status === 'loading'` the native splash stays up
 * (session restore from SecureStore is in flight). Then we branch to the auth
 * stack or the tab app. Feedback is a modal available from either side.
 */
export function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  const restore = useAuthStore((s) => s.restore);

  useEffect(() => {
    restore();
  }, [restore]);

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => undefined);
  }, [status]);

  if (status === 'loading') return null;

  return (
    <Root.Navigator screenOptions={{ headerShown: false }}>
      {status === 'signedIn' ? (
        <Root.Screen name="App" component={AppTabs} />
      ) : (
        <Root.Screen name="Auth" component={AuthStack} />
      )}
      <Root.Screen
        name="Feedback"
        component={FeedbackScreen}
        options={{ presentation: 'modal', headerShown: true, title: 'Send feedback' }}
      />
    </Root.Navigator>
  );
}
