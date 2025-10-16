import type React from "react"
import { useState, useEffect } from "react"
import * as SecureStore from "expo-secure-store"
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { NavigationProp } from "@react-navigation/native"
import { ScrollView } from "tamagui"
import { useUser } from "../../context/UserContext"
import { BASE_URL, endpoints } from "../../api"
import { getAccessToken } from "../../auth"

type Props = {
  navigation: NavigationProp<any>
}

type FriendRequest = {
  id: number
  sender: {
    id: number
    name: string
    username: string
  }
  created_at: string
}

const isFriendRequestArray = (data: unknown): data is FriendRequest[] => {
  return (
    Array.isArray(data) &&
    data.every((item) => {
      if (typeof item !== "object" || item === null) return false
      const it = item as any
      return (
        typeof it.id === "number" &&
        typeof it.created_at === "string" &&
        typeof it.sender === "object" &&
        it.sender !== null &&
        typeof it.sender.id === "number" &&
        typeof it.sender.name === "string" &&
        typeof it.sender.username === "string"
      )
    })
  )
}

const FriendsRequests: React.FC<Props> = ({ navigation }) => {
  const { user } = useUser()
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)

  // Retry once on 401 by refreshing with stored refresh token
  const fetchWithAutoRefresh = async (url: string) => {
    let accessToken = await getAccessToken();
    if (!accessToken) throw new Error("Not authenticated");
    let res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.status !== 401) return res;

    const refresh = await SecureStore.getItemAsync("refresh");
    if (!refresh) return res;
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
    fetchRequests()
  }, [user])

  const fetchRequests = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const response = await fetchWithAutoRefresh(endpoints.friendRequests(Number(user.id)))
      if (response.ok) {
        const data: unknown = await response.json().catch(() => null)
        setRequests(isFriendRequestArray(data) ? data : [])
      } else {
        setRequests([])
      }
    } catch (error) {
      console.error("Failed to fetch friend requests:", error)
    } finally {
      setLoading(false)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase())
      .join("")
      .substring(0, 2)
  }

  const generatePastelColor = (name: string): string => {
    const hash = name.split("").reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc)
    }, 0)

    const h = hash % 360
    const s = 60 + (hash % 20)
    const l = 80 + (hash % 10)

    return `hsl(${h}, ${s}%, ${l}%)`
  }

  const handleRequest = async (requestId: number, accept: boolean) => {
    if (!user?.id) return

    try {
      setProcessingId(requestId)

      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Not authenticated");
      }
      const response = await fetch(endpoints.respondToFriendRequest(requestId), {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          accept,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Failed to ${accept ? "accept" : "decline"} friend request`)
      }

      // Remove the request from the list
      setRequests(requests.filter((req) => req.id !== requestId))

      Alert.alert("Success", accept ? "Friend request accepted! You are now friends." : "Friend request declined.")
    } catch (error: any) {
      Alert.alert("Error", error.message || `Failed to ${accept ? "accept" : "decline"} friend request`)
    } finally {
      setProcessingId(null)
    }
  }

  const formatRequestTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.round(diffMs / 60000)
    const diffHours = Math.round(diffMins / 60)
    const diffDays = Math.round(diffHours / 24)

    if (diffMins < 60) {
      return `${diffMins}m ago`
    } else if (diffHours < 24) {
      return `${diffHours}h ago`
    } else {
      return `${diffDays}d ago`
    }
  }

  return (
    <ImageBackground source={require("../../images/cgpt.png")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Friend Requests</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFD700" />
          </View>
        ) : (
          <ScrollView style={styles.scrollViewContainer} contentContainerStyle={styles.scrollViewContent}>
            {requests.length > 0 ? (
              requests.map((request) => {
                const backgroundColor = generatePastelColor(request.sender.name)
                return (
                  <View key={request.id} style={styles.requestCard}>
                    <View style={[styles.avatarContainer, { backgroundColor }]}>
                      <Text style={styles.avatarText}>{getInitials(request.sender.name)}</Text>
                    </View>
                    <View style={styles.requestInfo}>
                      <View style={styles.nameContainer}>
                        <Text style={styles.senderName}>{request.sender.name}</Text>
                        <Text style={styles.requestTime}>{formatRequestTime(request.created_at)}</Text>
                      </View>
                      <Text style={styles.senderUsername}>@{request.sender.username}</Text>

                      <View style={styles.actionsContainer}>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.acceptButton]}
                          onPress={() => handleRequest(request.id, true)}
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? (
                            <ActivityIndicator size="small" color="#FFF" />
                          ) : (
                            <>
                              <Ionicons name="checkmark" size={18} color="#FFF" />
                              <Text style={styles.actionButtonText}>Accept</Text>
                            </>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionButton, styles.declineButton]}
                          onPress={() => handleRequest(request.id, false)}
                          disabled={processingId === request.id}
                        >
                          <Ionicons name="close" size={18} color="#FFF" />
                          <Text style={styles.actionButtonText}>Decline</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )
              })
            ) : (
              <View style={styles.emptyStateContainer}>
                <Ionicons name="notifications" size={60} color="rgba(255,255,255,0.5)" />
                <Text style={styles.emptyStateText}>No friend requests</Text>
                <Text style={styles.emptyStateSubText}>
                  When someone sends you a friend request, it will appear here
                </Text>
              </View>
            )}
          </ScrollView>
        )}
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
    paddingHorizontal: 20,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  title: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "700",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
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
  requestCard: {
    flexDirection: "row",
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
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#333",
  },
  requestInfo: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  senderName: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
  },
  requestTime: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
  },
  senderUsername: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    marginBottom: 12,
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginTop: 5,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginRight: 10,
  },
  acceptButton: {
    backgroundColor: "rgba(127, 255, 0, 0.3)",
    borderWidth: 1,
    borderColor: "rgba(127, 255, 0, 0.5)",
  },
  declineButton: {
    backgroundColor: "rgba(255, 99, 71, 0.3)",
    borderWidth: 1,
    borderColor: "rgba(255, 99, 71, 0.5)",
  },
  actionButtonText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 5,
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
    textAlign: "center",
    paddingHorizontal: 20,
  },
})

export default FriendsRequests
