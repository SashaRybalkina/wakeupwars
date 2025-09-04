import React, { useEffect, useState } from "react"
import {
  Alert,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import DateTimePicker from "@react-native-community/datetimepicker"
import { NavigationProp, useRoute } from "@react-navigation/native"
import { LinearGradient } from "expo-linear-gradient"
import { BASE_URL, endpoints } from "../../api"
import { Platform } from "react-native"

type Props = {
  navigation: NavigationProp<any>
}

const DAYS = ["M", "T", "W", "TH", "F", "S", "SU"]

const GroupChall2: React.FC<Props> = ({ navigation }) => {
  const route = useRoute()
  const { groupId, groupMembers } = route.params as {
    groupId: number
    groupMembers: { id: number; name: string }[]
  }

  useEffect(() => {
    console.log("GroupChall2 Group Members:", groupMembers)
  }, [])

  const [name, setName] = useState("")
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)

  const [tempTime, setTempTime] = useState<Date | null>(null)
  const [showTimePicker, setShowTimePicker] = useState(false)

  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [dayTimeMapping, setDayTimeMapping] = useState<Record<string, string>>({})
  const [gamesByDay, setGamesByDay] = useState<Record<string, [string, string][]>>({})

  const goToMessages = () => navigation.navigate("Messages")
  const goToGroups = () => navigation.navigate("Groups")
  const goToChallenges = () => navigation.navigate("Challenges")
  const goToProfile = () => navigation.navigate("Profile")

  const dayToInt: Record<string, number> = {
    M: 1,
    T: 2,
    W: 3,
    TH: 4,
    F: 5,
    S: 6,
    SU: 7,
  }

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

  // const onDateChange = (_: any, date?: Date) => {
  //   if (date) setSelectedDate(date)
  // }

  // Android + IOS version
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

  // const onTimeChange = (_: any, time?: Date) => {
  //   if (time) setTempTime(time)
  // }

  // Android + IOS version
  const onTimeChange = (event: any, time?: Date) => {
    if (event?.type === "dismissed") {
      setShowTimePicker(false)
      return
    }
  
    if (time) {
      if (Platform.OS === "android") {
        let formattedTime = formatTime(time)
        formattedTime = cleanTime(formattedTime)
  
        const updatedMapping = { ...dayTimeMapping }
        selectedDays.forEach((day) => {
          updatedMapping[day] = formattedTime
        })
  
        setDayTimeMapping(updatedMapping)
        setSelectedDays([])
        setShowTimePicker(false)
      } else {
        // for ios
        setTempTime(time)
      }
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  }

  const cleanTime = (time: string) => {
    return time.replace(/\u202f/g, "").trim()
  }

  const handleSetTime = () => {
    if (!tempTime) return
    let formattedTime = formatTime(tempTime)
    formattedTime = cleanTime(formattedTime)

    const updatedMapping = { ...dayTimeMapping }
    selectedDays.forEach((day) => {
      updatedMapping[day] = formattedTime
    })

    setDayTimeMapping(updatedMapping)
    setTempTime(null)
    setSelectedDays([])
    setShowTimePicker(false)
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

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    }
    return date.toLocaleDateString(undefined, options)
  }

  const handleCreateChallenge = async() => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a challenge name")
      return
    }

    if (Object.keys(dayTimeMapping).length === 0) {
      Alert.alert("Error", "Please select at least one day and set an alarm time")
      return
    }

    console.log("Day-Time Mapping:", dayTimeMapping)
    console.log("Games By Day:", JSON.stringify(gamesByDay, null, 2))
    
    const alarmSchedule = Object.entries(dayTimeMapping)
      .filter(([day, time]) => time && dayToInt[day])
      .map(([day, time]) => ({
        dayOfWeek: dayToInt[day],
        time,
      }))
    console.log("Filtered Alarm Schedule:", alarmSchedule)

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

    console.log("Group Members:", groupMembers)

    const payload = {
      name,
      group_id: groupId,
      start_date: new Date().toLocaleDateString('en-CA'),
      end_date: selectedDate.toISOString().split("T")[0],
      members: groupMembers.map((member) => member.id),
      alarm_schedule: alarmSchedule,
      game_schedules: gameSchedules,
    }
    console.log(payload)

    try {
      const csrfRes = await fetch(`${BASE_URL}/api/csrf-token/`, {
        credentials: 'include',                      
      });
      if (!csrfRes.ok) throw new Error('Failed to fetch CSRF token');
      const { csrfToken } = await csrfRes.json();     
      console.log('csrfToken:', csrfToken);
  
  
      const res = await fetch(endpoints.createGroupChallenge, {
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
        throw new Error(error.message || 'Failed to create challenge');
      }
  
      const data = await res.json();
      console.log('Challenge created:', data);
      Alert.alert('Success', 'Challenge created successfully', [
        { text: 'OK', onPress: () => navigation.navigate('GroupDetails', { groupId, groupMembers, refresh: Date.now() }) },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  
  }

  return (
    <ImageBackground source={require("../../images/cgpt.png")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>

        <Text style={styles.pageTitle}>Create Challenge</Text>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Challenge Name</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter challenge name"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={name}
                onChangeText={setName}
              />
            </View>
          </View>

          <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Select Days</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.daysScrollContent}
          >
            {DAYS.map((day, index) => {
              const isSelected = selectedDays.includes(day)
              const hasTime = dayTimeMapping[day]
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dayButton,
                    isSelected && styles.dayButtonSelected,
                    hasTime && styles.dayButtonWithTime
                  ]}
                  onPress={() => toggleDay(day)}
                >
                  <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>
                    {day}
                  </Text>
                  {hasTime && (
                    <Text style={styles.timeText}>{dayTimeMapping[day]}</Text>
                  )}
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowTimePicker(true)}
          >
            <LinearGradient
              colors={["rgba(255, 255, 255, 0.2)", "rgba(255, 255, 255, 0.1)"]}
              style={styles.buttonGradient}
            >
              <Ionicons name="alarm-outline" size={20} color="#FFF" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Set Alarm Time</Text>
            </LinearGradient>
          </TouchableOpacity>

            {showTimePicker && (
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={tempTime || new Date()}
                  mode="time"
                  display="spinner"
                  onChange={onTimeChange}
                  textColor="#FFF"
                />
                {/* <TouchableOpacity style={styles.doneButton} onPress={handleSetTime}>
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity> */}
                {Platform.OS !== "android" && (
                  <TouchableOpacity style={styles.doneButton} onPress={handleSetTime}>
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                )}      
              </View>
            )}
          </View>

          {selectedDays.length === 1 && (
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Games for {selectedDays[0]}</Text>
              <View style={styles.gamesContainer}>
                {(selectedDays[0] && gamesByDay[selectedDays[0]] || []).map((game, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.gameCard}
                    onPress={() => selectedDays[0] && handleGameRemove(selectedDays[0], index)}
                  >
                    <View style={styles.gameContent}>
                      <Text style={styles.gameTitle}>{game[1]}</Text>
                      <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.7)" style={styles.removeIcon} />
                    </View>
                    <ImageBackground
                      source={require("../../images/sudoku.png")}
                      style={styles.gameImage}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={styles.addGameButton}
                  onPress={() => {
                    navigation.navigate("Categories", {
                      groupId,
                      groupMembers,
                      catType: "Group",
                      onGameSelected: (game: { id: number; name: string }) => {
                        handleGameAdd(game)
                      },
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
          )}

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>End Date</Text>
            <Text style={styles.dateDisplay}>{formatDate(selectedDate)}</Text>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowDatePicker(true)}
            >
              <LinearGradient
                colors={["rgba(255, 255, 255, 0.2)", "rgba(255, 255, 255, 0.1)"]}
                style={styles.buttonGradient}
              >
                <Ionicons name="calendar-outline" size={20} color="#FFF" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Select Date</Text>
              </LinearGradient>
            </TouchableOpacity>

            {showDatePicker && (
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="spinner"
                  onChange={onDateChange}
                  textColor="#FFF"
                />
                {/* <TouchableOpacity
                  style={styles.doneButton}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity> */}
                {Platform.OS !== "android" && (
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

          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateChallenge}
          >
            <LinearGradient
              colors={["#FFD700", "#FFC107"]}
              style={styles.createButtonGradient}
            >
              <Text style={styles.createButtonText}>Create Challenge</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navButton} onPress={goToChallenges}>
          <Ionicons name="star-outline" size={28} color="#FFF" />
          <Text style={styles.navText}>Challenges</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={goToGroups}>
          <Ionicons name="people" size={28} color="#FFD700" />
          <Text style={styles.activeNavText}>Groups</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={goToMessages}>
          <Ionicons name="mail-outline" size={28} color="#FFF" />
          <Text style={styles.navText}>Messages</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={goToProfile}>
          <Ionicons name="person-outline" size={28} color="#FFF" />
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
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
  navBar: {
    backgroundColor: "#211F26",
    flexDirection: "row",
    height: 80,
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 15,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
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
  activeNavText: {
    color: "#FFD700",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },
})

export default GroupChall2