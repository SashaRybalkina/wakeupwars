import type React from "react"
import { useState, useEffect } from "react"
import { endpoints } from "../api"
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

type Props = {
  navigation: NavigationProp<any>
}

const { width } = Dimensions.get("window")
const inputWidth = Math.min(width * 0.85, 400)

const Messages: React.FC<Props> = ({ navigation }) => {
  const [selected, setSelected] = useState("Friends")
  const { user } = useUser()
  const [friendMessages, setFriendMessages] = useState<any[]>([])
  const [groupMessages, setGroupMessages] = useState<any[]>([])
  const [indicatorPosition] = useState(new Animated.Value(0))

  useEffect(() => {
    const fetchMessages = async () => {
      if (!user?.id) return

      try {
        const response = await fetch(endpoints.messages(Number(user.id)))
        const data = await response.json()

        const friends = data.filter((msg: any) => msg.recipient !== null)
        const groups = data.filter((msg: any) => msg.groupID !== null)

        setFriendMessages(friends)
        setGroupMessages(groups)
      } catch (error) {
        console.error("Failed to fetch messages:", error)
      }
    }

    fetchMessages()
  }, [user])

  useEffect(() => {
    Animated.spring(indicatorPosition, {
      toValue: selected === "Friends" ? 0 : 1,
      useNativeDriver: false,
      friction: 8,
      tension: 50,
    }).start()
  }, [selected])

  const goToMessages = () => {
    navigation.navigate("Messages")
  }

  const goToGroups = () => navigation.navigate("Groups")
  const goToChallenges = () => navigation.navigate("Challenges")
  const goToProfile = () => navigation.navigate("Profile")

  const translateX = indicatorPosition.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width * 0.425],
  })

  const getTimeAgo = (timestamp: string) => {
    return "2m ago"
  }

  const MessageItem: React.FC<{ name: string; text: string; index: number; timestamp?: string }> = ({
    name,
    text,
    index,
    timestamp = "now",
  }) => (
    <TouchableOpacity style={[styles.messageCard, { marginTop: index === 0 ? 0 : 12 }]} activeOpacity={0.7}>
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
          <Animated.View
            style={[
              styles.tabIndicator,
              {
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
          {(selected === "Friends" ? friendMessages : groupMessages).length > 0 ? (
            (selected === "Friends" ? friendMessages : groupMessages).map((message, index) => (
              <MessageItem
                key={index}
                name={message.sender.name || message.sender.username}
                text={message.message}
                index={index}
                timestamp={message.timestamp}
              />
            ))
          ) : (
            <EmptyState />
          )}
        </ScrollView>

        <TouchableOpacity style={styles.newConversationButton} activeOpacity={0.8}>
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
