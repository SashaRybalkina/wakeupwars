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
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View, Platform, Alert, Button, Image } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import DateTimePicker from "@react-native-community/datetimepicker"
import { type NavigationProp, useRoute } from "@react-navigation/native"
import axios from "axios"
import { BASE_URL, endpoints } from "../../api"
import ChallengeCard from "./ChallengeCard"
import { LinearGradient } from "expo-linear-gradient"
import { useUser } from "../../context/UserContext"
import { getAccessToken } from "../../auth"
import { scheduleAlarmsForUser } from "../../alarmService"
import { FA6Style } from "@expo/vector-icons/build/FontAwesome6"
// import { DayOfWeek, DayOfWeekLabels } from "./DayOfWeek";

type Alarm = { userName: string; alarmTime: string }
type DaySchedule = {
  dayOfWeek: number
  alarms: Alarm[]
  games: { id?: number; name: string; order: number; screen?: string }[]
}

type Member = {
  id: number;
  name: string;
  username: string;
  avatar?: {
      id: number;
      imageUrl: string;
      backgroundColor: string;
  };
};


const DAYS = ["M", "T", "W", "TH", "F", "S", "SU"]
const extendedDays = new Set(["T", "TH", "S"])
const DayOfWeekLabels: Record<number, string> = { 1: "M", 2: "T", 3: "W", 4: "TH", 5: "F", 6: "S", 7: "SU" }

const ChallSchedule = ({ navigation }: { navigation: NavigationProp<any> }) => {
  const route = useRoute()
  const { challId, challName, fromSearch, userAverageSkillLevel, isInitiator, fromInvite, whichChall } = route.params as { 
    challId: number; 
    challName: string, 
    fromSearch: boolean,
    userAverageSkillLevel: number,
    isInitiator: boolean,
    fromInvite: boolean,
    whichChall?: string,
  }

  const [startDate, setStartDate] = useState<string>()
  const [endDate, setEndDate] = useState<string>()
  // const [selectedStartDate, setSelectedStartDate] = useState<Date>(new Date())
  // const [selectedEndDate, setSelectedEndDate] = useState<Date>(new Date())
  const [showStartDatePicker, setShowStartDatePicker] = useState(false)
  const [showEndDatePicker, setShowEndDatePicker] = useState(false)
  const [hasSetAlarms, setHasSetAlarms] = useState<boolean>()
  const [isPending, setIsPending] = useState<boolean>()
  const [groupId, setGroupId] = useState<Number>() // is personal if groupId null and isPublic false
  const [isPublic, setIsPublic] = useState<boolean>()
  const [isMember, setIsMember] = useState<boolean>()
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const { user } = useUser()

  // Full schedule from backend (contains both alarms and games)
  const [schedule, setSchedule] = useState<
    {
      dayOfWeek: number
      alarms: { userName: string; alarmTime: string }[]
      games: { name: string; order: number }[]
    }[]
  >([])

  // Which day is currently selected by the user
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  // Challenge members
  const [members, setMembers] = useState<Member[]>([])

  // Derived for convenience: currently visible games and alarms
  const currentDay = schedule.find((d) => d.dayOfWeek === selectedDay)
  const visibleGames = currentDay?.games ?? []
  const visibleAlarms = currentDay?.alarms ?? []

  const parseLocalDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };



useEffect(() => {
  const fetchSchedule = async () => {
    try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
              throw new Error("Not authenticated");
            }
      const [scheduleRes, alarmsRes] = await Promise.all([
        axios.get(endpoints.getChallengeSchedule(challId), {
          headers: { Authorization: `Bearer ${accessToken}` }
        }),
        axios.get(endpoints.getHasSetAlarms(challId, Number(user?.id)), {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
      ]);

      const data = scheduleRes.data;

      // Set challenge dates
      // const startDate = new Date(data.startDate)
      if (data.startDate) {
        // const startDateParts = data.startDate.split("-").map(Number)
        // const startDate = new Date(startDateParts[0], startDateParts[1] - 1, startDateParts[2])
        setStartDate(data.startDate)
      }
      if (data.endDate) {
        setEndDate(data.endDate)
      }

      setMembers(data.members)
      setIsPending(data.isPending)
      setIsPublic(data.isPublic)
      setGroupId(data.groupId)

      const dedupedSchedule: DaySchedule[] = data.schedule.map((day: DaySchedule) => ({
        ...day,
        alarms: Object.values(
          day.alarms.reduce((acc: Record<string, Alarm>, alarm: Alarm) => {
            acc[alarm.alarmTime] = alarm // only keep one per unique time
            return acc
          }, {})
        )
      }))

      setSchedule(dedupedSchedule)
      // setSchedule(data.schedule)
      console.log(JSON.stringify(data.schedule, null, 2))

      // Select first day that has a schedule by default
      if (data.schedule.length > 0) {
        setSelectedDay(data.schedule[0].dayOfWeek)
      }

      setHasSetAlarms(alarmsRes.data.hasSetAlarms);
      setIsLoading(false)
    } catch (err) {
      console.error(err)
    }
  }

  fetchSchedule()
}, [])

  const getRandomPastelColor = (seed: number) => {
    const hue = (seed * 137.5) % 360
    return `hsl(${hue}, 70%, 80%)`
  }


  // const onStartDateChange = (event: any, date?: Date) => {
  //   if (event?.type === "dismissed") return setShowStartDatePicker(false)
  //   if (date) {
  //     setSelectedStartDate(date)
  //     if (Platform.OS === "android") setShowStartDatePicker(false)
  //   }
  // }

  // const onEndDateChange = (event: any, date?: Date) => {
  //   if (event?.type === "dismissed") return setShowEndDatePicker(false)
  //   if (date) {
  //     setSelectedEndDate(date)
  //     if (Platform.OS === "android") setShowEndDatePicker(false)
  //   }
  // }


