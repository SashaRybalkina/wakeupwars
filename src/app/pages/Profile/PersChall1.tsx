import type React from "react"
import { useState, useEffect } from "react"
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View, StatusBar, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { NavigationProp } from "@react-navigation/native"
import { useUser } from "../../context/UserContext"
import axios from "axios"
import { endpoints } from "../../api"
import ChallengeCard from "../Challenges/ChallengeCard"

type Props = {
  navigation: NavigationProp<any>
}

const PersChall1: React.FC<Props> = ({ navigation }) => {
  const { user } = useUser()
  const [challenges, setChallenges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
  
    const fetchChallenges = async () => {
      try {
        setLoading(true)
        const response = await axios.get(endpoints.challengeList(Number(user.id), "Personal"))
        
        // Fetch alarm schedules for each challenge
        const challengesWithAlarms = await Promise.all(
          response.data.map(async (c: any) => {
            try {
              // Fetch alarm schedule for this challenge
              const scheduleRes = await axios.get(endpoints.challengeSchedule(c.id))
              
              // Extract alarm schedule
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
                totalDays: c.totalDays ?? 30,
                daysOfWeek: c.daysOfWeek ?? [],
                alarmSchedule: alarmSchedule, // Add the alarm schedule
                isCompleted: c.endDate ? new Date(c.endDate) < new Date() : false,
              }
            } catch (error) {
              console.error(`Failed to fetch schedule for challenge ${c.id}:`, error)
              // Return challenge without alarm data if there was an error
              return {
                id: c.id,
                name: c.name,
                daysCompleted: c.daysCompleted || 0,
                startDate: c.startDate,
                endDate: c.endDate || null,
                totalDays: c.totalDays ?? 30,
                daysOfWeek: c.daysOfWeek ?? [],
                alarmSchedule: [], // Empty array if we couldn't fetch alarms
                isCompleted: c.endDate ? new Date(c.endDate) < new Date() : false,
              }
            }
          })
        )
        
        setChallenges(challengesWithAlarms)
      } catch (error) {
        console.error("Failed to fetch personal challenges:", error)
      } finally {
        setLoading(false)
      }
    }
  
    fetchChallenges()
  }, [user])

  const goToChallenges = () => navigation.navigate("Challenges")
  const goToGroups = () => navigation.navigate("Groups")
  const goToMessages = () => navigation.navigate("Messages")
  const goToProfile = () => navigation.navigate("Profile")

  const currentChallenges = challenges.filter(c => !c.isCompleted)
  const pastChallenges = challenges.filter(c => c.isCompleted)



  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ImageBackground source={require("../../images/cgpt.png")} style={styles.background} resizeMode="cover">
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
            <Text style={styles.loadingText}>Loading challenges...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.challengesSection}>
              <Text style={styles.sectionTitle}>Current Challenges</Text>

              {currentChallenges.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Ionicons name="flag-outline" size={40} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.emptyStateText}>No active challenges</Text>
                  <Text style={styles.emptyStateSubText}>Create a challenge to get started</Text>
                </View>
              ) : (
                <View style={styles.challengeCardsContainer}>
                  {currentChallenges.map((challenge) => (
                    <View key={challenge.id} style= {styles.challengeRow}>
                        <TouchableOpacity
                        //key={challenge.id}
                        style={styles.challengeCardWrapper}
                        onPress={() =>
                          navigation.navigate("ChallDetails", {
                            challId: challenge.id,
                            challName: challenge.name,
                            whichChall: "Personal",
                          })
                        }
                      >
                        <View style={{ transform: [{ scale: 0.97 }] }}>
                          <ChallengeCard
                            title={challenge.name}
                            icon={require("../../images/school.png")}
                            daysComplete={challenge.daysCompleted}
                            totalDays={challenge.totalDays}
                            daysOfWeek={challenge.daysOfWeek}
                          />
                        </View>
                      </TouchableOpacity>

                       {/* Share Button */}
                       <TouchableOpacity
                        style={styles.shareButton}
                        onPress={() => {
                          setLoading(true);
                          console.log("[FRONTEND] Navigate -> EditChallengeSharingFriends with challId:", challenge.id)
                          navigation.navigate("EditChallengeSharingFriends", {
                            challId: challenge.id,
                            challName: challenge.name, 
                          })
                          setLoading(false);
                        }}
                      >
                        <Ionicons name="share" size={20} color="#FFF" />
                      </TouchableOpacity>
                    </View>                    
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={styles.addNewButton}
                onPress={() => navigation.navigate("PersChall2")}
              >
                <Text style={styles.addNewButtonText}>Add new +</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.challengesSection}>
              <Text style={styles.sectionTitle}>Past Challenges</Text>

              {pastChallenges.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Ionicons name="time-outline" size={40} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.emptyStateText}>No past challenges</Text>
                  <Text style={styles.emptyStateSubText}>Completed challenges will appear here</Text>
                </View>
              ) : (
                <View style={styles.challengeCardsContainer}>
                  {pastChallenges.map((challenge) => (
                    <TouchableOpacity
                      key={challenge.id}
                      style={styles.challengeCardWrapper}
                      onPress={() =>
                        navigation.navigate("ChallDetails", {
                          challId: challenge.id,
                          challName: challenge.name,
                          whichChall: "Personal",
                        })
                      }
                    >
                      <ChallengeCard
                        title={challenge.name}
                        icon={require("../../images/school.png")}
                        daysComplete={challenge.daysCompleted}
                        totalDays={challenge.totalDays}
                        daysOfWeek={challenge.daysOfWeek}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </ImageBackground>

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
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    paddingTop: 50,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  titleContainer: {
    marginTop: 10,
    paddingLeft: 10,
  },
  title: {
    color: "#FFF",
    fontSize: 38,
    fontWeight: "800",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  titleSecondary: {
    color: "#FFF",
    fontSize: 38,
    fontWeight: "800",
    marginTop: -5,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  decorativeLine: {
    width: 60,
    height: 4,
    backgroundColor: "#FFD700",
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  challengesSection: {
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFF",
    marginTop: 10,
    marginBottom: 15,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  challengeCardsContainer: {
    width: "100%",
  },
  challengeCardWrapper: {
    marginBottom: 15,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    flex: 1,
  },
  emptyStateContainer: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 15,
    padding: 30,
  },
  emptyStateText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 10,
  },
  emptyStateSubText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    marginTop: 5,
  },
  addNewButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: "center",
    marginTop: 20,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  addNewButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  navBar: {
    backgroundColor: "#211F26",
    flexDirection: "row",
    height: 80,
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 15,
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
  challengeRow: {
    position: "relative",
    marginBottom: 15,
  },
  shareButton: {
    position: "absolute",
    width: 36,
    height: 36,
    top: 10,
    right: 10,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
})

export default PersChall1