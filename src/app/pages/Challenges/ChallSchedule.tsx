import { useState, useEffect } from "react"
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View, Platform } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import DateTimePicker from "@react-native-community/datetimepicker"
import { type NavigationProp, useRoute } from "@react-navigation/native"
import axios from "axios"
import { endpoints } from "../../api"
import { DayOfWeek, DayOfWeekLabels } from "./DayOfWeek";

const DAYS = ["M", "T", "W", "TH", "F", "S", "SU"]
const extendedDays = new Set(["T", "TH", "S"]);

const ChallSchedule = ({ navigation }: { navigation: NavigationProp<any> }) => {
  const route = useRoute()
  const { challId, challName, whichChall } = route.params as {
    challId: number
    challName: string
    whichChall: string
  }

  const [selectedDays, setSelectedDays] = useState<Record<string, boolean>>({})
  const [showStartDatePicker, setShowStartDatePicker] = useState(false)
  const [showEndDatePicker, setShowEndDatePicker] = useState(false)
  const [selectedStartDate, setSelectedStartDate] = useState(new Date())
  const [selectedEndDate, setSelectedEndDate] = useState(new Date())
  const [allGames, setAllGames] = useState<Record<string, string[][]>>({}) 
  const [visibleGames, setVisibleGames] = useState<string[][]>([])
  const [activeDay, setActiveDay] = useState<string | null>(null) 
  const [alarmSchedule, setAlarmSchedule] = useState<{ dayOfWeek: number; alarmTime: string; userName: string }[]>([])

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const [detailRes, scheduleRes] = await Promise.all([
          axios.get(endpoints.challengeDetail(challId)),
          axios.get(endpoints.challengeSchedule(challId)),
        ])

        const detail = detailRes.data
        const data = scheduleRes.data

        console.log("Challenge detail:", detail)
        console.log("Schedule data:", data)

        const parseLocalDate = (dateStr: string): Date => {
          const parts = dateStr.split("-")
          const year = Number(parts[0])
          const month = Number(parts[1])
          const day = Number(parts[2])

          if (isNaN(year) || isNaN(month) || isNaN(day)) {
            console.warn("Invalid date string:", dateStr)
            return new Date()
          }

          return new Date(year, month - 1, day)
        }

        setSelectedStartDate(parseLocalDate(detail.startDate))
        setSelectedEndDate(parseLocalDate(detail.endDate))

        const parsedDays: Record<string, boolean> = {}
        const gamesByDay: Record<string, string[][]> = {}

        data.forEach((day: any) => {
          const label = DayOfWeekLabels[day.dayOfWeek as DayOfWeek];
          if (label) {
            parsedDays[label] = true;
  
            gamesByDay[label] = day.games.map((g: any) => [
              g.name,
              g.repeats || "-",
              g.minutes || "-",
            ]);
          }
        });

        setSelectedDays(parsedDays)
        setAllGames(gamesByDay)

        // Set first selected day as active
        const firstSelectedDay = Object.keys(parsedDays).find((day) => parsedDays[day])
        if (firstSelectedDay) {
          setActiveDay(firstSelectedDay)
          setVisibleGames(gamesByDay[firstSelectedDay] || [])
        }

        const alarmParsed = data.map((day: any) => ({
          dayOfWeek: day.dayOfWeek,
          alarmTime: day.alarmTime,
          userName: "",
        }))
        setAlarmSchedule(alarmParsed)
      } catch (err) {
        console.error(err)
      }
    }

    fetchSchedule()
  }, [])

  const selectDay = (day: string) => {
    if (selectedDays[day]) {
      setActiveDay(day)
      setVisibleGames(allGames[day] || [])
    }
  }

  const toggleDay = (day: string) => {
    setSelectedDays((prev) => ({
      ...prev,
      [day]: !prev[day],
    }))

    // If toggling on, make it active
    if (!selectedDays[day]) {
      setActiveDay(day)
      setVisibleGames(allGames[day] || [])
    }
    // If toggling off the active day, find another day to make active
    else if (day === activeDay) {
      const nextActiveDay = Object.keys(selectedDays).find((d) => d !== day && selectedDays[d])
      if (nextActiveDay) {
        setActiveDay(nextActiveDay)
        setVisibleGames(allGames[nextActiveDay] || [])
      } else {
        setActiveDay(null)
        setVisibleGames([])
      }
    }
  }

  const onStartDateChange = (event: any, date: Date | undefined) => {    
    if (event?.type === "dismissed") {
      // Android Cancel
      setShowStartDatePicker(false)
      return
    }

    if (date) {
      setSelectedStartDate(date)
      if (Platform.OS === "android") {
        // Android  OK 
        setShowStartDatePicker(false)
      }
    }
  }

  const onEndDateChange = (event: any, date: Date | undefined) => {
    if (event?.type === "dismissed") {
      // Android Cancel
      setShowEndDatePicker(false)
      return
    }

    if (date) {
      setSelectedEndDate(date)
      if (Platform.OS === "android") {
        // Android  OK 
        setShowEndDatePicker(false)
      }
    }

  }

  const addGameToDay = (game: string, attr: string[]) => {
    if (activeDay) {
      const newGame = [game, attr[0] + "", attr[1] + ""]

      // Update both the visible games and the stored games for the active day
      setVisibleGames((prev) => [...prev, newGame])
      setAllGames((prev) => ({
        ...prev,
        [activeDay]: [...(prev[activeDay] || []), newGame],
      }))
    }
  }

  const removeGame = (index: number) => {
    if (activeDay) {
      // Remove from visible games
      setVisibleGames((prev) => prev.filter((_, i) => i !== index))

      // Remove from stored games
      setAllGames((prev) => ({
        ...prev,
        [activeDay]: (prev[activeDay] ?? []).filter((_, i) => i !== index),
      }))
    }
  }

  const goToMessages = () => navigation.navigate("Messages")
  const goToGroups = () => navigation.navigate("Groups")
  const goToProfile = () => navigation.navigate("Profile")

  const goToSudoku = () => {
    navigation.navigate('Sudoku', { challengeId: challId });
  };

  const goToPattern = () => {
    navigation.navigate('PatternGame', { challengeId: challId});
  }

  const handleGamePress = (game: string[], index: number) => {
    if (game[0] === "Sudoku" || game[0] === "Group Sudoku") {
      goToSudoku();
    } 
    // If the second game exists and matches certain names
    else if (game[0] === "Pattern Game") {
      goToPattern(); // Navigate to the second game (custom handler)
    }
    else {
      removeGame(index);
    }
  };

  const formatDate = (date: Date) => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()} ${date.getFullYear()}`
  }

  return (
    <ImageBackground source={require("../../images/tertiary.png")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>

        <Text style={styles.title}>{challName}</Text>

        <ScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.dateSection}>

            {/* Start Date */}
            <View style={styles.dateContainer}>
              <Text style={styles.dateLabel}>Start date</Text>
              <Text style={styles.dateValue}>{formatDate(selectedStartDate)}</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartDatePicker(true)}>
                <Text style={styles.dateButtonText}>Edit Start Date</Text>
              </TouchableOpacity>
            </View>

            {showStartDatePicker && (
              <View style={Platform.OS === "ios" ? styles.pickerContainer : undefined}>
                <DateTimePicker
                  value={selectedStartDate}
                  mode="date"
                  display={Platform.OS === "android" ? "default" : "spinner"}
                  onChange={onStartDateChange}
                  textColor="#FFF"
                />
                {Platform.OS === "ios" && (
                  <TouchableOpacity style={styles.doneButton} onPress={() => setShowStartDatePicker(false)}>
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.divider} />

            {/* End Date */}
            <View style={styles.dateContainer}>
              <Text style={styles.dateLabel}>End date</Text>
              <Text style={styles.dateValue}>{formatDate(selectedEndDate)}</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndDatePicker(true)}>
                <Text style={styles.dateButtonText}>Edit End Date</Text>
              </TouchableOpacity>
            </View>

            {showEndDatePicker && (
              <View style={Platform.OS === "ios" ? styles.pickerContainer : undefined}>
                <DateTimePicker
                  value={selectedEndDate}
                  mode="date"
                  display={Platform.OS === "android" ? "default" : "spinner"}
                  onChange={onEndDateChange}
                  textColor="#FFF"
                />
                {Platform.OS === "ios" && (
                  <TouchableOpacity style={styles.doneButton} onPress={() => setShowEndDatePicker(false)}>
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <View style={styles.alarmSection}>
            <Text style={styles.sectionTitle}>Challenge Days</Text>
            <View style={styles.calendarContainer}>
              {DAYS.map((day, index) => {
                const isSelected = selectedDays[day]
                const isActive = activeDay === day
                const alarmItem = alarmSchedule.find((item) => DayOfWeekLabels[item.dayOfWeek as DayOfWeek] === day);

                return (
                  <View key={index} style={styles.dayColumn}>
                    <TouchableOpacity
                      style={[
                        styles.dayCircle,
                        isSelected && styles.selectedDayCircle,
                        isActive && styles.activeDayCircle,
                      ]}
                      onPress={() => (isSelected ? selectDay(day) : toggleDay(day))}
                    >
                      <Text
                        style={[styles.dayText, isSelected && styles.selectedDayText, isActive && styles.activeDayText]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>

                    {isSelected && alarmItem?.alarmTime ? (
                      <View style={styles.dayBarWithAlarm}>
                        <View
                          style={[
                            styles.dayBar,
                            styles.selectedDayBar,
                            isActive && styles.activeDayBar,
                            extendedDays.has(day) && styles.extendedDayBar, // Added this line to apply extended style
                          ]}
                        />
                        <View style={styles.alarmBadge}>
                          <Ionicons name="alarm" size={14} color="#FFD700" />
                          <Text style={styles.alarmTimeText}>{alarmItem.alarmTime}</Text>
                        </View>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.dayBar,
                          isSelected && styles.selectedDayBar,
                          isActive && styles.activeDayBar,
                          extendedDays.has(day) && styles.extendedDayBar,
                        ]}
                      />
                    )}
                  </View>
                )
              })}
            </View>
          </View>

          <View style={styles.gamesSection}>
            <View style={styles.gamesSectionHeader}>
              <Text style={styles.sectionTitle}>{activeDay ? `Games for ${activeDay}` : "No day selected"}</Text>
              {activeDay && (
                <TouchableOpacity
                  style={styles.addGameButtonSmall}
                  onPress={() => {
                    navigation.navigate("GroupChall3", {
                      catType: "Group",
                      onGameSelected: addGameToDay,
                    })
                  }}
                >
                  <Ionicons name="add-circle" size={24} color="#FFD700" />
                  <Text style={styles.addGameTextSmall}>Add</Text>
                </TouchableOpacity>
              )}
            </View>

            {visibleGames.length > 0 ? (
              <ScrollView
                horizontal={true}
                showsHorizontalScrollIndicator={true}
                contentContainerStyle={styles.gamesScrollContainer}
              >
                <View style={styles.gamesGrid}>
                  {visibleGames.map((game, index) => (
                    <TouchableOpacity 
                      key={index} 
                      style={[
                        styles.gameCard,
                        game[0] === "Sudoku" && styles.sudokuGameCard
                      ]} 
                      onPress={() => handleGamePress(game, index)}
                    >
                      <Text style={styles.gameTitle}>{game[0]}</Text>
                      {game[0] !== "Sudoku" ? (
                        <>
                          <Text style={styles.gameDetail}>Repeats: {game[1]}</Text>
                          <Text style={styles.gameDetail}>Minutes: {game[2]}</Text>
                        </>
                      ) : (
                        <>
                          <ImageBackground
                            source={require("../../images/sudoku.png")}
                            style={styles.sudokuImage}
                            resizeMode="contain"
                          />
                          <View style={styles.playIndicator}>
                            <Ionicons name="play-circle" size={24} color="#FFD700" />
                            <Text style={styles.playText}>Play</Text>
                          </View>
                        </>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.emptyGamesContainer}>
                {activeDay ? (
                  <>
                    <Ionicons name="game-controller-outline" size={40} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.emptyGamesText}>No games for {activeDay}</Text>
                    <TouchableOpacity
                      style={styles.addGameButton}
                      onPress={() => {
                        navigation.navigate("GroupChall3", {
                          catType: "Group",
                          onGameSelected: addGameToDay,
                        })
                      }}
                    >
                      <Ionicons name="add-circle" size={40} color="#FFF" />
                      <Text style={styles.addGameText}>Add new game</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={styles.emptyGamesText}>Select a day to see games</Text>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navButton}>
          <Ionicons name="star" size={28} color="#FFD700" />
          <Text style={styles.activeNavText}>Challenges</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={goToGroups}>
          <Ionicons name="people-outline" size={28} color="#FFF" />
          <Text style={styles.navText}>Groups</Text>
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
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFF",
    textAlign: "center",
    marginBottom: 20,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
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
  dateSection: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  dateContainer: {
    marginBottom: 10,
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFF",
    marginBottom: 5,
    opacity: 0.8,
  },
  dateValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFF",
    marginBottom: 10,
  },
  dateButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  dateButtonText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 16,
  },
  pickerContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 15,
    padding: 10,
    marginVertical: 10,
  },
  doneButton: {
    backgroundColor: "#FFD700",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignSelf: "center",
    marginTop: 10,
  },
  doneButtonText: {
    color: "#333",
    fontWeight: "700",
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    marginVertical: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFF",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  alarmSection: {
    marginBottom: 20,
  },
  calendarContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(30, 30, 40, 0.6)",
    borderRadius: 16,
    padding: 15,
    paddingTop: 20,
    marginTop: 7,
    paddingBottom: 20,
    marginBottom: 10,
  },
  dayColumn: {
    alignItems: "center",
    width: 45,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    marginBottom: 8,
  },
  selectedDayCircle: {
    backgroundColor: "#FFD700",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  activeDayCircle: {
    backgroundColor: "#FFA500",
    shadowColor: "#FFA500",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 5,
  },
  dayText: {
    fontWeight: "700",
    fontSize: 15,
    color: "#FFF",
  },
  selectedDayText: {
    color: "#000",
  },
  activeDayText: {
    color: "#000",
  },
  dayBar: {
    width: 4,
    height: 15,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 2,
  },
  selectedDayBar: {
    backgroundColor: "#FFD700",
  },
  activeDayBar: {
    backgroundColor: "#FFA500",
    width: 6,
  },
  extendedDayBar: {
    height: 60,
  },
  mediumDayBar: {
    height: 30,
  },
  dayBarWithAlarm: {
    alignItems: "center",
    position: "relative",
  },
  alarmBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.3)",
    minWidth: 70,
  },
  inlineAlarmBadge: {
    position: "absolute",
    top: 20,
    left: 15,
  },
  alarmTimeText: {
    color: "#FFD700",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
    flexShrink: 1,
  },
  gamesSection: {
    marginBottom: 20,
  },
  gamesSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  addGameButtonSmall: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.3)",
  },
  addGameTextSmall: {
    color: "#FFD700",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 4,
  },
  gamesScrollContainer: {
    paddingBottom: 10,
  },
  gamesGrid: {
    flexDirection: "row",
    paddingRight: 20,
  },
  gameCard: {
    backgroundColor: "rgba(50, 50, 60, 0.7)",
    borderRadius: 15,
    padding: 12,
    width: 120,
    marginRight: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    height: 120,
  },
  sudokuGameCard: {
    borderColor: "rgba(255, 215, 0, 0.3)",
    backgroundColor: "rgba(60, 60, 70, 0.8)",
    width: 140,
    height: 160,
  },
  gameTitle: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 6,
  },
  gameDetail: {
    color: "#DDD",
    fontSize: 12,
    marginBottom: 3,
  },
  sudokuImage: {
    width: 80,
    height: 80,
    marginTop: 5,
  },
  playIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  playText: {
    color: "#FFD700",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
  emptyGamesContainer: {
    backgroundColor: "rgba(30, 30, 40, 0.6)",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 150,
  },
  emptyGamesText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 16,
    fontWeight: "500",
    marginVertical: 10,
  },
  addGameButton: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 15,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderStyle: "dashed",
    marginTop: 15,
    paddingHorizontal: 20,
    flexDirection: "row",
  },
  addGameText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 16,
    marginLeft: 8,
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

export default ChallSchedule