import type React from "react"
import { useState } from "react"
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  Platform,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import DateTimePicker from "@react-native-community/datetimepicker"
import { useRoute, type NavigationProp } from "@react-navigation/native"
import { LinearGradient } from "expo-linear-gradient"
import { useUser } from "../../context/UserContext"
import { BASE_URL, endpoints } from "../../api"
import { getMetaFromTuple } from "../Games/NewGamesManagement"
import { getAccessToken } from "../../auth"

type Props = {
  navigation: NavigationProp<any>
}

const DAYS = ["M", "T", "W", "TH", "F", "S", "SU"]

const CreateChallengeForFriend: React.FC<Props> = ({ navigation }) => {
  const route = useRoute()
  const { friendId } = route.params as { friendId: number }

  const { user } = useUser()
  const [name, setName] = useState("")
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)

  const [tempTime, setTempTime] = useState<Date | null>(null)
  const [showTimePicker, setShowTimePicker] = useState(false)

  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [dayTimeMapping, setDayTimeMapping] = useState<Record<string, string>>({})
  const [gamesByDay, setGamesByDay] = useState<Record<string, [string, string][]>>({})

  const dayToInt: Record<string, number> = { M: 1, T: 2, W: 3, TH: 4, F: 5, S: 6, SU: 7 }

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(prev => prev.filter(d => d !== day))
    } else {
      setSelectedDays(prev => [...prev, day])
    }
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

  const formatTime = (date: Date) =>
    date
      .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
      .replace(/([AP]M)/, " $1")
      .replace(/\u202f/g, "")
      .trim()

  const onTimeChange = (event: any, time?: Date) => {
    if (event?.type === "dismissed") {
      setShowTimePicker(false)
      setTempTime(null)
      return
    }
    if (!time) return

    if (Platform.OS === "android") {
      const formatted = formatTime(time)
      const updated = { ...dayTimeMapping }
      selectedDays.forEach(day => (updated[day] = formatted))
      setDayTimeMapping(updated)
      setShowTimePicker(false)
    } else {
      setTempTime(time)
    }
  }

  const handleSetTime = () => {
    if (!tempTime) return
    const formatted = formatTime(tempTime)
    const updated = { ...dayTimeMapping }
    selectedDays.forEach(day => (updated[day] = formatted))
    setDayTimeMapping(updated)
    setTempTime(null)
    setShowTimePicker(false)
  }

  const handleGameAdd = (game: { id: number; name: string }) => {
    const updated = { ...gamesByDay }
    selectedDays.forEach(day => {
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

  const formatDate = (date: Date) =>
    date.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })

  // format local date to YYYY-MM-DD (avoid UTC shift from toISOString)
  const toLocalYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const handleCreateChallenge = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a challenge name")
      return
    }
    if (Object.keys(dayTimeMapping).length === 0) {
      Alert.alert("Error", "Please select at least one day and set an alarm time")
      return
    }

    const today = toLocalYMD(new Date());

    const payload = {
      userId: user?.id,
      name,
      startDate: today,
      endDate: toLocalYMD(selectedDate),
      schedule: selectedDays.map(day => ({
        day,
        dayOfWeek: dayToInt[day],
        time: dayTimeMapping[day],
        games: (gamesByDay[day] || []).map(([id, name]) => ({ id: Number(id), name })),
      })),
      members: [friendId], 
    }

    try {

      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(endpoints.shareChallenge(), {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error(`Server error: ${response.status}`)

      Alert.alert("Success", "Challenge request sent to your friend!", [
        { text: "OK", onPress: () => navigation.navigate("Profile") },
      ])
    } catch (err) {
      console.error("Create challenge for friend failed:", err)
      Alert.alert("Error", "Failed to create challenge. Please try again.")
    }
  }

  return (
    <ImageBackground source={require("../../images/secondary.png")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>

        <Text style={styles.pageTitle}>Create Challenge for Friend</Text>

        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
          {/* Challenge Name */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Challenge Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter challenge name"
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Days & Alarm */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Select Days</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysScrollContent}>
              {DAYS.map(day => {
                const isSelected = selectedDays.includes(day)
                const hasTime = dayTimeMapping[day]
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayButton, isSelected && styles.dayButtonSelected, hasTime && styles.dayButtonWithTime]}
                    onPress={() => toggleDay(day)}
                  >
                    <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{day}</Text>
                    {hasTime && <Text style={styles.timeText}>{dayTimeMapping[day]}</Text>}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>

            <TouchableOpacity style={styles.actionButton} onPress={() => setShowTimePicker(true)}>
              <LinearGradient colors={["rgba(255,255,255,0.2)", "rgba(255,255,255,0.1)"]} style={styles.buttonGradient}>
                <Ionicons name="alarm-outline" size={20} color="#FFF" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Set Alarm Time</Text>
              </LinearGradient>
            </TouchableOpacity>

            {showTimePicker && (
              <View style={styles.pickerContainer}>
                <DateTimePicker value={tempTime || new Date()} mode="time" display="spinner" onChange={onTimeChange} />
                {Platform.OS !== "android" && (
                  <TouchableOpacity style={styles.doneButton} onPress={handleSetTime}>
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Games */}
          {selectedDays.length > 0 && (
                      <View style={styles.formSection}>
                        <Text style={styles.sectionTitle}>Games for Selected Days</Text>
                        <View style={styles.gamesContainer}>
                          {selectedDays.map((day) => (
                            <View key={day} style={styles.dayGamesSection}>
                              <Text style={styles.dayTitle}>{day}</Text>
                              <View style={styles.gamesList}>
                                {(gamesByDay[day] || []).map((game, index) => {
                                    const { image } = getMetaFromTuple(game);
          
                                    return (
                                      <TouchableOpacity
                                        key={index}
                                        style={styles.gameCard}
                                        onPress={() => handleGameRemove(day, index)}
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
                              </View>
                            </View>
                          ))}
          
                         {(selectedDays && selectedDays[0] && (!gamesByDay[selectedDays[0]]) || (selectedDays && selectedDays[0] && gamesByDay[selectedDays[0]].length === 0)) && (
                          <TouchableOpacity
                            style={styles.addGameButton}
                            onPress={() => {
                              navigation.navigate("Categories", {
                                catType: "Friend",
                                singOrMult: "Multiplayer",
                                friendId,
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
                        )}
                        </View>
                      </View>
                    )}

          {/* End Date */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>End Date</Text>
            <Text style={styles.dateDisplay}>{formatDate(selectedDate)}</Text>
            <TouchableOpacity style={styles.actionButton} onPress={() => setShowDatePicker(true)}>
              <LinearGradient colors={["rgba(255,255,255,0.2)", "rgba(255,255,255,0.1)"]} style={styles.buttonGradient}>
                <Ionicons name="calendar-outline" size={20} color="#FFF" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Select Date</Text>
              </LinearGradient>
            </TouchableOpacity>

            {showDatePicker && (
              <View style={styles.pickerContainer}>
                <DateTimePicker value={selectedDate} mode="date" display="spinner" onChange={onDateChange} />
                {Platform.OS !== "android" && (
                  <TouchableOpacity style={styles.doneButton} onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.createButton} onPress={handleCreateChallenge}>
            <LinearGradient colors={["#FFD700", "#FFC107"]} style={styles.createButtonGradient}>
              <Text style={styles.createButtonText}>Send Challenge</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  container: { flex: 1, paddingTop: 50 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
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
  },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  formSection: {
    marginBottom: 25,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  sectionTitle: { fontSize: 20, fontWeight: "600", color: "#FFF", marginBottom: 15 },
  input: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 12,
    color: "#FFF",
    fontSize: 16,
  },
  daysScrollContent: { flexDirection: "row", paddingVertical: 5 },
  dayButton: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  dayButtonSelected: { backgroundColor: "rgba(255,215,0,0.3)", borderColor: "#FFD700" },
  dayButtonWithTime: { backgroundColor: "rgba(138,43,226,0.3)", borderColor: "#8A2BE2", height: 60 },
  dayText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  dayTextSelected: { color: "#FFD700" },
  timeText: { color: "#FFF", fontSize: 12, marginTop: 4 },
  actionButton: { borderRadius: 12, overflow: "hidden", marginTop: 15 },
  buttonGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  buttonIcon: { marginRight: 8 },
  buttonText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  pickerContainer: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 16,
    padding: 15,
    marginTop: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  doneButton: {
    backgroundColor: "rgba(255,215,0,0.3)",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 15,
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  doneButtonText: { color: "#FFD700", fontSize: 16, fontWeight: "600" },
  dayGamesSection: { marginBottom: 15 },
  dayTitle: { fontSize: 18, fontWeight: "600", color: "#FFD700", marginBottom: 10 },
  gameCard: {
    width: "48%",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  gameTitle: { color: "#FFF", fontSize: 16, fontWeight: "600", flex: 1 },
  addGameButton: { width: "100%", borderRadius: 12, overflow: "hidden", marginTop: 10 },
  addGameGradient: {
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    borderStyle: "dashed",
  },
  addGameText: { color: "#FFF", fontSize: 16, fontWeight: "600", marginTop: 8 },
  dateDisplay: { color: "#FFD700", fontSize: 18, fontWeight: "600", marginBottom: 15, textAlign: "center" },
  createButton: { borderRadius: 12, overflow: "hidden", marginVertical: 10, marginBottom: 30 },
  createButtonGradient: { paddingVertical: 15, alignItems: "center", justifyContent: "center" },
  createButtonText: { color: "#333", fontSize: 18, fontWeight: "700" },
  gameContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  removeIcon: {
    marginLeft: 5,
  },
  gameImage: {
    width: "100%",
    height: 80,
  },
  gamesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gamesContainer: {
    width: "100%",
  },
})

export default CreateChallengeForFriend
