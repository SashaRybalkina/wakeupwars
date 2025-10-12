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
import { getMetaFromTuple } from '../Games/NewGamesManagement';
import { getNextAlarmDate } from '../../../utils/dateUtils';

type Props = { navigation: NavigationProp<any> } 
// Config 


const GroupChallCollab2: React.FC<Props> = ({ navigation }) => { 
  const route = useRoute() 
  const { name, groupId, members, alarmSchedule } = route.params as { 
    name: string
    groupId: number 
    members: { id: number; name: string }[]
    alarmSchedule: { dayOfWeek: number; time: string }[], }

  console.log("GroupChallCollab2 route params:", route.params);

  const { user } = useUser()

  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [gamesByDay, setGamesByDay] = useState<Record<string, [string, string][]>>({})

  const dayToInt: Record<string, number> = {
    M: 1,
    T: 2,
    W: 3,
    TH: 4,
    F: 5,
    S: 6,
    SU: 7,
  }

  const intToDay: Record<number, string> = {
  1: "M",
  2: "T",
  3: "W",
  4: "TH",
  5: "F",
  6: "S",
  7: "SU",
};

  const alarmDays = alarmSchedule.map(a => a.dayOfWeek);
  const DAYS = ["M", "T", "W", "TH", "F", "S", "SU"].filter(day =>
    alarmDays.some(num => intToDay[num] === day)
  );

  console.log(DAYS); // ["M", "T"]


  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays((prev) => prev.filter((d) => d !== day))
    } else {
      if (selectedDays.length > 0) {
        setSelectedDays([day])
      } else {
        setSelectedDays((prev) => [...prev, day])
      }
    }
  }



  const handleGameAdd = (game: { id: number; name: string }) => {
    const updated = { ...gamesByDay }
    selectedDays.forEach((day) => {
      if (!updated[day]) updated[day] = []
      updated[day].push([game.id.toString(), game.name])
    })
    setGamesByDay(updated)
  }


  const handleGameRemove = (day: string, index: number) => {
    const updated = { ...gamesByDay }
    const games = updated[day]

    if (!games) return

    updated[day] = games.filter((_, i) => i !== index)
    if (updated[day].length === 0) delete updated[day]
    setGamesByDay(updated)
  }

  const toLocalYMD = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }


  const getFirstValidStartDate = (alarmDays: number[]): Date => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // normalize to start of today

    // for (let i = 1; i <= 7; i++) { // check the next 7 days
    //     const candidate = new Date(today);
    //     candidate.setDate(today.getDate() + i);

    //     const jsDay = candidate.getDay(); // 0 = Sunday, 1 = Monday, ...
    //     const dayOfWeek = jsDay === 0 ? 7 : jsDay; // convert to 1–7

    //     if (alarmDays.includes(dayOfWeek)) {
    //     return candidate;
    //     }
    // }
    return today

    // fallback, should never reach here if alarmDays is not empty
    throw new Error("No valid alarm days provided");
    };



    const handleNext = async() => {

        console.log("Games By Day:", JSON.stringify(gamesByDay, null, 2))


      const gameSchedules = Object.entries(gamesByDay || {})
      .filter(([day, games]) => {
        const isValid = Array.isArray(games) && games.length > 0 && dayToInt[day]
        if (!isValid) {
          console.warn(`Skipping invalid entry for day: ${day}`, games)
        }
        return isValid
      })
      .map(([day, games]) => {
        try {
          return {
            dayOfWeek: dayToInt[day],
            games: games
              .map((game, index) => {
                console.log(`Processing game for day ${day}:`, game)
                if (!Array.isArray(game) || game.length < 2) {
                  console.error(`Malformed game entry for day ${day}:`, game)
                  return null
                }
                return {
                  id: parseInt(game[0], 10) || 0,
                  order: index + 1,
                }
              })
              .filter(Boolean),
          }
        } catch (e) {
          console.error(`Failed to process games for day ${day}`, e)
          return null
        }
      })
      .filter(Boolean)



            const alarmDays = alarmSchedule.map(a => a.dayOfWeek);
            console.log(alarmDays)
            const gameDays = gameSchedules.map(g => g.dayOfWeek);
            console.log(gameDays)
      
            // find alarm days missing games
            const missingGames = alarmDays.filter(day => !gameDays.includes(day));
      
            if (missingGames.length > 0) {
              Alert.alert(
                "Error",
                "Please select at least one game for each day that has an alarm."
              );
              return;
            }

            try {            
                // find first valid future start date
                const date = getFirstValidStartDate(alarmDays);
                console.log("first valid date:")
                console.log(toLocalYMD(date));

                navigation.navigate("PersChall3", {
                    first_possible_start_date: toLocalYMD(date),
                    name,
                    alarm_schedule: alarmSchedule,
                    game_schedule: gameSchedules,
                    chall_type: 'Group',
                    group_id: groupId,
                    members
                })
            } catch {
                console.log("failed to find first valid date")
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

      <View style={styles.container}>
        <Text style={styles.pageTitle}>Group Challenge</Text>
      </View>

          <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Select Games For Each Day</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.daysScrollContent}
          >
            {DAYS.map((day, index) => {
              const isSelected = selectedDays.includes(day)
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dayButton,
                    isSelected && styles.dayButtonSelected,
                  ]}
                  onPress={() => toggleDay(day)}
                >
                  <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>



{selectedDays.length === 1 && (
  <View style={styles.formSection}>
    <Text style={styles.sectionTitle}>Games for {selectedDays[0]}</Text>

    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 4, alignItems: 'flex-start' }}
    >
      {(selectedDays[0] && gamesByDay[selectedDays[0]] || []).map((game, index) => {
        const { image } = getMetaFromTuple(game);

        return (
          <TouchableOpacity
            key={index}
            style={[styles.gameCard, { width: 160, marginRight: 8 }]} // fixed width + spacing
            onPress={() => selectedDays[0] && handleGameRemove(selectedDays[0], index)}
          >
            <View style={styles.gameContent}>
              <Text style={styles.gameTitle}>{game[1]}</Text>
              <Ionicons
                name="close-circle"
                size={20}
                color="rgba(255,255,255,0.7)"
                style={styles.removeIcon}
              />
            </View>

            <ImageBackground
              source={image}
              style={styles.gameImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        );
      })}

      {/* Add Game Button */}
      <TouchableOpacity
        style={[styles.addGameButton, { width: 120, marginLeft: 8 }]} // same width as cards
        onPress={() => {
          navigation.navigate("Categories", {
            catType: "Group",
            singOrMult: "Neither",
            onGameSelected: (game: { id: number; name: string }) => {
              handleGameAdd(game)
            },
            groupId,
            challName: name,
            groupMembers: members,
            alarmSchedule
          })
        }}
      >
        <LinearGradient
          colors={["rgba(255, 255, 255, 0.2)", "rgba(255, 255, 255, 0.1)"]}
          style={styles.addGameGradient}
        >
          <Ionicons name="add-circle-outline" size={24} color="#FFF" />
          <Text style={styles.addGameText}>Add Game</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  </View>
)}



{/* 
          {selectedDays.length === 1 && (
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Games for {selectedDays[0]}</Text>
              <View style={styles.gamesContainer}>
                {(selectedDays[0] && gamesByDay[selectedDays[0]] || []).map((game, index) => {
                  const { image } = getMetaFromTuple(game);

                  return (
                    <TouchableOpacity
                      key={index}
                      style={styles.gameCard}
                      onPress={() => selectedDays[0] && handleGameRemove(selectedDays[0], index)}
                    >
                      <View style={styles.gameContent}>
                        <Text style={styles.gameTitle}>{game[1]}</Text>
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color="rgba(255,255,255,0.7)"
                          style={styles.removeIcon}
                        />
                      </View>

                      <ImageBackground
                        source={image}
                        style={styles.gameImage}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={styles.addGameButton}
                  onPress={() => {
                    navigation.navigate("Categories", {
                      catType: "Group",
                      singOrMult: "Neither",
                      onGameSelected: (game: { id: number; name: string }) => {
                        handleGameAdd(game)
                      },
                      groupId,
                      challName: name,
                      groupMembers: members,
                      alarmSchedule
                    })
                  }}
                >
                  <LinearGradient
                    colors={["rgba(255, 255, 255, 0.2)", "rgba(255, 255, 255, 0.1)"]}
                    style={styles.addGameGradient}
                  >
                    <Ionicons name="add-circle-outline" size={24} color="#FFF" />
                    <Text style={styles.addGameText}>Add Game</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )} */}



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
    paddingHorizontal: 20
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
    sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFF",
    marginBottom: 15,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
})


export default GroupChallCollab2;