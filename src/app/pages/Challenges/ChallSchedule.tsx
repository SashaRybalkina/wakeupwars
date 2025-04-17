import { useState, useEffect } from "react"
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import DateTimePicker from "@react-native-community/datetimepicker"
import { type NavigationProp, useRoute } from "@react-navigation/native"
import axios from "axios"
import { endpoints } from "../../api"

const DAYS = ["M", "T", "W", "TH", "F", "S", "SU"]

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
  const [curGames, setCurGames] = useState<string[][]>([])
  const [name, setName] = useState("")
  const [alarmSchedule, setAlarmSchedule] = useState<{ dayOfWeek: number; alarmTime: string; userName: string }[]>([])
  const getDayLabel = (dayOfWeek: number): string => {
    const labels = ["M", "T", "W", "TH", "F", "S", "SU"]
    return labels[dayOfWeek] || ""
  }

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
        data.forEach((day: any) => {
          const label = DAYS[day.dayOfWeek]
          if (label) parsedDays[label] = true
        })
        setSelectedDays(parsedDays)

        const alarmParsed = data.map((day: any) => ({
          dayOfWeek: day.dayOfWeek,
          alarmTime: day.alarmTime,
          userName: "",
        }))
        setAlarmSchedule(alarmParsed)

        const allGames: string[][] = data.flatMap((day: any) => day.games.map((g: any) => [g.name, "-", "-"]))
        setCurGames(allGames)
      } catch (err) {
        console.error(err)
      }
    }

    fetchSchedule()
  }, [])

  const toggleDay = (day: string) => {
    setSelectedDays((prev) => ({
      ...prev,
      [day]: !prev[day],
    }))
  }

  const onStartDateChange = (event: any, date: Date | undefined) => {
    if (date) {
      setSelectedStartDate(date)
    }
  }

  const onEndDateChange = (event: any, date: Date | undefined) => {
    if (date) {
      setSelectedEndDate(date)
    }
  }

  const goToMessages = () => navigation.navigate("Messages")
  const goToGroups = () => navigation.navigate("Groups")
  const goToProfile = () => navigation.navigate("Profile")

  const formatDate = (date: Date) => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()} ${date.getFullYear()}`
  }

  return (
    <ImageBackground source={require("../../images/cgpt.png")} style={styles.background} resizeMode="cover">
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
            <View style={styles.dateContainer}>
              <Text style={styles.dateLabel}>Start date</Text>
              <Text style={styles.dateValue}>{formatDate(selectedStartDate)}</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartDatePicker(true)}>
                <Text style={styles.dateButtonText}>Edit Start Date</Text>
              </TouchableOpacity>
            </View>

            {showStartDatePicker && (
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={selectedStartDate}
                  mode="date"
                  display="spinner"
                  onChange={onStartDateChange}
                  textColor="#FFF"
                />
                <TouchableOpacity style={styles.doneButton} onPress={() => setShowStartDatePicker(false)}>
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.dateContainer}>
              <Text style={styles.dateLabel}>End date</Text>
              <Text style={styles.dateValue}>{formatDate(selectedEndDate)}</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndDatePicker(true)}>
                <Text style={styles.dateButtonText}>Edit End Date</Text>
              </TouchableOpacity>
            </View>

            {showEndDatePicker && (
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={selectedEndDate}
                  mode="date"
                  display="spinner"
                  onChange={onEndDateChange}
                  textColor="#FFF"
                />
                <TouchableOpacity style={styles.doneButton} onPress={() => setShowEndDatePicker(false)}>
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.alarmSection}>
            <Text style={styles.sectionTitle}>Challenge Days</Text>
            <View style={styles.calendarContainer}>
              {DAYS.map((day, index) => {
                const isSelected = selectedDays[day];
                const alarmItem = alarmSchedule.find(item => getDayLabel(item.dayOfWeek) === day);
                
                return (
                  <View key={index} style={styles.dayColumn}>
                    <TouchableOpacity 
                      style={[
                        styles.dayCircle, 
                        isSelected && styles.selectedDayCircle
                      ]}
                      onPress={() => toggleDay(day)}
                    >
                      <Text style={[styles.dayText, isSelected && styles.selectedDayText]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                    
                    {isSelected && alarmItem?.alarmTime ? (
                      <View style={styles.dayBarWithAlarm}>
                        <View style={[
                          styles.dayBar, 
                          styles.selectedDayBar,
                          day === "T" ? styles.extendedDayBar : {}
                        ]} />
                        {day === "T" && alarmItem?.alarmTime && (
                          <View style={styles.alarmBadge}>
                            <Ionicons name="alarm" size={14} color="#FFD700" />
                            <Text style={styles.alarmTimeText}>{alarmItem.alarmTime}</Text>
                          </View>
                        )}
                        {day === "W" && alarmItem?.alarmTime && (
                          <View style={styles.alarmBadge}>
                            <Ionicons name="alarm" size={14} color="#FFD700" />
                            <Text style={styles.alarmTimeText}>{alarmItem.alarmTime}</Text>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={[
                        styles.dayBar, 
                        styles.selectedDayBar,
                        day === "T" ? styles.extendedDayBar : {},
                        day === "W" ? styles.mediumDayBar : {}
                      ]} />
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.gamesSection}>
            <Text style={styles.sectionTitle}>Games</Text>
            <ScrollView 
              horizontal={true}
              showsHorizontalScrollIndicator={true}
              contentContainerStyle={styles.gamesScrollContainer}
            >
              <View style={styles.gamesGrid}>
                {curGames.map((game, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.gameCard}
                    onPress={() => setCurGames((prevGames) => prevGames.filter((_, i) => i !== index))}
                  >
                    <Text style={styles.gameTitle}>{game[0]}</Text>
                    {game[0] !== "Sudoku" ? (
                      <>
                        <Text style={styles.gameDetail}>Repeats: {game[1]}</Text>
                        <Text style={styles.gameDetail}>Minutes: {game[2]}</Text>
                      </>
                    ) : (
                      <ImageBackground
                        source={require("../../images/sudoku.png")}
                        style={styles.sudokuImage}
                        resizeMode="contain"
                      />
                    )}
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={styles.addGameButton}
                  onPress={() => {
                    navigation.navigate("GroupChall3", {
                      catType: "Group",
                      onGameSelected: (game: string, attr: string[]) => {
                        setCurGames((prevGames) => [...prevGames, [game, attr[0] + "", attr[1] + ""]])
                      },
                    })
                  }}
                >
                  <Ionicons name="add-circle" size={40} color="#FFF" />
                  <Text style={styles.addGameText}>Add new</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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
    marginBottom: 15,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  alarmSection: {
    marginBottom: 20,
  },
  calendarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(30, 30, 40, 0.6)',
    borderRadius: 16,
    padding: 15,
    paddingTop: 20,
    marginTop: 7,
    paddingBottom: 20, 
    marginBottom: 10,
  },
  dayColumn: {
    alignItems: 'center',
    width: 45,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 8,
  },
  selectedDayCircle: {
    backgroundColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 5,
  },
  dayText: {
    fontWeight: '700',
    fontSize: 15,
    color: '#FFF',
  },
  selectedDayText: {
    color: '#000',
  },
  dayBar: {
    width: 4,
    height: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
  },
  selectedDayBar: {
    backgroundColor: '#FFD700',
  },
  extendedDayBar: {
    height: 60,
  },
  mediumDayBar: {
    height: 30,
  },
  dayBarWithAlarm: {
    alignItems: 'center',
    position: 'relative',
  },
  alarmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    minWidth: 70, 
  },
  inlineAlarmBadge: {
    position: 'absolute',
    top: 20, 
    left: 15,
  },
  alarmTimeText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    flexShrink: 1,
  },
  gamesSection: {
    marginBottom: 20,
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
    width: 60,
    height: 60,
    marginTop: 5,
  },
  addGameButton: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 15,
    padding: 12,
    width: 120,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderStyle: "dashed",
    height: 110,
  },
  addGameText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 16,
    marginTop: 8,
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