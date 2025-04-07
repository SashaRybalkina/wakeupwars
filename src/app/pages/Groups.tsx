import React, { useState } from 'react';
import {
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import { Int32 } from 'react-native/Libraries/Types/CodegenTypes';
import { Button, ScrollView } from 'tamagui';

type Props = {
  navigation: NavigationProp<any>;
};

const Groups: React.FC<Props> = ({ navigation }) => {
  const [groups, setGroups] = useState<string[]>(['A', 'B', 'C', 'D']);

  const goToPersonalChall = () => {
    //navigation.navigate('ChallPers');
  };

  const goToGroupChall = () => {
    navigation.navigate('ChallGroup');
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

  const Group = (name: String, index: Int32) => {
    return (
      <TouchableOpacity
        style={styles.navToGroup}
        onPress={() => {
          // setGroups((prevGroups) => prevGroups.filter((_, i) => i !== index));
          navigation.navigate('GroupDetails', { groupName: name });
        }}
      >
        <Text style={styles.navToGroupText}>{name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ImageBackground
      source={require('../images/cgpt.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <Button
          style={styles.addButton}
          onPress={() => setGroups((prevGroups) => [...prevGroups, 'test'])}
        >
          <Ionicons name="add-circle-outline" size={45} color={'#fff'} />
        </Button>
        <Text style={styles.title}>My Groups</Text>
        <ScrollView style={styles.scrollViewContainer}>
          {groups.map((group, index) => {
            var colIndex = index % 4;
            return Group(groups[index] + '', index);
          })}
        </ScrollView>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    alignItems: 'center',
    maxWidth: 400,
    width: '80%',
    marginVertical: 60,
    justifyContent: 'center',
  },
  addButton: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    width: 100,
    height: 100,
    marginTop: 75,
    marginLeft: 300,
  },
  title: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '700',
    marginBottom: 50,
  },
  scrollViewContainer: {
    width: '100%',
    height: '100%',
    marginBottom: 20,
  },
  navToGroup: {
    width: '100%',
    height: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 15,
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navToGroupText: {
    color: '#FFF',
    fontSize: 30,
    fontWeight: '900',
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

export default Groups;
