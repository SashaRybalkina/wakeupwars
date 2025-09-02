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

type Props = { navigation: NavigationProp<any> } 
// Config 
const DAYS = ["M", "T", "W", "TH", "F", "S", "SU"]
const TIMES = Array.from({ length: 12 }, (_, i) => `${i + 6}:00`); // 6am - 5pm 
type SelectedCell = { day: number; time: number }; // day: 0-6, time: 0-11 

const GroupChallCollab: React.FC<Props> = ({ navigation }) => { 
  const route = useRoute() 
  const { groupId, groupMembers } = route.params as { 
    groupId: number 
    groupMembers: { id: number; name: string }[] }

  const { user } = useUser()

  const [name, setName] = useState("")
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)

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

  const onDateChange = (event: any, date?: Date) => {
    if (event?.type === "dismissed") {
      setShowDatePicker(false)
      return
    }
  
    if (date) {
      setSelectedDate(date)
      if (Platform.OS === "android") {
        setShowDatePicker(false)
      }
    }
  }

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    }
    return date.toLocaleDateString(undefined, options)
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






    const handleSubmit = async() => {
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
            if (dayStr === undefined) return [];

            const dayOfWeek = dayToInt[dayStr as keyof typeof dayToInt];
            if (dayOfWeek === undefined) return [];

            return [{ dayOfWeek, time: TIMES[time] }];
        });


        console.log("Alarm Availabilities:", alarmSchedule)

        const payload = {
            name,
            group_id: groupId,
            end_date: selectedDate.toISOString().split("T")[0],
            member: user?.id,
            alarm_schedule: alarmSchedule,
        }
        console.log(payload)

        try {
            const csrfRes = await fetch(`${BASE_URL}/api/csrf-token/`, {
                credentials: 'include',                      
        });
        if (!csrfRes.ok) throw new Error('Failed to fetch CSRF token');
        const { csrfToken } = await csrfRes.json();     
        console.log('csrfToken:', csrfToken);


        const res = await fetch(endpoints.createPendingGroupChallenge, {
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
        Alert.alert('Success', 'Schedule saved successfully', [
            { text: 'OK', onPress: () => navigation.navigate('GroupDetails', { groupId, groupMembers, refresh: Date.now() }) },
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
            <Text style={styles.label}>End Date</Text>
            <Text style={styles.dateDisplay}>{formatDate(selectedDate)}</Text>

            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.actionButton}>
              <LinearGradient
                colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
                style={styles.buttonGradient}
              >
                <Ionicons name="calendar-outline" size={20} color="#FFF" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Select End Date</Text>
              </LinearGradient>
            </TouchableOpacity>

            {showDatePicker && (
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="spinner"
                  onChange={onDateChange}
                />
                {Platform.OS !== 'android' && (
                  <TouchableOpacity
                    style={styles.doneButton}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

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

          <TouchableOpacity style={styles.createButton} onPress={handleSubmit}>
            <LinearGradient
              colors={['#FFD700', '#FFC107']}
              style={styles.createButtonGradient}
            >
              <Text style={styles.createButtonText}>Save Schedule</Text>
            </LinearGradient>
          </TouchableOpacity>

      </View>


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
    height: 40,
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