const addGameToDay = async (game: { id: number; name: string }) => {
  if (!selectedDay) return;

  const gameOrder = (currentDay?.games.length || 0) + 1;

  // 1. Update local state immediately for responsive UI
  const newGame = { name: game.name, order: gameOrder };
  setSchedule((prev) =>
    prev.map((d) =>
      d.dayOfWeek === selectedDay
        ? { ...d, games: [...d.games, newGame] }
        : d
    )
  );

  try {

        const payload = {
          challengeId: challId,
          gameId: game.id,
          dayOfWeek: selectedDay,
          gameOrder: gameOrder
        };

        console.log("Payload sent to backend:", payload);

              const accessToken = await getAccessToken();
              if (!accessToken) {
                throw new Error("Not authenticated");
              }
        const res = await fetch(endpoints.addGameToSchedule(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              "Authorization": `Bearer ${accessToken}`,
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to add game');
        }

  } catch (err) {
    console.error("Failed to add game to backend:", err);

    // 3. Optional: revert state if API fails
    setSchedule((prev) =>
      prev.map((d) =>
        d.dayOfWeek === selectedDay
          ? { ...d, games: d.games.filter((g) => g.order !== gameOrder) }
          : d
      )
    );
  }
};


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

  const goToMessages = () => navigation.navigate("Messages")
  const goToGroups = () => navigation.navigate("Groups")
  const goToProfile = () => navigation.navigate("Profile")

  const goToSudoku = () => {
    navigation.navigate('Sudoku', { challengeId: challId, challName, whichChall: whichChall ?? 'Group' });
  };

  const goToWordle = () => {
    navigation.navigate('Wordle', { challengeId: challId, challName: challName, whichChall: 'Public' });
  };

  const goToPattern = () => {
    navigation.navigate('PatternGame', { challengeId: challId});
  }


  const handleGamePress = (game: { name: string; order: number; screen?: string }, index: number) => {
    // Prefer backend-provided screen for dynamic navigation
    // if (game.screen) {
    //   navigation.navigate(game.screen, { challengeId: challId, challName: challName, whichChall: 'Public' });
    //   return;
    // }

    // Fallback to name-based routing if screen is not provided
    const lowered = game.name.toLowerCase();
    if (lowered.includes("sudoku")) {
      goToSudoku();
    } else if (lowered.includes("wordle")) {
      goToWordle();
    } else if (lowered.includes("pattern")) {
      goToPattern();
    } else {
      // no-op for unknown games on this screen
    }
  }

    const handleJoinPublicChallenge = async () => {
  
          try {

            const payload = {
              challenge_id: challId,
              user_average_skill_level: userAverageSkillLevel
            }
  
                const accessToken = await getAccessToken();
                if (!accessToken) {
                  throw new Error("Not authenticated");
                }
          const res = await fetch(endpoints.joinPublicChallenge(Number(user?.id)), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                "Authorization": `Bearer ${accessToken}`,
              },
              body: JSON.stringify(payload),
          });
  
          if (!res.ok) {
              const error = await res.json();
              throw new Error(error.message || 'Failed to join challenge');
          }
  
          setIsPending(false)
            try {
                if (challId) {
                console.log(challId)
                await scheduleAlarmsForUser(challId, challName, Number(user?.id));
                setHasSetAlarms(true)
                }
            } catch (e) {
                console.warn('Failed to schedule alarms for new challenge', e);
            }
          Alert.alert('Success', 'Joined Challenge', [
              { text: 'OK', onPress: () => navigation.navigate('PublicChallenges') },
          ]);
          } catch (err: any) {
              Alert.alert('Error', err.message);
          }
  
      }


      //   const handleFinalizePublicChallenge = async () => {
  
      //     try {

      //       const payload = {
      //         challenge_id: challId,
      //       }

      //   const accessToken = await getAccessToken();
      //   if (!accessToken) {
      //     throw new Error("Not authenticated");
      //   }
  
          
      //     const res = await fetch(endpoints.finalizePublicChallenge(), {
      //         method: 'POST',
      //         headers: {
      //           'Content-Type': 'application/json',
      //           "Authorization": `Bearer ${accessToken}`,
      //         },
      //         body: JSON.stringify(payload),
      //     });
  
      //     if (!res.ok) {
      //         const error = await res.json();
      //         throw new Error(error.message || 'Failed to finalize challenge');
      //     }
  
      //     const data = await res.json();
      //     Alert.alert('Success', 'Finalized Challenge', [
      //         { text: 'OK', onPress: () => navigation.navigate('PublicChallenges') },
      //     ]);
      //     } catch (err: any) {
      //         Alert.alert('Error', err.message);
      //     }
  
      // }


  // const formatDate = (date: Date) => {
  //   const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  //   const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  //   return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()} ${date.getFullYear()}`
  // }
  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    }
    return date.toLocaleDateString(undefined, options)
  }

  // const allDaysHaveGames = schedule.every(day => {
  //   if (day.alarms.length > 0) {
  //     return day.games.length > 0
  //   }
  //   return true
  // })

  const generatePastelColor = (name: string): string => {
  // Simple hash function to generate a number from a string
  const hash = name.split("").reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc)
  }, 0)

  // Generate pastel colors by keeping high lightness and medium saturation
  const h = hash % 360 // Hue: 0-359
  const s = 60 + (hash % 20) // Saturation: 60-79%
  const l = 80 + (hash % 10) // Lightness: 80-89%

  return `hsl(${h}, ${s}%, ${l}%)`
}

