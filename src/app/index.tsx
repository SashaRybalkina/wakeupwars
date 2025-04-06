import * as React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import 'expo-router/entry';

import { NavigationContainer } from '@react-navigation/native';

import Challenges from './pages/Challenges';
import Chall1 from './pages/Challenges/Chall1';
import Categories from './pages/Games/Categories';
import GameExpanded from './pages/Games/GameExpanded';
import Games from './pages/Games/Games';
import GroupScreen from './pages/Groups';
import GroupChall1 from './pages/Groups/GroupChall1';
import GroupChall2 from './pages/Groups/GroupChall2';
import GroupChall3 from './pages/Groups/GroupChall3';
import GroupChall4 from './pages/Groups/GroupChall4';
import GroupDetails from './pages/Groups/GroupDetails';
import LoginScreen from './pages/Login';
import InputOutput from './pages/mainPage';
import Messages from './pages/Messages';
import Profile from './pages/Profile';
import PersChall1 from './pages/Profile/PersChall1';
import PersChall2 from './pages/Profile/PersChall2';
import SignUpScreen from './pages/SignUp';
import StartScreen from './pages/StartScreen';
import SudokuScreen from './pages/SudokuScreen';

const Stack = createStackNavigator();

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Profile"
        screenOptions={{ animationEnabled: false }}
      >
        <Stack.Screen
          name="Categories"
          component={Categories}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Games"
          component={Games}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="GameExpanded"
          component={GameExpanded}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Challenges"
          component={Challenges}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Chall1"
          component={Chall1}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="GroupChall2"
          component={GroupChall2}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="GroupChall3"
          component={GroupChall3}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="GroupChall4"
          component={GroupChall4}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Sudoku"
          component={SudokuScreen}
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
          name="GroupDetails"
          component={GroupDetails}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="GroupChall1"
          component={GroupChall1}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Profile"
          component={Profile}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PersChall1"
          component={PersChall1}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PersChall2"
          component={PersChall2}
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
