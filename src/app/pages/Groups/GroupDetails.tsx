import React, { useState } from 'react';
import {
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, RouteProp, useRoute } from '@react-navigation/native';
import { Button } from 'tamagui';

type Props = {
  navigation: NavigationProp<any>;
};

const GroupDetails: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { groupName } = route.params as {
    groupName: string;
  };

  const [currentChallenges, setCurrentChallenges] = useState<string[]>([
    'Challenge 1',
    'Challenge 2',
  ]);

  // Placeholder for group profile picture
  const groupImage = require('../../images/game.jpeg');

  // List of member profile pictures
  const memberImages = [
    require('../../images/game.jpeg'),
    require('../../images/game.jpeg'),
    require('../../images/game.jpeg'),
    require('../../images/game.jpeg'),
  ];

  return (
    <ImageBackground
      source={require('../../images/secondary.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ScrollView
            style={[
              {
                marginBottom: 120,
                paddingHorizontal: 30,
              },
            ]}
            contentContainerStyle={[{ alignItems: 'center' }]}
          >
            <Text style={styles.groupTitle}>
              {groupName ?? 'Unnamed Group'}
            </Text>

            <Image source={groupImage} style={styles.groupImage} />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.membersContainer}
            >
              {memberImages.map((image, index) => (
                <Image key={index} source={image} style={styles.memberImage} />
              ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>Current Challenges</Text>
            <TouchableOpacity
              style={styles.addChallenge}
              onPress={() => navigation.navigate('GroupChall1', { groupName })}
            >
              <Ionicons name="add-circle-outline" size={35} color={'#fff'} />
            </TouchableOpacity>
            <ScrollView style={styles.challs}>
              {currentChallenges.map((challenge, index) => (
                <View key={index} style={styles.challenge}>
                  <Text style={styles.challengeText}>{challenge}</Text>
                </View>
              ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>Past Challenges</Text>
            <ScrollView style={styles.challs}>
              <View style={styles.challenge}>
                <Ionicons name="book-outline" size={30} color={'#FFF'} />
                <Text style={styles.challengeText}>School :(</Text>
                <View style={styles.completionBadge}>
                  <Text style={styles.completionText}>30/30</Text>
                  <Text style={styles.completionLabel}>Days Complete</Text>
                </View>
              </View>
            </ScrollView>
          </ScrollView>
        </View>

        <View style={styles.buttons}>
          <Button
            style={styles.button}
            onPress={() => navigation.navigate('Challenges')}
          >
            <Ionicons name="star-outline" size={40} color={'#FFF5CD'} />
          </Button>
          <Button style={styles.button}>
            <Ionicons name="people" size={40} color={'#FFF5CD'} />
          </Button>
          <Button
            style={styles.button}
            onPress={() => navigation.navigate('Messages')}
          >
            <Ionicons name="mail-outline" size={40} color={'#FFF5CD'} />
          </Button>
          <Button
            style={styles.button}
            onPress={() => navigation.navigate('Profile')}
          >
            <Ionicons name="person-outline" size={40} color={'#FFF5CD'} />
          </Button>
        </View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    marginTop: 50,
    alignItems: 'center',
  },
  groupImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  groupTitle: {
    fontSize: 25,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 30,
    marginBottom: 20,
    color: '#FFF',
  },
  membersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 25,
  },
  memberImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginHorizontal: 5,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#FFF',
    marginVertical: 10,
  },
  addChallenge: {
    backgroundColor: 'transparent',
  },
  challs: {
    marginVertical: 15,
    marginBottom: 35,
  },
  challenge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 10,
    borderRadius: 15,
    marginTop: 10,
    width: 250,
    height: 65,
  },
  challengeText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  completionBadge: {
    marginLeft: 'auto',
    alignItems: 'center',
  },
  completionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  completionLabel: {
    fontSize: 12,
    color: '#FFF',
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

export default GroupDetails;
