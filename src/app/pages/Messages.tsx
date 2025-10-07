import type React from "react"
import { useState, useEffect, useRef } from "react"
import { BASE_URL, endpoints } from "../api"
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
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { NavigationProp } from "@react-navigation/native"
import { LinearGradient } from "expo-linear-gradient"
import axios from "axios"
import * as Notifications from 'expo-notifications'
import {formatDistanceToNow} from 'date-fns'

type Props = {
  navigation: NavigationProp<any>
}

const { width } = Dimensions.get("window")

const Messages: React.FC<Props> = ({ navigation }) => {
  const [selected, setSelected] = useState("Friends")
  const { user } = useUser()
  const [friendMessages, setFriendMessages] = useState<any[]>([])
  const [groupConversations, setGroupConversations] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [indicatorPosition] = useState(new Animated.Value(0))
  const [composeVisible, setComposeVisible] = useState(false)
  const [composeText, setComposeText] = useState("")
  const [composeRecipientId, setComposeRecipientId] = useState("")
  const [composeGroupId, setComposeGroupId] = useState("")
  const [sending, setSending] = useState(false)
  const [csrfToken, setCsrfToken] = useState<string>("")
  const wsNotification = useRef<WebSocket | null>(null)
  const wsPrivate = useRef<WebSocket | null>(null)
  const wsGroups = useRef<WebSocket | null>(null)

  useEffect(() => {
    const fetchCsrf = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/csrf-token/`, { credentials: "include" })
        const data = await res.json()
        setCsrfToken(data.csrfToken)
      } catch (err) {
        console.error("Failed to fetch CSRF token:", err)
      }
    }
    fetchCsrf()
  }, [])

  const fetchMessages = async () => {
    if (!user?.id) return
    try {
      const response = await fetch(endpoints.messages(Number(user.id)))
      const data = await response.json()
      const friends = data.filter((msg: any) => msg.recipient !== null)
      setFriendMessages(friends)
    } catch (error) {
      console.error("Failed to fetch messages:", error)
    }
  }

  useEffect(() => {
    fetchMessages()
  }, [user])

  useEffect(() => {
    const fetchGroupConversations = async () => {
      if (!user?.id) return
      try {
        const response = await fetch(`${BASE_URL}/api/user/${user.id}/group-conversations/`)
        const data = await response.json()
        setGroupConversations(data)
      } catch (error) {
        console.error("Failed to fetch group conversations:", error)
      }
    }
    fetchGroupConversations()
  }, [user])

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user?.id) return
      try {
        const response = await fetch(endpoints.notifications(Number(user.id)))
        const data = await response.json()
        setNotifications(data)
      } catch (error) {
        console.error('Failed to fetch notifications:', error)
      }
    }
    fetchNotifications()
  }, [user])

  useEffect(() => {
    const registerForPushNotifications = async () => {
      const { status: existingStatus } = await Notifications.getPermissionsAsync()
      let finalStatus = existingStatus
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }
      if (finalStatus !== 'granted') {
        alert('Failed to get push token for push notification!')
        return
      }
      const tokenData = await Notifications.getExpoPushTokenAsync()
      const pushToken = tokenData.data
      // Send pushToken to your backend for this user
      if (user?.id && pushToken) {
        try {
          await fetch(`${BASE_URL}/api/save-push-token/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ user_id: user.id, push_token: pushToken }),
          })
        } catch (err) {
          console.error('Failed to save push token:', err)
        }
      }
    }
    registerForPushNotifications()
  }, [user])

  useEffect(() => {
    Animated.spring(indicatorPosition, {
      toValue: selected === "Friends" ? 0 : selected === "Groups" ? 1 : 2,
      useNativeDriver: false,
      friction: 8,
      tension: 50,
    }).start()
  }, [selected])

  useEffect(() => {
    if (!user?.id) return;
    // Notifications WebSocket
    const wsUrlNotif = `${BASE_URL.replace(/^http/, "ws")}/ws/notifications/${user.id}/`;
    wsNotification.current = new WebSocket(wsUrlNotif);
    wsNotification.current.onmessage = (event: any) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "notification_event") {
          setNotifications((prev) => [data, ...prev]);
        }
      } catch (e) {
        console.error("WebSocket notification parse error:", e);
      }
    };
    wsNotification.current.onerror = (err: any) => {
      console.error("WebSocket notification error:", err);
    };
    wsNotification.current.onclose = () => {};

    // Private messages WebSocket (aggregate all 1-1 chats for this user)
    const wsUrlPrivate = `${BASE_URL.replace(/^http/, "ws")}/ws/chat/${user.id}/${user.id}/`;
    wsPrivate.current = new WebSocket(wsUrlPrivate);
    wsPrivate.current.onmessage = (event: any) => {
      try {
        const data = JSON.parse(event.data);
        setFriendMessages((prev) => [...prev, data]);
      } catch (e) {
        console.error("WebSocket private message parse error:", e);
      }
    };
    wsPrivate.current.onerror = (err: any) => {
      console.error("WebSocket private message error:", err);
    };
    wsPrivate.current.onclose = () => {};

    // Group messages WebSocket (aggregate all groups for this user)
    // You may want to open a socket for each group, but here is a single example for groupId=0 (broadcast)
    const wsUrlGroups = `${BASE_URL.replace(/^http/, "ws")}/ws/chat/group/0/`;
    wsGroups.current = new WebSocket(wsUrlGroups);
    wsGroups.current.onmessage = (event: any) => {
      try {
        const data = JSON.parse(event.data);
        setGroupConversations((prev) => [...prev, data]);
      } catch (e) {
        console.error("WebSocket group message parse error:", e);
      }
    };
    wsGroups.current.onerror = (err: any) => {
      console.error("WebSocket group message error:", err);
    };
    wsGroups.current.onclose = () => {};

    return () => {
      wsNotification.current?.close();
      wsPrivate.current?.close();
      wsGroups.current?.close();
    };
  }, [user]);

  const getConversations = (messages: any[]) => {
    const conversations: Record<string, any> = {}
    messages.forEach((msg) => {
      const otherUser = msg.sender.id === user?.id ? msg.recipient : msg.sender
      if (!otherUser) return
      const conversationId = otherUser.id
      if (
        !conversations[conversationId] ||
        new Date(msg.timestamp) > new Date(conversations[conversationId].timestamp)
      ) {
        conversations[conversationId] = {
          otherUser,
          lastMessage: msg,
        }
      }
    })
    return Object.values(conversations).sort(
      (a: any, b: any) =>
        new Date(b.lastMessage.timestamp).getTime() -
        new Date(a.lastMessage.timestamp).getTime()
    )
  }

  const openConversation = (message: any) => {
    const otherUserId = message.sender.id === user?.id ? message.recipient.id : message.sender.id
    navigation.navigate("Conversation", { otherUserId })
  }

  const openGroupConversation = (groupId: number, groupName: string) => {
    navigation.navigate("Conversation", { groupId, recipientName: groupName })
  }

  const handleNotificationPress = (notification: any) => {
    console.log(notification.screen);
    if (notification.type === 'friend_request' || notification.type === 'group_add') {
      navigation.navigate(notification.screen as string);
    } else {
        navigation.navigate({
          name: notification.screen as string,
          params: { 
            challengeId: notification.challengeId, 
            challName: notification.challName, 
            whichChall: notification.whichChall 
          }
        });
    }
  }

  const goToMessages = () => navigation.navigate("Messages")
  const goToGroups = () => navigation.navigate("Groups")
  const goToChallenges = () => navigation.navigate("Challenges")
  const goToProfile = () => navigation.navigate("Profile")

  const translateX = indicatorPosition.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, width * 0.425, width * 0.85],
  })

  const getTimeAgo = (timestamp: string) => {
    if (!timestamp) return ""
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
  }

  const sendMessage = async () => {
    if (!user?.id || !composeText) return
    setSending(true)
    try {
      if (composeRecipientId) {
        const response = await axios.post(
          `${BASE_URL}/api/messages/send/${composeRecipientId}/`,
          { recipient_id: composeRecipientId, message: composeText },
          { headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken }, withCredentials: true }
        )
        const newMessage = response.data
        setFriendMessages(prev => [...prev, {
          ...newMessage,
          sender: { id: user.id, username: user.username, name: user.name },
          recipient: { id: composeRecipientId },
        }])
      } else if (composeGroupId) {
        const response = await axios.post(
          `${BASE_URL}/api/messages/send/group/${composeGroupId}/`,
          { group_id: composeGroupId, message: composeText },
          { headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken }, withCredentials: true }
        )
        // Optionally, you may want to refresh groupConversations here
      }
      await fetchMessages()
      setComposeText("")
      setComposeRecipientId("")
      setComposeGroupId("")
      setComposeVisible(false)
    } catch (error) {
      console.error("Failed to send message:", error)
    } finally {
      setSending(false)
    }
  }

  const MessageItem: React.FC<{ name: string; text: string; index: number; timestamp: string; onPress?: () => void }> = ({
    name,
    text,
    index,
    timestamp,
    onPress,
  }) => (
    <TouchableOpacity
      style={[styles.messageCard, { marginTop: index === 0 ? 0 : 12 }]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.messageAvatarContainer}>
        <View style={styles.messageAvatar}>
          <Text style={styles.avatarText}>{name ? name.charAt(0).toUpperCase() : "?"}</Text>
        </View>
      </View>
      <View style={styles.messageContent}>
        <View style={styles.messageHeader}>
          <Text style={styles.messageName}>{name}</Text>
          <Text style={styles.messageTime}>{getTimeAgo(timestamp)}</Text>
          {/* <Text style={styles.messageTime}>N/A</Text> */}
        </View>
        <Text style={styles.messageText} numberOfLines={1}>
          {text}
        </Text>
      </View>
    </TouchableOpacity>
  )

  const NotificationItem: React.FC<{ notification: any; index: number }> = ({ 
    notification, 
    index, 
  }) => {
  
    const confirmDelete = (id: number) => {
      Alert.alert(
        "Delete Notification",
        "Are you sure you want to delete this notification?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => deleteNotification(id) }
        ]
      )
    }
  
    const deleteNotification = async (id: number) => {
      try {
        const response = await fetch(`${BASE_URL}/api/notifications/${id}/delete/`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
          },
          credentials: "include",
        })
    
        if (!response.ok) {
          throw new Error(`Failed with status ${response.status}`)
        }
    
        setNotifications(prev => prev.filter(n => n.id !== id))
      } catch (err) {
        console.error("Failed to delete notification:", err)
        Alert.alert("Error", "Could not delete notification. Please try again.")
      }
    }    
  
    return (
      <TouchableOpacity
        style={[styles.messageCard, { marginTop: index === 0 ? 0 : 12 }]}
        activeOpacity={0.7}
        onPress={() => handleNotificationPress(notification)}
      >
        <View style={styles.messageAvatarContainer}>
          <View style={styles.messageAvatar}>
            <Ionicons name="notifications" size={24} color="#FFD700" />
          </View>
        </View>
        <View style={styles.messageContent}>
          <View style={styles.messageHeader}>
            <Text style={styles.messageName}>{notification.title}</Text>
            <Text style={styles.messageTime}>{getTimeAgo(notification.timestamp)}</Text>
            <TouchableOpacity onPress={() => confirmDelete(notification.id)}>
              <Ionicons name="close" size={20} color="#FFD700" />
            </TouchableOpacity>
          </View>
          <Text style={styles.messageText} numberOfLines={2}>
            {notification.body}
          </Text>
        </View>
      </TouchableOpacity>
    )
  }  

  const EmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Ionicons name="chatbubble-ellipses-outline" size={70} color="rgba(255,255,255,0.5)" />
      <Text style={styles.emptyStateText}>No messages yet</Text>
      <Text style={styles.emptyStateSubText}>Start a conversation to connect</Text>
    </View>
  )

  return (
    <ImageBackground source={require("../images/cgpt.png")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Messages</Text>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
            <TextInput style={styles.searchInput} placeholder="Search messages" placeholderTextColor="#999" />
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity style={styles.tabButton} onPress={() => setSelected("Friends")} activeOpacity={0.7}>
            <Text style={[styles.tabText, selected === "Friends" && styles.activeTabText]}>Friends</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabButton} onPress={() => setSelected("Groups")} activeOpacity={0.7}>
            <Text style={[styles.tabText, selected === "Groups" && styles.activeTabText]}>Groups</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabButton} onPress={() => setSelected("Notifications")} activeOpacity={0.7}>
            <Text style={[styles.tabText, selected === "Notifications" && styles.activeTabText]}>Notifications</Text>
          </TouchableOpacity>
          <Animated.View
            style={[
              styles.tabIndicator,
              {
                width: "33.3%",
                transform: [{ translateX }],
              },
            ]}
          />
        </View>

        <ScrollView
          style={styles.scrollViewContainer}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
        >
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
                    onPress={() => openConversation(lastMessage)}
                  />
                )
              })
            ) : (
              <EmptyState />
            )
          ) : selected === "Groups" ? (
            groupConversations.length > 0 ? (
              groupConversations.map((group: any, index: number) => {
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
                    onPress={() => openGroupConversation(group.group_id, groupName)}
                  />
                )
              })
            ) : (
              <EmptyState />
            )
          ) : (
            notifications.length > 0 ? (
              notifications.map((notification, index) => (
                <NotificationItem key={index} notification={notification} index={index} />
              ))
            ) : (
              <EmptyState />
            )
          )}
        </ScrollView>

        <TouchableOpacity style={styles.newConversationButton} activeOpacity={0.8} onPress={() => setComposeVisible(true)}>
          <LinearGradient
            colors={["#FFD700", "#FFA500"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.newConversationGradient}
          >
            <Ionicons name="add-circle-outline" size={22} color="#FFF" style={styles.newConversationIcon} />
            <Text style={styles.newConversationText}>Start New Conversation</Text>
          </LinearGradient>
        </TouchableOpacity>

        {composeVisible && (
          <View style={{ position: "absolute", top: 100, left: 20, right: 20, backgroundColor: "#222", borderRadius: 16, padding: 20, zIndex: 10 }}>
            <Text style={{ color: "#FFD700", fontSize: 18, fontWeight: "700", marginBottom: 10 }}>New Message</Text>
            <TextInput
              style={{ backgroundColor: "#fff", borderRadius: 8, padding: 10, marginBottom: 10, color: "#333" }}
              placeholder="Recipient ID (leave blank if sending to a group)"
              value={composeRecipientId}
              onChangeText={setComposeRecipientId}
              keyboardType="numeric"
            />
            <TextInput
              style={{ backgroundColor: "#fff", borderRadius: 8, padding: 10, marginBottom: 10, color: "#333" }}
              placeholder="Group ID (leave blank if sending to a friend)"
              value={composeGroupId}
              onChangeText={setComposeGroupId}
              keyboardType="numeric"
            />
            <TextInput
              style={{ backgroundColor: "#fff", borderRadius: 8, padding: 10, marginBottom: 10, color: "#333" }}
              placeholder="Type your message..."
              value={composeText}
              onChangeText={setComposeText}
              multiline
            />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <TouchableOpacity onPress={() => setComposeVisible(false)} style={{ padding: 10 }}>
                <Text style={{ color: "#999" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={sendMessage} style={{ padding: 10 }} disabled={sending}>
                <Text style={{ color: sending ? "#ccc" : "#FFD700", fontWeight: "700" }}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navButton} onPress={goToChallenges}>
          <Ionicons name="star-outline" size={28} color="#FFF" />
          <Text style={styles.navText}>Challenges</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={goToGroups}>
          <Ionicons name="people-outline" size={28} color="#FFF" />
          <Text style={styles.navText}>Groups</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={goToMessages}>
          <Ionicons name="mail" size={28} color="#FFD700" />
          <Text style={styles.activeNavText}>Messages</Text>
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
    elevation: 2,
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
    elevation: 2,
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
    borderWidth: 2,
    borderColor: "#FFD700",
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
  emptyStateSubText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 16,
    marginTop: 8,
  },
  newConversationButton: {
    height: 65,
    borderRadius: 25,
    overflow: "hidden",
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
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