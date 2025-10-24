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
import { scheduleAlarmsForChallenge } from "../../alarmService"
import { Platform } from "react-native"
import { useUser } from "../../context/UserContext"
import { Picker } from "@react-native-picker/picker"
import { getAccessToken } from "../../auth"
import { getNextAlarmDate } from "../../../utils/dateUtils"
import { getMetaFromTuple } from "../Games/NewGamesManagement"

type Props = {
  navigation: NavigationProp<any>
}

const DAYS = ["M", "T", "W", "TH", "F", "S", "SU"]

// reward types allowed by backend
// const REWARD_TYPES = [
//   { key: 'money', label: 'Money $' },
//   { key: 'points', label: 'Points' },
//   { key: 'custom', label: 'Custom' },
// ] as const;

// type RewardTypeKey = typeof REWARD_TYPES[number]['key'];

const CreatePublicChall2: React.FC<Props> = ({ navigation }) => {
  const route = useRoute()
  const { singOrMult, categories } = route.params as {
    singOrMult: string
    categories: { id: number; name: string }[]
  }
  console.log("CreatePublicChall2 route params:", route.params);

  const { user } = useUser();

  // Note: just inserting this user as "group members" since this is a public challenge
  // they're creating
  const initiatorId = user?.id



  const [name, setName] = useState("")

  const [tempTime, setTempTime] = useState<Date | null>(null)
  const [showTimePicker, setShowTimePicker] = useState(false)

  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [dayTimeMapping, setDayTimeMapping] = useState<Record<string, string>>({})
  const [gamesByDay, setGamesByDay] = useState<Record<string, [string, string][]>>({})
  const [numUserCoins, setNumUserCoins] = useState<number>(0)
  const [participationFee, setParticipationFee] = useState('');

  // reward state
  // const [rewardType, setRewardType] = useState<RewardTypeKey>('money');
  // const [rewardAmount, setRewardAmount] = useState('5');
  // const [rewardNote, setRewardNote] = useState('');

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


  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const access = await getAccessToken();
        const res = await fetch(endpoints.getNumCoins(Number(user?.id)), {
          headers: {
            Authorization: `Bearer ${access}`
          }
        });
        const data = await res.json()
        setNumUserCoins(data.numCoins);
      } catch {}
    })();
  }, [user]);

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
  // const onDateChange = (event: any, date?: Date) => {
  //   if (event?.type === "dismissed") {
  //     setShowDatePicker(false)
  //     return
  //   }
  
  //   if (date) {
  //     setSelectedDate(date)
  //     if (Platform.OS === "android") {
  //       setShowDatePicker(false)
  //     }
  //   }
  // }

  // const onTimeChange = (_: any, time?: Date) => {
  //   if (time) setTempTime(time)
  // }

  // // Android + IOS version
  // const onTimeChange = (event: any, time?: Date) => {
  //   if (event?.type === "dismissed") {
  //     setShowTimePicker(false)
  //     return
  //   }
  
  //   if (time) {
  //     if (Platform.OS === "android") {
  //       let formattedTime = formatTime(time)
  //       formattedTime = cleanTime(formattedTime)
  
  //       const updatedMapping = { ...dayTimeMapping }
  //       selectedDays.forEach((day) => {
  //         updatedMapping[day] = formattedTime
  //       })
  
  //       setDayTimeMapping(updatedMapping)
  //       setSelectedDays([])
  //       setShowTimePicker(false)
  //     } else {
  //       // for ios
  //       setTempTime(time)
  //     }
  //   }
  // }


