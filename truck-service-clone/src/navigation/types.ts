import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Central param-list definitions. Every navigator and screen imports these so
 * navigation is fully type-checked end to end (no stringly-typed routes).
 */
export type SearchStackParamList = {
  SearchHome: undefined;
  Results: { serviceTypes?: string[]; title?: string };
  VendorDetail: { vendorId: string };
};

export type RepairsStackParamList = {
  RepairsList: undefined;
  StartRepair: { vendorId?: string } | undefined;
  RepairTicket: { ticketId: string };
};

export type AppTabsParamList = {
  SearchTab: NavigatorScreenParams<SearchStackParamList>;
  MapTab: undefined;
  SavedTab: undefined;
  RepairsTab: NavigatorScreenParams<RepairsStackParamList>;
  AccountTab: undefined;
};

export type AuthStackParamList = {
  Onboarding: undefined;
  SignIn: undefined;
  Register: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  App: NavigatorScreenParams<AppTabsParamList>;
  Feedback: undefined;
};
