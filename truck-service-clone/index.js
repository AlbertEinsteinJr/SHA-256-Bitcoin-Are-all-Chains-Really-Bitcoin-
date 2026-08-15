// Entry point. registerRootComponent wires src/App.tsx to the native AppRegistry
// on both platforms and calls SplashScreen.preventAutoHideAsync internally.
import { registerRootComponent } from 'expo';
import App from './src/App';

registerRootComponent(App);
