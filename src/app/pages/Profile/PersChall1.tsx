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
import NavBar from "../Components/NavBar"
import { LinearGradient } from "expo-linear-gradient"

type Props = {
  navigation: NavigationProp<any>
}


type Challenge = {
  id: number
  name: string
  startDate: string
  endDate: string
  daysOfWeek: string[]
  daysCompleted: number
  totalDays: number
  isCompleted: boolean
  isGroupChallenge: boolean
}


const PersChall1: React.FC<Props> = ({ navigation }) => {
  const { user, logout } = useUser()
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [pendingChallenges, setPendingChallenges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // --- reusable fetch function ---
  const fetchChallenges = async () => {
    try {
      setLoading(true)

      // fetch all personal challenges
      const accessToken = await getAccessToken();
      if (!accessToken) {
                  Alert.alert(
                    "Session expired",
                    "Your login session has expired. Please log in again.",
                    [
                      {
                        text: "OK",
                        onPress: async () => {
                          await logout();
                          navigation.reset({
                            index: 0,
                            routes: [{ name: "Login" }],
                          });
                        },
                      },
                    ],
                    { cancelable: false }
                  );

                  return;
      }
    
          const response = await fetch(endpoints.getPersonalChallenges(Number(user?.id)), {
                headers: {
                  Authorization: `Bearer ${accessToken}`
                }
              });
          const data = await response.json();

          const formattedData = data.map(
            (item: Challenge) => ({
                id: item.id,
                name: item.name,
                startDate: item.startDate,
                endDate: item.endDate,
                daysOfWeek: item.daysOfWeek,
                daysCompleted: item.daysCompleted,
                totalDays: item.totalDays,
                isCompleted: item.isCompleted,
                isGroupChallenge: item.isGroupChallenge,
            })
          );
          setChallenges(formattedData);
          
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
                  Alert.alert(
                    "Session expired",
                    "Your login session has expired. Please log in again.",
                    [
                      {
                        text: "OK",
                        onPress: async () => {
                          await logout();
                          navigation.reset({
                            index: 0,
                            routes: [{ name: "Login" }],
                          });
                        },
                      },
                    ],
                    { cancelable: false }
                  );

                  return;
      }

      // await scheduleAlarmsForUser(challId, challName, Number(user?.id));

      const res = await fetch(endpoints.acceptPersonalChallenge(Number(user!.id), challId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${accessToken}`,
        },
      });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to accept challenge");
            }

            const data = await res.json();
            console.log('Challenge accepted:', data);

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
                  Alert.alert(
                    "Session expired",
                    "Your login session has expired. Please log in again.",
                    [
                      {
                        text: "OK",
                        onPress: async () => {
                          await logout();
                          navigation.reset({
                            index: 0,
                            routes: [{ name: "Login" }],
                          });
                        },
                      },
                    ],
                    { cancelable: false }
                  );

                  return;
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

        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
            
          {/* -------- PENDING -------- */}
          {!loading && pendingChallenges.length > 0 && (
            <View style={styles.challengesSection}>
              <Text style={styles.sectionTitle}>Pending Challenges</Text>
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
            </View>
          )}

          {/* -------- CURRENT -------- */}
          <View style={[styles.challengesSection, styles.currentSection]}>
            <Text style={styles.sectionTitle}>Current Challenges</Text>
            {loading ? (
              <View style={styles.emptyStateContainer}>
                <ActivityIndicator size="small" color="#FFD700" />
                <Text style={styles.emptyStateText}>Loading...</Text>
              </View>
            ) : currentChallenges.length === 0 ? (
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
                        totalDays={c.totalDays === null ? 30 : c.totalDays}
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

          <TouchableOpacity
            style={styles.pastButtonContainer}
            onPress={() => navigation.navigate("PastChallenges", { type: "Personal" })}
          >
              <LinearGradient
                colors={["#FFD700", "#fdb021ff"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.pastButtonGradient}
              >
              <View style={styles.pastButtonRow}>
                <Ionicons name="time-outline" size={18} color="#333" style={{ marginRight: 8 }} />
                <Text style={styles.pastButtonText}>View past challenges</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </ImageBackground>

      {/* NAV BAR */}
      <NavBar
        goToPublicChallenges={() => navigation.navigate("PublicChallenges")}
        goToChallenges={() => navigation.navigate("Challenges")}
        goToGroups={() => navigation.navigate("Groups")}
        goToMessages={() => navigation.navigate("Messages")}
        goToProfile={() => navigation.navigate("Profile")}
        active="Profile"
      />
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
  title: { color: "#FFF", fontSize: 38, fontWeight: "800", textShadowColor: "rgba(0, 0, 0, 0.2)", textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 3 },
  titleSecondary: { color: "#FFF", fontSize: 38, fontWeight: "800", marginTop: -5, textShadowColor: "rgba(0, 0, 0, 0.2)", textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 3 },
  decorativeLine: { width: 60, height: 4, backgroundColor: "#FFD700", borderRadius: 2, marginTop: 10, marginBottom: 10 },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingBottom: 30 },
  challengesSection: { marginBottom: 25, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 24, fontWeight: "700", color: "#ffffffff", marginTop: 10, marginBottom: 15 },
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
  pastButtonContainer: {
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 5,
    width: "90%",
  },
  pastButtonGradient: {
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 22,
    minWidth: 220,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.35)",
  },
  pastButtonText: {
    color: "#353535ff",
    fontSize: 16,
    fontWeight: "700",
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  pastButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  inlineLoadingRow: { flexDirection: "row", alignItems: "center", marginTop: 4, marginBottom: 8 },
  inlineLoadingText: { color: "#FFF", fontSize: 14, fontWeight: "600", marginLeft: 8 },
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
