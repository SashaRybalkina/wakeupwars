import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { BASE_URL } from "../api"
import { useUser } from "../context/UserContext"
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
  Dimensions,
  Alert,
  Image,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { NavigationProp } from "@react-navigation/native"
import { useFocusEffect } from "@react-navigation/native"
import { LinearGradient } from "expo-linear-gradient"
import axios from "axios"
import { getAccessToken } from "../auth"
import * as Notifications from 'expo-notifications'
import { formatDistanceToNow } from 'date-fns'
import NavBar from "./Components/NavBar"

type Props = {
  navigation: NavigationProp<any>
}

const { width } = Dimensions.get("window")

const Messages: React.FC<Props> = ({ navigation }) => {
  const { user, activeConversationId, activeGroupId, logout } = useUser()
  const [selected, setSelected] = useState("Friends")
  const [friendMessages, setFriendMessages] = useState<any[]>([])
  const [groupConversations, setGroupConversations] = useState<any[]>([])
  const [indicatorPosition] = useState(new Animated.Value(0))
  const [composeVisible, setComposeVisible] = useState(false)
  const [composeText, setComposeText] = useState("")
  const [composeRecipientId, setComposeRecipientId] = useState("")
  const [composeGroupId, setComposeGroupId] = useState("")
  const [sending, setSending] = useState(false)
  const [loadingFriends, setLoadingFriends] = useState(true)
  const [loadingGroups, setLoadingGroups] = useState(true)
  const wsPrivate = useRef<WebSocket | null>(null)
  const wsGroups = useRef<WebSocket | null>(null)

  // Fetch messages
  const fetchMessages = async () => {
    if (!user?.id) return
    setLoadingFriends(true)
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
      const response = await fetch(`${BASE_URL}/api/user/${user.id}/recent-messages/`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json()
      const friends = data.filter((msg: any) => msg.recipient !== null)
      setFriendMessages(friends)
    } catch (error) {
      console.error("Failed to fetch messages:", error)
    } finally {
      setLoadingFriends(false)
    }
  }

  const fetchGroupConversations = async () => {
    if (!user?.id) return
    setLoadingGroups(true)
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
      const response = await fetch(`${BASE_URL}/api/user/${user.id}/recent-group-messages/`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json()
      setGroupConversations(data)
    } catch (error) {
      console.error("Failed to fetch group conversations:", error)
    } finally {
      setLoadingGroups(false)
    }
  }

  useEffect(() => {
    fetchMessages()
    fetchGroupConversations()
  }, [user])

  // Push notifications setup (still needed for device notifications)
  useEffect(() => {
    const registerForPushNotifications = async () => {
      const { status: existingStatus } = await Notifications.getPermissionsAsync()
      let finalStatus = existingStatus
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }
      if (finalStatus !== 'granted') return
      const tokenData = await Notifications.getExpoPushTokenAsync()
      const pushToken = tokenData.data
      // if (user?.id && pushToken) {
      //   await fetch(`${BASE_URL}/api/save-push-token/`, {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify({ user_id: user.id, push_token: pushToken }),
      //   })
      // }
    }
    registerForPushNotifications()
  }, [user])

  // Animated tab indicator
  useEffect(() => {
    Animated.spring(indicatorPosition, {
      toValue: selected === "Friends" ? 0 : 1,
      useNativeDriver: false,
    }).start()
  }, [selected])

  // WebSocket setup for messages
  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;

      const wsUrlPrivate = `${BASE_URL.replace(/^http/, "ws")}/ws/chat/users/${user.id}/`;
      wsPrivate.current = new WebSocket(wsUrlPrivate);
      wsPrivate.current.onmessage = () => fetchMessages();

      const wsUrlGroups = `${BASE_URL.replace(/^http/, "ws")}/ws/chat/groups/${user.id}/`;
      wsGroups.current = new WebSocket(wsUrlGroups);
      wsGroups.current.onmessage = () => fetchGroupConversations();

      return () => {
        wsPrivate.current?.close();
        wsGroups.current?.close();
      };
    }, [user?.id])
  );

  const getConversations = (messages: any[]) => {
    const conversations: Record<string, any> = {}
    messages.forEach((msg) => {
      const otherUser = msg.sender.id === user?.id ? msg.recipient : msg.sender
      if (!otherUser) return
      const id = otherUser.id
      if (!conversations[id] || new Date(msg.timestamp) > new Date(conversations[id].timestamp))
        conversations[id] = { otherUser, lastMessage: msg }
    })
    return Object.values(conversations).sort(
      (a: any, b: any) => b.lastMessage.id - a.lastMessage.id
    );
  }

  const openConversation = (id: number, name: string) =>
    navigation.navigate("Conversation", { otherUserId: id, groupId: null, groupName: null, otherUserName: name })

  const openGroupConversation = (id: number, name: string) =>
    navigation.navigate("Conversation", { otherUserId: null, groupId: id, groupName: name, otherUserName: null })

  const getTimeAgo = (timestamp: string) =>
    timestamp ? formatDistanceToNow(new Date(timestamp), { addSuffix: true }) : ""

  const tabWidth = width / 2 * 0.9
  const translateX = indicatorPosition.interpolate({
    inputRange: [0, 1],
    outputRange: [0, tabWidth],
  })

  const goToMessages = () => navigation.navigate("Messages") 
  const goToGroups = () => navigation.navigate("Groups") 
  const goToChallenges = () => navigation.navigate("Challenges") 
  const goToProfile = () => navigation.navigate("Profile")

  const MessageItem: React.FC<{ 
    name: string; 
    text: string; 
    index: number; 
    timestamp: string; 
    onPress?: () => void;
    unread?: boolean;
    avatar?: { imageUrl?: string; backgroundColor?: string } | null;
  }> = ({
    name,
    text,
    index,
    timestamp,
    onPress,
    unread = false,
    avatar,
  }) => (
    <TouchableOpacity
      style={[
        styles.messageCard,
        { 
          marginTop: index === 0 ? 0 : 12,
          backgroundColor: unread 
            ? "rgba(255, 215, 0, 0.15)"
            : "rgba(50, 50, 60, 0.3)"
        },
      ]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.messageAvatarContainer}>
        <View style={[
          styles.messageAvatar,
          { backgroundColor: (avatar?.backgroundColor || "rgba(255, 215, 0, 0.3)") },
          unread && { borderColor: "#FFF700" }
        ]}>
          {avatar?.imageUrl ? (
            <Image
              source={{ uri: avatar.imageUrl.startsWith("http") ? avatar.imageUrl : `${BASE_URL}${avatar.imageUrl}` }}
              style={styles.messageAvatarImg}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.avatarText}>{name ? name.charAt(0).toUpperCase() : "?"}</Text>
          )}
        </View>
      </View>
      <View style={styles.messageContent}>
        <View style={styles.messageHeader}>
          <Text 
            style={[
              styles.messageName, 
              unread && { color: "#FFF", fontWeight: "800" }
            ]}
          >
            {name}
          </Text>
          <Text style={styles.messageTime}>{getTimeAgo(timestamp)}</Text>
        </View>
        <Text 
          style={[
            styles.messageText, 
            unread && { fontWeight: "700", color: "#FFD700" }
          ]} 
          numberOfLines={1}
        >
          {text}
        </Text>
      </View>
    </TouchableOpacity>
  )

  const EmptyState = () => {
    const isLoading = selected === "Friends" ? loadingFriends : loadingGroups
    return (
      <View style={styles.emptyStateContainer}>
        <Ionicons name="chatbubble-ellipses-outline" size={70} color="rgba(255,255,255,0.5)" />
        <Text style={styles.emptyStateText}>No messages yet</Text>
        {isLoading && (
          <Text style={styles.emptyStateTextLoading}>Loading...</Text>
        )}
      </View>
    )
  }

  return (
    <ImageBackground source={require("../images/cgpt.png")} style={styles.background}>
      <View style={styles.container}>
        <Text style={styles.title}>Messages</Text>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity style={styles.tabButton} onPress={() => setSelected("Friends")}>
            <Text style={[styles.tabText, selected === "Friends" && styles.activeTabText]}>Friends</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabButton} onPress={() => setSelected("Groups")}>
            <Text style={[styles.tabText, selected === "Groups" && styles.activeTabText]}>Groups</Text>
          </TouchableOpacity>
          <Animated.View style={[styles.tabIndicator, { transform: [{ translateX }] }]} />
        </View>

        <ScrollView style={styles.scrollViewContainer}>
        {selected === "Friends" ? (
            friendMessages.length > 0 ? (
              getConversations(friendMessages).map((conv: any, index: number) => {
                const { otherUser, lastMessage } = conv
                const isMine = lastMessage.sender.id === user?.id
                return (
                  <MessageItem
                    key={otherUser.id}
                    name={otherUser.name || otherUser.username}
                    text={`${isMine ? "You" : otherUser.name}: ${lastMessage.message}`}
                    index={index}
                    timestamp={lastMessage.timestamp}
                    unread={!isMine && lastMessage.hasOwnProperty('is_read') && !lastMessage.is_read}
                    onPress={() => openConversation(otherUser.id, otherUser.name)}
                    avatar={otherUser.avatar}
                  />
                )
              })
            ) : (
              <EmptyState />
            )
          ) : (
            groupConversations.length > 0 ? (
              groupConversations
              .map(group => ({
                ...group,
                lastMessageId: group.last_message?.id || 0
              }))
              .sort((a, b) => b.lastMessageId - a.lastMessageId)
              .map((group: any, index: number) => {
                const groupName = group.group_name || `Group ${group.group_id}`
                const lastMessage = group.last_message
                let text = "No messages yet"
                let timestamp = ""
                let senderName = ""
                let isMine = false
                if (lastMessage) {
                  senderName = lastMessage.sender?.name || lastMessage.sender?.username || "Someone"
                  text = `${isMine ? "You" : senderName}: ${lastMessage.message}`
                  timestamp = lastMessage.timestamp
                  isMine = lastMessage.sender.id === user?.id
                }
                return (
                  <MessageItem
                    key={group.group_id}
                    name={groupName}
                    text={text}
                    index={index}
                    timestamp={timestamp}
                    unread={lastMessage ? lastMessage.hasOwnProperty('is_read') && !lastMessage.is_read : false}
                    onPress={() => openGroupConversation(group.group_id, groupName)}
                  />
                )
              })
            ) : (
              <EmptyState />
            )
          )}
        </ScrollView>

        <TouchableOpacity 
          style={styles.newConversationButton} 
          activeOpacity={0.8} 
          onPress={() => { 
            if (selected == "Groups") { 
              navigation.navigate("Groups", { from: "Messages" }) 
            } 
            else { 
              navigation.navigate("Friends1", { from: "Messages" }) 
            } 
          }}> 
          <LinearGradient 
            colors={["#FFD700", "#FFA500"]} 
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} 
            style={styles.newConversationGradient} > 
            <Ionicons name="add-circle-outline" size={22} color="#FFF" style={styles.newConversationIcon} /> 
            <Text style={styles.newConversationText}>Start New Conversation</Text> 
          </LinearGradient> 
        </TouchableOpacity>
      </View>

      <NavBar
        goToPublicChallenges={() => navigation.navigate("PublicChallenges")}
        goToChallenges={() => navigation.navigate("Challenges")}
        goToGroups={() => navigation.navigate("Groups")}
        goToMessages={() => navigation.navigate("Messages")}
        goToProfile={() => navigation.navigate("Profile")}
        active="Messages"
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
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  headerContainer: {
    marginBottom: 25,
  },
  title: {
    color: "#fff",
    fontSize: 38,
    fontWeight: "800",
    marginBottom: 20,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontSize: 16,
    color: "#333",
  },
  tabContainer: {
    flexDirection: "row",
    marginBottom: 20,
    position: "relative",
    height: 45,
    width: "100%",
    alignSelf: "center",
  },
  tabButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    height: 45,
  },
  tabText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 18,
    fontWeight: "600",
  },
  activeTabText: {
    color: "#FFF",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    height: 3,
    backgroundColor: "#FFD700",
    borderRadius: 3,
    width: "50%",
  },
  scrollViewContainer: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 20,
  },
  messageCard: {
    flexDirection: "row",
    backgroundColor: "rgba(50, 50, 60, 0.3)",
    borderRadius: 16,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  messageAvatarContainer: {
    marginRight: 15,
  },
  messageAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 215, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.3,
    borderColor: "#FFD700",
    overflow: "hidden",
  },
  messageAvatarImg: {
    width: "95%",
    height: "95%",
    borderRadius: 25,
  },
  avatarText: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "700",
  },
  messageContent: {
    flex: 1,
    justifyContent: "center",
  },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  messageName: {
    color: "#FFD700",
    fontSize: 18,
    fontWeight: "700",
  },
  messageTime: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
  },
  messageText: {
    color: "#FFF",
    fontSize: 16,
    opacity: 0.9,
  },
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
  },
  emptyStateText: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "600",
    marginTop: 15,
  },
  emptyStateTextLoading: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 15,
  },
  emptyStateSubText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 16,
    marginTop: 8,
  },
  newConversationButton: {
    height: 65,
    borderRadius: 25,
    overflow: "hidden",
    marginTop: 20,
    marginBottom:-20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  newConversationGradient: {
    width: "100%",
    height: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  newConversationIcon: {
    marginRight: 8,
  },
  newConversationText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
  },
  navBar: {
    backgroundColor: "rgba(33, 31, 38, 0.95)",
    flexDirection: "row",
    height: 80,
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 15,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
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

export default Messages
