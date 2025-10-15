// import React, { useEffect, useState } from "react"
// import {
//   View,
//   Text,
//   ScrollView,
//   TouchableOpacity,
//   ImageBackground,
//   Platform,
// } from "react-native"
// import { useRoute, NavigationProp } from "@react-navigation/native"
// import DateTimePicker from "@react-native-community/datetimepicker"
// import { Ionicons } from "@expo/vector-icons"
// import axios from "axios"
// import { endpoints } from "../../api"
// // import styles from "./ChallSchedule.styles"
import { useState, useEffect } from "react"
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View, Platform } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import DateTimePicker from "@react-native-community/datetimepicker"
import { type NavigationProp, useRoute } from "@react-navigation/native"
import axios from "axios"
import { endpoints } from "../../api"
// import { DayOfWeek, DayOfWeekLabels } from "./DayOfWeek";


const DAYS = ["M", "T", "W", "TH", "F", "S", "SU"]
const extendedDays = new Set(["T", "TH", "S"])
const DayOfWeekLabels: Record<number, string> = { 1: "M", 2: "T", 3: "W", 4: "TH", 5: "F", 6: "S", 7: "SU" }

const TempCp = ({ navigation }: { navigation: NavigationProp<any> }) => {
  const route = useRoute()
  const { challId, challName } = route.params as { challId: number; challName: string }

  const [selectedStartDate, setSelectedStartDate] = useState(new Date())
  const [selectedEndDate, setSelectedEndDate] = useState(new Date())
  const [showStartDatePicker, setShowStartDatePicker] = useState(false)
  const [showEndDatePicker, setShowEndDatePicker] = useState(false)

  // NEW: full schedule state from backend
  const [schedule, setSchedule] = useState<
    {
      dayOfWeek: number
      alarms: { userName: string; alarmTime: string }[]
      games: { name: string; order: number }[]
    }[]
  >([])

  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  // For showing games of selected day
  const currentDay = schedule.find((d) => d.dayOfWeek === selectedDay)

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const [detailRes, scheduleRes] = await Promise.all([
          axios.get(endpoints.challengeDetail(challId)),
          axios.get(endpoints.challengeSchedule(challId)),
        ])

        const detail = detailRes.data
        const data = scheduleRes.data

        // Parse dates
        const parseLocalDate = (dateStr: string): Date => {
            if (!dateStr) return new Date() // handle undefined/null

            const parts = dateStr.split("-")
            const year = Number(parts[0])
            const month = Number(parts[1])
            const day = Number(parts[2])

            // fallback if any part is invalid
            if (isNaN(year) || isNaN(month) || isNaN(day)) {
                console.warn("Invalid date string:", dateStr)
                return new Date()
            }

            return new Date(year, month - 1, day)
        }


        setSelectedStartDate(parseLocalDate(detail.startDate))
        setSelectedEndDate(parseLocalDate(detail.endDate))

        // Map API response directly into schedule state
        const parsedSchedule = data.map((day: any) => ({
          dayOfWeek: day.dayOfWeek,
          alarms: day.alarms || [],
          games: day.games || [],
        }))

        setSchedule(parsedSchedule)
        console.log("schedule: " + parsedSchedule)

        // Pick first day with any alarms or games as default selected
        const firstDay = parsedSchedule[0]?.dayOfWeek || null
        setSelectedDay(firstDay)
      } catch (err) {
        console.error(err)
      }
    }

    fetchSchedule()
  }, [])

  const onStartDateChange = (event: any, date?: Date) => {
    if (event?.type === "dismissed") return setShowStartDatePicker(false)
    if (date) {
      setSelectedStartDate(date)
      if (Platform.OS === "android") setShowStartDatePicker(false)
    }
  }

  const onEndDateChange = (event: any, date?: Date) => {
    if (event?.type === "dismissed") return setShowEndDatePicker(false)
    if (date) {
      setSelectedEndDate(date)
      if (Platform.OS === "android") setShowEndDatePicker(false)
    }
  }

  const addGameToDay = (game: string, attr: string[]) => {
    // update db??
    if (!selectedDay) return
    const newGame = { name: game, order: (currentDay?.games.length || 0) + 1 }
    setSchedule((prev) =>
      prev.map((d) =>
        d.dayOfWeek === selectedDay
          ? { ...d, games: [...d.games, newGame] }
          : d
      )
    )
  }

  const removeGame = (index: number) => {
    if (!selectedDay) return
    setSchedule((prev) =>
      prev.map((d) =>
        d.dayOfWeek === selectedDay
          ? { ...d, games: d.games.filter((_, i) => i !== index) }
          : d
      )
    )
  }

  const handleGamePress = (game: { name: string; order: number }, index: number) => {
    if (game.name === "Sudoku" || game.name === "Group Sudoku") {
      navigation.navigate("Sudoku", { challengeId: challId })
    } else {
      removeGame(index)
    }
  }

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

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Start / End Date Section */}
          <View style={styles.dateSection}>
            <View style={styles.dateContainer}>
              <Text style={styles.dateLabel}>Start date</Text>
              <Text style={styles.dateValue}>{formatDate(selectedStartDate)}</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartDatePicker(true)}>
                <Text style={styles.dateButtonText}>Edit Start Date</Text>
              </TouchableOpacity>
            </View>
            {showStartDatePicker && (
              <DateTimePicker value={selectedStartDate} mode="date" display={Platform.OS === "android" ? "default" : "spinner"} onChange={onStartDateChange} />
            )}

            <View style={styles.dateContainer}>
              <Text style={styles.dateLabel}>End date</Text>
              <Text style={styles.dateValue}>{formatDate(selectedEndDate)}</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndDatePicker(true)}>
                <Text style={styles.dateButtonText}>Edit End Date</Text>
              </TouchableOpacity>
            </View>
            {showEndDatePicker && (
              <DateTimePicker value={selectedEndDate} mode="date" display={Platform.OS === "android" ? "default" : "spinner"} onChange={onEndDateChange} />
            )}
          </View>

          {/* Days + Alarms Section */}
          <View style={styles.alarmSection}>
            <Text style={styles.sectionTitle}>Challenge Days</Text>
            <ScrollView horizontal contentContainerStyle={{ flexDirection: "row", paddingVertical: 8 }}>
              {DAYS.map((dayLabel, idx) => {
                const dayData = schedule.find((d) => DayOfWeekLabels[d.dayOfWeek] === dayLabel)
                const isActive = dayData?.dayOfWeek === selectedDay

                return (
                  <View key={idx} style={{ alignItems: "center", marginHorizontal: 6 }}>
                    <TouchableOpacity
                      style={[
                        styles.dayCircle,
                        isActive && styles.activeDayCircle,
                      ]}
                      onPress={() => dayData && setSelectedDay(dayData.dayOfWeek)}
                    >
                      <Text style={[styles.dayText, isActive && styles.activeDayText]}>{dayLabel}</Text>
                    </TouchableOpacity>

                    {/* Render all alarms for this day */}
                    <View style={{ flexDirection: "row", marginTop: 4 }}>
                      {dayData?.alarms.map((alarm, i) => (
                        <View
                          key={i}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: "#1E90FF",
                            justifyContent: "center",
                            alignItems: "center",
                            marginHorizontal: 2,
                          }}
                        >
                          <Ionicons name="alarm" size={14} color="#FFD700" />
                          <Text style={{ fontSize: 10, color: "#FFF" }}>{alarm.alarmTime}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )
              })}
            </ScrollView>
          </View>

          {/* Games Section */}
          <View style={styles.gamesSection}>
            <View style={styles.gamesSectionHeader}>
              <Text style={styles.sectionTitle}>
                {selectedDay ? `Games for ${DayOfWeekLabels[selectedDay]}` : "Select a day"}
              </Text>
              {selectedDay && (
                <TouchableOpacity
                  style={styles.addGameButtonSmall}
                  onPress={() => navigation.navigate("GroupChall3", { catType: "Group", onGameSelected: addGameToDay })}
                >
                  <Ionicons name="add-circle" size={24} color="#FFD700" />
                  <Text style={styles.addGameTextSmall}>Add</Text>
                </TouchableOpacity>
              )}
            </View>

            {currentDay?.games.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.gamesScrollContainer}>
                <View style={styles.gamesGrid}>
                  {currentDay.games.map((game, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.gameCard, game.name === "Sudoku" && styles.sudokuGameCard]}
                      onPress={() => handleGamePress(game, index)}
                    >
                      <Text style={styles.gameTitle}>{game.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.emptyGamesContainer}>
                {selectedDay ? (
                  <>
                    <Ionicons name="game-controller-outline" size={40} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.emptyGamesText}>No games for {DayOfWeekLabels[selectedDay]}</Text>
                  </>
                ) : (
                  <Text style={styles.emptyGamesText}>Select a day to see games</Text>
                )}
              </View>
            )}
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
  },
  activeDayCircle: {
    backgroundColor: "#FFA500",
    shadowColor: "#FFA500",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
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

export default TempCp


