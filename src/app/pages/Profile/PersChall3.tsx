import React, { useEffect, useMemo, useState } from "react"
import { Calendar } from 'react-native-calendars';
import {
  Alert,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import DateTimePicker from "@react-native-community/datetimepicker"
import { NavigationProp, useRoute } from "@react-navigation/native"
import { LinearGradient } from "expo-linear-gradient"
import { BASE_URL, endpoints } from "../../api"
import { Platform } from "react-native"
import { getMetaFromTuple } from "../Games/NewGamesManagement"
import { scheduleAlarmsForChallenge, scheduleAlarmsForUser } from "../../alarmService"
import { useUser } from "../../context/UserContext"
import { getAccessToken } from "../../auth"
import { getNextAlarmDate } from "../../../utils/dateUtils"

type Props = {
  navigation: NavigationProp<any>
}

type GameSchedule = {
  dayOfWeek: number;
  games: {
    id: number;
    order: number;
  }[];
};



const PersChall3: React.FC<Props> = ({ navigation }) => {
      
  const route = useRoute()
  const { start_date, name, alarm_schedule, game_schedule } = route.params as {
    start_date: string; 
    name: number; 
    alarm_schedule: { dayOfWeek: number; time: string }[],
    game_schedule: GameSchedule[]
  }
  console.log("param")
  console.log(start_date)
  console.log(name)
  console.log(alarm_schedule)
  console.log(game_schedule)
  


  const { user } = useUser()

  const parseLocalDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d); // JS months are 0-indexed
  };
    
  const [selectedDate, setSelectedDate] = useState(parseLocalDate(start_date))
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(start_date)

  const goToMessages = () => navigation.navigate("Messages")
  const goToGroups = () => navigation.navigate("Groups")
  const goToChallenges = () => navigation.navigate("Challenges")
  const goToProfile = () => navigation.navigate("Profile")

    const alarmDays = useMemo(
    () => alarm_schedule.map(a => a.dayOfWeek),
    [alarm_schedule]
    );


  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    }
    return date.toLocaleDateString(undefined, options)
  }


const toLocalYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};




const getMarkedDatesForMonth = (
  monthStart: string,
  startDateStr: string,
  alarmSchedule: { dayOfWeek: number; time: string }[]
) => {
  const marked: Record<string, any> = {};

  const startDate = parseLocalDate(startDateStr);

  const [yearStr, monthStr] = monthStart.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed

  const lastDay = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(year, month, d);
    const isoDate = toLocalYMD(date);

    if (date < startDate) {
      marked[isoDate] = { disabled: true, disableTouchEvent: true };
      continue;
    }

    const jsDay = date.getDay(); // 0 = Sunday
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;
    const enabled = alarmSchedule.some(a => a.dayOfWeek === dayOfWeek);

    if (!enabled) {
      marked[isoDate] = { disabled: true, disableTouchEvent: true };
    }
  }

  return marked;
};


// Compute markedDates with selection
const markedDates = useMemo(() => {
  const marks = getMarkedDatesForMonth(currentMonth, start_date, alarm_schedule);

  const selDate = toLocalYMD(selectedDate);
  if (marks[selDate]) {
    marks[selDate].selected = true;
    marks[selDate].selectedColor = '#FFD700';
  } else {
    marks[selDate] = { selected: true, selectedColor: '#FFD700' };
  }

  return marks;
}, [currentMonth, start_date, alarm_schedule, selectedDate]);



