"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { useFocusEffect } from '@react-navigation/native';
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  Animated,
  TextInput,
} from "react-native"
import { useUser } from "../../context/UserContext"
import { Ionicons } from "@expo/vector-icons"
import { type NavigationProp, useRoute } from "@react-navigation/native"
import axios from "axios"
import { endpoints, BASE_URL } from "../../api"
import { LinearGradient } from "expo-linear-gradient"
import { DayOfWeekLabels, type DayOfWeek } from "./DayOfWeek" // Ensure this is imported
import { Button } from 'tamagui';
import { Alert } from "react-native";
import { getAccessToken } from "../../auth";

type Props = {
  navigation: NavigationProp<any>
}

type Member = {
  id: number;
  name: string;
  username: string;
  numCoins: number;
};

const { width } = Dimensions.get("window")
const cardWidth = Math.min(width * 0.9, 400)
const DAY_ORDER = ["M", "T", "W", "TH", "F", "S", "SU"]

const DayOfWeekReverseLabels: Record<string, number> = {
  M: 1, // Monday
  T: 2, // Tuesday
  W: 3, // Wednesday
  TH: 4, // Thursday
  F: 5, // Friday
  S: 6, // Saturday
  SU: 7, // Sunday
}

// Function to generate a pastel color based on name
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

const ChallDetails: React.FC<Props> = ({ navigation }) => {
  const route = useRoute()
  const { challId, challName, whichChall } = route.params as {
    challId: number
    challName: string
    whichChall: string
  }
  console.log("ChallDetails route params:", route.params);

  const { user } = useUser()
  const myName = user?.username || ""

  const [daysComplete, setDaysComplete] = useState(0)
  const [totalDays, setTotalDays] = useState(0)
  const [members, setMembers] = useState<Member[]>([])
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>([])
  const [isFavorite, setIsFavorite] = useState(false)
  const [progressAnim] = useState(new Animated.Value(0))
  // type Obligation = {
  //   id:number; challenge:number; payer:any; payee:any; currency:string; amount:string; remaining:string; status:string;
  //   reward_type?:string; reward_note?:string;
  // };
  // const [toPay, setToPay] = useState<Obligation[]>([]);
  // const [toReceive, setToReceive] = useState<Obligation[]>([]);
  // const [canEditReward,setCanEditReward]=useState<boolean>(false);
  
  // leaderboard setup
  type LeaderRow = { name: string; points: number; rank: number }
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([])
  const [lbLoading, setLbLoading] = useState(false)
  const [lbError, setLbError] = useState<string | null>(null)
  const [lbSince, setLbSince] = useState<string | null>(null)
  const [lbUntil, setLbUntil] = useState<string | null>(null)

  // personal challenge history
  type Performance = { date: string; game: string; score: number };
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfError, setPerfError] = useState<string | null>(null);


  // reward editor
  const [reward, setReward] = useState<any|null>(null);   // fetched reward_setting
  const [rewardType, setRewardType] = useState<'money'|'points'|'custom'>('money');
  const [rewardAmount, setRewardAmount] = useState('');
  const [rewardNote, setRewardNote] = useState('');

  const getDayLabel = (day: number): string => {
    return DayOfWeekLabels[day as DayOfWeek] || ""
  }

  const getDayFullName = (day: number): string => {
    const fullNames: Record<number, string> = {
      1: "Monday",
      2: "Tuesday",
      3: "Wednesday",
      4: "Thursday",
      5: "Friday",
      6: "Saturday",
      7: "Sunday",
    }
    return fullNames[day] || ""
  }

  useEffect(() => {
    const fetchChallengeDetails = async () => {
      try {
              const accessToken = await getAccessToken();
              if (!accessToken) {
                throw new Error("Not authenticated");
              }
        const res = await axios.get(endpoints.challengeDetail(challId), {
                headers: {
                  Authorization: `Bearer ${accessToken}`
                }
              });

        const data = res.data

        const parsedDaysOfWeek = (data.daysOfWeek as string[])
          .filter((day): day is keyof typeof DayOfWeekReverseLabels => day in DayOfWeekReverseLabels)
          .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
          .map((day) => DayOfWeekReverseLabels[day])

        setDaysOfWeek(parsedDaysOfWeek.map(String))

        setDaysComplete(data.daysCompleted)
        setTotalDays(data.totalDays ?? 30)
        console.log('total days??', data.totalDays)
        setMembers(data.members);
        // setCanEditReward(!!data.initiator_id);
        // setReward(data.reward_setting);
        // console.log('reward setting??',!!data.reward_setting)
      } catch (err) {
        console.error(err)
      }
    }

    fetchChallengeDetails()
  }, [])

  // AI generated
