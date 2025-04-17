import React, { useState, useEffect } from 'react';
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { Button } from 'tamagui';
import axios from 'axios';
import { endpoints } from '../../api';
import { useUser } from '../../context/UserContext';

type Props = {
  navigation: NavigationProp<any>;
};

const Chall1: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { whichChall } = route.params as {
    whichChall: string;
  };
  const { user } = useUser();
  const [challs, setChalls] = useState<{ id: number; name: string; text: string }[]>([]);
  
  useEffect(() => {
    if (!user) return; 
  
    const fetchChallenges = async () => {
      try {
        const response = await axios.get(endpoints.challengeList(user.id, whichChall));
        const data = response.data.map((c: any) => ({
          id: c.id,
          name: c.name,
          text: `${c.daysCompleted} days done from ${c.startDate}`,
        }));
        setChalls(data);
      } catch (error) {
        console.error(error);
      }
    };
  
    fetchChallenges();
  }, [user]);
  
  const goToMessages = () => {
    navigation.navigate('Messages');
  };

  const goToGroups = () => {
    navigation.navigate('Groups');
  };

  const goToProfile = () => {
    navigation.navigate('Profile');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toISOString().split("T")[0] // Returns YYYY-MM-DD format
  }
  const Challenge: React.FC<{ id: number; name: string; text: string }> = ({
    id,
    name,
    text,
  }) => (
    <TouchableOpacity
      style={styles.navToChall}
      onPress={() => {
        navigation.navigate('ChallDetails', {
          challId: id,
          challName: name,
          whichChall,
        });
      }}
    >
      <Text style={styles.navToChallName}>{name}</Text>
      <Text style={styles.navToChallText}>{text}</Text>
    </TouchableOpacity>
  );  

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
        <Text style={styles.title}>My {whichChall} Challenges</Text>
        <ScrollView style={styles.scrollViewContainer}>
          {challs.map((challenge) => (
            <Challenge
              key={challenge.id}
              id={challenge.id}
              name={challenge.name}
              text={challenge.text}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.buttons}>
        <Button style={styles.button}>
          <Ionicons name="star" size={40} color={'#FFF5CD'} />
        </Button>
        <Button style={styles.button} onPress={goToGroups}>
          <Ionicons name="people-outline" size={40} color={'#FFF5CD'} />
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
    alignItems: 'center',
    maxWidth: 400,
    width: '80%',
    marginVertical: 80,
  },
  title: {
    color: '#FFF500',
    fontSize: 40,
    fontWeight: '700',
    marginBottom: 50,
    marginTop: 40,
    textAlign: 'center',
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
  navToChall: {
    width: '100%',
    height: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 15,
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navToChallName: {
    color: '#fff',
    fontSize: 23,
    fontWeight: '600',
    marginLeft: 5,
    marginBottom: 10,
  },
  navToChallText: {
    color: '#fff',
    fontSize: 18,
    marginLeft: 20,
    fontWeight: '600',
  },
  scrollViewContainer: {
    width: '100%',
    height: '70%',
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

export default Chall1;
