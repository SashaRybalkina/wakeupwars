import type React from "react"
import { useState, useEffect } from "react"
import {
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { NavigationProp } from "@react-navigation/native"
import { ScrollView } from "tamagui"
import { useUser } from "../../context/UserContext"
import { BASE_URL, endpoints } from "../../api"
import { getAccessToken } from "../../auth"

type Props = {
  navigation: NavigationProp<any>
}

type UserType = {
  id: number
  name: string
  username: string
  isFriend?: boolean
  requestSent?: boolean
}

const FriendsSearch: React.FC<Props> = ({ navigation }) => {
  const { user } = useUser()
  const [users, setUsers] = useState<UserType[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserType[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [sendingRequest, setSendingRequest] = useState<number | null>(null)

  useEffect(() => {
    const fetchUsers = async () => {
      if (!user?.id) return

      try {
        setLoading(true)
        // Fetch all users
        const response = await fetch(endpoints.allUsers())
        const allUsers = await response.json()

        // Fetch current friends to filter them out
        const friendsResponse = await fetch(endpoints.friends(Number(user.id)))
        const friends = await friendsResponse.json()

        // Fetch sent friend requests
        const requestsResponse = await fetch(endpoints.sentFriendRequests(Number(user.id)))
        const sentRequests = await requestsResponse.json()

        // Mark users who are already friends or have pending requests
        const processedUsers = allUsers
          .filter((u: UserType) => u.id !== user.id) // Filter out current user
          .map((u: UserType) => ({
            ...u,
            isFriend: friends.some((f: UserType) => f.id === u.id),
            requestSent: sentRequests.some((r: any) => r.recipient.id === u.id),
          }))

        setUsers(processedUsers)
        setFilteredUsers(processedUsers)
      } catch (error) {
        console.error("Failed to fetch users:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [user])

  useEffect(() => {
    if (searchQuery) {
      const filtered = users.filter(
        (user) =>
          user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      setFilteredUsers(filtered)
    } else {
      setFilteredUsers(users)
    }
  }, [searchQuery, users])

  const cancelFriendRequest = async (recipientId: number) => {
    if (!user?.id) return;
  
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Not authenticated");
      }
      
      const res = await fetch(endpoints.sentFriendRequests(Number(user.id)), {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      const data = await res.json();
  
      const matchingRequest = data.find((r: any) => r.recipient.id === recipientId);
  
      if (!matchingRequest) {
        Alert.alert("Error", "No friend request found to cancel.");
        return;
      }
  
  
      const response = await fetch(endpoints.cancelFriendRequest(matchingRequest.id), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to cancel request");
      }
  
      const updatedRequests = await (await fetch(endpoints.sentFriendRequests(Number(user.id)))).json();
      const updatedIds = updatedRequests.map((r: any) => r.recipient.id);
  
      setUsers(users.map((u) => ({
        ...u,
        requestSent: updatedIds.includes(u.id),
      })));
  
      Alert.alert("Cancelled", "Friend request cancelled successfully.");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Something went wrong.");
    }
  };  
  
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

  const sendFriendRequest = async (recipientId: number) => {
    if (!user?.id) return
    const recipient = users.find((u) => u.id === recipientId);
    if (recipient?.requestSent || recipient?.isFriend) {
      Alert.alert("Info", "You already sent a request or are already friends.");
      return;
    }

    try {
      setSendingRequest(recipientId)

      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Not authenticated");
      }
      const response = await fetch(endpoints.sendFriendRequest(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          sender_id: user.id,
          recipient_id: recipientId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to send friend request")
      }

      // Update the UI to show the request was sent
      setUsers(users.map((u) => (u.id === recipientId ? { ...u, requestSent: true } : u)))

      Alert.alert("Success", "Friend request sent successfully!")
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send friend request")
    } finally {
      setSendingRequest(null)
    }
  }

  return (
    <ImageBackground source={require("../../images/cgpt.png")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Find Friends</Text>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by username or name..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFD700" />
          </View>
        ) : (
          <ScrollView style={styles.scrollViewContainer} contentContainerStyle={styles.scrollViewContent}>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => {
                const backgroundColor = generatePastelColor(user.name)
                return (
                  <View key={user.id} style={styles.userCard}>
                    <View style={[styles.avatarContainer, { backgroundColor }]}>
                      <Text style={styles.avatarText}>{getInitials(user.name)}</Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{user.name}</Text>
                      <Text style={styles.userUsername}>@{user.username}</Text>
                    </View>
                    {user.isFriend ? (
                      <View style={styles.friendBadge}>
                        <Ionicons name="checkmark-circle" size={18} color="#7FFF00" />
                        <Text style={styles.friendText}>Friend</Text>
                      </View>
                    ) : user.requestSent ? (
                        <TouchableOpacity
                        style={styles.requestSentBadge}
                        onPress={() => cancelFriendRequest(user.id)}
                        disabled={sendingRequest === user.id}
                        >
                        <Ionicons name="close-circle" size={18} color="#FFD700" />
                        <Text style={styles.requestSentText}>Cancel</Text>
                        </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => sendFriendRequest(user.id)}
                        disabled={sendingRequest === user.id}
                      >
                        {sendingRequest === user.id ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <>
                            <Ionicons name="person-add" size={18} color="#FFF" />
                            <Text style={styles.addButtonText}>Add</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )
              })
            ) : (
              <View style={styles.emptyStateContainer}>
                <Ionicons name="search" size={60} color="rgba(255,255,255,0.5)" />
                <Text style={styles.emptyStateText}>No users found</Text>
                <Text style={styles.emptyStateSubText}>Try a different search term</Text>
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
  userCard: {
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
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#333",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  userUsername: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 215, 0, 0.3)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  addButtonText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 5,
  },
  friendBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(127, 255, 0, 0.2)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(127, 255, 0, 0.5)",
  },
  friendText: {
    color: "#7FFF00",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 5,
  },
  requestSentBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 215, 0, 0.2)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.5)",
  },
  requestSentText: {
    color: "#FFD700",
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
  },
})

export default FriendsSearch
