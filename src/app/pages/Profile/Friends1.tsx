/**
 * @file Friends1.tsx
 * @description This file creates a page that allows users to view their friends list.
 */

import type React from "react"
import { useEffect, useState } from "react"
import * as SecureStore from "expo-secure-store"
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View, TextInput, ActivityIndicator, Image, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { type NavigationProp, useRoute } from "@react-navigation/native"
import { ScrollView } from "tamagui"
import { useUser } from "../../context/UserContext"
import { BASE_URL, endpoints } from "../../api"
import { getAccessToken } from "../../auth"
import NavBar from "../Components/NavBar"

type Props = {
  navigation: NavigationProp<any>
}

type Friend = {
  id: number
  name: string
  username: string
  avatar?: {
    id: number;
    imageUrl: string;
    backgroundColor: string;
  };
}

const Friends1: React.FC<Props> = ({ navigation }) => {
  const { user, logout } = useUser()
  const route = useRoute()
  const from = route?.params?.from;
  const params = route.params as { groupId?: number } | undefined
  const groupId = params?.groupId
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [requestCount, setRequestCount] = useState(0)

  // Retry once on 401 by refreshing the access token with the stored refresh token
  const fetchWithAutoRefresh = async (url: string) => {
    let accessToken = await getAccessToken();
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
    let res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.status !== 401) return res;

    const refresh = await SecureStore.getItemAsync("refresh");
    if (!refresh) return res;

    // attempt refresh
    const r = await fetch(endpoints.tokenRefresh, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!r.ok) return res;
    const data = await r.json().catch(() => ({} as any));
    if (!data?.access) return res;
    await SecureStore.setItemAsync("access", data.access);
    accessToken = data.access;
    return await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  };

  useEffect(() => {
    if (!user?.id) {
      console.error("userId is missing!")
      return
    }
    const fetchFriends = async () => {
      try {
        setLoading(true)
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
        const response = await fetchWithAutoRefresh(endpoints.friends(Number(user.id)))
        // Be robust to empty or non-JSON responses
        const text = await response.text()
        let data: any = []
        try {
          data = text ? JSON.parse(text) : []
        } catch {}
        const list = Array.isArray(data)
          ? data
          : (Array.isArray((data as any)?.friends)
              ? (data as any).friends
              : (Array.isArray((data as any)?.results)
                  ? (data as any).results
                  : []))
        setFriends(list)

        // Fetch friend request count
        const requestsResponse = await fetchWithAutoRefresh(endpoints.friendRequests(Number(user.id)))
        if (requestsResponse.ok) {
          const requestsData = await requestsResponse.json().catch(() => [])
          setRequestCount(Array.isArray(requestsData) ? requestsData.length : 0)
        } else {
          setRequestCount(0)
        }
      } catch (error) {
        console.error("Failed to fetch friends:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchFriends()
  }, [user])

  const filteredFriends = friends.filter((friend) => friend.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase())
      .join("")
      .substring(0, 2)
  }

  // Generate a pastel color based on name
  const generatePastelColor = (name: string): string => {
    // Simple hash function to generate a number from a string
    const hash = name.split("").reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc)
    }, 0)

    // Generate pastel colors by keeping high lightness and medium saturation
    const h = hash % 360 // Hue: 0-359
    const s = 60 + (hash % 20) // Saturation: 60-79%
    const l = 80 + (hash % 10) // Lightness: 80-89%

    return `hsl(${h}, ${s}%, ${l}%)`
  }

  const goToChallenges = () => navigation.navigate("Challenges")
  const goToMessages = () => navigation.navigate("Messages")
  const goToGroups = () => navigation.navigate("Groups")
  const goToProfile = () => navigation.navigate("Profile")

  return (
    <ImageBackground source={require("../../images/cgpt.png")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.title}>My Friends</Text>
          <TouchableOpacity
            style={styles.addFriendButton}
            onPress={() => {
              console.log("Navigating to FriendsSearch")
              navigation.navigate("FriendsSearch")
            }}
          >
            <Ionicons name="person-add" size={24} color="#FFD700" />
          </TouchableOpacity>
        </View>

        {requestCount > 0 && (
          <TouchableOpacity
            style={styles.requestsButton}
            onPress={() => {
              console.log("Navigating to FriendsRequests")
              navigation.navigate("FriendsRequests")
            }}
          >
            <View style={styles.requestsIconContainer}>
              <Ionicons name="notifications" size={24} color="#FFD700" />
              <View style={styles.requestsBadge}>
                <Text style={styles.requestsBadgeText}>{requestCount}</Text>
              </View>
            </View>
            <Text style={styles.requestsText}>
              {requestCount === 1 ? "1 friend request" : `${requestCount} friend requests`}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#FFD700" />
          </TouchableOpacity>
        )}

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search friends..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFD700" />
          </View>
        ) : (
          <ScrollView style={styles.scrollViewContainer} contentContainerStyle={styles.scrollViewContent}>
            {filteredFriends.length > 0 ? (
              filteredFriends.map((friend) => {
                return (
                  <TouchableOpacity
                    key={friend.id}
                    style={styles.friendCard}
                    onPress={() => {
                      if (from === "Messages") {
                        navigation.navigate("Conversation", { 
                          otherUserId: friend.id, 
                          otherUserName: friend.name,
                          groupId: null,
                          groupName: null
                        });
                      }
                      else
                      {
                        navigation.navigate("Friends3", { friendId: friend.id, groupId: groupId })}
                      }
                    }
                  >
                    <View
                      style={[
                        styles.avatarContainer,
                        { backgroundColor: friend.avatar?.backgroundColor || generatePastelColor(friend.name) },
                      ]}
                    >
                      {friend.avatar?.imageUrl ? (
                        <Image
                          source={{ uri: `${BASE_URL}${friend.avatar.imageUrl}` }}
                          style={{ width: 50, height: 50, borderRadius: 25 }}
                          resizeMode="contain"
                        />
                      ) : (
                        <Text style={styles.avatarText}>{getInitials(friend.name)}</Text>
                      )}
                    </View>
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>{friend.name}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                )
              })
            ) : (
              <View style={styles.emptyStateContainer}>
                <Ionicons name="people-outline" size={60} color="rgba(255,255,255,0.5)" />
                <Text style={styles.emptyStateText}>No friends found</Text>
                {searchQuery ? (
                  <Text style={styles.emptyStateSubText}>Try a different search term</Text>
                ) : (
                  <Text style={styles.emptyStateSubText}>Add friends to get started</Text>
                )}
              </View>
            )}
          </ScrollView>
        )}
      </View>

      <NavBar
        goToPublicChallenges={() => navigation.navigate("PublicChallenges")}
        goToChallenges={() => navigation.navigate("Challenges")}
        goToGroups={() => navigation.navigate("Groups")}
        goToMessages={() => navigation.navigate("Messages")}
        goToProfile={() => navigation.navigate("Profile")}
        active="Profile"
      />
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
    paddingHorizontal: 20,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "700",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  addFriendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  requestsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(50, 50, 60, 0.4)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.3)",
  },
  requestsIconContainer: {
    position: "relative",
    marginRight: 10,
  },
  requestsBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  requestsBadgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  requestsText: {
    flex: 1,
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(50, 50, 60, 0.30)",
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 50,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontSize: 16,
    color: "#FFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollViewContainer: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 100,
  },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(50, 50, 60, 0.25)",
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#333",
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 50,
  },
  emptyStateText: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "600",
    marginTop: 15,
  },
  emptyStateSubText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 16,
    marginTop: 8,
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

export default Friends1