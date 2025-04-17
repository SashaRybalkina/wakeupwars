import type React from "react"
import { useState, useEffect } from "react"
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { type NavigationProp, useRoute } from "@react-navigation/native"
import axios from "axios"
import { endpoints } from "../../api"

type Props = {
  navigation: NavigationProp<any>
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
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>([]) // optional

  const getDayLabel = (dayOfWeek: number): string => {
    const labels = ["M", "T", "W", "TH", "F", "S", "SU"]
    return labels[dayOfWeek] || "" // 1 = Monday, 7 = Sunday
  }

  useEffect(() => {
    const fetchChallengeDetails = async () => {
      try {
        const res = await axios.get(endpoints.challengeDetail(challId))
        const data = res.data
        setDaysComplete(data.daysCompleted)
        setTotalDays(data.totalDays)
        setMembers(data.members)
        setDaysOfWeek(data.daysOfWeek) // optional
      } catch (err) {
        console.error(err)
      }
    }

    fetchChallengeDetails()
  }, [])

  const leaderboard = [
    { name: "Pers1", points: 928, emoji: "👑" },
    { name: "Pers2", points: 800, emoji: "🥈" },
    { name: "Pers3", points: 700, emoji: "🥉" },
    { name: "Pers4", points: 0, emoji: "50." },
  ]

  const goToMessages = () => navigation.navigate("Messages")
  const goToGroups = () => navigation.navigate("Groups")
  const goToProfile = () => navigation.navigate("Profile")

  // Calculate progress percentage
  const progressPercentage = (daysComplete / totalDays) * 100

  return (
    <ImageBackground source={require("../../images/cgpt.png")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.headerSection}>
          <Text style={styles.title}>{challName}</Text>
          <TouchableOpacity style={styles.favoriteButton}>
            <Ionicons name="star" size={32} color="#FFD700" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.membersSection}>
            <Text style={styles.sectionTitle}>Enrolled Members:</Text>
            <View style={styles.membersContainer}>
              {members.map((m, index) => (
                <View key={index} style={styles.memberBadge}>
                  <Text style={styles.memberName}>{m.name}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.daysSection}>
            <View style={styles.daysRow}>
              {daysOfWeek.map((day, idx) => (
                <View key={idx} style={styles.dayBadge}>
                  <Text style={styles.dayText}>{day}</Text>
                </View>
              ))}
            </View>

            <View style={styles.progressSection}>
              <Text style={styles.progressText}>
                {daysComplete}/{totalDays} Days Complete
              </Text>

              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: `${progressPercentage}%` }]} />
              </View>

              <TouchableOpacity
                style={styles.scheduleButton}
                onPress={() => navigation.navigate("ChallSchedule", { challId, challName, whichChall })}
              >
                <Text style={styles.scheduleButtonText}>View Schedule</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.leaderboardSection}>
            <Text style={styles.leaderboardTitle}>RANKING</Text>

            {leaderboard.map((person, index) => (
              <View key={index} style={styles.rankItem}>
                <Text style={styles.rankPosition}>{person.emoji}</Text>
                <Text style={styles.rankName}>{person.name}</Text>
                <Text style={styles.rankPoints}>{person.points} pts</Text>
              </View>
            ))}

            <TouchableOpacity style={styles.leaderboardButton}>
              <Text style={styles.leaderboardButtonText}>View leader board details</Text>
            </TouchableOpacity>
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
  headerSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFF",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    flex: 1,
  },
  favoriteButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
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
  membersSection: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  membersContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  memberBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  memberName: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 16,
  },
  daysSection: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 25,
  },
  daysRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 15,
  },
  dayBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  dayText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 16,
  },
  progressSection: {
    alignItems: "center",
  },
  progressText: {
    color: "#FFD700",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  progressBarContainer: {
    height: 10,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 5,
    width: "100%",
    marginBottom: 15,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#FFD700",
    borderRadius: 5,
  },
  scheduleButton: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  scheduleButtonText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 16,
  },
  leaderboardSection: {
    backgroundColor: "rgba(50, 50, 60, 0.7)",
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
  },
  leaderboardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFD700",
    marginBottom: 15,
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
    fontSize: 18,
    fontWeight: "700",
    color: "#FFD700",
  },
  rankName: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#FFF",
  },
  rankPoints: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFD700",
  },
  leaderboardButton: {
    backgroundColor: "#FFD700",
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  leaderboardButtonText: {
    color: "#333",
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
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

export default ChallDetails