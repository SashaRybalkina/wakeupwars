import React, { useState, useEffect } from 'react';
import {
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
import { NavigationProp, useRoute } from '@react-navigation/native';
import { Button } from 'tamagui';
import axios from 'axios';
import { endpoints } from '../../api';

const DAYS = ['M', 'T', 'W', 'TH', 'F', 'S', 'SU'];

const ChallSchedule = ({ navigation }: { navigation: NavigationProp<any> }) => {
  const route = useRoute();
  const { challId, challName, whichChall } = route.params as {
    challId: number;
    challName: string;
    whichChall: string;
  };  

  const [selectedDays, setSelectedDays] = useState<Record<string, boolean>>({});
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [selectedStartDate, setSelectedStartDate] = useState(new Date());
  const [selectedEndDate, setSelectedEndDate] = useState(new Date());
  const [curGames, setCurGames] = useState<string[][]>([]);
  const [name, setName] = useState('');
  const [alarmSchedule, setAlarmSchedule] = useState<
    { dayOfWeek: number; alarmTime: string; userName: string }[]
  >([]);
  const getDayLabel = (dayOfWeek: number): string => {
    const labels = ['M', 'T', 'W', 'TH', 'F', 'S', 'SU'];
    return labels[dayOfWeek] || '';
  };
  

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const [detailRes, scheduleRes] = await Promise.all([
          axios.get(endpoints.challengeDetail(challId)),
          axios.get(endpoints.challengeSchedule(challId)),
        ]);
  
        const detail = detailRes.data;
        const data = scheduleRes.data;
  
        console.log('Challenge detail:', detail);
        console.log('Schedule data:', data);
  
        const parseLocalDate = (dateStr: string): Date => {
          const parts = dateStr.split('-');
          const year = Number(parts[0]);
          const month = Number(parts[1]);
          const day = Number(parts[2]);
        
          if (isNaN(year) || isNaN(month) || isNaN(day)) {
            console.warn('Invalid date string:', dateStr);
            return new Date();
          }
        
          return new Date(year, month - 1, day);
        };

        setSelectedStartDate(parseLocalDate(detail.startDate));
        setSelectedEndDate(parseLocalDate(detail.endDate));
  
        const parsedDays: Record<string, boolean> = {};
        data.forEach((day: any) => {
          const label = DAYS[day.dayOfWeek];
          if (label) parsedDays[label] = true;
        });
        setSelectedDays(parsedDays);
  
        const alarmParsed = data.map((day: any) => ({
          dayOfWeek: day.dayOfWeek,
          alarmTime: day.alarmTime,
          userName: '',
        }));
        setAlarmSchedule(alarmParsed);
  
        const allGames: string[][] = data.flatMap((day: any) =>
          day.games.map((g: any) => [g.name, '-', '-'])
        );
        setCurGames(allGames);
      } catch (err) {
        console.error(err);
      }
    };
  
    fetchSchedule();
  }, []);  
  
  const toggleDay = (day: string) => {
    setSelectedDays((prev) => ({
      ...prev,
      [day]: !prev[day],
    }));
  };

  const onStartDateChange = (event: any, date: Date | undefined) => {
    if (date) {
      setSelectedStartDate(date);
    }
  };

  const onEndDateChange = (event: any, date: Date | undefined) => {
    if (date) {
      setSelectedEndDate(date);
    }
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
          <Text style={styles.title}>{challName}</Text>

          <Text style={styles.sectionTitle}>
            Start date: {selectedStartDate.toDateString()}
          </Text>
          <Button
            onPress={() => setShowStartDatePicker(true)}
            style={styles.dateButton}
          >
            Edit Start Date
          </Button>
          {showStartDatePicker && (
            <>
              <DateTimePicker
                value={selectedStartDate}
                mode="date"
                display="spinner"
                onChange={onStartDateChange}
                textColor="#FFF"
              />
              <Button
                onPress={() => setShowStartDatePicker(false)}
                style={styles.doneButton}
              >
                Done
              </Button>
            </>
          )}

          <Text style={styles.sectionTitle}>
            End date: {selectedEndDate.toDateString()}
          </Text>
          <Button
            onPress={() => setShowEndDatePicker(true)}
            style={styles.dateButton}
          >
            Edit End Date
          </Button>
          {showEndDatePicker && (
            <>
              <DateTimePicker
                value={selectedEndDate}
                mode="date"
                display="spinner"
                onChange={onEndDateChange}
                textColor="#FFF"
              />
              <Button
                onPress={() => setShowEndDatePicker(false)}
                style={styles.doneButton}
              >
                Done
              </Button>
            </>
          )}

          <View style={styles.alarmDaysRow}>
            {alarmSchedule.map((item, index) => {
              const label = getDayLabel(item.dayOfWeek);
              const isSelected = selectedDays[label];

              return (
                <View key={index} style={[styles.dayItem, isSelected && styles.dayItemSelected]}>
                  <Text style={styles.dayLabelText}>{label}</Text>
                  {item.alarmTime && (
                    <Text style={styles.dayAlarmText}>Alarm at: {item.alarmTime}</Text>
                  )}
                </View>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Games:</Text>
          <View style={styles.gameWrapper}>
            {curGames.map((game, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.game]}
                onPress={() =>
                  setCurGames((prevGames) =>
                    prevGames.filter((_, i) => i !== index),
                  )
                }
              >
                <Text style={styles.gameTitle}>{game[0]}</Text>
                {game[0] != 'Sudoku' && (
                  <Text style={styles.gameText}>{'Repeats: ' + game[1]}</Text>
                )}
                {game[0] != 'Sudoku' && (
                  <Text style={styles.gameText}>{'Minutes: ' + game[2]}</Text>
                )}
                {game[0] == 'Sudoku' && (
                  <ImageBackground
                    source={require('../../images/sudoku.png')}
                    style={styles.sudoku}
                  ></ImageBackground>
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                navigation.navigate('GroupChall3', {
                  catType: 'Group',
                  onGameSelected: (game: string, attr: string[]) => {
                    setCurGames((prevGames) => [
                      ...prevGames,
                      [game, attr[0] + '', attr[1] + ''],
                    ]);
                  },
                });
              }}
            >
              <Ionicons name="add-circle-outline" size={35} color={'#FFF'} />
              <Text style={styles.addText}>Add new</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

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
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    flex: 1,
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
    marginBottom: 25,
    marginTop: -30,
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
    marginTop: 50,
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
    marginBottom: 30,
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
  alarmText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 5,
    textAlign: 'center',
  },
  alarmDaysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  
  dayItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginHorizontal: 5,
    marginVertical: 5,
    alignItems: 'center',
  },
  
  dayItemSelected: {
    backgroundColor: '#FFF455',
  },
  
  dayLabelText: {
    fontWeight: '700',
    fontSize: 16,
    color: '#000',
  },
  
  dayAlarmText: {
    fontSize: 12,
    color: '#333',
  },  
});

export default ChallSchedule;
