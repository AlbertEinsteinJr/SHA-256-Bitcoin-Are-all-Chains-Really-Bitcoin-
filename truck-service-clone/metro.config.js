// Metro bundler config. Wraps the Expo default with the Sentry plugin so release
// builds upload a source map for symbolicated crash reports.
const { getDefaultConfig } = require('expo/metro-config');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getDefaultConfig(__dirname);
module.exports = getSentryExpoConfig(__dirname, config);
