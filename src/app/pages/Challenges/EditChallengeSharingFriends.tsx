import React, { useState, useEffect } from "react";
import {
  ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View,
  Platform, Alert, Image, ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { NavigationProp, RouteProp } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import axios from "axios";
import { endpoints } from "../../api";
import { getGameMeta } from "../Games/NewGamesManagement";
import { useUser } from "../../context/UserContext";
import { getAccessToken } from "../../auth";
import { getNextAlarmDate } from "../../../utils/dateUtils";

type Props = {
  navigation: NavigationProp<any>;
  route: RouteProp<any>;
};

const DAYS = ["M", "T", "W", "TH", "F", "S", "SU"];


function normalizeSchedule(raw: any): {
  dayOfWeek: number;
  alarms: { userName?: string; alarmTime: string }[];
  games: { id?: number; name: string; order?: number }[];
}[] {
  if (!raw) return [];


  if (!Array.isArray(raw) && Array.isArray(raw.schedule)) {
    return raw.schedule.map((d: any) => ({
      dayOfWeek: Number(d.dayOfWeek),
      alarms: Array.isArray(d.alarms) ? d.alarms : [],
      games: Array.isArray(d.games)
        ? d.games.map((g: any, idx: number) => ({
            id: g.id ?? g.gameId,
            name: g.name ?? String(g),
            order: g.order ?? idx + 1,
          }))
        : [],
    }));
  }


  if (Array.isArray(raw)) {
    return raw.map((d: any) => ({
      dayOfWeek: Number(d.dayOfWeek),
      alarms: d.alarmTime ? [{ userName: "", alarmTime: d.alarmTime }] : [],
      games: Array.isArray(d.games)
        ? d.games.map((g: any, idx: number) => {
            const name = typeof g === "object"
              ? (g.name ?? g[0] ?? "")
              : String(g);
            const id = typeof g === "object" ? (g.id ?? g.gameId) : undefined;
            return { id, name, order: idx + 1 };
          })
        : [],
    }));
  }

  return [];
}

const EditChallengeSharingFriends: React.FC<Props> = ({ navigation, route }) => {
  const { challId, challName } = route.params || {};
  const { user, logout } = useUser();
  console.log("[FRONTEND] Entering EditChallengeSharingFriends with challId:", challId, "challName:", challName);

  const [alarmSchedule, setAlarmSchedule] = useState<any[]>([])
  // const [gameSchedule, setGameSchedule] = useState<any[]>([])

  // Challenge state
  const [challenge, setChallenge] = useState<any>(null);
  const [loadingChallenge, setLoadingChallenge] = useState(true);

  // Dates
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Friends
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<number[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);

  // const [members, setMembers] = useState<{ id: number; name: string }[]>([])

  function to24Hour(time12h: string) {
    const [time, modifier] = time12h.split(' '); // ["07:25", "PM"]
    let [hours, minutes] = time.split(':').map(Number);

    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  
  useEffect(() => {
    if (!challId) return;

    let cancelled = false;

    async function load() {
      try {
        setLoadingChallenge(true);
        
      const accessToken = await getAccessToken();
      if (!accessToken) {
                      await logout();
                      navigation.reset({
                        index: 0,
                        routes: [{ name: "Login" }],
                      });
      }
        const detailReq = axios.get(endpoints.challengeDetail(challId), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        let scheduleData: any = null;
        try {
          const res = await axios.get(endpoints.getChallengeSchedule(challId), {
                headers: {
                  Authorization: `Bearer ${accessToken}`
                }
              });

          scheduleData = res.data;
        } catch (e) {
          console.log("[FRONTEND] getChallengeSchedule failed, fallback to challengeSchedule");
          const resFallback = await axios.get(endpoints.challengeSchedule(challId), {
                headers: {
                  Authorization: `Bearer ${accessToken}`
                }
              });

          scheduleData = resFallback.data;
        }

        const [detailRes] = await Promise.all([detailReq]);
        if (cancelled) return;

        const detail = detailRes.data;
        const schedule = normalizeSchedule(scheduleData);

        const merged = {
          ...detail,
          schedule, 
          members: Array.isArray(scheduleData?.members) ? scheduleData.members : [],
        };

        setChallenge(merged);

        console.log(schedule)

        // Extract all alarms into a single list
        const alarmSched = schedule.flatMap(dayItem =>
          dayItem.alarms.map(alarm => ({
            dayOfWeek: dayItem.dayOfWeek,
            time: to24Hour(alarm.alarmTime),
          }))
        );

        // const gameSched = Object.values(
        //   schedule.reduce((acc, dayItem) => {
        //     if (dayItem.games?.length) {
        //       acc[dayItem.dayOfWeek] = {
        //         dayOfWeek: dayItem.dayOfWeek,
        //         games: dayItem.games.map((game, index) => ({
        //           id: game.id,
        //           order: game.order ?? index + 1,
        //         })),
        //       }
        //     }
        //     return acc
        //   }, {} as Record<number, { dayOfWeek: number; games: { id: number; order: number }[] }>)
        // )


        // console.log("alarmSchedule:", alarmSched);
        // console.log("gameSchedules:", JSON.stringify(gameSched, null, 2));

        setAlarmSchedule(alarmSched)
        // setGameSchedule(gameSched)


        // const sd = detail.startDate ?? scheduleData?.startDate;
        // const ed = detail.endDate ?? scheduleData?.endDate;
        // if (sd) setStartDate(new Date(sd));
        // if (ed) setEndDate(new Date(ed));
      } catch (err: any) {
        console.error("[FRONTEND] Failed to load challenge/schedule:", err.response?.data || err.message);
      } finally {
        if (!cancelled) setLoadingChallenge(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [challId]);


useEffect(() => {
  const fetchFriends = async () => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
                      await logout();
                      navigation.reset({
                        index: 0,
                        routes: [{ name: "Login" }],
                      });
      }

      if (!user?.id) return;
      setLoadingFriends(true);

      const res = await axios.get(endpoints.friends(Number(user.id)), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      console.log("[FRONTEND] Friends data:", res.data);
      setFriends(res.data);
    } catch (err: any) {
      console.error(
        "[FRONTEND] Failed to load friends:",
        err.response?.data || err.message
      );
    } finally {
      setLoadingFriends(false);
    }
  };

  fetchFriends();
}, [user]);


  const toggleFriend = (id: number) => {
    setSelectedFriends(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const onDateChange = (picker: "start" | "end", event: any, date?: Date) => {
    if (event?.type === "dismissed") {
      picker === "start" ? setShowStartPicker(false) : setShowEndPicker(false);
      return;
    }
    if (date) {
      picker === "start" ? setStartDate(date) : setEndDate(date);
      if (Platform.OS === "android") {
        picker === "start" ? setShowStartPicker(false) : setShowEndPicker(false);
      }
    }
  };

  const formatDate = (date: Date | null) =>
    date ? date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "N/A";

  // Local YYYY-MM-DD (avoid UTC shift from toISOString)
  const toLocalYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const handleSave = async () => {
    if (!challenge) return;

    if (selectedFriends.length === 0) {
      Alert.alert("Pick friends", "Please select at least one friend to share with.");
      return;
    }

    console.log(alarmSchedule)

    // find first valid future start date
    const nextAlarmDate = getNextAlarmDate(alarmSchedule);
    if (!nextAlarmDate) {
      Alert.alert('Error', 'Could not determine start date from schedule');
      return;
    }
    console.log(toLocalYMD(nextAlarmDate));

    navigation.navigate('PersChall3', {
                first_possible_start_date: toLocalYMD(nextAlarmDate),
                name: challName,
                alarm_schedule: alarmSchedule,
                // game_schedule: gameSchedule,
                chall_type: 'Share',
                members: selectedFriends,
                chall_id: challenge.id,
            })

    // try {

    //   const accessToken = await getAccessToken();
    //   if (!accessToken) {
    //     throw new Error("Not authenticated");
    //   }

    //   const payload = {
    //     startDate: startDate ? toLocalYMD(startDate) : undefined,
    //     endDate: endDate ? toLocalYMD(endDate) : undefined,
    //     members: selectedFriends, 
    //   };

    //   console.log("[FRONTEND] Share payload:", payload);

    //   const response = await axios.post(
    //     endpoints.shareChallenge(challenge.id),
    //     payload, // <-- request body
    //     {
    //       headers: {
    //         "Content-Type": "application/json",
    //         Authorization: `Bearer ${accessToken}`,
    //       },
    //     }
    //   );

    //   console.log("[FRONTEND] Share response:", response.data);
    //   Alert.alert("Saved", "Challenge shared successfully!");
    //   navigation.goBack();
    // } catch (error: any) {
    //   console.error("[FRONTEND] Error sharing:", error.response?.data || error.message);
    //   Alert.alert("Error", "Failed to share challenge.");
    // }
  };

  // --- UI states ---
  if (loadingChallenge) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" }}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={{ color: "#FFF", marginTop: 10 }}>Loading challenge...</Text>
      </View>
    );
  }

  if (!challenge) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" }}>
        <Text style={{ color: "red" }}>Error loading challenge</Text>
      </View>
    );
  }

  return (
    <ImageBackground source={require("../../images/cgpt4.png")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>

        <Text style={styles.pageTitle}>Share Challenge</Text>

        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Challenge Info */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Name</Text>
            <Text style={styles.readonlyText}>{challenge.name ?? challName}</Text>
          </View>

          {/* Days & Alarm */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Days & Alarm</Text>


            {!!challenge.daysOfWeek?.length && (
              <View style={styles.daysContainer}>
                {challenge.daysOfWeek.map((day: number | string, idx: number) => {
                  const label = typeof day === "number" ? DAYS[day - 1] : day;
                  return (
                    <View key={idx} style={styles.dayReadonly}>
                      <Text style={styles.dayText}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            )}


            {Array.isArray(challenge.schedule) && challenge.schedule.map((d: any, idx: number) => {
              const label = DAYS[(d.dayOfWeek ?? 1) - 1] || d.dayOfWeek;
              const times = (d.alarms || []).map((a: any) => a.alarmTime).filter(Boolean);
              return (
                <Text key={idx} style={styles.readonlyText}>
                  {`${label}: ${times.length ? times.join(" • ") : "No alarm"}`}
                </Text>
              );
            })}
          </View>

          {/* Games */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Games</Text>
            {Array.isArray(challenge.schedule) && challenge.schedule.some((s: any) => (s.games?.length ?? 0) > 0) ? (
              challenge.schedule.map((s: any, idx: number) => (
                <View key={idx} style={{ marginBottom: 15 }}>
                  <Text style={[styles.readonlyText, { fontWeight: "700", marginBottom: 5 }]}>
                    {DAYS[(s.dayOfWeek ?? 1) - 1] || s.dayOfWeek}
                  </Text>
                  {(s.games || []).map((g: any, gIdx: number) => {
                    const meta = getGameMeta(g.id, g.name);
                    return (
                      <View key={gIdx} style={styles.gameRow}>
                        <Image source={meta.image} style={styles.gameIcon} resizeMode="contain" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.gameName}>{g.name}</Text>
                          <Text style={styles.gameDesc}>{meta.desc}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))
            ) : (
              <Text style={styles.readonlyText}>No games</Text>
            )}
          </View>

          {/* Start / End Dates */}
          {/* <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Start Date</Text>
            <Text style={styles.dateDisplay}>{formatDate(startDate)}</Text>
            <TouchableOpacity style={styles.actionButton} onPress={() => setShowStartPicker(true)}>
              <LinearGradient colors={["rgba(255, 255, 255, 0.2)", "rgba(255, 255, 255, 0.1)"]} style={styles.buttonGradient}>
                <Ionicons name="calendar-outline" size={20} color="#FFF" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Select Start Date</Text>
              </LinearGradient>
            </TouchableOpacity>
            {showStartPicker && startDate && (
              <DateTimePicker value={startDate} mode="date" display="spinner" onChange={(e, d) => onDateChange("start", e, d)} />
            )}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>End Date</Text>
            <Text style={styles.dateDisplay}>{formatDate(endDate)}</Text>
            <TouchableOpacity style={styles.actionButton} onPress={() => setShowEndPicker(true)}>
              <LinearGradient colors={["rgba(255, 255, 255, 0.2)", "rgba(255, 255, 255, 0.1)"]} style={styles.buttonGradient}>
                <Ionicons name="calendar-outline" size={20} color="#FFF" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Select End Date</Text>
              </LinearGradient>
            </TouchableOpacity>
            {showEndPicker && endDate && (
              <DateTimePicker value={endDate} mode="date" display="spinner" onChange={(e, d) => onDateChange("end", e, d)} />
            )}
          </View> */}

          {/* Friends List */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Select Friends</Text>
            {selectedFriends.length > 0 && (
              <Text style={styles.selectedCount}>
                Selected {selectedFriends.length} friend{selectedFriends.length > 1 ? "s" : ""}
              </Text>
            )}
            {loadingFriends ? (
              <ActivityIndicator size="large" color="#FFD700" />
            ) : friends.length === 0 ? (
              <Text style={styles.readonlyText}>No friends available</Text>
            ) : (
              friends.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[
                    styles.friendRow,
                    selectedFriends.includes(f.id) && styles.friendRowSelected,
                  ]}
                  onPress={() => toggleFriend(f.id)}
                >
                  <Ionicons
                    name={selectedFriends.includes(f.id) ? "checkbox" : "square-outline"}
                    size={22}
                    color="#FFD700"
                    style={{ marginRight: 10 }}
                  />
                  <Text style={styles.friendName}>{f.name}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Save */}
          <TouchableOpacity style={styles.createButton} onPress={handleSave}>
            <LinearGradient colors={["#FFD700", "#FFC107"]} style={styles.createButtonGradient}>
              <Text style={styles.createButtonText}>Next</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: { flex: 1 },
  container: { flex: 1, paddingTop: 50 },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center", alignItems: "center",
    marginLeft: 20, marginBottom: 10,
  },
  pageTitle: { fontSize: 28, fontWeight: "700", color: "#FFF", textAlign: "center", marginBottom: 20 },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  formSection: {
    marginBottom: 25, backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 16, padding: 20, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.1)",
  },
  sectionTitle: { fontSize: 20, fontWeight: "600", color: "#FFF", marginBottom: 15 },
  readonlyText: { fontSize: 16, color: "#FFF", marginBottom: 8 },
  daysContainer: { flexDirection: "row", flexWrap: "wrap" },
  dayReadonly: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center", alignItems: "center",
    marginRight: 8, marginBottom: 8,
  },
  dayText: { color: "#FFF", fontWeight: "600" },
  dateDisplay: { color: "#FFD700", fontSize: 18, marginBottom: 10 },
  actionButton: { borderRadius: 12, overflow: "hidden", marginTop: 10 },
  buttonGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  buttonIcon: { marginRight: 8 },
  buttonText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  createButton: { borderRadius: 12, overflow: "hidden", marginTop: 20, marginBottom: 30 },
  createButtonGradient: { paddingVertical: 15, alignItems: "center", justifyContent: "center" },
  createButtonText: { color: "#333", fontSize: 18, fontWeight: "700" },
  gameRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 10 },
  gameIcon: { width: 40, height: 40, marginRight: 12 },
  gameName: { fontSize: 16, fontWeight: "600", color: "#FFF" },
  gameDesc: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  selectedCount: { color: "#FFD700", fontSize: 14, marginBottom: 10, fontWeight: "600" },
  friendRow: { flexDirection: "row", alignItems: "center", padding: 12, marginBottom: 8, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10 },
  friendRowSelected: { backgroundColor: "rgba(255,215,0,0.3)", borderWidth: 1, borderColor: "#FFD700" },
  friendName: { color: "#FFF", fontSize: 16, fontWeight: "500" },
});

export default EditChallengeSharingFriends;