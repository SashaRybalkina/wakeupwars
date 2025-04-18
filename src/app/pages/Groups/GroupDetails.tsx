import type React from "react"
import { useEffect, useState } from "react"
import { endpoints } from "../../api"
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { type NavigationProp, useRoute } from "@react-navigation/native"
import { LinearGradient } from "expo-linear-gradient"
import ChallengeCard from "../Challenges/ChallengeCard"

type Props = {
  navigation: NavigationProp<any>
}

type Challenge = {
  id: number
  name: string
  startDate: string
  endDate: string
  isGroupChallenge: boolean
  daysOfWeek: string[]
  daysCompleted: number
  totalDays?: number
  isCompleted?: boolean
}

type GroupData = {
  id: number
  name: string
  challenges: Challenge[]
  members: { id: number; name: string }[]
}

const GroupDetails: React.FC<Props> = ({ navigation }) => {
  const route = useRoute()
  const { groupId } = route.params as { groupId: number }

  const [groupData, setGroupData] = useState<GroupData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchGroupData = async () => {
      setIsLoading(true)
      try {
        console.log("Fetching from:", endpoints.groupProfile(groupId))
        const response = await fetch(endpoints.groupProfile(groupId))
        const data = await response.json()

        // Add totalDays if not present and determine if challenge is completed
        if (data.challenges) {
          const now = new Date()
          data.challenges = data.challenges.map((challenge: Challenge) => ({
            ...challenge,
            totalDays: challenge.totalDays || 30,
            isCompleted: challenge.endDate ? new Date(challenge.endDate) < now : false,
          }))
        }

        setGroupData(data)
      } catch (error) {
        console.error("Failed to fetch group details:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchGroupData()
  }, [groupId])

  const goToMessages = () => navigation.navigate("Messages")
  const goToGroups = () => navigation.navigate("Groups")
  const goToChallenges = () => navigation.navigate("Challenges")
  const goToProfile = () => navigation.navigate("Profile")

  const currentChallenges = groupData?.challenges?.filter((c) => !c.isCompleted) ?? []
  const pastChallenges = groupData?.challenges?.filter((c) => c.isCompleted) ?? []

  // Get member initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  // Get random pastel color for member avatars
  const getRandomPastelColor = (seed: number) => {
    const hue = (seed * 137.5) % 360
    return `hsl(${hue}, 70%, 80%)`
  }

  return (
    <ImageBackground source={require("../../images/cgpt.png")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading group details...</Text>
          </View>
        ) : !groupData ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={60} color="#FFF" />
            <Text style={styles.errorText}>Could not load group details</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerSection}>
              <Text style={styles.groupTitle}>{groupData.name}</Text>
              <View style={styles.decorativeLine} />
            </View>

            <View style={styles.groupImageContainer}>
              <LinearGradient
                colors={["#FF6B6B", "#6B66FF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.groupImage}
              />
            </View>

            <View style={styles.membersSection}>
              <Text style={styles.sectionTitle}>Members</Text>
              <View style={styles.membersRow}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.membersScrollContent}
                >
                  {groupData.members.map((member, index) => (
                    <View key={index} style={styles.memberContainer}>
                      <View style={[styles.memberAvatar, { backgroundColor: getRandomPastelColor(index) }]}>
                        <Text style={styles.memberInitials}>{getInitials(member.name)}</Text>
                      </View>
                      <Text style={styles.memberName}>{member.name}</Text>
                    </View>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={styles.addMemberButton}
                  onPress={() => navigation.navigate("Friends1", { groupId: Number(groupId) })}
                >
                  <View style={styles.addMemberCircle}>
                    <Ionicons name="person-add-outline" size={24} color="#FFF" />
                  </View>
                  <Text style={styles.addMemberText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

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
                    <TouchableOpacity
                      key={challenge.id}
                      style={styles.challengeCardWrapper}
                      onPress={() =>
                        navigation.navigate("ChallDetails", {
                          challId: challenge.id,
                          challName: challenge.name,
                          whichChall: "Group",
                        })
                      }
                    >
                      <ChallengeCard
                        title={challenge.name}
                        icon={require("../../images/school.png")}
                        daysComplete={challenge.daysCompleted}
                        totalDays={challenge.totalDays || 30}
                        daysOfWeek={challenge.daysOfWeek}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={styles.addNewButton}
                onPress={() => {
                  navigation.navigate("GroupChall1", {
                    groupId: groupData.id,
                    groupMembers: groupData.members,
                  })
                }}
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
                          whichChall: "Group",
                        })
                      }
                    >
                      <ChallengeCard
                        title={challenge.name}
                        icon={require("../../images/school.png")}
                        daysComplete={challenge.daysCompleted}
                        totalDays={challenge.totalDays || 30}
                        daysOfWeek={challenge.daysOfWeek}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        )}
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 10,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  groupTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFF",
    textAlign: "center",
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
  },
  groupImageContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  groupImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  membersSection: {
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFF",
    marginTop: 20,
    marginBottom: 15,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  membersScrollContent: {
    paddingRight: 20,
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
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  memberInitials: {
    color: "#333",
    fontSize: 20,
    fontWeight: "700",
  },
  memberName: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  challengesSection: {
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  addNewButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  addNewButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
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
  membersContainer: {
    flexGrow: 0,
    maxWidth: "85%",
  },
  membersWithAddContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  addMember: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 0, // Change from 10 to 0 to move it right
  },
  membersRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  addMemberButton: {
    marginLeft: 10,
    alignItems: "center",
  },
  addMemberCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  addMemberText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 5,
  },
})

export default GroupDetails