import type React from "react"
import { useState, useEffect } from "react"
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  Animated,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { type NavigationProp, useRoute } from "@react-navigation/native"
import axios from "axios"
import { endpoints } from "../../api"
import { LinearGradient } from "expo-linear-gradient"

type Props = {
  navigation: NavigationProp<any>
}

const { width } = Dimensions.get("window")
const cardWidth = Math.min(width * 0.9, 400)

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

  const [daysComplete, setDaysComplete] = useState(0)
  const [totalDays, setTotalDays] = useState(0)
  const [members, setMembers] = useState<{ name: string }[]>([])
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>([])
  const [isFavorite, setIsFavorite] = useState(false)
  const [progressAnim] = useState(new Animated.Value(0))

  const getDayLabel = (day: string): string => {
    return day.charAt(0).toUpperCase()
  }

  const getDayFullName = (day: string): string => {
    const days: Record<string, string> = {
      M: "Monday",
      T: "Tuesday",
      W: "Wednesday",
      TH: "Thursday",
      F: "Friday",
      S: "Saturday",
      SU: "Sunday",
    }
    return days[day] || day
  }

  useEffect(() => {
    const fetchChallengeDetails = async () => {
      try {
        const res = await axios.get(endpoints.challengeDetail(challId))
        const data = res.data
        setDaysComplete(data.daysCompleted)
        setTotalDays(data.totalDays)
        setMembers(data.members)
        setDaysOfWeek(data.daysOfWeek)
      } catch (err) {
        console.error(err)
      }
    }

    fetchChallengeDetails()
  }, [])

  useEffect(() => {
    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: daysComplete / totalDays,
      duration: 1000,
      useNativeDriver: false,
    }).start()
  }, [daysComplete, totalDays])

  const leaderboard = [
    { name: "Pers1", points: 928, rank: 1 },
    { name: "Pers2", points: 800, rank: 2 },
    { name: "Pers3", points: 700, rank: 3 },
    { name: "Pers4", points: 0, rank: 50 },
  ]

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
                  <Text style={styles.dayText}>{getDayLabel(day)}</Text>
                  <Text style={styles.daySubtext}>{getDayFullName(day).substring(0, 3)}</Text>
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

          {/* Leaderboard Section */}
          <View style={styles.leaderboardCard}>
            <View style={styles.leaderboardHeader}>
              <Ionicons name="trophy" size={24} color="#FFD700" style={styles.trophyIcon} />
              <Text style={styles.leaderboardTitle}>RANKING</Text>
            </View>

            {leaderboard.map((person, index) => (
              <View key={index} style={styles.rankItem}>
                <View style={styles.rankPosition}>
                  <Text style={styles.rankEmoji}>{getRankEmoji(person.rank)}</Text>
                </View>
                <Text style={styles.rankName}>{person.name}</Text>
                <Text style={styles.rankPoints}>{person.points} pts</Text>
              </View>
            ))}

            <TouchableOpacity style={styles.viewDetailsButton}>
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
    elevation: 3,
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
    backgroundColor: "rgba(50, 50, 60, 0.8)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
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
})

export default ChallDetails
