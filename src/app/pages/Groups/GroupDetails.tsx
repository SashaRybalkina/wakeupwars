import React, { useEffect, useState } from 'react';
import { endpoints } from '../../api';
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

type Challenge = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isGroupChallenge: boolean;
  daysOfWeek: number[];
  daysCompleted: number;
};

type GroupData = {
  id: number;
  name: string;
  challenges: Challenge[];
  members: { id: number; name: string }[];
};


const GroupDetails: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { groupId } = route.params as { groupId: number };

  const [groupData, setGroupData] = useState<GroupData | null>(null);

  useEffect(() => {
    const fetchGroupData = async () => {
      try {
        console.log("Fetching from:", endpoints.groupProfile(groupId));
        const response = await fetch(endpoints.groupProfile(groupId));
        const data = await response.json();
        setGroupData(data);
      } catch (error) {
        console.error('Failed to fetch group details:', error);
      }
    };

    fetchGroupData();
  }, [groupId]);




  const currentChallenges = groupData?.challenges?.filter((c: any) => !c.isCompleted) ?? [];
  const pastChallenges = groupData?.challenges?.filter((c: any) => c.isCompleted) ?? [];


  // Placeholder for group profile picture
  const groupImage = require('../../images/game.jpeg');

  // List of member profile pictures
  // const memberImages = [
  //   require('../../images/game.jpeg'),
  //   require('../../images/game.jpeg'),
  //   require('../../images/game.jpeg'),
  //   require('../../images/game.jpeg'),
  // ];

  return (
    <ImageBackground
      source={require('../../images/secondary.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {!groupData ? (
            <Text style={{ color: '#fff', marginTop: 50 }}>Loading...</Text>
          ) : (
          <ScrollView
            style={[
              {
                marginBottom: 120,
                paddingHorizontal: 30,
              },
            ]}
            contentContainerStyle={[{ alignItems: 'center' }]}
          >
            <Text style={styles.groupTitle}>{groupData.name}</Text>

            <Image source={groupImage} style={styles.groupImage} />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.membersContainer}
            >
              {groupData?.members.map((member: any, index: number) => (
                <View key={index} style={styles.memberImage}>
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>
                    {member.name}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>Current Challenges</Text>
            <TouchableOpacity
              style={styles.addChallenge}
              onPress={() => navigation.navigate('GroupChall1', { groupName: groupData?.name })} //going to want to pass whole group
            >
              <Ionicons name="add-circle-outline" size={35} color={'#fff'} />
            </TouchableOpacity>
            <ScrollView style={styles.challs}>
              {currentChallenges.map((challenge: Challenge, index: number) => (
              <View key={index} style={styles.challenge}>
                <Text style={styles.challengeText}>{challenge.name}</Text>
                <View style={styles.completionBadge}>
                    <Text style={styles.completionText}>{challenge.daysCompleted}</Text>
                    <Text style={styles.completionLabel}>Days Complete</Text>
                  </View>
              </View>
              ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>Past Challenges</Text>
            <ScrollView style={styles.challs}>
              {pastChallenges.map((challenge: Challenge, index: number) => (
                <View key={index} style={styles.challenge}>
                  <Text style={styles.challengeText}>{challenge.name}</Text>
                  <View style={styles.completionBadge}>
                    <Text style={styles.completionText}>{challenge.daysCompleted}</Text>
                    <Text style={styles.completionLabel}>Days Complete</Text>
                  </View>
                </View>
                ))}
            </ScrollView>
          </ScrollView>
          )}
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