//   ---------- Leaderboard fetch ----------
    const loadLeaderboard = async () => {
      try {
        setLbLoading(true);
        setLbError(null);

        const accessToken = await getAccessToken();
        if (!accessToken) {
          throw new Error("Not authenticated");
        }

          const res = await fetch(`${endpoints.leaderboard(challId)}?t=${Date.now()}`, {
                  headers: {
                    Authorization: `Bearer ${accessToken}`
                  }
                });


          const text = await res.text();
          const d: any = text ? JSON.parse(text) : null;

          const rows = Array.isArray(d) ? d : d?.leaderboard ?? [];
          setLeaderboard(rows);
          setLbSince(d?.since ?? null);
          setLbUntil(d?.until ?? null);

          if (rows.length === 0) {
            setTimeout(async () => {
              try {
                const res2 = await fetch(`${endpoints.leaderboard(challId)}?t=${Date.now()}`, {
                  headers: {
                    Authorization: `Bearer ${accessToken}`
                  }
                });
                const txt2 = await res2.text();
                const d2: any = txt2 ? JSON.parse(txt2) : null;
                setLeaderboard(Array.isArray(d2) ? d2 : d2?.leaderboard ?? []);
                setLbSince(d2?.since ?? null);
                setLbUntil(d2?.until ?? null);
              } catch {}
            }, 500);
          }

      } catch (err) {
        console.error(err);
        setLbError('Failed to load leaderboard');
      } finally {
        setLbLoading(false);
      }
    };



