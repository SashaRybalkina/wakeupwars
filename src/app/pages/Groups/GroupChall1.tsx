import React, { useEffect } from 'react';
import {
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { Button } from 'tamagui';

type Props = {
  navigation: NavigationProp<any>;
};

// got here from GroupDetails page, navigation.navigate('GroupChall1', { groupId: groupData?.id, groupMembers:groupData?.members })}
const GroupChall1: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { groupId, groupMembers } = route.params as {
    groupId: number;
    groupMembers: { id: number; name: string }[];
  };

  useEffect(() => {
    console.log("GroupChall1 Group Members:", groupMembers);
  }, []);

  const goToManual = (groupId: number, groupMembers: { id: number; name: string }[]) => {
    navigation.navigate('GroupChall2', { groupId, groupMembers });
  };

  const goToCollab = (groupId: number, groupMembers: { id: number; name: string }[]) => {
    navigation.navigate('GroupChallCollab', { groupId, groupMembers });
  };

  const goToMessages = () => {
    navigation.navigate('Messages');
  };

  const goToGroups = () => navigation.navigate('Groups');
  const goToChallenges = () => navigation.navigate('Challenges');
  const goToProfile = () => navigation.navigate('Profile');

  return (
    <ImageBackground
      source={require('../../images/cgpt4.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.backButtonContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={30} color="#FFF" />
        </TouchableOpacity>
      </View>
      <View style={styles.container}>
        <Text style={styles.title}>Set Up...</Text>
        <TouchableOpacity
          style={styles.navToChall}
          onPress={() => {
            console.log("Navigating to GroupChall2 with members:", groupMembers);
            goToManual(groupId, groupMembers);
          }}
        >
          <Text style={styles.navToChallText}>Manually</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navToChall}
          onPress={() => {
            console.log("Navigating to GroupChallCollab with members:", groupMembers);
            goToCollab(groupId, groupMembers);
          }}
          >
          <Text style={styles.navToChallText}>Collaboratively</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navButton} onPress={goToChallenges}>
          <Ionicons name="star" size={28} color="#FFF" />
          <Text style={styles.navText}>Challenges</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={goToGroups}>
          <Ionicons name="people-outline" size={28} color="#FFD700" />
          <Text style={styles.activeNavText}>Groups</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={goToMessages}>
          <Ionicons name="mail-outline" size={28} color="#FFF" />
          <Text style={styles.navText}>Messages</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={goToProfile}>
          <Ionicons name="person-outline" size={28} color="#FFF" />
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    alignItems: 'center',
  },
  backButtonContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 400,
    width: '80%',
    marginVertical: 80,
  },
  title: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '700',
    marginBottom: 50,
    marginVertical: 100,
  },
  navToChall: {
    width: '100%',
    height: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 15,
    marginVertical: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navToChallText: {
    color: '#FFF',
    fontSize: 30,
    fontWeight: '500',
  },
  buttons: {
    backgroundColor: '#211F26',
    flexDirection: 'row',
    height: 100,
    justifyContent: 'space-around',
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    marginBottom: 15,
  },
  navBar: {
    backgroundColor: "#211F26",
    flexDirection: "row",
    height: 80,
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 15,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  navButton: {
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
  },
  navText: {
    color: "#999",
    fontSize: 12,
    marginTop: 4,
  },
  activeNavText: {
    color: "#FFD700",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },
});

export default GroupChall1;
