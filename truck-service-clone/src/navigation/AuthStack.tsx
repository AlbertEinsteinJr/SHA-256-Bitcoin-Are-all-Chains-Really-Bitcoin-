import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';
import OnboardingScreen from '@screens/onboarding/OnboardingScreen';
import SignInScreen from '@screens/auth/SignInScreen';
import RegisterScreen from '@screens/auth/RegisterScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

/** Pre-auth flow. Search is usable without an account in the real app, but rating,
 *  rates, private locations, and repair tickets require sign-in — so those tabs
 *  route here when tapped while signed out. */
export function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}
