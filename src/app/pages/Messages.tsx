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
import { NavigationProp } from '@react-navigation/native';
import * as Font from 'expo-font';
import { Int32 } from 'react-native/Libraries/Types/CodegenTypes';
import { Button } from 'tamagui';

type Props = {
  navigation: NavigationProp<any>;
};

const Messages: React.FC<Props> = ({ navigation }) => {
  const [selected, setSelected] = useState('Friends');
  const [fMessages, setFMessages] = useState<string[][]>([
    ['NameA', 'fnucwncjkwnl'],
    ['NameB', 'nfenvoencklk'],
    ['NameC', 'cneoenclknck'],
    ['NameD', 'qowfpwhnljnv'],
  ]);
  const [gMessages, setGMessages] = useState<string[][]>([
    ['GroupA', 'fnucwncjkwnl'],
    ['GroupB', 'nfenvoencklk'],
    ['GroupC', 'cneoenclknck'],
    ['GroupD', 'qowfpwhnljnv'],
  ]);

  const goToPersonalChall = () => {
    //navigation.navigate('ChallPers');
  };

  const goToGroupChall = () => {
    //navigation.navigate('ChallGroup');
  };

  const goToGroups = () => {
    navigation.navigate('Groups');
  };

  const goToChallenges = () => {
    navigation.navigate('Challenges');
  };

  const goToProfile = () => {
    navigation.navigate('Profile');
  };

  const Message: React.FC<{ name: string; text: string; index: number }> = ({
    name,
    text,
    index,
  }) => (
    <TouchableOpacity
      style={styles.navToMess}
      onPress={() => {
        if (selected === 'Friends') {
          setFMessages((prevMess) => prevMess.filter((_, i) => i !== index));
        } else {
          setGMessages((prevMess) => prevMess.filter((_, i) => i !== index));
        }
      }}
    >
      <Text style={styles.navToMessName}>{name}</Text>
      <Text style={styles.navToMessText}>{text}</Text>
    </TouchableOpacity>
  );

  return (
    <ImageBackground
      source={require('../images/cgpt.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <Text style={styles.title}>Messages</Text>
        <TextInput
          style={styles.input}
          placeholder="Seacrh messages"
        ></TextInput>
        <View style={[{ flexDirection: 'row' }]}>
          <TouchableOpacity onPress={() => setSelected('Friends')}>
            <Text
              style={[
                styles.selection,
                selected === 'Friends' && styles.underline,
              ]}
            >
              Friends
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setSelected('Groups')}>
            <Text
              style={[
                styles.selection,
                selected === 'Groups' && styles.underline,
              ]}
            >
              Groups
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.scrollViewContainer}>
          {selected === 'Friends'
            ? fMessages.map((message, index) => (
                <Message
                  key={index}
                  name={message[0] + ''}
                  text={message[1] + ''}
                  index={index}
                />
              ))
            : gMessages.map((message, index) => (
                <Message
                  key={index}
                  name={message[0] + ''}
                  text={message[1] + ''}
                  index={index}
                />
              ))}
        </ScrollView>

        <Button
          style={styles.addButton}
          onPress={() => {
            if (selected == 'Friends') {
              setFMessages((prevMess) => [
                ...prevMess,
                ['test', 'befpvblwebvwbjvda'],
              ]);
            } else {
              setGMessages((prevMess) => [
                ...prevMess,
                ['test', 'befpvblwebvwbjvda'],
              ]);
            }
          }}
        >
          <Text style={styles.addText}>Start New Conversation</Text>
        </Button>
      </View>

      <View style={styles.buttons}>
        <Button style={styles.button} onPress={goToChallenges}>
          <Ionicons name="star-outline" size={40} color={'#FFF5CD'} />
        </Button>
        <Button style={styles.button} onPress={goToGroups}>
          <Ionicons name="people-outline" size={40} color={'#FFF5CD'} />
        </Button>
        <Button style={styles.button}>
          <Ionicons name="mail" size={40} color={'#FFF5CD'} />
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
    marginBottom: 20,
    marginVertical: 100,
    marginTop: 30,
  },
  input: {
    backgroundColor: '#fff',
    width: 280,
    height: 40,
    borderRadius: 5,
    marginBottom: 30,
  },
  selection: {
    color: '#fff',
    fontSize: 22.5,
    fontWeight: '700',
    marginHorizontal: 25,
    marginBottom: 20,
  },
  underline: {
    textDecorationLine: 'underline',
  },
  navToMess: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    width: '100%',
    height: 70,
    marginVertical: 5,
    justifyContent: 'center',
  },
  navToMessName: {
    color: '#ffcce6',
    fontSize: 22.5,
    fontWeight: '600',
    marginLeft: 5,
    marginBottom: 10,
  },
  navToMessText: {
    color: '#fff',
    fontSize: 17.5,
    marginLeft: 20,
  },
  scrollViewContainer: {
    width: '100%',
    height: '50%',
    marginBottom: 10,
    marginTop: -10,
  },
  addButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    width: '100%',
    height: '10%',
    borderRadius: 15,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
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

export default Messages;
