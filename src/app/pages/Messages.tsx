import type React from "react"
import { useState, useEffect } from "react"
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
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { NavigationProp } from "@react-navigation/native"
import { LinearGradient } from "expo-linear-gradient"
import axios from "axios"
import { getAccessToken } from "../auth"

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



  useEffect(() => {
    const fetchMessages = async () => {
      if (!user?.id) return
      try {
              const accessToken = await getAccessToken();
              if (!accessToken) {
                throw new Error("Not authenticated");
              }
        const response = await fetch(endpoints.messages(Number(user.id)), {
                headers: {
                  Authorization: `Bearer ${accessToken}`
                }
              });
        const data = await response.json()
        const friends = data.filter((msg: any) => msg.recipient !== null)
        setFriendMessages(friends)
      } catch (error) {
        console.error("Failed to fetch messages:", error)
      }
    }
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
    Animated.spring(indicatorPosition, {
      toValue: selected === "Friends" ? 0 : selected === "Groups" ? 1 : 2,
      useNativeDriver: false,
      friction: 8,
      tension: 50,
    }).start()
  }, [selected])

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

  const goToMessages = () => navigation.navigate("Messages")
  const goToGroups = () => navigation.navigate("Groups")
  const goToChallenges = () => navigation.navigate("Challenges")
  const goToProfile = () => navigation.navigate("Profile")

  const translateX = indicatorPosition.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, width * 0.425, width * 0.85],
  })

  const getTimeAgo = (timestamp: string) => "2m ago"

  const sendMessage = async () => {
    if (!user?.id || !composeText) return
    setSending(true)
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      if (composeRecipientId) {
        const response = await axios.post(
          `${BASE_URL}/api/messages/send/${composeRecipientId}/`,
          {
            recipient_id: composeRecipientId,
            message: composeText,
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        const newMessage = response.data
        setFriendMessages(prev => [...prev, {
          ...newMessage,
          sender: { id: user.id, username: user.username, name: user.name },
          recipient: { id: composeRecipientId },
        }])
      } else if (composeGroupId) {
          const response = await axios.post(
            `${BASE_URL}/api/messages/send/group/${composeGroupId}/`,
            {
              group_id: composeGroupId,
              message: composeText,
            },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );
        // Optionally, you may want to refresh groupConversations here
      }
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

  const MessageItem: React.FC<{ name: string; text: string; index: number; timestamp?: string; onPress?: () => void }> = ({
    name,
    text,
    index,
    timestamp = "now",
    onPress,
  }) => (
    <TouchableOpacity
      style={[styles.messageCard, { marginTop: index === 0 ? 0 : 12 }]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.messageAvatarContainer}>
        <View style={styles.messageAvatar}>
          <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.messageContent}>
        <View style={styles.messageHeader}>
          <Text style={styles.messageName}>{name}</Text>
          <Text style={styles.messageTime}>{getTimeAgo(timestamp)}</Text>
        </View>
        <Text style={styles.messageText} numberOfLines={1}>
          {text}
        </Text>
      </View>
    </TouchableOpacity>
  )

  const NotificationItem: React.FC<{ notification: any; index: number }> = ({ notification, index }) => (
    <TouchableOpacity style={[styles.messageCard, { marginTop: index === 0 ? 0 : 12 }]} activeOpacity={0.7}>
      <View style={styles.messageAvatarContainer}>
        <View style={styles.messageAvatar}>
          <Ionicons name="notifications" size={24} color="#FFD700" />
        </View>
      </View>
      <View style={styles.messageContent}>
        <View style={styles.messageHeader}>
          <Text style={styles.messageName}>Notification</Text>
          <Text style={styles.messageTime}>{getTimeAgo(notification.timestamp)}</Text>
        </View>
        <Text style={styles.messageText} numberOfLines={2}>
          {notification.message?.message || notification.message || ""}
        </Text>
      </View>
    </TouchableOpacity>
  )

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
                const isMine = lastMessage.sender.id === user?.id
                let text = "No messages yet"
                let timestamp = ""
                let senderName = ""
                if (lastMessage) {
                  senderName = lastMessage.sender?.name || lastMessage.sender?.username || "Someone"
                  text = `${isMine ? "You" : senderName}: ${lastMessage.message}`
                  timestamp = lastMessage.timestamp
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