// Function to get initials from name
const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .substring(0, 2) // Limit to 2 characters
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
          {startDate && (
            <View style={styles.dateSection}>
              <View style={styles.dateContainer}>
                <Text style={styles.dateLabel}>Start date</Text>
                <Text style={styles.dateValue}>{startDate}</Text>
              </View>

              <View style={styles.dateContainer}>
                <Text style={styles.dateLabel}>End date</Text>
                <Text style={styles.dateValue}>{endDate}</Text>
              </View>
            </View>
          )}






          {(fromSearch === true || isPending === true) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Enrolled Members</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.membersScroll}>
  {members.map((member) => {
    const bgColor = member.avatar?.backgroundColor ?? getRandomPastelColor(member.id);
    return (
      <View key={member.id} style={styles.memberContainer}>
        <View style={[styles.memberAvatar, { backgroundColor: bgColor }]}>
          {member.avatar?.imageUrl ? (
            <Image
              source={{ uri: `${BASE_URL}${member.avatar.imageUrl}` }}
              style={styles.memberAvatarImage}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.memberInitials}>{getInitials(member.name)}</Text>
          )}
        </View>
        <Text style={styles.memberName}>{member.name}</Text>
      </View>
    );
  })}
              </ScrollView>
            </View>
          )}





          {/* Days + Alarms Section */}
          <View style={styles.alarmSection}>
            <Text style={styles.sectionTitle}>Challenge Days</Text>
            <ScrollView horizontal contentContainerStyle={{ flexDirection: "row", paddingVertical: 8 }}>
{DAYS.map((dayLabel, idx) => {
  // find the schedule object for this label
  const dayData = schedule.find((d) => DayOfWeekLabels[d.dayOfWeek] === dayLabel)
  const isActive = dayData?.dayOfWeek === selectedDay

  return (
    <View key={idx} style={{ alignItems: "center", marginHorizontal: 6 }}>
      <TouchableOpacity
        style={[styles.dayCircle, isActive && styles.activeDayCircle]}
        onPress={() => dayData && setSelectedDay(dayData.dayOfWeek)} // set selectedDay
      >
        <Text style={[styles.dayText, isActive && styles.activeDayText]}>{dayLabel}</Text>
      </TouchableOpacity>

      <View style={{ flexDirection: "row", marginTop: 4 }}>
        {dayData?.alarms.map((alarm, i) => (
          <View key={i} style={{
            width: 42, height: 42, borderRadius: 20,
            backgroundColor: "#1E90FF", justifyContent: "center",
            alignItems: "center", marginHorizontal: 2
          }}>
            <Ionicons name="alarm" size={14} color="#FFD700" />
            <Text style={{ fontSize: 10, color: "#FFF", textAlign: "center" }}>{alarm.alarmTime.replace(" ", "\n")}</Text>
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
    {/* {selectedDay && (
      <TouchableOpacity
        style={styles.addGameButtonSmall}
        onPress={() => navigation.navigate("Categories", {
          catType: "Schedule",
          groupId: null,
          onGameSelected: addGameToDay,
          challId,
          challName
        })}
      >
        <Ionicons name="add-circle" size={24} color="#FFD700" />
        <Text style={styles.addGameTextSmall}>Add</Text>
      </TouchableOpacity>
    )} */}
  </View>
            {visibleGames.length > 0 ? (
              <ScrollView
                horizontal={true}
                showsHorizontalScrollIndicator={true}
                contentContainerStyle={styles.gamesScrollContainer}
              >
                <View style={styles.gamesGrid}>
                  {visibleGames.map((game, index) => {
                    // const name = (game[0] || "").trim();
                    const lower = game.name.toLowerCase();
                    const isSudoku = lower.includes("sudoku");   
                    const isWordle = lower.includes("wordle");
                    const isPattern = lower.includes("pattern"); 

                    return (
                      <TouchableOpacity
                        key={index}
                        style={[styles.gameCard, isSudoku && styles.sudokuGameCard]}
                        onPress={() => handleGamePress(game, index)}
                      >
                        <Text style={styles.gameTitle}>{game.name}</Text>

                        {isSudoku ? (
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
                        ) : isPattern ? (
                          <>
                            <ImageBackground
                              source={require("../../images/patternGame.png")}
                              style={styles.sudokuImage}
                              resizeMode="contain"
                            />
                            <View style={styles.playIndicator}>
                              <Ionicons name="play-circle" size={24} color="#FFD700" />
                              <Text style={styles.playText}>Play</Text>
                            </View>
                          </>
                        ) : 
                        isWordle ? (
                          <>
                            <ImageBackground
                              source={require("../../images/wordle.png")}
                              style={styles.sudokuImage}
                              resizeMode="contain"
                            />
                            <View style={styles.playIndicator}>
                              <Ionicons name="play-circle" size={24} color="#FFD700" />
                              <Text style={styles.playText}>Play</Text>
                            </View>
                          </>
                        ) : (
                          <>
                            <Text style={styles.gameDetail}>Repeats: -</Text>
                            <Text style={styles.gameDetail}>Minutes: -</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    );
                  })}
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

{fromSearch === true && (
  <TouchableOpacity style={styles.createButton} onPress={handleJoinPublicChallenge}>
    <LinearGradient
      colors={['#FFD700', '#FFC107']}
      style={styles.createButtonGradient}
    >
      <Text style={styles.createButtonText}>Join Challenge</Text>
    </LinearGradient>
  </TouchableOpacity>
)}

{/* {isInitiator === true && (
  <TouchableOpacity style={styles.createButton} onPress={handleFinalizePublicChallenge}>
    <LinearGradient
      colors={['#FFD700', '#FFC107']}
      style={styles.createButtonGradient}
    >
      <Text style={styles.createButtonText}>Finalize Challenge</Text>
    </LinearGradient>
  </TouchableOpacity>
)} */}

{!isLoading && !isPending && !hasSetAlarms && !fromInvite && (
  <Button
    title="Set My Alarms"
    onPress={async () => {
      // if (!allDaysHaveGames) {
      //   Alert.alert("Error", "Select at least one game for each scheduled alarm");
      //   return;
      // }

      try {
        // 1. Schedule alarms locally
        await scheduleAlarmsForUser(challId, challName, Number(user?.id));

              const accessToken = await getAccessToken();
              if (!accessToken) {
                throw new Error("Not authenticated");
              }
        // 2. Mark in backend that user has set their alarms
        const res = await fetch(
          endpoints.setUserHasSetAlarms(challId, Number(user?.id)),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        setHasSetAlarms(true);
        console.log("Alarms set and API updated");
      } catch (e) {
        console.warn("Failed to set alarms", e);
        Alert.alert("Failed", "Failed to schedule alarms for new challenge", [
          { text: "OK" },
        ]);
      }
    }}
    // disabled={!allDaysHaveGames}
  />

)}


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
    width: 130,
    marginRight: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    height: 130,
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
    fontSize: 12,
    marginBottom: 6,
  },
  gameDetail: {
    color: "#DDD",
    fontSize: 12,
    marginBottom: 3,
  },
  sudokuImage: {
    width: 50,
    height: 50,
    marginTop: 4,
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
    section: {
    marginBottom: 20,
  },
    membersScroll: {
    flexDirection: "row",
    marginBottom: 10,
  },
  memberCard: {
    alignItems: "center",
    marginRight: 20,
    width: 70,
  },
  memberContainer: {
    alignItems: "center",
    marginRight: 15,
    width: 70,
  },
  memberAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  memberAvatarImage: {
    width: '100%',
    height: '100%',
  },
  memberInitials: {
    fontSize: 22,
    fontWeight: "700",
    color: "#333",
  },
  memberName: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
})

export default ChallSchedule