const handleDayPress = (day: { dateString: string }) => {
  const selected = parseLocalDate(day.dateString);
  const weekday = selected.getDay() === 0 ? 7 : selected.getDay();
  if (!alarm_schedule.some(a => a.dayOfWeek === weekday)) return;
  setSelectedDate(selected);
};






  const handleCreateChallenge = async() => {
    
    const end_date = toLocalYMD(selectedDate);


    if (!end_date) {
      Alert.alert("Error", "Please select an end date");
      return;
    }

    const diffMs = new Date(end_date).getTime() - new Date(start_date).getTime();

    // compute inclusive difference in days
    const total_days = Math.ceil(diffMs / 86_400_000) + 1; // +1 → inclusive
    
    const payload = {
      userId: user?.id,
      name,
      start_date,
      end_date,
      total_days,
      alarm_schedule,
      game_schedules: game_schedule,
    };
    console.log(payload)

    try {
              const accessToken = await getAccessToken();
              if (!accessToken) {
                throw new Error("Not authenticated");
              }
  
  
      const res = await fetch(endpoints.createPersonalChallenge, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
  
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create challenge');
      }
  
      const data = await res.json();
      console.log('Challenge created:', data);

      // Schedule native alarms on this device for the newly created challenge
      try {
        const newId = (data && (data.id ?? data.challenge_id)) as number | undefined;
        if (newId) {
          console.log(newId)
          // await scheduleAlarmsForUser(newId, name, Number(user?.id));
        }
      } catch (e) {
        console.warn('Failed to schedule alarms for new challenge', e);
      }
      Alert.alert('Success', 'Challenge created successfully', [
        { text: 'OK', onPress: () => navigation.navigate('PersChall1') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  
  }


  return (
    <ImageBackground source={require("../../images/cgpt.png")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>

        <Text style={styles.pageTitle}>Create Challenge</Text>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >

<View style={styles.formSection}>
  <Text style={styles.sectionTitle}>Select End Date</Text>
  <Text style={styles.dateDisplay}>{formatDate(selectedDate)}</Text>

  {/* <TouchableOpacity
    style={[
      styles.actionButton,
      alarmDays.length === 0 && { opacity: 0.5 },
    ]}
    disabled={alarmDays.length === 0}
    onPress={() => setShowDatePicker(true)}
  >
    <LinearGradient
      colors={["rgba(255, 255, 255, 0.2)", "rgba(255, 255, 255, 0.1)"]}
      style={styles.buttonGradient}
    >
      <Ionicons name="calendar-outline" size={20} color="#FFF" style={styles.buttonIcon} />
      <Text style={styles.buttonText}>
        {alarmDays.length === 0 ? "Set alarms first" : "Select Date"}
      </Text>
    </LinearGradient>
  </TouchableOpacity> */}

<Calendar
  minDate={toLocalYMD(parseLocalDate(start_date))}
  current={currentMonth}
  onMonthChange={(month) =>
    setCurrentMonth(`${month.year}-${String(month.month).padStart(2, '0')}-01`)
  }
  markedDates={markedDates}
  onDayPress={handleDayPress}
  theme={{
    todayTextColor: '#FFD700',
    selectedDayBackgroundColor: '#FFD700',
    arrowColor: '#FFD700',
  }}
/>
</View>


          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateChallenge}
          >
            <LinearGradient
              colors={["#FFD700", "#FFC107"]}
              style={styles.createButtonGradient}
            >
              <Text style={styles.createButtonText}>Create Challenge</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navButton} onPress={goToChallenges}>
          <Ionicons name="star-outline" size={28} color="#FFF" />
          <Text style={styles.navText}>Challenges</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={goToGroups}>
          <Ionicons name="people" size={28} color="#FFD700" />
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
  )
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingTop: 50,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 20,
    marginBottom: 10,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFF",
    textAlign: "center",
    marginBottom: 20,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  formSection: {
    marginBottom: 25,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFF",
    marginBottom: 15,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  inputContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  input: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    color: "#FFF",
    fontSize: 16,
    width: "100%",
  },
  daysContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 20,
  },
  daysScrollContent: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  dayButton: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  dayButtonSelected: {
    backgroundColor: "rgba(255, 215, 0, 0.3)",
    borderColor: "#FFD700",
  },
  dayButtonWithTime: {
    backgroundColor: "rgba(138, 43, 226, 0.3)",
    borderColor: "#8A2BE2",
    height: 60,
  },
  dayText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  dayTextSelected: {
    color: "#FFD700",
  },
  timeText: {
    color: "#FFF",
    fontSize: 12,
    marginTop: 4,
  },
  actionButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 5,
  },
  buttonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  pickerContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 16,
    padding: 15,
    marginTop: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  doneButton: {
    backgroundColor: "rgba(255, 215, 0, 0.3)",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 15,
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  doneButtonText: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "600",
  },
  gamesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gameCard: {
    width: "48%",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  gameContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  gameTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  removeIcon: {
    marginLeft: 5,
  },
  gameImage: {
    width: "100%",
    height: 80,
  },
  addGameButton: {
    width: "48%",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 15,
  },
  addGameGradient: {
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    borderStyle: "dashed",
  },
  addGameText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
  },
  dateDisplay: {
    color: "#FFD700",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 15,
    textAlign: "center",
  },
  createButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginVertical: 10,
    marginBottom: 30,
  },
  createButtonGradient: {
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonText: {
    color: "#333",
    fontSize: 18,
    fontWeight: "700",
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
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  choiceButton: { marginTop:-20, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', marginRight: 10, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  choiceButtonSelected: { backgroundColor: 'rgba(255,215,0,0.3)', borderColor: '#FFD700' },
  choiceText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  choiceTextSelected: { color: '#FFD700' },
  rewardHeader:{flexDirection:'row',alignItems:'center',marginBottom:12},

  activeNavText: {
    color: "#FFD700",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },
})

export default PersChall3