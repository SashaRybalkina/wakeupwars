import 'react-native-gesture-handler';
import React from 'react';
import { registerRootComponent } from 'expo';

import { AppProvider } from './src/providers/AppProvider';
import { UserProvider } from './src/app/context/UserContext';
import App from './src/app';

function Root() {
  return (
    <AppProvider onInitialized={() => {}}>
      <UserProvider>
        <App />
      </UserProvider>
    </AppProvider>
  );
}

registerRootComponent(Root);
