import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { endpoints } from "../../api"
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { type NavigationProp, useRoute } from "@react-navigation/native"
import { LinearGradient } from "expo-linear-gradient"
import ChallengeCard from "./ChallengeCard"
import PendingPublicChallengeCard from "./PendingPublicChallengeCard"
import { useFocusEffect } from "@react-navigation/native"
import { ActivityIndicator } from "react-native"
import { useUser } from "../../context/UserContext"
import Categories from "../Games/Categories"
import { INTERNAL_CALLSITES_REGEX } from "expo/metro-config"
import PublicChallengeCard from "./PublicChallengeCard"
import { CheckboxStyledContext } from "tamagui"
import { getAccessToken } from "../../auth"

type Props = {
  navigation: NavigationProp<any>
}

type PublicChallenge = {
  id: number
  name: string
  startDate: string
  endDate: string
  daysOfWeek: string[]
  daysCompleted: number
  totalDays: number
  isCompleted: boolean
  categories: string[]
  averageSkillLevel: number
}

type PendingPublicChallenge = {
  id: number
  name: string
  totalDays: number
  numParticipants: number
  daysOfWeek: string[]
  categories: string[],
  averageSkillLevel: number,
  initiator_id: number
}


const PublicChallenges: React.FC<Props> = ({ navigation }) => {
  const { user } = useUser()

  const [isLoading, setIsLoading] = useState(true)

  const [pendingChallenges, setPendingChallenges] = useState<PendingPublicChallenge[]>([]);
  const [challenges, setChallenges] = useState<PublicChallenge[]>([]);



  useFocusEffect(
    useCallback(() => {
      if (!user?.id) {
        console.error("userId is missing!");
        return;
      }

      setIsLoading(true);

      const fetchData = async () => {

        setIsLoading(true)
        try {

                const accessToken = await getAccessToken();
                if (!accessToken) {
                  throw new Error("Not authenticated");
                }
          const response = await fetch(endpoints.getPendingPublicChallenges(Number(user.id)), {
                headers: {
                  Authorization: `Bearer ${accessToken}`
                }
              });
          const data = await response.json()
          console.log("hmm2")
        //   fields = [
        //     'id',
        //     'name',
        //     'totalDays',
        //     'daysOfWeek',
        //     'numParticipants',  
        //     'categories',
        //     'averageSkillLevel',
        //     'initiator_id'
        //   ]
        console.log(data)
        const formattedData = data.map(
            (item: PendingPublicChallenge) => ({
                id: item.id,
                name: item.name,
                totalDays: item.totalDays,
                numParticipants: item.numParticipants,
                daysOfWeek: item.daysOfWeek,
                categories: item.categories,
                averageSkillLevel: item.averageSkillLevel,
                initiator_id: item.initiator_id,
            })
        )
  
          setPendingChallenges(formattedData)


          const response2 = await fetch(endpoints.getPublicChallenges(Number(user.id)), {
                headers: {
                  Authorization: `Bearer ${accessToken}`
                }
              });
          const data2 = await response2.json();
// type PublicChallenge = {
//   id: number
//   name: string
//   startDate: string
//   endDate: string
//   daysOfWeek: string[]
//   daysCompleted: number
//   totalDays: number
//   isCompleted: boolean
//   categories: string[]
//   averageSkillLevel: number
// }

          const formattedData2 = data2.map(
            (item: PublicChallenge) => ({
                id: item.id,
                name: item.name,
                startDate: item.startDate,
                endDate: item.endDate,
                daysOfWeek: item.daysOfWeek,
                daysCompleted: item.daysCompleted,
                totalDays: item.totalDays,
                isCompleted: item.isCompleted,
                categories: item.categories,
                averageSkillLevel: item.averageSkillLevel
            })
          );
          setChallenges(formattedData2);

        } catch (error) {
          console.error("Failed to fetch group details:", error)
        } finally {
          setIsLoading(false)
        }
      }
  
      fetchData()
    }, [user?.id])
  );
    
  const goToMessages = () => navigation.navigate("Messages")
  const goToGroups = () => navigation.navigate("Groups")
  const goToChallenges = () => navigation.navigate("Challenges")
  const goToProfile = () => navigation.navigate("Profile")

  const currentChallenges = challenges?.filter((c) => !c.isCompleted) ?? []
  const pastChallenges = challenges?.filter((c) => c.isCompleted) ?? []


  return (
    <ImageBackground source={require("../../images/cgpt.png")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFD700" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerSection}>
              <Text style={styles.sectionTitle}>Public Challenges</Text>
              <View style={styles.decorativeLine} />
            </View>


        <TouchableOpacity
          style={styles.addNewButton}
          onPress={() => {
            navigation.navigate("VerifyAvailability");
          }}
        >
          <Text style={styles.addNewButtonText}>Search for Public Challenge</Text>
        </TouchableOpacity>




            <View style={styles.challengesSection}>

              <Text style={styles.sectionTitle}>Pending Challenges</Text>

              {pendingChallenges?.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Ionicons name="flag-outline" size={40} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.emptyStateText}>No pending challenges</Text>
                </View>
              ) : (
                <View style={styles.challengeCardsContainer}>
                  {pendingChallenges?.map((challenge) => (
                    <TouchableOpacity
                      key={challenge.id}
                      style={styles.challengeCardWrapper}
                      onPress={() =>
                        navigation.navigate("ChallSchedule", {
                          challId: challenge.id,
                          challName: challenge.name,
                          isInitiator: challenge.initiator_id == user?.id
                        })
                      }
                    >
                      <PendingPublicChallengeCard
                        title={challenge.name}
                        icon={require("../../images/school.png")}
                        numEnrolledMembers={challenge.numParticipants}
                        totalDays={challenge.totalDays}
                        daysOfWeek={challenge.daysOfWeek}
                        categories={challenge.categories}
                        averageSkillLevel={challenge.averageSkillLevel}
                      />
                      {/* const PendingPublicChallengeCard: React.FC<PendingPublicChallengeCardProps> = ({ 
                        title, 
                        icon, 
                      //   daysComplete,
                        numEnrolledMembers,
                        totalDays, 
                        daysOfWeek,
                        // alarmSchedule = [] // Default to empty array if not provided
                      }) => { */}
                    </TouchableOpacity>
                  ))}
                </View>
              )}




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
                          whichChall: "Public",
                        })
                      }
                    >
                      <PublicChallengeCard
                        title={challenge.name}
                        icon={require("../../images/school.png")}
                        startDate={challenge.startDate}
                        endDate={challenge.endDate}
                        daysOfWeek={challenge.daysOfWeek}
                        daysCompleted={challenge.daysCompleted}
                        totalDays={challenge.totalDays || 30}
                        isCompleted={challenge.isCompleted}
                        categories={challenge.categories}
                        averageSkillLevel={challenge.averageSkillLevel}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={styles.addNewButton}
                onPress={() => {
                  navigation.navigate("CreatePublicChall1");
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
                    //   onPress={() =>
                    //     navigation.navigate("ChallDetails", {
                    //       challId: challenge.id,
                    //       challName: challenge.name,
                    //       whichChall: "Group",
                    //     })
                    //   }
                    >
                      <PublicChallengeCard
                        title={challenge.name}
                        icon={require("../../images/school.png")}
                        startDate={challenge.startDate}
                        endDate={challenge.endDate}
                        daysOfWeek={challenge.daysOfWeek}
                        daysCompleted={challenge.daysCompleted}
                        totalDays={challenge.totalDays || 30}
                        isCompleted={challenge.isCompleted}
                        categories={challenge.categories}
                        averageSkillLevel={challenge.averageSkillLevel}
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
    marginTop: 30,
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

export default PublicChallenges