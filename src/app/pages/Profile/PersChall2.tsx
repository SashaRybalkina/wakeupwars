import React, { useState } from 'react';
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

const DAYS = ['M', 'T', 'W', 'TH', 'F', 'S', 'SU'];

const PersChall2 = ({ navigation }) => {
  const [selectedDays, setSelectedDays] = useState({});
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [curGames, setCurGames] = useState<string[][]>([]);
  const [name, setName] = useState('');

  const toggleDay = (day) => {
    setSelectedDays((prev) => ({
      ...prev,
      [day]: !prev[day],
    }));
  };

  const onDateChange = (event, date) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const onTimeChange = (event, time) => {
    if (time) {
      setSelectedTime(time);
    }
  };

  return (
    <ImageBackground
      source={require('../../images/secondary.png')}
      style={styles.background}
      resizeMode="cover"
    >
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

          <TouchableOpacity
            onPress={() => setShowTimePicker(true)}
            style={styles.timePickerButton}
          >
            <Text style={styles.pickerText}>
              {selectedTime.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </TouchableOpacity>
          {showTimePicker && (
            <>
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display="spinner"
                onChange={onTimeChange}
                textColor="#FFF"
              />
              <Button
                onPress={() => setShowTimePicker(false)}
                style={styles.doneButton}
              >
                Done
              </Button>
            </>
          )}

          <View style={styles.daysContainer}>
            {DAYS.map((day, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.day, selectedDays[day] && styles.daySelected]}
                onPress={() => toggleDay(day)}
              >
                <Text style={styles.dayText}>{day}</Text>
              </TouchableOpacity>
            ))}
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
                navigation.navigate('Categories', {
                  catType: 'Personal',
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

          <Text style={styles.sectionTitle}>
            End date: {selectedDate.toDateString()}
          </Text>
          <Button
            onPress={() => setShowDatePicker(true)}
            style={styles.dateButton}
          >
            Select Date
          </Button>
          {showDatePicker && (
            <>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="spinner"
                onChange={onDateChange}
                textColor="#FFF"
              />
              <Button
                onPress={() => setShowDatePicker(false)}
                style={styles.doneButton}
              >
                Done
              </Button>
            </>
          )}

          <Button style={styles.finishButton}>Finish</Button>
        </ScrollView>

        <View style={styles.buttons}>
          <Button
            style={styles.button}
            onPress={() => navigation.navigate('Challenges')}
          >
            <Ionicons name="star-outline" size={40} color={'#FFF5CD'} />
          </Button>
          <Button
            style={styles.button}
            onPress={() => navigation.navigate('Groups')}
          >
            <Ionicons name="people-outline" size={40} color={'#FFF5CD'} />
          </Button>
          <Button
            style={styles.button}
            onPress={() => navigation.navigate('Messages')}
          >
            <Ionicons name="mail-outline" size={40} color={'#FFF5CD'} />
          </Button>
          <Button style={styles.button}>
            <Ionicons name="person" size={40} color={'#FFF5CD'} />
          </Button>
        </View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
});

export default PersChall2;
