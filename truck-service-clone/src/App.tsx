import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as Sentry from '@sentry/react-native';

import { queryClient } from '@store/queryClient';
import { RootNavigator } from '@/navigation/RootNavigator';
import { crashReporting } from '@services/crashReporting';
import { analytics } from '@services/analytics';

/**
 * Provider tree — order matters:
 *   GestureHandlerRootView (native gesture root)
 *     -> SafeAreaProvider (notch insets)
 *       -> QueryClientProvider (server-state cache)
 *         -> NavigationContainer (routing + deep links)
 *           -> RootNavigator (auth vs app switch)
 * Sentry.wrap installs the error boundary + performance tracing around the whole app.
 */
function App() {
  useEffect(() => {
    crashReporting.init();
    analytics.logAppOpen();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer
            onStateChange={(state) => analytics.logScreenFromNavState(state)}
          >
            <StatusBar style="auto" />
            <RootNavigator />
          </NavigationContainer>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(App);
