import React, { useState, useEffect } from 'react';
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
import { NavigationProp, useRoute } from '@react-navigation/native';
import { Button } from 'tamagui';
import { ProgressBar } from 'react-native-paper';
import axios from 'axios';
import { endpoints } from '../../api';

type Props = {
  navigation: NavigationProp<any>;
};

const ChallDetails: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { challId, challName, whichChall } = route.params as {
    challId: number;
    challName: string;
    whichChall: string;
  };  
  
  const [daysComplete, setDaysComplete] = useState(0);
  const [totalDays, setTotalDays] = useState(0);
  const [members, setMembers] = useState<{ name: string }[]>([]);
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>([]); // optional

  const getDayLabel = (dayOfWeek: number): string => {
    const labels = ['M', 'T', 'W', 'TH', 'F', 'S', 'SU'];
    return labels[dayOfWeek] || ''; // 1 = Monday, 7 = Sunday
  };
  
  useEffect(() => {
    const fetchChallengeDetails = async () => {
      try {
        const res = await axios.get(endpoints.challengeDetail(challId));
        const data = res.data;
        setDaysComplete(data.daysCompleted);
        setTotalDays(data.totalDays);
        setMembers(data.members);
        setDaysOfWeek(data.daysOfWeek); // optional
      } catch (err) {
        console.error(err);
      }
    };
  
    fetchChallengeDetails();
  }, []);

  const leaderboard = [
    { name: 'Pers1', points: 928, emoji: '👑' },
    { name: 'Pers2', points: 800, emoji: '🥈' },
    { name: 'Pers3', points: 700, emoji: '🥉' },
    { name: 'Pers4', points: 0, emoji: '50.' },
  ];

  const goToMessages = () => navigation.navigate('Messages');
  const goToGroups = () => navigation.navigate('Groups');
  const goToProfile = () => navigation.navigate('Profile');

  const enrolledMembers = [
    require('../../images/game.jpeg'),
    require('../../images/game.jpeg'),
    require('../../images/game.jpeg'),
  ];

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
        <Text style={styles.title}>{challName}</Text>
        <Ionicons name="star" size={50} color="white" style={styles.bookIcon} />

        <Text style={styles.enrolledLabel}>Enrolled Members:</Text>
        <View style={styles.avatarsRow}>
          {members.map((m, index) => (
            <View key={index} style={styles.memberNameBox}>
              <Text style={styles.memberNameText}>{m.name}</Text>
            </View>
          ))}
        </View>

        <View style={styles.progressBox}>
        <View style={styles.selectedDaysRow}>
          {daysOfWeek.map((day, idx) => (
            <View key={idx} style={styles.selectedDay}>
              <Text style={styles.selectedDayText}>{day}</Text>
            </View>
          ))}
        </View>
          <Text style={styles.daysComplete}>
            {daysComplete}/{totalDays} Days Complete
          </Text>
          <TouchableOpacity
            style={styles.scheduleBtn}
            onPress={() =>
              navigation.navigate('ChallSchedule', { challId, challName, whichChall })
            }
          >
            <Text style={styles.scheduleBtnText}>View Schedule</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.leaderboard}>
          <Text style={styles.rankTitle}>RANKING</Text>
          <ScrollView style={styles.rankList} nestedScrollEnabled={true}>
            {leaderboard.map((person, index) => (
              <View key={index} style={styles.rankItem}>
                <Text style={styles.rankText}>
                  {person.emoji} {person.name} - {person.points} pts
                </Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.leaderboardBtn}>
            <Text style={styles.leaderboardBtnText}>
              View leader board details
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navButton}>
          <Ionicons name="star" size={28} color="#FFD700" />
          <Text style={styles.activeNavText}>Challenges</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={goToGroups}>
          <Ionicons name="people-outline" size={28} color="#FFF" />
          <Text style={styles.navText}>Groups</Text>
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
  container: {
    marginTop: 80,
    alignItems: 'center',
    width: '90%',
  },
  backButtonContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  title: {
    fontSize: 35,
    fontWeight: '600',
    color: 'white',
    marginBottom: 10,
  },
  bookIcon: {
    marginBottom: 20,
  },
  enrolledLabel: {
    fontSize: 25,
    color: 'white',
    marginBottom: 15,
  },
  avatarsRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginHorizontal: 5,
  },
  progressBox: {
    alignItems: 'center',
    marginBottom: 30,
  },
  weekdays: {
    fontSize: 25,
    color: 'white',
    letterSpacing: 10,
    marginBottom: 15,
  },
  daysComplete: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF455',
    marginBottom: 15,
  },
  scheduleBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: -10,
  },
  scheduleBtnText: {
    fontSize: 15,
    color: 'black',
    fontWeight: '600',
  },
  leaderboard: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 15,
    borderRadius: 12,
    marginBottom: 110,
  },
  rankTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 15,
    color: '#FFD700',
  },
  rankItem: {
    marginVertical: 6,
  },
  rankText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF455',
  },
  leaderboardBtn: {
    marginTop: 17.5,
    paddingVertical: 10,
    backgroundColor: '#FFD700',
    borderRadius: 8,
  },
  leaderboardBtnText: {
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 18,
    color: '#c46c14',
  },
  rankList: {
    maxHeight: 250,
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
  memberNameBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
    marginHorizontal: 5,
  },
  memberNameText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedDaysRow: {
    flexDirection: 'row',
    marginBottom: 15,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  selectedDay: {
    backgroundColor: '#FFF455',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 5,
    marginVertical: 5,
  },
  selectedDayText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },  
  navBar: {
    backgroundColor: "#211F26",
    flexDirection: "row",
    height: 80,
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 15,
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

export default ChallDetails;
