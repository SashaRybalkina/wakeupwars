import * as React from 'react';
import { useState } from 'react';
import { Alert, NativeEventEmitter, NativeModules } from 'react-native';
import {
  createNavigationContainerRef,
  NavigationContainer,
} from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as Notifications from 'expo-notifications';

import 'expo-router/entry';

import { useUser } from './context/UserContext';

import Challenges from './pages/Challenges';
import Chall1 from './pages/Challenges/Chall1';
import ChallDetails from './pages/Challenges/ChallDetails';
import ChallSchedule from './pages/Challenges/ChallSchedule';
import CreatePublicChall1 from './pages/Challenges/CreatePublicChall1';
import CreatePublicChall2 from './pages/Challenges/CreatePublicChall2';
import LeaderboardDetails from './pages/Challenges/LeaderboardDetails';
import RewardSettleScreen from './pages/Challenges/RewardSettleScreen';
import VerifyAvailability from './pages/Challenges/VerifyAvailability';
import PublicChallSearch1 from './pages/Challenges/PublicChallSearch1';
import PublicChallSearch2 from './pages/Challenges/PublicChallSearch2';
import PublicChallenges from './pages/Challenges/PublicChallenges';
import Wordle from './pages/WordGame/Wordle';
import Categories from './pages/Games/Categories';
import SomeCategories from './pages/Games/SomeCategories';
import GameExpanded from './pages/Games/GameExpanded';
import Games from './pages/Games/Games';
import GroupScreen from './pages/Groups';
import CreateGroup from './pages/Groups/CreateGroup';
import EditAvailability from './pages/Groups/EditAvailability';
import GroupChall1 from './pages/Groups/GroupChall1';
import GroupChall2 from './pages/Groups/GroupChall2';
import GroupChall3 from './pages/Groups/GroupChall3';
import GroupChall3Old from './pages/Groups/GroupChall3Old';
import GroupChall4Old from './pages/Groups/GroupChall4Old';
import GroupChallCollab from './pages/Groups/GroupChallCollab';
import GroupDetails from './pages/Groups/GroupDetails';
import LoginScreen from './pages/Login';
import InputOutput from './pages/mainPage';
import Messages from './pages/Messages';
import PatternGameScreen from './pages/PatternGame/PatternGameScreen';
import Profile from './pages/Profile';
import AcceptFInvite from './pages/Profile/AcceptFInvite';
import AcceptGInvite from './pages/Profile/AcceptGInvite';
import FriendsRequests from './pages/Profile/FriendRequest';
import Friends1 from './pages/Profile/Friends1';
import Friends3 from './pages/Profile/Friends3';
import FriendsSearch from './pages/Profile/FriendSearch';
import PersChall1 from './pages/Profile/PersChall1';
import PersChall2 from './pages/Profile/PersChall2';
import SignUpScreen from './pages/SignUp';
import StartScreen from './pages/StartScreen';
import SudokuScreen from './pages/SudokuScreen';
import EditChallengeSharingFriends from './pages/Challenges/EditChallengeSharingFriends';
import CreateChallengeForFriend from './pages/Challenges/CreateChallengeForFriend';


const { AlarmModule } = NativeModules;
const { IntentModule } = NativeModules;

const Stack = createStackNavigator();
export const navigationRef = createNavigationContainerRef();
let pendingNavigation: { screen: string; params?: any } | null = null;

function navigate(screen: string, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(screen as never, params as never);
  } else {
    pendingNavigation = { screen, params };
  }
}

function flushPendingNavigation() {
  if (pendingNavigation && navigationRef.isReady()) {
    navigationRef.navigate(
      pendingNavigation.screen as never,
      pendingNavigation.params as never,
    );
    pendingNavigation = null;
  }
}

function App() {
  const { user } = useUser();

  React.useEffect(() => {
    let subscription: any;
    let notificationListener: any;

    // 1) cold-start intent
    IntentModule.getInitialIntent()
      .then((data: any) => {
        console.log('getInitialIntent =>', data);
        if (data?.screen) {
          if (!user) {
            navigate('Login', {
              redirectTo: data.screen,
              redirectParams: data,
            });
          } else {
            navigate(data.screen, data.params);
          }
        }
      })
      .catch((e: any) => {
        console.warn('getInitialIntent error', e);
      });

    // 2) warm-start intents: subscribe to native event emitter
    const emitter = new NativeEventEmitter(IntentModule);
    subscription = emitter.addListener('NewIntent', (data: any) => {
      console.log('NewIntent event =>', data);
      if (data?.screen) {
        if (!user) {
          navigate('Login', { redirectTo: data.screen, redirectParams: data });
        } else {
          navigate(data.screen, data.params);
        }
      }
    });

    // 3) notification tap handler (for foreground/background)
    notificationListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        if (data?.screen) {
          if (!user) {
            navigate('Login', {
              redirectTo: data.screen,
              redirectParams: data.params || {},
            });
          } else {
            navigate(data.screen, data.params || {});
          }
        }
      });

    return () => {
      if (subscription && subscription.remove) subscription.remove();
      else if (subscription) subscription.remove(); // defensive
      if (notificationListener) notificationListener.remove();
    };
  }, [user]);

  return (
    <NavigationContainer ref={navigationRef} onReady={flushPendingNavigation}>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{ animationEnabled: false, headerShown: false }}
      >
        <Stack.Screen
          name="Categories"
          component={Categories}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SomeCategories"
          component={SomeCategories}
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
          name="GroupChallCollab"
          component={GroupChallCollab}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EditAvailability"
          component={EditAvailability}
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
          name="CreatePublicChall1"
          component={CreatePublicChall1}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CreatePublicChall2"
          component={CreatePublicChall2}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="VerifyAvailability"
          component={VerifyAvailability}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PublicChallSearch1"
          component={PublicChallSearch1}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PublicChallSearch2"
          component={PublicChallSearch2}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PublicChallenges"
          component={PublicChallenges}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="LeaderboardDetails"
          component={LeaderboardDetails}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Wordle"
          component={Wordle}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="mainPage"
          component={InputOutput}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EditChallengeSharingFriends"
          component={EditChallengeSharingFriends}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CreateChallengeForFriend"
          component={CreateChallengeForFriend}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Rewards"
          component={RewardSettleScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EditChallengeSharingFriends"
          component={EditChallengeSharingFriends}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CreateChallengeForFriend"
          component={CreateChallengeForFriend}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
