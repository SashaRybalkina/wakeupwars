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
  ActivityIndicator,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import DateTimePicker from "@react-native-community/datetimepicker"
import { NavigationProp, StackActions, useRoute } from "@react-navigation/native"
import { LinearGradient } from "expo-linear-gradient"
import { BASE_URL, endpoints } from "../../api"
import { Platform } from "react-native"
import { getMetaFromTuple } from "../Games/NewGamesManagement"
import { scheduleAlarmsForChallenge, scheduleAlarmsForUser } from "../../alarmService"
import { useUser } from "../../context/UserContext"
import { getAccessToken } from "../../auth"
import { getNextAlarmDate } from "../../../utils/dateUtils"
import axios from "axios";

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
  const route = useRoute();
  const { first_possible_start_date, name, alarm_schedule, game_schedule, chall_type, group_id, members, sing_or_mult, category_ids, chall_id, participation_fee, friendId, schedule } =    route.params as {
      first_possible_start_date: string;
      name: string;
      alarm_schedule: { dayOfWeek: number; time: string }[];
      game_schedule: GameSchedule[];
      chall_type: string;
      group_id: number | null;
      members: { id: number; name: string }[];
      sing_or_mult: string;
      category_ids: number[];
      chall_id: number;
      participation_fee: number;
      friendId: number;
      schedule: any[] | null; // only exisits if creating this challenge for friend
    };

    console.log("PersChall3 route params:", route.params);

  const { user, logout } = useUser();

  const parseLocalDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const toLocalYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(first_possible_start_date);
  const [submitting, setSubmitting] = useState(false);

  const alarmDays = useMemo(
    () => alarm_schedule.map((a) => a.dayOfWeek),
    [alarm_schedule]
  );

  const formatDate = (date: Date | null) =>
    date
      ? date.toLocaleDateString(undefined, {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "Not selected";

  const getMarkedDatesForMonth = (
    monthStart: string,
    minDate: string,
    alarmSchedule: { dayOfWeek: number; time: string }[]
  ) => {
    const marked: Record<string, any> = {};
    const min = parseLocalDate(minDate);

    const [yearStr, monthStr] = monthStart.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const lastDay = new Date(year, month + 1, 0).getDate();

    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(year, month, d);
      const isoDate = toLocalYMD(date);

      if (date < min) {
        marked[isoDate] = { disabled: true, disableTouchEvent: true };
        continue;
      }

      const jsDay = date.getDay(); // 0 = Sunday
      const dayOfWeek = jsDay === 0 ? 7 : jsDay;
      const enabled = alarmSchedule.some((a) => a.dayOfWeek === dayOfWeek);

      if (!enabled) {
        marked[isoDate] = { disabled: true, disableTouchEvent: true };
      }
    }
    return marked;
  };

  const handleStartDayPress = (day: { dateString: string }) => {
    const selected = parseLocalDate(day.dateString);
    const weekday = selected.getDay() === 0 ? 7 : selected.getDay();
    if (!alarm_schedule.some((a) => a.dayOfWeek === weekday)) return;
    setStartDate(selected);
    setShowStartPicker(false);
  };

  const handleEndDayPress = (day: { dateString: string }) => {
    const selected = parseLocalDate(day.dateString);
    const weekday = selected.getDay() === 0 ? 7 : selected.getDay();
    if (!alarm_schedule.some((a) => a.dayOfWeek === weekday)) return;
    setEndDate(selected);
    setShowEndPicker(false);
  };


function countAlarmDaysBetween(startDate: Date, endDate: Date, alarmDays: number[]): number {
  // Normalize: ensure startDate <= endDate
  if (startDate > endDate) [startDate, endDate] = [endDate, startDate];

  let count = 0;
  const current = new Date(startDate);

  // Loop day-by-day
  while (current <= endDate) {
    const weekday = current.getDay() === 0 ? 7 : current.getDay(); // Sunday=7, Monday=1,...
    if (alarmDays.includes(weekday)) count++;
    current.setDate(current.getDate() + 1);
  }

  return count;
}



  const handleCreateChallenge = async () => {
    if (submitting) return;
    if (!startDate || !endDate) {
      Alert.alert("Error", "Please select both start and end dates.");
      return;
    }

    const start_date = toLocalYMD(startDate);
    const end_date = toLocalYMD(endDate);
    // const diffMs = endDate.getTime() - startDate.getTime();
    // const total_days = Math.ceil(diffMs / 86_400_000) + 1;
    const total_days = countAlarmDaysBetween(startDate, endDate, alarmDays);

    try {
        setSubmitting(true);
        const accessToken = await getAccessToken();
        if (!accessToken) {
                                      await logout();
                      navigation.reset({
                        index: 0,
                        routes: [{ name: "Login" }],
                      });
        }

        if (chall_type == 'Personal') {
            const payload = {
                userId: user?.id,
                name,
                start_date,
                end_date,
                total_days,
                alarm_schedule,
                game_schedules: game_schedule,
            };
            console.log(JSON.stringify(payload))

            const res = await fetch(endpoints.createPersonalChallenge, {
                method: "POST",
                headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to create challenge");
            }

            const data = await res.json();
            console.log('Challenge created:', data);

            // Schedule native alarms on this device for the newly created challenge
            try {
                const newId = (data && (data.id ?? data.challenge_id)) as number | undefined;
                if (newId) {
                console.log(newId)
                await scheduleAlarmsForUser(newId, name, Number(user?.id));
                }
            } catch (e) {
                console.warn('Failed to schedule alarms for new challenge', e);
            }
            setSubmitting(false);
            Alert.alert('Success', 'Challenge created successfully', [
                { text: 'OK', onPress: () => navigation.navigate('PersChall1') },
            ]);
        }

        if (chall_type == 'Friend') {

            const payload = {
              userId: user?.id,
              name,
              startDate: start_date,
              endDate: end_date,
              totalDays: total_days,
              schedule,
              members: [friendId], 
            }
            console.log(JSON.stringify(payload))

            const res = await fetch(endpoints.shareChallenge(), {
              method: "POST",
              headers: {
                'Content-Type': 'application/json',
                "Authorization": `Bearer ${accessToken}`,
              },
              body: JSON.stringify(payload),
            })

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to create challenge for friend");
            }

            const data = await res.json();
            console.log('Challenge created for friend:', data);

            Alert.alert('Success', 'Challenge created for friend successfully', [
                // { text: 'OK', onPress: () => navigation.navigate('PersChall1') }
                { text: 'OK', onPress: () => navigation.dispatch(StackActions.pop(2)) }
            ]);
        }
        
        else if (chall_type == 'Share') {
          const payload = {
            startDate: start_date,
            endDate: end_date,
            members, 
            totalDays: total_days,
            name,
          };
          console.log(JSON.stringify(payload))

          try {

            const accessToken = await getAccessToken();
            if (!accessToken) {
                            await logout();
                      navigation.reset({
                        index: 0,
                        routes: [{ name: "Login" }],
                      });
            }

            console.log("[FRONTEND] Share payload:", payload);

            const response = await axios.post(
              endpoints.shareChallenge(chall_id),
              payload, // <-- request body
              {
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${accessToken}`,
                },
              }
            );

            console.log("[FRONTEND] Share response:", response.data);
            setSubmitting(false);
            Alert.alert("Saved", "Challenge shared successfully!");
            navigation.navigate('PersChall1');
          } catch (error: any) {
            console.error("[FRONTEND] Error sharing:", error.response?.data || error.message);
            Alert.alert("Error", "Failed to share challenge.");
          }
        }


        else if (chall_type == 'Group') {
            const payload = {
                name,
                start_date,
                end_date,
                group_id,
                initiator_id: Number(user?.id),
                total_days,
                members,
                alarm_schedule,
                game_schedules: game_schedule,
                participation_fee,
            };
            console.log(JSON.stringify(payload))

            const res = await fetch(endpoints.createPendingCollaborativeGroupChallenge(), {
                method: 'POST',
                headers: {
                'Content-Type': 'application/json',
                "Authorization": `Bearer ${accessToken}`,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to save schedule');
            }

            setSubmitting(false);
            Alert.alert('Success', 'Schedule saved successfully', [
                { text: 'OK', onPress: () => navigation.navigate('GroupDetails', { groupId: group_id }) },
            ]);

        }
        else if (chall_type == 'Public') {
            const payload = {
                name,
                start_date,
                end_date,
                total_days,
                initiator_id: Number(user?.id),
                alarm_schedule,
                game_schedules: game_schedule,
                sing_or_mult,
                category_ids,
                participation_fee,
            }
            console.log(payload)

            const res = await fetch(endpoints.createPublicChallenge, {
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

            setSubmitting(false);
            Alert.alert('Success', 'Challenge created successfully', [
                { text: 'OK', onPress: () => navigation.navigate('PublicChallenges') },
            ]);
        }

    } catch (err: any) {
      Alert.alert("Error", err.message);
      setSubmitting(false);
    }

  };





  const renderCalendar = (
    label: string,
    visible: boolean,
    onDayPress: (day: any) => void,
    minDate: string,
    selectedDate: Date | null
  ) => {
    const marks = getMarkedDatesForMonth(
      currentMonth,
      minDate,
      alarm_schedule
    );
    if (selectedDate) {
      const sel = toLocalYMD(selectedDate);
      marks[sel] = { selected: true, selectedColor: "#FFD700" };
    }

    return (
      visible && (
        <Calendar
          minDate={minDate}
          current={currentMonth}
          onMonthChange={(month) =>
            setCurrentMonth(`${month.year}-${String(month.month).padStart(2, "0")}-01`)
          }
          markedDates={marks}
          onDayPress={onDayPress}
          theme={{
            todayTextColor: "#FFD700",
            selectedDayBackgroundColor: "#FFD700",
            arrowColor: "#FFD700",
          }}
        />
      )
    );
  };

  return (
    <ImageBackground
      source={require("../../images/cgpt.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>

        <Text style={styles.pageTitle}>Create Challenge</Text>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* START DATE SELECTION */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Select Challenge Start Date</Text>
            <Text style={styles.dateDisplay}>{formatDate(startDate)}</Text>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowStartPicker((p) => !p)}
            >
              <LinearGradient
                colors={["rgba(255,255,255,0.2)", "rgba(255,255,255,0.1)"]}
                style={styles.buttonGradient}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color="#FFF"
                  style={styles.buttonIcon}
                />
                <Text style={styles.buttonText}>Select Start Date</Text>
              </LinearGradient>
            </TouchableOpacity>

            {renderCalendar(
              "Start Date",
              showStartPicker,
              handleStartDayPress,
              first_possible_start_date,
              startDate
            )}
          </View>

          {/* END DATE SELECTION */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Select Challenge End Date</Text>
            <Text style={styles.dateDisplay}>{formatDate(endDate)}</Text>

            <TouchableOpacity
              style={[
                styles.actionButton,
                !startDate && { opacity: 0.5 },
              ]}
              disabled={!startDate}
              onPress={() => setShowEndPicker((p) => !p)}
            >
              <LinearGradient
                colors={["rgba(255,255,255,0.2)", "rgba(255,255,255,0.1)"]}
                style={styles.buttonGradient}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color="#FFF"
                  style={styles.buttonIcon}
                />
                <Text style={styles.buttonText}>
                  {startDate ? "Select End Date" : "Select Start Date First"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {startDate &&
              renderCalendar(
                "End Date",
                showEndPicker,
                handleEndDayPress,
                toLocalYMD(startDate),
                endDate
              )}
          </View>

          <TouchableOpacity
            style={[styles.createButton, submitting && { opacity: 0.6 }]}
            onPress={handleCreateChallenge}
            disabled={submitting}
          >
            <LinearGradient
              colors={["#FFD700", "#FFC107"]}
              style={styles.createButtonGradient}
            >
              <Text style={styles.createButtonText}>{submitting ? "Creating..." : "Create Challenge"}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </ImageBackground>
  );
};

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
  //rewardHeader:{flexDirection:'row',alignItems:'center',marginBottom:12},

  activeNavText: {
    color: "#FFD700",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },
})

export default PersChall3