const onTimeChange = (event: any, time?: Date) => {

  if (Platform.OS === "android") {
    if (event?.type === "dismissed") {
      setShowTimePicker(false);
      return;
    }
    setShowTimePicker(false);

    if (event?.type === "set" && time) {
      let formattedTime = formatTime(time);
      formattedTime = cleanTime(formattedTime);

      const updatedMapping = { ...dayTimeMapping };
      selectedDays.forEach((day) => {
        updatedMapping[day] = formattedTime;
      });

      setDayTimeMapping(updatedMapping);
      setSelectedDays([]);
      // setShowTimePicker(false);
    }
  }
};


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

  // const formatDate = (date: Date) => {
  //   const options: Intl.DateTimeFormatOptions = { 
  //     weekday: 'short', 
  //     year: 'numeric', 
  //     month: 'short', 
  //     day: 'numeric' 
  //   }
  //   return date.toLocaleDateString(undefined, options)
  // }



    const toLocalYMD = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }


  const handleNext = async() => {
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

      const trimmed = participationFee.trim();
      console.log(trimmed)
      if (!/^\d+$/.test(trimmed)) {
        Alert.alert('Error', 'Enter a valid positive whole number for the reward');
        return;
      }

      const fee = parseInt(trimmed, 10);
      console.log(fee)

      if (fee < 0) {
        Alert.alert('Error', 'Enter a valid positive amount for the reward');
        return;
      }

      if (fee > numUserCoins) {
        Alert.alert('Error', `You do not have enough coins! You currently have ${numUserCoins} coins.`);
        return;
      }


    // // reward validation
    // let reward: any = null;
    // if (rewardType === 'custom') {
    //   if (!rewardNote.trim()) {
    //     Alert.alert('Error', 'Please enter a description for the custom reward');
    //     return;
    //   }
    //   reward = { type: 'custom', note: rewardNote.trim() };
    // } else {
    //   const amt = parseFloat(rewardAmount);
    //   if (isNaN(amt) || amt <= 0) {
    //     Alert.alert('Error', 'Enter a valid positive amount for the reward');
    //     return;
    //   }
    //   reward = { type: rewardType, amount: amt };
    // }
    
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

          const alarmDays = alarmSchedule.map(a => a.dayOfWeek);
          const gameDays = gameSchedules.map(g => g.dayOfWeek);
    
          // find alarm days missing games
          const missingGames = alarmDays.filter(day => !gameDays.includes(day));
    
          if (missingGames.length > 0) {
            Alert.alert(
              "Error",
              "Please select at least one game for each day that has an alarm."
            );
            return;
          }

    const nextAlarmDate = getNextAlarmDate(alarmSchedule);
    if (!nextAlarmDate) {
      Alert.alert('Error', 'Could not determine start date from schedule');
      return;
    }
    console.log(toLocalYMD(nextAlarmDate));
          
                navigation.navigate("PersChall3", {
                    first_possible_start_date: toLocalYMD(nextAlarmDate),
                    name,
                    alarm_schedule: alarmSchedule,
                    game_schedule: gameSchedules,
                    chall_type: 'Public',
                    sing_or_mult: singOrMult,
                    category_ids: categories.map(c => c.id),
                    participation_fee: fee,
                })
  
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
      {(selectedDays && selectedDays[0] && (!gamesByDay[selectedDays[0]]) || (selectedDays && selectedDays[0] && gamesByDay[selectedDays[0]].length === 0)) && (
      <TouchableOpacity
        style={[styles.addGameButton, { width: 120, marginLeft: 8 }]}
        onPress={() => {
          navigation.navigate("SomeCategories", {
            catType: "Public",
            categories: categories,
            singOrMult: singOrMult,
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
    </ScrollView>
  </View>
)}




{/* 

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
                    {((game[1] === "Sudoku") && (
                      <ImageBackground
                      source={require('../../images/sudoku.png')}
                      style={styles.gameImage}
                      resizeMode="contain"
                    />
                    ))}
                    {((game[1] === "Wordle" || game[1] === "Singleplayer Wordle") && (
                      <ImageBackground
                      source={require('../../images/wordle.png')}
                      style={styles.gameImage}
                      resizeMode="contain"
                    />
                    ))}
                    {((game[1] === "Pattern" || game[1] === "Pattern Game") && (
                      <ImageBackground
                      source={require('../../images/patternGame.png')}
                      style={styles.gameImage}
                      resizeMode="contain"
                    />
                    ))}
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={styles.addGameButton}
                  onPress={() => {
                    navigation.navigate("SomeCategories", {
                      catType: "Public",
                      categories: categories,
                      singOrMult: singOrMult,
                      onGameSelected: (game: { id: number; name: string }) => {
                        handleGameAdd(game)
                      },
                    })
                  }}
                  // onPress={() => {
                  //   navigation.navigate("Games", {
                  //     catType: "Public",
                  //     category: category,
                  //     singOrMult: singOrMult,
                  //     groupId : null,
                  //     groupMembers : null,
                  //     onGameSelected: (game: { id: number; name: string }) => {
                  //       handleGameAdd(game)
                  //     },
                  //     challId : null,
                  //     challName : null
                  //   })
                  // }}
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


          <View style={styles.rewardHeader}>
            <Text style={styles.sectionTitle}>Set Reward</Text>

            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Amount"
                placeholderTextColor="rgba(255,255,255,0.6)"
                keyboardType="numeric"
                value={participationFee}
                onChangeText={setParticipationFee}
              />
              <Text style={styles.coinEmoji}>🪙</Text>
            </View>
          </View>


          <TouchableOpacity
            style={styles.createButton}
            onPress={handleNext}
          >
            <LinearGradient
              colors={["#FFD700", "#FFC107"]}
              style={styles.createButtonGradient}
            >
              <Text style={styles.createButtonText}>Next</Text>
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
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  choiceButton: { marginTop:-20, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', marginRight: 10, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  choiceButtonSelected: { backgroundColor: 'rgba(255,215,0,0.3)', borderColor: '#FFD700' },
  choiceText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  choiceTextSelected: { color: '#FFD700' },
  rewardHeader:{flexDirection:'row',alignItems:'center',marginBottom:12},

  activeNavText: {
    color: "#FFD700",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    backgroundColor: "#222",
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  coinEmoji: {
    fontSize: 20,
    marginLeft: 6,
  },
})

export default CreatePublicChall2