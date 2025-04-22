import * as React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import 'expo-router/entry';

import { NavigationContainer } from '@react-navigation/native';

import Challenges from './pages/Challenges';
import Chall1 from './pages/Challenges/Chall1';
import ChallDetails from './pages/Challenges/ChallDetails';
import ChallSchedule from './pages/Challenges/ChallSchedule';
import Categories from './pages/Games/Categories';
import GameExpanded from './pages/Games/GameExpanded';
import Games from './pages/Games/Games';
import GroupScreen from './pages/Groups';
import GroupChall1 from './pages/Groups/GroupChall1';
import GroupChall2 from './pages/Groups/GroupChall2';
import GroupChall3 from './pages/Groups/GroupChall3';
import GroupChall3Old from './pages/Groups/GroupChall3Old';
import GroupChall4Old from './pages/Groups/GroupChall4Old';
import GroupDetails from './pages/Groups/GroupDetails';
import LoginScreen from './pages/Login';
import InputOutput from './pages/mainPage';
import Messages from './pages/Messages';
import Profile from './pages/Profile';
import AcceptFInvite from './pages/Profile/AcceptFInvite';
import AcceptGInvite from './pages/Profile/AcceptGInvite';
import Friends1 from './pages/Profile/Friends1';
import Friends3 from './pages/Profile/Friends3';
import FriendsRequests from './pages/Profile/FriendRequest';
import FriendsSearch from './pages/Profile/FriendSearch';
import PersChall1 from './pages/Profile/PersChall1';
import PersChall2 from './pages/Profile/PersChall2';
import SignUpScreen from './pages/SignUp';
import StartScreen from './pages/StartScreen';
import SudokuScreen from './pages/SudokuScreen';
import CreateGroup from './pages/Groups/CreateGroup';

const Stack = createStackNavigator();

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Start"
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
          name="ChallDetails"
          component={ChallDetails}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ChallSchedule"
          component={ChallSchedule}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Sudoku"
          component={SudokuScreen}
          options={{ animationEnabled: false }}
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
          name="CreateGroup"
          component={CreateGroup}
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
          name="GroupChall3Old"
          component={GroupChall3Old}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="GroupChall4Old"
          component={GroupChall4Old}
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
          name="AcceptFInvite"
          component={AcceptFInvite}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AcceptGInvite"
          component={AcceptGInvite}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Friends1"
          component={Friends1}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Friends3"
          component={Friends3}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="FriendsRequests"
          component={FriendsRequests}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="FriendsSearch"
          component={FriendsSearch}
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
