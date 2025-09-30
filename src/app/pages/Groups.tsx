import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { endpoints } from "../api"
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View, ScrollView as RNScrollView } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { NavigationProp } from "@react-navigation/native"
import { useUser } from "../context/UserContext"
import { useFocusEffect } from "@react-navigation/native";
import { getAccessToken } from "../auth"
type Props = {
  navigation: NavigationProp<any>
}

type Group = {
  id: number
  name: string
}

const Groups: React.FC<Props> = ({ navigation }) => {
  const { user } = useUser()
  const [groups, setGroups] = useState<Group[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) {
        console.error("userId is missing!");
        return;
      }
  
      const fetchGroups = async () => {
        setIsLoading(true);
        try {
                const accessToken = await getAccessToken();
                if (!accessToken) {
                  throw new Error("Not authenticated");
                }
          const response = await fetch(endpoints.groups(Number(user.id)), {
                headers: {
                  Authorization: `Bearer ${accessToken}`
                }
              });
          const data = await response.json();
          setGroups(data);
        } catch (error) {
          console.error("Failed to fetch groups:", error);
        } finally {
          setIsLoading(false);
        }
      };
  
      fetchGroups();
    }, [user?.id])
  );
  
  const goToChallenges = () => navigation.navigate("Challenges")
  const goToGroups = () => navigation.navigate("Groups")
  const goToMessages = () => navigation.navigate("Messages")
  const goToProfile = () => navigation.navigate("Profile")
  const goToCreateGroup = () => navigation.navigate("CreateGroup")

  // Group card icons based on name
  const getGroupIcon = (name: string) => {
    const nameLower = name.toLowerCase()
    if (nameLower.includes("morning") || nameLower.includes("early") || nameLower.includes("bird")) {
      return "sunny-outline"
    } else if (nameLower.includes("night") || nameLower.includes("evening")) {
      return "moon-outline"
    } else if (nameLower.includes("fitness") || nameLower.includes("workout")) {
      return "fitness-outline"
    } else if (nameLower.includes("study") || nameLower.includes("learn")) {
      return "book-outline"
    } else if (nameLower.includes("friend") || nameLower.includes("social")) {
      return "people-outline"
    }
    return "people-circle-outline"
  }

  return (
    <ImageBackground source={require("../images/cgpt.png")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>My Groups</Text>
          <View style={styles.decorativeLine} />
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading groups...</Text>
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="people-circle-outline" size={70} color="rgba(255,255,255,0.7)" />
            <Text style={styles.emptyStateText}>No groups yet</Text>
            <Text style={styles.emptyStateSubText}>Create or join a group to get started</Text>
          </View>
        ) : (
          <RNScrollView
            style={styles.scrollViewContainer}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
          >
            {groups.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={styles.groupCard}
                onPress={() => navigation.navigate("GroupDetails", { groupId: group.id })}
                activeOpacity={0.8}
              >
                <View style={styles.groupIconContainer}>
                  <Ionicons name={getGroupIcon(group.name)} size={32} color="#FFF" />
                </View>

                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>{group.name}</Text>
                  <View style={styles.groupMeta}></View>
                </View>

                <View style={styles.arrowContainer}>
                  <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.6)" />
                </View>
              </TouchableOpacity>
            ))}
          </RNScrollView>
        )}

        <TouchableOpacity style={styles.floatingButton} onPress={goToCreateGroup}>
          <Ionicons name="add" size={30} color="#FFF" />
        </TouchableOpacity>
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
    paddingTop: 60,
  },
  headerContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
    marginTop: 30,
  },
  title: {
    fontSize: 38,
    fontWeight: "800",
    color: "#FFF",
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
  scrollViewContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollViewContent: {
    paddingBottom: 100,
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
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(50, 50, 60, 0.3)",
    borderRadius: 16,
    marginBottom: 15,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  groupIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  groupMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  metaText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    marginLeft: 4,
  },
  challengeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 215, 0, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  challengeText: {
    color: "#FFD700",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  arrowContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  floatingButton: {
    position: "absolute",
    bottom: 100,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
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

export default Groups
