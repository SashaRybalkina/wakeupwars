import React, { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ImageBackground,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { BASE_URL } from "../api"
import { useUser } from "../context/UserContext"
import { getAccessToken } from "../auth"
import AsyncStorage from "@react-native-async-storage/async-storage";

type Props = {
  route: any
  navigation: any
}

const Conversation: React.FC<Props> = ({ route }) => {
  const { user } = useUser()
  const { otherUserId, groupId, groupName, otherUserName } = route.params

  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  const ws = useRef<WebSocket | null>(null)
  const flatListRef = useRef<FlatList>(null)

  // Connect WebSocket
  useEffect(() => {
    if (!user?.id) return

    let url = ""
    if (groupId) {
      url = `${BASE_URL.replace(/^http/, "ws")}/ws/chat/group/${groupId}/`
    } else if (otherUserId) {
      const ids = [user.id, otherUserId].sort((a, b) => a - b)
      url = `${BASE_URL.replace(/^http/, "ws")}/ws/chat/${ids[0]}/${ids[1]}/`
    } else return

    ws.current = new WebSocket(url)

    ws.current.onmessage = (event: any) => {
      const data = JSON.parse(event.data)
      setMessages((prev) => [...prev, data])
    }

    ws.current.onerror = (err: any) => console.error("WebSocket error:", err)

    return () => {
      ws.current?.close()
    }
  }, [user, otherUserId, groupId])

  // Fetch conversation
  useEffect(() => {
    const fetchConversation = async () => {
      if (!user?.id) return
      setLoading(true)
      try {
        let url = ""
        if (groupId) {
          url = `${BASE_URL}/api/conversation/group/${groupId}/`
        } else if (otherUserId) {
          url = `${BASE_URL}/api/conversation/${user.id}/${otherUserId}/`
        } else return

        const accessToken = await getAccessToken()
        if (!accessToken) throw new Error("Not authenticated")

        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        })
        const data = await response.json()
        setMessages(data)
      } catch (error) {
        console.error("Failed to fetch conversation:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchConversation()
  }, [user, otherUserId, groupId])


  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true })
    }
  }, [messages])
  

  const sendMessage = async () => {
    if (!newMessage.trim() || !user?.id) return
    setSending(true)
    try {
      const msgObj: any = {
        message: newMessage,
        sender_id: user.id,
        timestamp: new Date().toISOString(),
      }

      if (groupId) msgObj.group_id = groupId
      else if (otherUserId) msgObj.recipient_id = otherUserId

      ws.current?.send(JSON.stringify(msgObj))
      setNewMessage("")
    } catch (error) {
      console.error("Failed to send message:", error)
    } finally {
      setSending(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ImageBackground 
        source={require("../images/messages.png")}
        resizeMode="cover"
        style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {/* Banner */}
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              {groupId ? groupName : otherUserName}
            </Text>
          </View>

          {/* Loading Indicator */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size={100} color="#FFF" />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(_: any, index: number) => index.toString()}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.messageBubble,
                    item.sender_id === user.id ||
                    (item.sender && item.sender.id === user.id)
                      ? styles.myMessage
                      : styles.theirMessage,
                  ]}
                >
                  {groupId &&
                    (item.sender?.name || item.sender?.username) &&
                    item.sender?.id !== user.id && (
                      <Text
                        style={{
                          color: "#FFD700",
                          fontWeight: "bold",
                          marginBottom: 2,
                        }}
                      >
                        {item.sender?.name || item.sender?.username || "Unknown"}
                      </Text>
                    )}

                  <Text
                    style={
                      item.sender_id === user.id ||
                      (item.sender && item.sender.id === user.id)
                        ? styles.myMessageText
                        : styles.messageText
                    }
                  >
                    {item.message}
                  </Text>
                </View>
              )}
              contentContainerStyle={{ padding: 16, paddingTop: 10 }}
              onContentSizeChange={() =>
                flatListRef.current?.scrollToEnd({ animated: false })
              }
            />
          )}
        </View>

        {/* Input Field */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            placeholderTextColor="#888"
          />
          <TouchableOpacity onPress={sendMessage} disabled={sending}>
            <Ionicons name="send" size={24} color={sending ? "#ccc" : "#FFD700"} />
          </TouchableOpacity>
        </View>
      </ImageBackground>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111" },
  banner: {
    padding: 16,
    backgroundColor: "#497ead",
    alignItems: "center",
  },
  bannerText: { color: "#FFD700", fontSize: 22, fontWeight: "bold" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  messageBubble: {
    padding: 10,
    borderRadius: 16,
    marginVertical: 5,
    maxWidth: "75%",
  },
  myMessage: { backgroundColor: "#FFD700", alignSelf: "flex-end", },
  theirMessage: { backgroundColor: "#653582", alignSelf: "flex-start" },
  messageText: { color: "#fff", fontSize: 16 },
  myMessageText: { color: "#000", fontSize: 16, fontWeight: "bold" },
  inputContainer: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "#333",
    backgroundColor: "#222",
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: "#333",
    color: "#fff",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10,
  },
})

export default Conversation