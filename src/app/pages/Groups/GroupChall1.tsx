import React from 'react';
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

  const goToManual = (groupId: number, groupMembers: { id: number; name: string }[]) => {
    navigation.navigate('GroupChall2', { groupId, groupMembers });
  };

  const goToChallenges = () => {
    navigation.navigate('Challenges');
  };

  const goToMessages = () => {
    navigation.navigate('Messages');
  };

  const goToProfile = () => {
    navigation.navigate('Profile');
  };

  return (
    <ImageBackground
      source={require('../../images/tertiary.png')}
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
            goToManual(groupId, groupMembers);
          }}
        >
          <Text style={styles.navToChallText}>Manually</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navToChall}>
          <Text style={styles.navToChallText}>Collaberatively</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttons}>
        <Button style={styles.button} onPress={goToChallenges}>
          <Ionicons name="star-outline" size={40} color={'#FFF5CD'} />
        </Button>
        <Button style={styles.button}>
          <Ionicons name="people" size={40} color={'#FFF5CD'} />
        </Button>
        <Button style={styles.button} onPress={goToMessages}>
          <Ionicons name="mail-outline" size={40} color={'#FFF5CD'} />
        </Button>
        <Button style={styles.button} onPress={goToProfile}>
          <Ionicons name="person-outline" size={40} color={'#FFF5CD'} />
        </Button>
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
});

export default GroupChall1;
