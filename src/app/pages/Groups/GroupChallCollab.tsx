/**
 * @file GroupChallCollab.tsx
 * @description Screen for setting up a collaborative group challenge. Users enter
 * a challenge name and mark their availability on a day/time grid. The selected
 * slots get packaged into an alarm schedule and passed to the next setup step.
 */

import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useRef } from 'react';
import DateTimePicker from "@react-native-community/datetimepicker"
import { useUser } from "../../context/UserContext"
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Button,
  PanResponder,
  GestureResponderEvent,
  TouchableOpacity,
  ImageBackground,
  TextInput,
  Platform,
  Modal,
} from 'react-native';
import { BASE_URL, endpoints } from '../../api';
import { Picker } from '@react-native-picker/picker';
import { getAccessToken } from '../../auth';

type Props = { navigation: NavigationProp<any> }
const DAYS = ["M", "T", "W", "TH", "F", "S", "SU"]

const TIMES = Array.from({ length: 144 }, (_, i) => {
  const totalMinutes = 11 * 60 + i * 5; // 12:00 PM .. 11:55 PM
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
});

const formatTo12Hour = (time24: string) => {
  const [hStr, mStr] = time24.split(":");
  if (!hStr || !mStr) return time24;
  let hours = parseInt(hStr, 10);
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${mStr} ${ampm}`;
};

type SelectedCell = { day: number; time: number }; // day: 0-6, time: 0-11 

const GroupChallCollab: React.FC<Props> = ({ navigation }) => {
  const route = useRoute()
  const { groupId, groupMembers } = route.params as {
    groupId: number
    groupMembers: { id: number; name: string }[]
  }

  const { user } = useUser()

  const [name, setName] = useState("")
  const [infoVisible, setInfoVisible] = React.useState(false);
  const horizontalScrollRef = useRef<ScrollView>(null);
  const [selectedCells, setSelectedCells] = useState<SelectedCell[]>([]);

  const dayToInt: Record<string, number> = {
    M: 1,
    T: 2,
    W: 3,
    TH: 4,
    F: 5,
    S: 6,
    SU: 7,
  }

  const getTotalDays = (value: number, unit: "weeks" | "months" | "years") => {
    switch (unit) {
      case "weeks":
        return value * 7;
      case "months":
        return value * 30; // approximate month as 30 days
      case "years":
        return value * 365; // ignoring leap years for simplicity
      default:
        return value;
    }
  };

  const toggleCell = (day: number, time: number) => {
    console.log("toggling")
    setSelectedCells(prev => {
      const exists = prev.some(cell => cell.day === day && cell.time === time);
      if (exists) {
        console.log("exists")
        return prev.filter(cell => !(cell.day === day && cell.time === time));
      } else {
        console.log("doesn't exist")
        return [...prev, { day, time }];
      }
    });
  };

  const isCellSelected = (day: number, time: number) =>
    selectedCells.some(cell => cell.day === day && cell.time === time);

  const convertTo24Hour = (time12: string) => {
    const s = time12.trim();
    if (/^\d{1,2}:\d{2}$/.test(s)) {
      const [hoursStr, minutesStr] = s.split(":");
      const hours = Number(hoursStr);
      const minutes = Number(minutesStr);
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }

    const [time, modifier] = s.split(" ");
    if (!time || !modifier) throw new Error(`Invalid time format: ${time12}`);

    const [hoursStr, minutesStr] = time.split(":");
    if (!hoursStr || !minutesStr) throw new Error(`Invalid time format: ${time12}`);

    let hours = Number(hoursStr);
    const minutes = Number(minutesStr);

    if (modifier === "AM" && hours === 12) hours = 0;
    if (modifier === "PM" && hours !== 12) hours += 12;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  const handleNext = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a challenge name")
      return
    }

    if (selectedCells.length === 0) {
      Alert.alert("Error", "Please select at least one availability slot.")
      return
    }

    const alarmSchedule = selectedCells.flatMap(({ day, time }) => {
      const dayStr = DAYS[day];
      if (!dayStr) return [];

      const dayOfWeek = dayToInt[dayStr as keyof typeof dayToInt];
      if (!dayOfWeek) return [];
      if (!TIMES[time]) return;
      return [{ dayOfWeek, time: convertTo24Hour(TIMES[time]) }];
    });

    navigation.navigate("GroupChallCollab2", {
      name,
      groupId,
      members: groupMembers.map((member) => member.id),
      alarmSchedule,
    })

  }

  return (
    <ImageBackground
      source={require('../../images/cgpt.png')}
      style={styles.background}
      resizeMode="cover"
    >

      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >

          <View style={styles.container}>
            <Text style={styles.pageTitle}>Group Challenge</Text>

            <View style={styles.formSection}>
              <Text style={styles.label}>Challenge Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter challenge name"
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.formSection}>
              <View style={[styles.formSection2, { flexDirection: "row", alignItems: "center" }]}>
                <Text style={styles.label}>Select Availability</Text>

                <TouchableOpacity
                  onPress={() => setInfoVisible(true)}
                  style={{ marginLeft: 6, marginTop: -10 }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="help-circle" size={22} color="rgba(255,255,255,0.85)" />
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', flex: 1 }}>
                {/* Fixed left column (times) */}
                <View>
                  {/* Empty corner cell to align with header row */}
                  <View style={styles.cell} />
                  {TIMES.map((time, timeIdx) => (
                    <View key={timeIdx} style={styles.cell}>
                      <Text style={styles.cellText}>{formatTo12Hour(time)}</Text>
                    </View>
                  ))}
                </View>

                {/* Scrollable section for days and grid */}
                <ScrollView horizontal>
                  <View>
                    {/* Top row (days) */}
                    <View style={styles.row}>
                      {DAYS.map((day, idx) => (
                        <View key={idx} style={styles.cell}>
                          <Text style={styles.cellText}>{day}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Scrollable grid below days */}
                    <ScrollView>
                      {TIMES.map((time, timeIdx) => (
                        <View key={timeIdx} style={styles.row}>
                          {DAYS.map((_, dayIdx) => (
                            <TouchableOpacity
                              key={`${dayIdx}-${timeIdx}`}
                              onPress={() => toggleCell(dayIdx, timeIdx)}
                              style={[
                                styles.cell,
                                styles.interactiveCell,
                                isCellSelected(dayIdx, timeIdx) && styles.selectedCell,
                              ]}
                            />
                          ))}
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                </ScrollView>
              </View>
            </View>

            <Modal transparent visible={infoVisible} animationType="fade" onRequestClose={() => setInfoVisible(false)}>
              <View style={styles.infoBackdrop}>
                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>How to set my availability?</Text>
                  <Text style={styles.infoText}>
                    Availability slots are in 5 minute segments. Selecting, for example,
                    the 6 AM slot on Monday means that you are available to have a 6 AM
                    alarm on Mondays. All group members will be able to enter their availabilities
                    into this chart once you send the invite. You will also be able to edit your
                    availability if needed.
                  </Text>
                  <TouchableOpacity style={styles.infoClose} onPress={() => setInfoVisible(false)}>
                    <Text style={styles.infoCloseText}>Got it</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
            <TouchableOpacity style={styles.createButton} onPress={handleNext}>
              <LinearGradient
                colors={['#FFD700', '#FFC107']}
                style={styles.createButtonGradient}
              >
                <Text style={styles.createButtonText}>Next</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    paddingHorizontal: 10
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
    marginTop: 5,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 20,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    marginTop: -40,
  },
  formSection: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  formSection2: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 12,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#FFF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  dateDisplay: {
    color: '#FFD700',
    fontSize: 16,
    marginBottom: 10,
  },
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 15,
    marginTop: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  doneButton: {
    backgroundColor: 'rgba(255,215,0,0.3)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  doneButtonText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    width: 60,
    height: 30,
    borderWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellText: {
    color: '#FFF',
    fontSize: 12,
  },
  interactiveCell: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  selectedCell: {
    backgroundColor: 'rgba(255, 0, 0, 0.3)',
  },
  createButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
  },
  createButtonGradient: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    color: '#333',
    fontSize: 18,
    fontWeight: '700',
  },
  infoBtn: {
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIcon: {

    textShadowColor: 'rgba(0, 0, 0, 0.30)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  infoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  infoCard: {
    width: '90%',
    backgroundColor: 'rgba(40, 40, 48, 0.65)',
    borderRadius: 26,
    padding: 23,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  infoTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  infoText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
  },
  infoClose: {
    alignSelf: 'flex-end',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
  },
  infoCloseText: {
    color: '#FFF',
    fontWeight: '700',
  },
})


export default GroupChallCollab;