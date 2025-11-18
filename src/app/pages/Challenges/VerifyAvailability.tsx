import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useFocusEffect, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { getAccessToken } from '../../auth';
import NavBar from '../Components/NavBar';

type Props = { navigation: NavigationProp<any> } 
// Config 
const DAYS = ["M", "T", "W", "TH", "F", "S", "SU"]
// const TIMES = Array.from({ length: 12 }, (_, i) => `${i + 6}:00`); // 6am - 5pm 

// const START_MIN = 24 * 60; // 10:00 PM
// const END_MIN = 25 * 60;   // 12:00 AM next day
// const STEP_MIN = 1;

// const TIMES = Array.from(
//   { length: Math.floor((END_MIN - START_MIN) / STEP_MIN) + 1 }, // 121 entries (includes 12:00 AM)
//   (_, i) => {
//     const totalMinutes = START_MIN + i * STEP_MIN;
//     const hours24 = Math.floor(totalMinutes / 60) % 24;
//     const minutes = totalMinutes % 60;
//     return `${String(hours24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`; // "HH:MM"
//   }
// );

const TIMES = Array.from({ length: 100 }, (_, i) => {
  const totalMinutes = 1 * 60 + i * 5; // start at 4:00
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
});

type SelectedCell = { day: number; time: number }; // day: 0-6, time: 0-11 

