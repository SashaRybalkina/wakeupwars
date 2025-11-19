import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, StatusBar, ImageBackground, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { type NavigationProp, useFocusEffect, useRoute } from "@react-navigation/native"
import axios from "axios"
import { endpoints } from "../../api"
import { useUser } from "../../context/UserContext"
import { getAccessToken } from "../../auth"
import ChallengeCard from "./ChallengeCard"
import NavBar from "../Components/NavBar"

type Props = {
  navigation: NavigationProp<any>
}

const Chall1: React.FC<Props> = ({ navigation }) => {
  const route = useRoute()
  const { whichChall } = route.params as {
    whichChall: string
    // whichCall will be "Personal", "Group", or "Public"
  }
  const { user, logout } = useUser()
  const [isLoading, setIsLoading] = useState(false);
  const [challs, setChalls] = useState<any[]>([])

  useFocusEffect(
    useCallback(() => {
      if (!user) return
      setIsLoading(true)

      const fetchChallenges = async () => {
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
          const response = await axios.get(
            endpoints.currentChallenges(Number(user.id), whichChall), {
              headers: {
                "Authorization": `Bearer ${accessToken}`,
              },
            }
          )
        // fields = [
        //     'id', 'name', 'startDate', 'endDate', 'totalDays',
        //     'isGroupChallenge', 'daysOfWeek', 'daysCompleted',
        //     'isCompleted',
        // ]
        console.log(response.data)
          const data = response.data.map((c: any) => ({
            id: c.id,
            name: c.name,
            startDate: c.startDate,
            endDate: c.endDate,
            daysCompleted: c.daysCompleted,
            totalDays: c.totalDays ?? 30,
            daysOfWeek: c.daysOfWeek ?? [],
            isCompleted: c.isCompleted,
          }))
          setChalls(data)
          console.log(challs)
        } catch (error) {
          console.error(error)
        } finally {
          setIsLoading(false)
        }
      }

      fetchChallenges()
    }, [user?.id, whichChall]) // refetch if user or whichChall changes
  )

  const goToMessages = () => {
    navigation.navigate("Messages")
  }

  const goToGroups = () => {
    navigation.navigate("Groups")
  }

  const goToProfile = () => {
    navigation.navigate("Profile")
  }



  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ImageBackground source={require("../../images/cgpt.png")} style={styles.background} resizeMode="cover">
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={styles.title}>My {whichChall}</Text>
            <Text style={styles.titleSecondary}>Challenges</Text>

            <View style={styles.decorativeLine} />
          </View>
        </View>


        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading challenges...</Text>
          </View>
        ) : challs.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Ionicons name="flag-outline" size={40} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.emptyStateText}>No active challenges</Text>
                </View>
              ) : (
          <ScrollView
            style={styles.scrollViewContainer}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
          >
                  {challs.map((c) => (
                    <View key={c.id} style={styles.challengeRow}>
                      <TouchableOpacity
                        style={styles.challengeCardWrapper}
                        onPress={() =>
                          navigation.navigate("ChallDetails", {
                            challId: c.id,
                            challName: c.name,
                            whichChall: whichChall,
                          })
                        }
                      >
                        <ChallengeCard
                          title={c.name}
                          icon={require("../../images/ytrophy.png")}
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
            </ScrollView>

              )}
      </ImageBackground>

      <NavBar
        goToPublicChallenges={() => navigation.navigate("PublicChallenges")}
        goToChallenges={() => navigation.navigate("Challenges")}
        goToGroups={() => navigation.navigate("Groups")}
        goToMessages={() => navigation.navigate("Messages")}
        goToProfile={() => navigation.navigate("Profile")}
        active="Challenges"
      />
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
  scrollViewContainer: {
    flex: 1,
    paddingHorizontal: 30,
  },
  scrollViewContent: {
    paddingBottom: 100,
  },
  challengeContainer: {
    marginBottom: 15,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    width: "100%",
    alignSelf: "center",
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 100,
  },
  emptyStateText: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "600",
    marginTop: 20,
  },
  emptyStateSubText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 16,
    marginTop: 10,
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
  challengeCardsContainer: { width: "100%" },
  challengeCardWrapper: {
    borderRadius: 16, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, flex: 1,
  },
  challengeRow: { position: "relative", marginBottom: 15 },
})

export default Chall1