import React, { useState } from 'react';
import {
  Alert,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NavigationProp, RouteProp, useRoute } from '@react-navigation/native';
import { Button } from 'tamagui';
import { endpoints } from '../../api';

type Props = {
  navigation: NavigationProp<any>;
};

const DAYS = ['M', 'T', 'W', 'TH', 'F', 'S', 'SU'];

const GroupChall2: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { groupId, groupMembers } = route.params as {
    groupId: number;
    groupMembers: { id: number; name: string }[];
  };

  const [name, setName] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [tempTime, setTempTime] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [dayTimeMapping, setDayTimeMapping] = useState<Record<string, string>>({});
  const [gamesByDay, setGamesByDay] = useState<Record<string, string[][]>>({});

  const toggleDay = (day: string) => {
    // If the day is already selected, deselect it
    if (selectedDays.includes(day)) {
      setSelectedDays(prev => prev.filter(d => d !== day));
    } else {
      // If there are already selected days (after game selection), switch to single-select behavior
      if (selectedDays.length > 0) {
        setSelectedDays([day]);
      } else {
        // First selection (multi-select phase for games or times)
        setSelectedDays(prev => [...prev, day]);
      }
    }
  };
  

  const onDateChange = (_: any, date?: Date) => {
    if (date) setSelectedDate(date);
  };

  const onTimeChange = (_: any, time?: Date) => {
    if (time) setTempTime(time);
  };

  const handleSetTime = () => {
    if (!tempTime) return;
    const formattedTime = tempTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const updatedMapping = { ...dayTimeMapping };
    selectedDays.forEach((day) => {
      updatedMapping[day] = formattedTime;
    });

    setDayTimeMapping(updatedMapping);
    setTempTime(null);
    setSelectedDays([]);
    setShowTimePicker(false);
  };

  // const handleGameAdd = (game: string, attr: string[]) => {
  //   const updated = { ...gamesByDay };
  //   selectedDays.forEach((day) => {
  //     if (!updated[day]) updated[day] = [];
  //     updated[day].push([game, attr[0] ?? '', attr[1] ?? '']);
  //   });
  //   setGamesByDay(updated);
  //   // Do NOT clear selectedDays
  // };
  const handleGameAdd = (game: { id: number; name: string }) => {
    const updated = { ...gamesByDay };
    selectedDays.forEach((day) => {
      if (!updated[day]) updated[day] = [];
      updated[day].push([game.id.toString(), game.name]); // keep it consistent
    });
    setGamesByDay(updated);
  };
  

  const handleGameRemove = (day: string, index: number) => {
    const updated = { ...gamesByDay };
    const games = updated[day];
  
    if (!games) return; // No games to remove
  
    updated[day] = games.filter((_, i) => i !== index);
    if (updated[day].length === 0) delete updated[day];
    setGamesByDay(updated);
  };
  

  return (
    <ImageBackground
      source={require('../../images/secondary.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.backButtonContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={30} color="#FFF" />
        </TouchableOpacity>
      </View>
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.nameContainer}>
            <Text style={styles.title}>Name:</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter name"
              placeholderTextColor="white"
              value={name}
              onChangeText={setName}
            />
          </View>
  
          <Text style={styles.sectionTitle}>Select Days:</Text>
          <ScrollView horizontal style={styles.dayTimeContainer}>
            {DAYS.map((day, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayTimeItem,
                  selectedDays.includes(day) && styles.daySelected,
                ]}
                onPress={() => toggleDay(day)}
              >
                <Text style={styles.dayTimeText}>
                  {day} {dayTimeMapping[day] ? `• ${dayTimeMapping[day]}` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
  
          <Button onPress={() => setShowTimePicker(true)} style={styles.dateButton}>
            Set Alarm Time
          </Button>
  
          {showTimePicker && (
            <>
              <DateTimePicker
                value={tempTime || new Date()}
                mode="time"
                display="spinner"
                onChange={onTimeChange}
              />
              <Button onPress={handleSetTime} style={styles.doneButton}>
                Done
              </Button>
            </>
          )}
  
          {selectedDays.length === 1 &&
            (() => {
              const selectedDay = selectedDays[0]!;
              return (
                <>
                  <Text style={styles.sectionTitle}>Games for {selectedDay}:</Text>
                  <View style={styles.gameWrapper}>
                    {(gamesByDay[selectedDay] || []).map((game, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.game}
                        onPress={() => handleGameRemove(selectedDay, index)}
                      >
                        <Text style={styles.gameTitle}>{game[1]}</Text>
                        <ImageBackground
                          source={require('../../images/sudoku.png')}
                          style={styles.sudoku}
                        />
                      </TouchableOpacity>
                    ))}
  
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => {
                        navigation.navigate('GroupChall3', {
                          groupId,
                          groupMembers,
                          catType: 'Group',
                          onGameSelected: (game: { id: number; name: string }) => {
                            handleGameAdd(game);
                          },
                        });
                      }}
                    >
                      <Ionicons name="add-circle-outline" size={35} color={'#FFF'} />
                      <Text style={styles.addText}>Add new</Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
  
          <Text style={styles.sectionTitle}>
            End date: {selectedDate.toDateString()}
          </Text>
          <Button onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
            Select Date
          </Button>
          {showDatePicker && (
            <>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="spinner"
                onChange={onDateChange}
              />
              <Button onPress={() => setShowDatePicker(false)} style={styles.doneButton}>
                Done
              </Button>
            </>
          )}
  
          <Button
            style={styles.finishButton}
            onPress={() => {
              const payload = {
                name,
                group_id: groupId,
                start_date: new Date().toISOString().split('T')[0], // or a selected start date
                end_date: selectedDate.toISOString().split('T')[0],
                alarm_schedule: Object.entries(dayTimeMapping).map(([day, time]) => ({
                  day,
                  time,
                })),
                games_schedule: Object.entries(gamesByDay).map(([day, games]) => ({
                  day,
                  games: games.map(([name, repeats, minutes]) => ({
                    name,
                    repeats: repeats || null,
                    minutes: minutes || null,
                  })),
                })),
              };
              fetch(`$https://29f4-136-38-171-186.ngrok-free.app/api/group-challenges/`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  // add auth header if needed
                },
                body: JSON.stringify(payload),
              })
                .then((res) => {
                  if (!res.ok) throw new Error('Failed to create challenge');
                  return res.json();
                })
                .then((data) => {
                  console.log('Challenge created:', data);
                  navigation.navigate('Challenges');
                })
                .catch((err) => {
                  Alert.alert('Error', err.message);
                });
              
            }}
          >
            Finish
          </Button>
        </ScrollView>
      </View>
    </ImageBackground>
  );
  
  
  
};

const styles = StyleSheet.create({
  background: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sudoku: {
    width: 50,
    height: 50,
    marginLeft: 8,
  },
  scrollContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 150,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FFF',
    marginRight: 10,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    fontSize: 20,
    padding: 7.5,
    color: '#FFF',
    width: '60%',
    textAlign: 'center',
  },
  timePickerButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    padding: 10,
    marginTop: 20,
    marginBottom: 10,
  },
  pickerText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  daysContainer: {
    flexDirection: 'row',
    marginTop: 20,
  },
  day: {
    padding: 10,
    marginHorizontal: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 5,
  },
  daySelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  dayText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 20,
    color: '#FFF',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    marginVertical: 15,
    marginHorizontal: 5,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  addText: {
    fontSize: 18,
    marginLeft: 10,
    color: '#FFF',
  },
  gameWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  game: {
    marginHorizontal: 5,
    marginVertical: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    paddingLeft: -3,
  },
  gameTitle: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 10,
    color: '#FFF',
  },
  gameText: {
    textAlign: 'center',
    fontSize: 11.5,
    marginLeft: 10,
    color: '#DDD',
  },
  dateButton: {
    marginTop: 15,
    padding: 10,
    fontSize: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    color: '#FFF',
  },
  doneButton: {
    marginBottom: 20,
    marginTop: -10,
    padding: 10,
    width: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    color: '#FFF',
  },
  finishButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    fontSize: 20,
    width: 150,
    color: '#FFF',
    fontWeight: 'bold',
  },
  buttons: {
    flexDirection: 'row',
    height: 100,
    justifyContent: 'space-around',
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#211F26',
  },
  button: { backgroundColor: 'transparent' },
  timeText: {
    fontSize: 12,
    color: '#FFF',
    marginTop: 4,
  },  
  daysScrollContainer: {
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayTimeContainer: {
    flexDirection: 'row',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxHeight: 50,
  },
  
  dayTimeItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayTimeItemSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderColor: '#FFF',
  },  
  dayTimeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  
});

export default GroupChall2;
