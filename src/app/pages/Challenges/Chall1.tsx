import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, StatusBar, ImageBackground } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { type NavigationProp, useFocusEffect, useRoute } from "@react-navigation/native"
import axios from "axios"
import { endpoints } from "../../api"
import { useUser } from "../../context/UserContext"
import ChallengeCard from "./ChallengeCard"

type Props = {
  navigation: NavigationProp<any>
}

const Chall1: React.FC<Props> = ({ navigation }) => {
  const route = useRoute()
  const { whichChall } = route.params as {
    whichChall: string
  }
  const { user } = useUser()
  const [challs, setChalls] = useState<
    {
      id: number
      name: string
      daysCompleted: number
      totalDays: number
      daysOfWeek: string[]
    }[]
  >([])

  useFocusEffect(
    useCallback(() => {
      if (!user) return

      const fetchChallenges = async () => {
        try {
          const response = await axios.get(
            endpoints.challengeList(Number(user.id), whichChall)
          )
          const data = response.data.map((c: any) => ({
            id: c.id,
            name: c.name,
            daysCompleted: c.daysCompleted,
            totalDays: c.totalDays ?? 30,
            daysOfWeek: c.daysOfWeek ?? [],
          }))
          setChalls(data)
        } catch (error) {
          console.error(error)
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


  const Challenge: React.FC<{
    id: number
    name: string
    daysCompleted: number
    totalDays: number
    daysOfWeek: string[]
  }> = ({ id, name, daysCompleted, totalDays, daysOfWeek }) => (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate("ChallDetails", {
          challId: id,
          challName: name,
          whichChall,
        })
      }
      style={styles.challengeContainer}
    >
      <ChallengeCard
        title={name}
        icon={require("../../images/school.png")}
        daysComplete={daysCompleted}
        totalDays={totalDays}
        daysOfWeek={daysOfWeek}
      />
    </TouchableOpacity>
  )

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

        {challs.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="flag-outline" size={70} color="rgba(255,255,255,0.7)" />
            <Text style={styles.emptyStateText}>No challenges yet</Text>
            
              <TouchableOpacity
                style={styles.addNewButton}
                onPress={() => {
                  navigation.navigate("CreatePublicChall1");
                }}
              >
                <Text style={styles.addNewButtonText}>Add new +</Text>
              </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollViewContainer}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
          >
            {challs.map((challenge) => (
              <Challenge
                key={challenge.id}
                id={challenge.id}
                name={challenge.name}
                daysCompleted={challenge.daysCompleted}
                totalDays={challenge.totalDays}
                daysOfWeek={challenge.daysOfWeek}
              />
            ))}

              <TouchableOpacity
                style={styles.addNewButton}
                onPress={() => {
                  navigation.navigate("CreatePublicChall1");
                }}
              >
                <Text style={styles.addNewButtonText}>Add new +</Text>
              </TouchableOpacity>
          </ScrollView>
        )}
      </ImageBackground>

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
    elevation: 4,
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
})

export default Chall1