import React, { useState } from 'react';
import {
  Alert,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useRoute } from '@react-navigation/native';
import * as Font from 'expo-font';
import { Int32 } from 'react-native/Libraries/Types/CodegenTypes';
import { Button } from 'tamagui';

type Props = {
  navigation: NavigationProp<any>;
};

const Friends4: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { friendName } = route.params as {
    friendName: string;
  };

  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[][]>([
    ['GroupA', 'fnucwncjkwnl'],
    ['GroupB', 'nfenvoencklk'],
    ['GroupC', 'cneoenclknck'],
    ['GroupD', 'qowfpwhnljnv'],
  ]);

  const goToGroups = () => {
    navigation.navigate('Groups');
  };

  const goToChallenges = () => {
    navigation.navigate('Challenges');
  };

  const goToMessages = () => {
    navigation.navigate('Messages');
  };

  const Group: React.FC<{ name: string; text: string; index: number }> = ({
    name,
    text,
    index,
  }) => {
    const isSelected = selectedGroups.includes(name);

    const toggleSelection = () => {
      if (isSelected) {
        setSelectedGroups((prev) => prev.filter((g) => g !== name));
      } else {
        setSelectedGroups((prev) => [...prev, name]);
      }
    };

    return (
      <TouchableOpacity
        style={[styles.group, isSelected && styles.selectedGroupBorder]}
        onPress={toggleSelection}
      >
        <Text style={styles.groupName}>{name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ImageBackground
      source={require('../../images/secondary.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.backButtonContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={30} color="#FFF" />
        </TouchableOpacity>
      </View>
      <View style={styles.container}>
        <Text style={styles.title}>Add to Group(s)</Text>
        <Text style={styles.sg}>Select Group(s):</Text>
        <ScrollView style={styles.scrollViewContainer}>
          {groups.map((group, index) => (
            <Group
              key={index}
              name={group[0] + ''}
              text={group[1] + ''}
              index={index}
            />
          ))}
        </ScrollView>
        <TouchableOpacity
          style={styles.sendInviteButton}
          onPress={() => {
            if (selectedGroups.length != 0) {
              Alert.alert(
                'Invite Sent!',
                `Invited ${friendName} to groups: ${selectedGroups.join(', ')}`,
              );
            } else {
              Alert.alert(
                'No Group Selected',
                'Please select groups to invite you friend.',
              );
            }
          }}
        >
          <Text style={styles.sendInviteText}>Send Invite</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttons}>
        <Button style={styles.button} onPress={goToChallenges}>
          <Ionicons name="star-outline" size={40} color={'#FFF5CD'} />
        </Button>
        <Button style={styles.button} onPress={goToGroups}>
          <Ionicons name="people-outline" size={40} color={'#FFF5CD'} />
        </Button>
        <Button style={styles.button} onPress={goToMessages}>
          <Ionicons name="mail-outline" size={40} color={'#FFF5CD'} />
        </Button>
        <Button style={styles.button}>
          <Ionicons name="person" size={40} color={'#FFF5CD'} />
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
    marginTop: 30,
  },
  input: {
    backgroundColor: '#fff',
    width: 280,
    height: 40,
    borderRadius: 5,
    marginBottom: 30,
    fontSize: 18,
    paddingHorizontal: 10,
  },
  sg: {
    color: 'white',
    fontSize: 25,
    fontWeight: '700',
    marginBottom: 25,
  },
  friend: {
    backgroundColor: 'pink',
    width: 280,
    height: 50,
    borderRadius: 15,
    marginBottom: 30,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendText: {
    fontSize: 25,
    fontWeight: '500',
    color: 'white',
  },
  selection: {
    color: '#fff',
    fontSize: 22.5,
    fontWeight: '700',
    marginHorizontal: 25,
    marginBottom: 30,
  },
  group: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    width: '100%',
    height: 50,
    marginVertical: 7.5,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  groupName: {
    color: '#FFF',
    fontSize: 22.5,
    fontWeight: '600',
    marginLeft: 5,
    marginBottom: 5,
  },
  selectedGroupBorder: {
    borderWidth: 2,
    borderColor: '#FFF455',
  },
  selectedFriendBorder: {
    borderWidth: 2,
    borderColor: '#FFF455',
  },
  sendInviteButton: {
    backgroundColor: '#AA55FF',
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    width: 250,
    height: 65,
    marginTop: 15,
  },
  sendInviteText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 25,
    textAlign: 'center',
  },
  scrollViewContainer: {
    width: '100%',
    height: 350,
    marginBottom: 20,
    marginTop: -10,
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

export default Friends4;