const loadPerformances = async () => {
  try {
    setPerfLoading(true);
    setPerfError(null);

    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error("Not authenticated");

    const res = await fetch(endpoints.getPerformances(challId), {
                headers: {
                  Authorization: `Bearer ${accessToken}`
                }
              });

    if (!res.ok) throw new Error(`Failed to load performances (${res.status})`);

    const data = await res.json();
    console.log(data)

    // Expect backend to return an array of objects like:
    // [{ date: "2025-10-10", game: "Memory Match", score: 87 }, ...]
    // Sort by date descending and keep last 5
    // const recent = Array.isArray(data) ? data : [];

    // setPerformances(recent);
    const formatted = data.map((p: any) => ({
      date: p.date,
      game: p.game_name,  // rename here
      score: p.score,
    }));
    setPerformances(formatted);

  } catch (err: any) {
    console.error(err);
    setPerfError(err.message || "Failed to load performances");
  } finally {
    setPerfLoading(false);
  }
};



    // run every time the screen gains focus
    useFocusEffect(
      useCallback(() => {
        // Immediately refetch challenge details on focus
        (async () => {
          try {
                  const accessToken = await getAccessToken();
                  if (!accessToken) {
                    throw new Error("Not authenticated");
                  }
            const res = await axios.get(endpoints.challengeDetail(challId), {
                    headers: {
                      Authorization: `Bearer ${accessToken}`
                    }
                  });
            const data = res.data;
            const parsedDaysOfWeek = (data.daysOfWeek as string[])
              .filter((day): day is keyof typeof DayOfWeekReverseLabels => day in DayOfWeekReverseLabels)
              .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
              .map((day) => DayOfWeekReverseLabels[day]);
            setDaysOfWeek(parsedDaysOfWeek.map(String));
            setDaysComplete(data.daysCompleted);
            setTotalDays(data.totalDays ?? 30);
            setMembers(data.members);
          } catch (err) {
            console.error(err);
          }
        })();

        if (whichChall === "Personal") {
          loadPerformances();
        } else {
          loadLeaderboard();
        }
        return () => {};
      }, [challId, whichChall])
    );

    async function loadMyObligations() {

      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const res = await fetch(endpoints.myObligations(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error('Failed to load obligations');
      }

      return data;
    }

    // useEffect(() => {
    //   (async () => {
    //     try {
    //       const obligations = await loadMyObligations();
    //       setToPay(obligations.to_pay);
    //       setToReceive(obligations.to_receive);
    //     } catch (err:any) {
    //       Alert.alert('Error: ', err.message);
    //     }
    //   })();
    // }, []);

  //   const showRewardInfo = () => {
  //   Alert.alert('Rewards', 'Choose the reward the winner will get. \n\nMoney: Send a USD amount. \nPoints: In-app points. \nCustom: Any creative prize. \n\nAfter saving, rewards are locked.');
  // };

  // const finalizeChallenge = async (challId: number) => {
  //     try {

  //     const accessToken = await getAccessToken();
  //     if (!accessToken) {
  //       throw new Error("Not authenticated");
  //     }

  //       const res = await fetch(`${BASE_URL}/api/challenges/${challId}/finalize/`, {
  //         method: 'POST',
  //         headers: {
  //           'Content-Type': 'application/json',
  //           "Authorization": `Bearer ${accessToken}`,
  //         },
  //       });

  //       if (!res.ok) {
  //         const err = await res.json().catch(() => ({}));
  //         throw new Error(err?.detail || err?.message || `Finalize failed (${res.status})`);
  //       }

  //       // await loadMyObligations();
  //       // navigation.navigate("Rewards", { challengeId: challId });

  //       //Alert.alert('Finalized', 'Obligations created. You can settle up now.');
  //     } catch (e: any) {
  //       Alert.alert('Finalize failed', e.message);
  //     }
  //   };

  useEffect(() => {
    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: daysComplete / totalDays,
      duration: 1000,
      useNativeDriver: false,
    }).start()
  }, [daysComplete, totalDays])

  const goToMessages = () => navigation.navigate("Messages")
  const goToGroups = () => navigation.navigate("Groups")
  const goToProfile = () => navigation.navigate("Profile")

  const toggleFavorite = () => {
    setIsFavorite(!isFavorite)
  }

  const getRankEmoji = (rank: number): string => {
    if (rank === 1) return "👑"
    if (rank === 2) return "🥈"
    if (rank === 3) return "🥉"
    return `${rank}.`
  }

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  })

  /* ---------- leaderboard compact view (AI generated)---------- */
  const buildDisplayRows = (): Array<LeaderRow | { ellipsis: true }> => {
    // nothing to show
    if (leaderboard.length === 0) return []

    const top3 = leaderboard.slice(0, 3)
    const me = leaderboard.find((r) => r.name === myName)

    // if I'm in top-3 just return the slice
    if (!me || me.rank <= 3) return top3

    // else: top-3 + ellipsis + me
    return [...top3, { ellipsis: true }, me]
  }
  const displayRows = buildDisplayRows()

  return (
    <ImageBackground source={require("../../images/cgpt.png")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{challName}</Text>
          <TouchableOpacity style={styles.favoriteButton} onPress={toggleFavorite}>
            <Ionicons name={isFavorite ? "star" : "star-outline"} size={24} color="#FFD700" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Members Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Enrolled Members</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.membersScroll}>
              {members.map((member, index) => {
                const initials = getInitials(member.name)
                const backgroundColor = generatePastelColor(member.name)

                return (
                  <View key={index} style={styles.memberCard}>
                    <View style={[styles.memberAvatar, { backgroundColor }]}>
                      <Text style={styles.memberInitials}>{initials}</Text>
                    </View>
                    <Text style={styles.memberName}>{member.name}</Text>
                  </View>
                )
              })}
            </ScrollView>
          </View>

          {/* Challenge Days Section */}
          <View style={styles.challengeCard}>
            <View style={styles.daysContainer}>
              {daysOfWeek.map((day, idx) => (
                <View key={idx} style={styles.dayBadge}>
                  <Text style={styles.dayText}>{getDayLabel(Number(day))}</Text>
                  <Text style={styles.daySubtext}>{getDayFullName(Number(day)).substring(0, 3)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.progressContainer}>
              <View style={styles.progressTextContainer}>
                <Text style={styles.progressLabel}>Progress</Text>
                <Text style={styles.progressText}>
                  {daysComplete}/{totalDays} Days Complete
                </Text>
              </View>

              <View style={styles.progressBarContainer}>
                <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
              </View>

              <TouchableOpacity
                style={styles.scheduleButton}
                onPress={() => navigation.navigate("ChallSchedule", { challId, challName, whichChall })}
              >
                <LinearGradient
                  colors={["#FFD700", "#FFA500"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.scheduleButtonGradient}
                >
                  <Ionicons name="calendar-outline" size={18} color="#FFF" style={styles.scheduleIcon} />
                  <Text style={styles.scheduleButtonText}>View Schedule</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

{/* Leaderboard or Performance Section */}
{(whichChall === "Group" || whichChall === "Public") && (
  <View style={styles.leaderboardCard}>
    <View style={styles.leaderboardHeader}>
      <Ionicons name="trophy" size={24} color="#FFD700" style={styles.trophyIcon} />
      <Text style={styles.leaderboardTitle}>RANKING</Text>
    </View>

    {lbSince && lbUntil && (
      <Text style={{ color: "rgba(255,255,255,0.7)", textAlign: "center", marginBottom: 8, fontSize: 12 }}>
        Window: {lbSince} – {lbUntil}
      </Text>
    )}

    {lbLoading && <Text style={{ color: "#FFF", textAlign: "center" }}>Loading…</Text>}
    {lbError && <Text style={{ color: "#F88", textAlign: "center" }}>{lbError}</Text>}

    {!lbLoading && !lbError && displayRows.length === 0 && (
      <Text style={{ color: "rgba(255,255,255,0.8)", textAlign: "center" }}>No scores yet — be the first!</Text>
    )}

    {!lbLoading &&
      !lbError &&
      displayRows.map((row, index) => {
        if ("ellipsis" in row) {
          return (
            <View key={`ellipsis-${index}`} style={styles.rankItem}>
              <Text style={styles.ellipsisText}>…</Text>
            </View>
          );
        }

        return (
          <View key={`${row.name}-${index}`} style={styles.rankItem}>
            <View style={styles.rankPosition}>
              <Text style={styles.rankEmoji}>{getRankEmoji(row.rank)}</Text>
            </View>
            <Text style={[styles.rankName, row.name === myName && { color: "#FFD700" }]}>
              {row.name === myName ? "You" : row.name}
            </Text>
            <Text style={styles.rankPoints}>{row.points} pts</Text>
          </View>
        );
      })}

    <TouchableOpacity
      style={styles.viewDetailsButton}
      onPress={() =>
        navigation.navigate("LeaderboardDetails", {
          challId,
          myName,
        })
      }
    >
      <LinearGradient
        colors={["#FFD700", "#FFA500"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.viewDetailsGradient}
      >
        <Text style={styles.viewDetailsText}>View leaderboard details</Text>
      </LinearGradient>
    </TouchableOpacity>
  </View>
)}

{whichChall === "Personal" && (
  <View style={styles.leaderboardCard}>
    <View style={styles.leaderboardHeader}>
      <Ionicons name="time-outline" size={24} color="#FFD700" style={styles.trophyIcon} />
      <Text style={styles.leaderboardTitle}>Recent Performances</Text>
    </View>

    {perfLoading && <Text style={{ color: "#FFF", textAlign: "center" }}>Loading…</Text>}
    {perfError && <Text style={{ color: "#F88", textAlign: "center" }}>{perfError}</Text>}

    {!perfLoading && !perfError && performances.length === 0 && (
      <Text style={{ color: "rgba(255,255,255,0.8)", textAlign: "center" }}>No games played yet.</Text>
    )}

    {!perfLoading &&
      !perfError &&
    performances.map((p, index) => (
      <View key={index} style={styles.performanceRow}>
        <Text style={styles.performanceDate}>{p.date}</Text>
        <Text
          style={styles.performanceGame}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {p.game}
        </Text>
        <Text style={styles.performanceScore}>{p.score}</Text>
      </View>
      ))}
  </View>
)}



    <TouchableOpacity
      style={styles.viewDetailsButton}
      onPress={() =>
        navigation.navigate("Bets", {
          challId,
          challName,
          challengeMembers: members,
        })
      }
    >
      <LinearGradient
        colors={["#FFD700", "#FFA500"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.viewDetailsGradient}
      >
        <Text style={styles.viewDetailsText}>Challenge bets</Text>
      </LinearGradient>
    </TouchableOpacity>


          {/* Challenge Stats */}
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Challenge Stats</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Ionicons name="time-outline" size={24} color="#FFD700" />
                <Text style={styles.statValue}>{totalDays}</Text>
                <Text style={styles.statLabel}>Days</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="people-outline" size={24} color="#FFD700" />
                <Text style={styles.statValue}>{members.length}</Text>
                <Text style={styles.statLabel}>Members</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="calendar-outline" size={24} color="#FFD700" />
                <Text style={styles.statValue}>{daysOfWeek.length}</Text>
                <Text style={styles.statLabel}>Days/Week</Text>
              </View>
            </View>
          </View>

        {/* <TouchableOpacity
          style={[styles.scheduleButton, { marginTop: 14 }]}
          onPress={() => navigation.navigate("Rewards", { challengeId: challId })}>
          <LinearGradient
            colors={["#00C853", "#64DD17"]}
            style={styles.scheduleButtonGradient}>
            <Ionicons name="wallet" size={18} color="#FFF" style={styles.scheduleIcon} />
            <Text style={styles.scheduleButtonText}>Settle Up</Text>
          </LinearGradient>
        </TouchableOpacity> */}

        {/* <TouchableOpacity
          style={[styles.scheduleButton, { marginTop: 14 }]}
          onPress={() => finalizeChallenge(challId)}>
          <LinearGradient
            colors={["#00C853", "#64DD17"]}
            style={styles.scheduleButtonGradient}>
            <Ionicons name="wallet" size={18} color="#FFF" style={styles.scheduleIcon} />
            <Text style={styles.scheduleButtonText}>Finalize Challenge</Text>
          </LinearGradient>
        </TouchableOpacity> */}

          {/* Bottom Spacing */}
          <View style={styles.bottomSpacing} />
        </ScrollView>
      </View>

      {/* Navigation Bar */}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFF",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    flex: 1,
    textAlign: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  favoriteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFF",
    marginBottom: 15,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
  memberAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
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
  challengeCard: {
    backgroundColor: "rgba(50, 50, 60, 0.3)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  daysContainer: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  dayBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
    margin: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  dayText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 18,
  },
  daySubtext: {
    color: "#000",
    fontSize: 10,
    fontWeight: "500",
    opacity: 0.7,
  },
  progressContainer: {
    alignItems: "center",
  },
  progressTextContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 10,
  },
  progressLabel: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  progressText: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "700",
  },
  progressBarContainer: {
    height: 10,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 5,
    width: "100%",
    marginBottom: 20,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#FFD700",
    borderRadius: 5,
  },
  scheduleButton: {
    width: "100%",
    height: 45,
    borderRadius: 22.5,
    overflow: "hidden",
  },
  scheduleButtonGradient: {
    width: "100%",
    height: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  scheduleIcon: {
    marginRight: 8,
  },
  scheduleButtonText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 16,
  },
  leaderboardCard: {
    backgroundColor: "rgba(50, 50, 60, 0.3)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  leaderboardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  trophyIcon: {
    marginRight: 10,
  },
  leaderboardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFD700",
    textAlign: "center",
  },
  rankItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  rankPosition: {
    width: 40,
    alignItems: "center",
  },
  rankEmoji: {
    fontSize: 20,
    color: "#FFD700",
  },
  rankName: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#FFF",
    marginLeft: 10,
  },
  rankPoints: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFD700",
  },
  viewDetailsButton: {
    height: 45,
    borderRadius: 22.5,
    overflow: "hidden",
    marginTop: 20,
  },
  viewDetailsGradient: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  viewDetailsText: {
    color: "#333",
    fontWeight: "700",
    fontSize: 16,
  },
  statsCard: {
    backgroundColor: "rgba(50, 50, 60, 0.3)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFF",
    marginBottom: 15,
    textAlign: "center",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFF",
    marginVertical: 5,
  },
  statLabel: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
  },
  bottomSpacing: {
    height: 100,
  },
  navBar: {
    backgroundColor: "rgba(33, 31, 38, 0.95)",
    flexDirection: "row",
    height: 80,
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 15,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
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
  ellipsisText: {
    color: "#888",
    fontSize: 18,
    textAlign: "center",
    width: "100%",
  },
    performanceRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  performanceDate: {
    color: "#FFD700",
    fontWeight: "600",
    width: 90, // fixed width for alignment
  },
  performanceGame: {
    flex: 1, // allows flexible width
    color: "#FFF",
    fontSize: 15,
    marginHorizontal: 8,
  },
  performanceScore: {
    color: "#00FFAA",
    fontWeight: "bold",
    width: 50, // fixed width for alignment
    textAlign: "right",
  },
})

export default ChallDetails