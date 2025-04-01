import * as React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import 'expo-router/entry';

import { NavigationContainer } from '@react-navigation/native';

import Challenges from './pages/Challenges';
import GroupScreen from './pages/Groups';
import LoginScreen from './pages/Login';
import InputOutput from './pages/mainPage';
import Messages from './pages/Messages';
import Profile from './pages/Profile';
import SignUpScreen from './pages/SignUp';
import StartScreen from './pages/StartScreen';
import SudokuScreen from './pages/SudokuScreen';

const Stack = createStackNavigator();

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Challenges"
        screenOptions={{ animationEnabled: false }}
      >
        <Stack.Screen
          name="Sudoku"
          component={SudokuScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Challenges"
          component={Challenges}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Messages"
          component={Messages}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Groups"
          component={GroupScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Profile"
          component={Profile}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Start"
          component={StartScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SignUp"
          component={SignUpScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="mainPage"
          component={InputOutput}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
