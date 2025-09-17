import * as React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';

import { Alarm } from './Alarm';

import Challenges from './pages/Challenges';
import Chall1 from './pages/Challenges/Chall1';
import ChallDetails from './pages/Challenges/ChallDetails';
import ChallSchedule from './pages/Challenges/ChallSchedule';
import CreatePublicChall1 from './pages/Challenges/CreatePublicChall1';
import CreatePublicChall2 from './pages/Challenges/CreatePublicChall2';
import LeaderboardDetails from './pages/Challenges/LeaderboardDetails'
import RewardSettleScreen from './pages/Challenges/RewardSettleScreen';
import Categories from './pages/Games/Categories';
import GameExpanded from './pages/Games/GameExpanded';
import Games from './pages/Games/Games';
import GroupScreen from './pages/Groups';
import GroupChall1 from './pages/Groups/GroupChall1';
import GroupChall2 from './pages/Groups/GroupChall2';
import GroupChallCollab from './pages/Groups/GroupChallCollab';
import EditAvailability from './pages/Groups/EditAvailability';
import GroupChall3 from './pages/Groups/GroupChall3';
import GroupChall3Old from './pages/Groups/GroupChall3Old';
import GroupChall4Old from './pages/Groups/GroupChall4Old';
import GroupDetails from './pages/Groups/GroupDetails';
import LoginScreen from './pages/Login';
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
import PatternGameScreen from './pages/PatternGame/PatternGameScreen';
import WordleScreen from './pages/WordGame/WordleScreen';

const Stack = createStackNavigator();
export const navigationRef = createNavigationContainerRef();

function App() {
  React.useEffect(() => {
    // const subscription = Notifications.addNotificationResponseReceivedListener(
    //   async (response) => {
    //     const { screen, params } = response.notification.request.content.data as {
    //       screen?: string;
    //       params?: Record<string, any>;
    //     };
  
    //     // stop any burst alarms when tapped
    //     await Alarm.stopAll();
  
    //     if (screen && navigationRef.isReady()) {
    //       navigationRef.navigate(screen as never, params as never);
    //     }
    //   }
    // );
  
    // return () => subscription.remove();
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="Login"
        //initialRouteName="PatternGame"
        screenOptions={{ animationEnabled: false, headerShown: false}}
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
          name="LeaderboardDetails"
          component={LeaderboardDetails}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Sudoku"
          component={SudokuScreen}
          options={{ animationEnabled: false }}
        />
        <Stack.Screen
          name="Wordle"
          component={WordleScreen}
          options={{ animationEnabled: false }}
        />
        <Stack.Screen
          name="PatternGame"
          component={PatternGameScreen}
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
          name="Rewards"
          component={RewardSettleScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;

//How to use alarm anywhere in the app
// import { Alarm } from './Alarm';
//Schedule for 1:30 PM, have it repeat for 20 seconds, and takes you to the sudoku game
Alarm.scheduleBurstNotification('Wordle', 16, 45, 20, {
  challengeId: 30,
  challName: 'Test Challenge',
  whichChall: 'wordle',
});