const VerifyAvailability: React.FC<Props> = ({ navigation }) => { 
  const { user, logout } = useUser()
  console.log("in verify")

  // const [selectedCells, setSelectedCells] = useState<SelectedCell[]>([]);

    // state for current selections
  const [selectedCells, setSelectedCells] = useState<SelectedCell[]>([]);
  // state for initial fetched availability
  const [initialCells, setInitialCells] = useState<SelectedCell[]>([]);
  const [infoVisible, setInfoVisible] = React.useState(false);


  const dayToInt: Record<string, number> = {
    M: 1,
    T: 2,
    W: 3,
    TH: 4,
    F: 5,
    S: 6,
    SU: 7,
  }



  const toggleCell = (day: number, time: number) => {
    setSelectedCells(prev => {
      const exists = prev.some(cell => cell.day === day && cell.time === time);
      if (exists) {
        return prev.filter(cell => !(cell.day === day && cell.time === time));
      } else {
        return [...prev, { day, time }];
      }
    });
  };
  const isCellSelected = (day: number, time: number) =>
    selectedCells.some(cell => cell.day === day && cell.time === time);



const convertTo24Hour = (input: string) => {
  // Accepts:
  //  - "HH:MM" (24-hour)
  //  - "h:MM AM/PM" (12-hour)
  // Returns: "HH:MM" (24-hour)

  // If already 24-hour format
  if (/^\d{2}:\d{2}$/.test(input)) {
    return input;
  }

  // Try to parse 12-hour format
  const m = /^(\d{1,2}):(\d{2})\s?(AM|PM)$/i.exec(input);
  if (m) {
    const hStr = m[1]!;
    const minStr = m[2]!;
    const ampm = m[3]!.toUpperCase();
    let hours = parseInt(hStr, 10);
    const minutes = parseInt(minStr, 10);

    if (ampm === "AM" && hours === 12) hours = 0;
    if (ampm === "PM" && hours !== 12) hours += 12;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  throw new Error(`Invalid time format: ${input}`);
};


useFocusEffect(
  useCallback(() => {
    const fetchAvailability = async () => {
      try {
        console.log("getting")
              const accessToken = await getAccessToken();
              if (!accessToken) {
                  Alert.alert(
                    "Session expired",
                    "Your login session has expired. Please log in again.",
                    [
                      {
                        text: "OK",
                        onPress: async () => {
                          await logout();
                          navigation.reset({
                            index: 0,
                            routes: [{ name: "Login" }],
                          });
                        },
                      },
                    ],
                    { cancelable: false }
                  );

                  return;
              }
        const res = await fetch(endpoints.getUserAvailability(Number(user?.id)), {
                headers: {
                  Authorization: `Bearer ${accessToken}`
                }
              });
        if (!res.ok) throw new Error("Failed to fetch availability");
        const data: { dayOfWeek: number; alarmTime: string }[] = await res.json();

        // convert backend format to SelectedCell[]
        const converted: SelectedCell[] = data.flatMap(({ dayOfWeek, alarmTime }) => {
          const timeIdx = TIMES.findIndex(t => convertTo24Hour(t) === alarmTime);
          if (timeIdx === -1) return [];
          return [{ day: dayOfWeek - 1, time: timeIdx }]; // backend 1-7 → front 0-6
        });

        setSelectedCells(converted);
        setInitialCells(converted); // save initial state
      } catch (err) {
        console.error(err);
      }
    };

    fetchAvailability();
  }, [user?.id])
);


  const formatTo12Hour = (time24: string) => {
    const [hStr, mStr] = time24.split(":");
    if (!hStr) return;
    if (!mStr) return;
    let hours = parseInt(hStr, 10);
    const minutes = parseInt(mStr, 10);
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${mStr} ${ampm}`;
};

  const handleSubmit = async () => {
    console.log("setting")
    // Find cells that are different from initial
    const toggledCells = selectedCells.filter(
      cell => !initialCells.some(init => init.day === cell.day && init.time === cell.time)
    ).concat(
      initialCells.filter(
        cell => !selectedCells.some(sel => sel.day === cell.day && sel.time === cell.time)
      )
    );

    const newlyToggledCells = toggledCells.map(cell => {
      const timeStr = TIMES[cell.time];
      if (!timeStr) throw new Error("Invalid time index");
      return { dayOfWeek: cell.day + 1, time: convertTo24Hour(timeStr) };
    });

    const payload = { alarm_schedule: newlyToggledCells }; 
    console.log("Payload sent to backend:", payload);


        try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
                  Alert.alert(
                    "Session expired",
                    "Your login session has expired. Please log in again.",
                    [
                      {
                        text: "OK",
                        onPress: async () => {
                          await logout();
                          navigation.reset({
                            index: 0,
                            routes: [{ name: "Login" }],
                          });
                        },
                      },
                    ],
                    { cancelable: false }
                  );

                  return;
      }

        
        const res = await fetch(endpoints.setUserAvailability(Number(user?.id)), {
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

        const data = await res.json();
        Alert.alert('Success', 'Schedule verified', [
            { text: 'OK', onPress: () => navigation.navigate('PublicChallSearch1') },
        ]);
        } catch (err: any) {
            Alert.alert('Error', err.message);
        }

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



<View style={styles.formSection}>
  <View style={[styles.formSection2, { flexDirection: "row", alignItems: "center" }]}>
    <Text style={styles.label}>Edit Availability</Text>

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
              Availability slots are in 15 mintute segments. Selecting, for example,
              the 6 AM slot on Monday means that you are available from 6 AM to 6:14 AM
              on Mondays. We will filter the public challenge results such that they
              fit within your availability.
            </Text>
            <TouchableOpacity style={styles.infoClose} onPress={() => setInfoVisible(false)}>
              <Text style={styles.infoCloseText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>


          <TouchableOpacity style={styles.createButton} onPress={handleSubmit}>
            <LinearGradient
              colors={['#FFD700', '#FFC107']}
              style={styles.createButtonGradient}
            >
              <Text style={styles.createButtonText}>Verify Schedule</Text>
            </LinearGradient>
          </TouchableOpacity>

      </ScrollView>
      </View>

      <NavBar
        goToPublicChallenges={() => navigation.navigate("PublicChallenges")}
        goToChallenges={() => navigation.navigate("Challenges")}
        goToGroups={() => navigation.navigate("Groups")}
        goToMessages={() => navigation.navigate("Messages")}
        goToProfile={() => navigation.navigate("Profile")}
        active="Public"
      />
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
    paddingHorizontal: 20,
  },
    backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  formSection: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
formSection2: {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: 4,
  paddingHorizontal: 2,
},
})


export default VerifyAvailability;