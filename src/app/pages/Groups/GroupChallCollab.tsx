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
} from 'react-native';
import { BASE_URL, endpoints } from '../../api';
import { Picker } from '@react-native-picker/picker';
import { getAccessToken } from '../../auth';

type Props = { navigation: NavigationProp<any> } 
// Config 
const DAYS = ["M", "T", "W", "TH", "F", "S", "SU"]
// const TIMES = Array.from({ length: 12 }, (_, i) => `${i + 6}:00`); // 6am - 5pm 

const TIMES = Array.from({ length: 80 }, (_, i) => {
  const totalMinutes = 4 * 60 + i * 15; // start at 4:00
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
});


// const START_MIN = 14 * 60; // 10:00 PM
// const END_MIN = 16 * 60;   // 12:00 AM next day
// const STEP_MIN = 1;

// const TIMES = Array.from(
//   { length: Math.floor((END_MIN - START_MIN) / STEP_MIN) + 1 }, // 121 entries
//   (_, i) => {
//     const totalMinutes = START_MIN + i * STEP_MIN;
//     const hours24 = Math.floor(totalMinutes / 60) % 24; // wrap past midnight
//     const minutes = totalMinutes % 60;

//     const period = hours24 >= 12 ? "PM" : "AM";
//     const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

//     return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
//   }
// );

// const TIMES = Array.from({ length: 44 }, (_, i) => {
//   const totalMinutes = 4 * 60 + i * 15; // start at 4:00
//   const hours24 = Math.floor(totalMinutes / 60);
//   const minutes = totalMinutes % 60;

//   const period = hours24 >= 12 ? "PM" : "AM";
//   const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

//   return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
// });


type SelectedCell = { day: number; time: number }; // day: 0-6, time: 0-11 

const GroupChallCollab: React.FC<Props> = ({ navigation }) => { 
  const route = useRoute() 
  const { groupId, groupMembers } = route.params as { 
    groupId: number 
    groupMembers: { id: number; name: string }[] }

  const { user } = useUser()

  const [name, setName] = useState("")
  // const [selectedDate, setSelectedDate] = useState(new Date())
  // const [showDatePicker, setShowDatePicker] = useState(false)
  // const [durationValue, setDurationValue] = useState(1); // default 1
  // const [durationUnit, setDurationUnit] = useState<"weeks" | "months" | "years">("weeks");

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
  // "4:15 AM" => "04:15", "3:00 PM" => "15:00"
  const [time, modifier] = time12.split(" ");
  if (!time || !modifier) throw new Error(`Invalid time format: ${time12}`);

  const [hoursStr, minutesStr] = time.split(":");
  if (!hoursStr || !minutesStr) throw new Error(`Invalid time format: ${time12}`);

  let hours = Number(hoursStr);
  const minutes = Number(minutesStr);

  if (modifier === "AM" && hours === 12) hours = 0;
  if (modifier === "PM" && hours !== 12) hours += 12;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};



    const handleNext = async() => {
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

        // const payload = {
        //   name,
        //   group_id: groupId,
        //   members: groupMembers.map((member) => member.id),
        //   alarm_schedule: alarmSchedule,
        // };

        navigation.navigate("GroupChallCollab2", {
          name,
          groupId,
          members: groupMembers.map((member) => member.id),
          alarmSchedule
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

          {/* <View style={styles.formSection}>
            <Text style={styles.label}>Challenge Duration</Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 10 }]}
                keyboardType="numeric"
                value={String(durationValue)}
                onChangeText={text => setDurationValue(Number(text) || 0)}
              />

              <Picker
                selectedValue={durationUnit}
                style={{ flex: 1 }}
                onValueChange={(itemValue) => setDurationUnit(itemValue)}
              >
                <Picker.Item label="Weeks" value="weeks" />
                <Picker.Item label="Months" value="months" />
                <Picker.Item label="Years" value="years" />
              </Picker>
            </View>
          </View> */}

          <View style={styles.formSection}>
            <Text style={styles.label}>Select Availability</Text>
            <ScrollView horizontal>
              <View>
                <View style={styles.row}>
                  <View style={styles.cell} />
                  {DAYS.map((day, idx) => (
                    <View key={idx} style={styles.cell}>
                      <Text style={styles.cellText}>{day}</Text>
                    </View>
                  ))}
                </View>

                {TIMES.map((time, timeIdx) => (
                  <View key={timeIdx} style={styles.row}>
                    <View style={styles.cell}>
                      <Text style={styles.cellText}>{time}</Text>
                    </View>
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
              </View>
            </ScrollView>
          </View>

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
})


export default GroupChallCollab;