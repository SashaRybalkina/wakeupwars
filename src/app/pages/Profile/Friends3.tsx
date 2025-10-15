import type React from "react"
import { useEffect, useState } from "react"
import { Alert, ImageBackground, StyleSheet, Text, TouchableOpacity, View, Animated } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { type NavigationProp, useRoute } from "@react-navigation/native"
import UserProfileCard from "../Components/UserProfileCard"
import { BASE_URL, endpoints } from "../../api"
import { LinearGradient } from "expo-linear-gradient"
import { getAccessToken } from "../../auth"

type Props = {
  navigation: NavigationProp<any>
}

const Friends3: React.FC<Props> = ({ navigation }) => {
  const route = useRoute()
  // groupId will be null if we're not navigating here to add this friend to a group
  const { friendId, groupId } = route.params as { friendId: number; groupId?: number }
  const [isLoading, setIsLoading] = useState(false)
  const [profileData, setProfileData] = useState<any>(null)
  const [buttonScale] = useState(new Animated.Value(1))

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        console.log(friendId)
        const response = await fetch(endpoints.profile(friendId))
        const data = await response.json()
        console.log(data)
        setProfileData(data)
      } catch (error) {
        console.error("Failed to load profile:", error)
      }
    }

    fetchProfile()
  }, [friendId])

  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.95,
      friction: 5,
      tension: 300,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 3,
      tension: 400,
      useNativeDriver: true,
    }).start()
  }

  const handleAddToGroup = async () => {
    if (isLoading) return

    setIsLoading(true)
    const payload = {
      friend_id: friendId,
    }

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Not authenticated");
      }
      
      const response = await fetch(endpoints.addGroupMember(groupId!), {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to add friend to group")
      }

      const data = await response.json()
      console.log("Friend added to group", data)
      Alert.alert("Success!", `${profileData?.name || "Friend"} has been added to your group.`, [
        { text: "OK", onPress: () => navigation.navigate("GroupDetails", { groupId }) },
      ])
    } catch (err: any) {
      Alert.alert("Error", err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const goToChallenges = () => navigation.navigate("Challenges")
  const goToGroups = () => navigation.navigate("Groups")
  const goToMessages = () => navigation.navigate("Messages")
  const goToProfile = () => {
    navigation.navigate("Profile")
  }

  return (
    <ImageBackground source={require("../../images/tertiary.png")} style={styles.background} resizeMode="cover">
      <View style={styles.backButtonContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={30} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Profile Section */}
      {profileData && <UserProfileCard name={profileData.name} skillLevels={profileData.skill_levels} />}

      {/* Add to Group Button */}
      {groupId !== undefined && groupId !== null && (
        <View style={styles.buttonContainer}>
          <Animated.View style={[{ transform: [{ scale: buttonScale }] }]}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={handleAddToGroup}
              disabled={isLoading}
            >
              <LinearGradient
                colors={["#FFD700", "#FFA500"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.addButton}
              >
                <View style={styles.buttonContent}>
                  <Ionicons name="person-add" size={24} color="#FFF" style={styles.buttonIcon} />
                  <Text style={styles.addText}>{isLoading ? "Adding..." : "Add to Group"}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
      {/* Create Challenge for Friend Button */}
      {profileData && (
        <TouchableOpacity
          style={styles.createChallengeButton}
          onPress={() => navigation.navigate("CreateChallengeForFriend", { friendId })}
        >
          <LinearGradient
            colors={["#FFD700", "#FFA500"]}
            style={styles.createButtonGradient}
          >
            <Text style={styles.createButtonText}>Create Challenge </Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navButton} onPress={goToChallenges}>
          <Ionicons name="star" size={28} color="#FFF" />
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
          <Ionicons name="person-outline" size={28} color="#FFD700" />
          <Text style={styles.activeNavText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    alignItems: "center",
  },
  backButtonContainer: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
  },
  profileContainer: {
    alignItems: "center",
    marginTop: 50,
  },
  avatar: {
    width: 120,
    height: 120,
    marginTop: 30,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#FFD700",
  },
  profileName: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#FFF",
    marginTop: 10,
    marginBottom: 20,
  },
  statsContainer: {
    marginTop: 7.5,
    width: "100%",
  },
  statCard: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    paddingHorizontal: 25,
    paddingVertical: 7.5,
    marginVertical: 2.5,
    borderRadius: 10,
  },
  stat: {
    color: "#FFF",
    fontWeight: "600",
  },
  statValue: {
    fontWeight: "bold",
    color: "#FFD700",
  },
  buttonContainer: {
    marginTop: 225,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  addButton: {
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minWidth: 220,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
    marginTop: 170,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonIcon: {
    marginRight: 10,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  addText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 20,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
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
   createChallengeButton: {
    marginTop: 20,
    borderRadius: 12,
    overflow: "hidden",
    width: "80%",
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  createButtonGradient: {
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  createButtonText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
})

export default Friends3