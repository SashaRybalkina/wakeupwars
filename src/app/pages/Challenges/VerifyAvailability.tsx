import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useRef, useEffect } from 'react';
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

type Props = { navigation: NavigationProp<any> } 
// Config 
const DAYS = ["M", "T", "W", "TH", "F", "S", "SU"]
// const TIMES = Array.from({ length: 12 }, (_, i) => `${i + 6}:00`); // 6am - 5pm 
const TIMES = Array.from({ length: 44 }, (_, i) => {
  const totalMinutes = 4 * 60 + i * 15; // start at 4:00
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
});


type SelectedCell = { day: number; time: number }; // day: 0-6, time: 0-11 

const VerifyAvailability: React.FC<Props> = ({ navigation }) => { 
  const { user } = useUser()

  // const [selectedCells, setSelectedCells] = useState<SelectedCell[]>([]);

    // state for current selections
  const [selectedCells, setSelectedCells] = useState<SelectedCell[]>([]);
  // state for initial fetched availability
  const [initialCells, setInitialCells] = useState<SelectedCell[]>([]);


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



  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const res = await fetch(endpoints.getUserAvailability(Number(user?.id)));
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
  }, [user?.id]);

  const handleSubmit = async () => {
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
          const csrfRes = await fetch(`${BASE_URL}/api/csrf-token/`, {
            credentials: 'include',                      
          });
          if (!csrfRes.ok) throw new Error('Failed to fetch CSRF token');
          const { csrfToken } = await csrfRes.json();     
          console.log('csrfToken:', csrfToken);

        
        const res = await fetch(endpoints.setUserAvailability(Number(user?.id)), {
            method: 'POST',
            credentials: 'include',                    
            headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,                
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
          <ScrollView
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          >


          <View style={styles.formSection}>
            <Text style={styles.label}>Edit Availability</Text>
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

          <TouchableOpacity style={styles.createButton} onPress={handleSubmit}>
            <LinearGradient
              colors={['#FFD700', '#FFC107']}
              style={styles.createButtonGradient}
            >
              <Text style={styles.createButtonText}>Verify Schedule</Text>
            </LinearGradient>
          </TouchableOpacity>

      </ScrollView>
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


export default VerifyAvailability;