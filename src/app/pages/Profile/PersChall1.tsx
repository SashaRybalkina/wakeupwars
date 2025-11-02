import type React from "react"
import { useState, useEffect, useCallback } from "react"
import {
  ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity,
  View, StatusBar, Alert, ActivityIndicator
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useFocusEffect, type NavigationProp } from "@react-navigation/native"
import { useUser } from "../../context/UserContext"
import axios from "axios"
import { endpoints } from "../../api"
import ChallengeCard from "../Challenges/ChallengeCard"
import PendingChallengeActionCard from "../Challenges/PersonalPendingChallengeCard"
import { getAccessToken } from "../../auth"
import { scheduleAlarmsForUser } from "../../alarmService"

type Props = {
  navigation: NavigationProp<any>
}

const PersChall1: React.FC<Props> = ({ navigation }) => {
  const { user } = useUser()
  const [challenges, setChallenges] = useState<any[]>([])
  const [pendingChallenges, setPendingChallenges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // --- reusable fetch function ---
  const fetchChallenges = async () => {
    try {
      setLoading(true)

      // fetch all personal challenges
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const response = await axios.get(endpoints.challengeList(Number(user!.id), "Personal"), {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      // attach alarm schedule for each challenge
      const challengesWithAlarms = await Promise.all(
        response.data.map(async (c: any) => {
          try {
            const scheduleRes = await axios.get(endpoints.challengeSchedule(c.id), {
              headers: {
                "Authorization": `Bearer ${accessToken}`,
              },
            });
            const alarmSchedule = scheduleRes.data.map((day: any) => ({
              dayOfWeek: day.dayOfWeek,
              alarmTime: day.alarmTime,
              userName: "",
            }))
            return {
              id: c.id,
              name: c.name,
              daysCompleted: c.daysCompleted || 0,
              startDate: c.startDate,
              endDate: c.endDate || null,
              totalDays: c.totalDays,
              daysOfWeek: c.daysOfWeek ?? [],
              alarmSchedule,
              isCompleted: c.isCompleted,
            }
          } catch {
            return {
              id: c.id,
              name: c.name,
              daysCompleted: c.daysCompleted || 0,
              startDate: c.startDate,
              endDate: c.endDate || null,
              totalDays: c.totalDays ?? 30, // TODO: fix this
              daysOfWeek: c.daysOfWeek ?? [],
              alarmSchedule: [],
              isCompleted: c.isCompleted,
            }
          }
        })
      )
      setChallenges(challengesWithAlarms)

      // fetch pending invites
      const pendingRes = await axios.get(endpoints.getPersonalChallengeInvites(Number(user!.id)), {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });
      setPendingChallenges(pendingRes.data || [])
    } catch (error) {
      console.error("Failed to fetch challenges:", error)
    } finally {
      setLoading(false)
    }
  }


  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchChallenges()
      }
    }, [user])
  )

  // --- accept challenge ---
  const handleAccept = async (challId: number, challName: string) => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      //await scheduleAlarmsForUser(challId, challName, Number(user?.id));

      const res = await fetch(endpoints.acceptPersonalChallenge(Number(user!.id), challId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      Alert.alert("Challenge Accepted", `You accepted challenge ${challId}`)

      // refresh after accepting
      await fetchChallenges()
    } catch (err) {
      console.error("Failed to accept challenge:", err)
      Alert.alert("Error", "Failed to accept challenge.")
    }
  }

  // --- decline challenge ---
  const handleDecline = async (challId: number) => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const res = await fetch(endpoints.declinePersonalChallenge(Number(user!.id), challId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      Alert.alert("Challenge Declined", `You declined challenge ${challId}`)

      // refresh after declining
      await fetchChallenges()
    } catch (err) {
      console.error("Failed to decline challenge:", err)
      Alert.alert("Error", "Failed to decline challenge.")
    }
  }

  // navigation shortcuts
  const goToChallenges = () => navigation.navigate("Challenges")
  const goToGroups = () => navigation.navigate("Groups")
  const goToMessages = () => navigation.navigate("Messages")
  const goToProfile = () => navigation.navigate("Profile")

  // separate current and past challenges
  const currentChallenges = challenges.filter(c => !c.isCompleted)
  const pastChallenges = challenges.filter(c => c.isCompleted)

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ImageBackground
        source={require("../../images/cgpt.png")}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>My Personal</Text>
            <Text style={styles.titleSecondary}>Challenges</Text>
            <View style={styles.decorativeLine} />
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFD700" />
            <Text style={styles.loadingText}>Loading challenges...</Text>
          </View>
        ) : (
          <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
            
            {/* -------- PENDING -------- */}
            <View style={styles.challengesSection}>
              <Text style={styles.sectionTitle}>Pending Challenges</Text>
              {pendingChallenges.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Ionicons name="flag-outline" size={40} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.emptyStateText}>No pending challenges</Text>
                </View>
              ) : (
                <View style={styles.challengeCardsContainer}>
                  {pendingChallenges.map((c) => (
                    <PendingChallengeActionCard
                      key={c.id}
                      title={c.name}
                      icon={require("../../images/school.png")}
                      onAccept={() => handleAccept(c.id, c.name)}
                      onDecline={() => handleDecline(c.id)}
                      onPress={() =>
                        navigation.navigate("ChallSchedule", {
                          challId: c.id,
                          challName: c.name,
                          fromInvite: true,  
                        })
                      }
                    />
                  ))}
                </View>
              )}
            </View>

            {/* -------- CURRENT -------- */}
            <View style={[styles.challengesSection, styles.currentSection]}>
              <Text style={styles.sectionTitle}>Current Challenges</Text>
              {currentChallenges.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Ionicons name="flag-outline" size={40} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.emptyStateText}>No active challenges</Text>
                </View>
              ) : (
                <View style={styles.challengeCardsContainer}>
                  {currentChallenges.map((c) => (
                    <View key={c.id} style={styles.challengeRow}>
                      <TouchableOpacity
                        style={styles.challengeCardWrapper}
                        onPress={() =>
                          navigation.navigate("ChallDetails", {
                            challId: c.id,
                            challName: c.name,
                            whichChall: "Personal",
                          })
                        }
                      >
                        <ChallengeCard
                          title={c.name}
                          icon={require("../../images/school.png")}
                          startDate={c.startDate}
                          endDate={c.endDate}
                          daysCompleted={c.daysCompleted}
                          totalDays={c.totalDays === null ? "?" : c.totalDays}
                          daysOfWeek={c.daysOfWeek}
                          isCompleted={c.isCompleted}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.shareButton}
                        onPress={() =>
                          navigation.navigate("EditChallengeSharingFriends", {
                            challId: c.id,
                            challName: c.name,
                          })
                        }
                      >
                        <Ionicons name="share-outline" size={20} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <TouchableOpacity
                style={styles.addNewButton}
                onPress={() => navigation.navigate("PersChall2Copy")}
              >
                <Text style={styles.addNewButtonText}>Add new +</Text>
              </TouchableOpacity>
            </View>

            {/* -------- PAST -------- */}
            <View style={styles.challengesSection}>
              <Text style={styles.sectionTitle}>Past Challenges</Text>
              {pastChallenges.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Ionicons name="time-outline" size={40} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.emptyStateText}>No past challenges</Text>
                </View>
              ) : (
                <View style={styles.challengeCardsContainer}>
                  {pastChallenges.map((c) => (
                    <View key={c.id} style={styles.challengeRow}>
                    <TouchableOpacity
                      style={styles.challengeCardWrapper}
                      onPress={() =>
                        navigation.navigate("ChallDetails", {
                          challId: c.id,
                          challName: c.name,
                          whichChall: "Personal",
                        })
                      }
                    >
                      <ChallengeCard
                        title={c.name}
                        icon={require("../../images/school.png")}
                        startDate={c.startDate}
                        endDate={c.endDate}
                        daysCompleted={c.daysCompleted}
                        totalDays={c.totalDays === null ? "?" : c.totalDays}
                        daysOfWeek={c.daysOfWeek}
                        isCompleted={c.isCompleted}
                      />
                    </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </ImageBackground>

      {/* NAV BAR */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navButton} onPress={goToChallenges}>
          <Ionicons name="star-outline" size={28} color="#FFF" />
          <Text style={styles.navText}>Challenges</Text>
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
          <Ionicons name="person" size={28} color="#FFD700" />
          <Text style={styles.activeNavText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  background: { flex: 1, paddingTop: 50 },
  headerContainer: { paddingHorizontal: 20, paddingBottom: 20 },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center", alignItems: "center",
    marginBottom: 15,
  },
  titleContainer: { marginTop: 10, paddingLeft: 10 },
  title: { color: "#FFF", fontSize: 38, fontWeight: "800" },
  titleSecondary: { color: "#FFF", fontSize: 38, fontWeight: "800", marginTop: -5 },
  decorativeLine: { width: 60, height: 4, backgroundColor: "#FFD700", borderRadius: 2, marginTop: 10, marginBottom: 10 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#FFF", fontSize: 18, fontWeight: "600" },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  challengesSection: { marginBottom: 25, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 24, fontWeight: "700", color: "#FFF", marginTop: 10, marginBottom: 15 },
  challengeCardsContainer: { width: "100%" },
  challengeCardWrapper: {
    borderRadius: 16, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, flex: 1,
  },
  emptyStateContainer: {
    alignItems: "center", backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 15, padding: 30,
  },
  emptyStateText: { color: "#FFF", fontSize: 18, fontWeight: "600", marginTop: 10 },
  addNewButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20,
    alignSelf: "center", marginTop: 20, marginBottom: 5,
    borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.3)",
  },
  addNewButtonText: { color: "#000", fontSize: 16, fontWeight: "600", textAlign: "center" },
  navBar: {
    backgroundColor: "#211F26", flexDirection: "row", height: 80,
    justifyContent: "space-around", alignItems: "center", paddingBottom: 15,
  },
  navButton: { justifyContent: "center", alignItems: "center", flex: 1 },
  navText: { color: "#999", fontSize: 12, marginTop: 4 },
  activeNavText: { color: "#FFD700", fontSize: 12, marginTop: 4, fontWeight: "600" },
  challengeRow: { position: "relative", marginBottom: 15 },
  shareButton: {
    position: "absolute", width: 36, height: 36, top: 10, right: 15,
    borderRadius: 18, backgroundColor: "rgba(88, 86, 214, 0.6)",
    justifyContent: "center", alignItems: "center", zIndex: 2,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8, shadowRadius: 4,
  },
})

export default PersChall1
