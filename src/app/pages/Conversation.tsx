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
  Image,
  Alert,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { BASE_URL, endpoints } from "../api"
import { useUser } from "../context/UserContext"
import { getAccessToken } from "../auth"
import type { NavigationProp } from "@react-navigation/native"
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native"
import axios from "axios"

type Props = {
  route: any
  navigation: NavigationProp<any>
}

const Conversation: React.FC<Props> = ({ route, navigation }) => {
  const { user, logout } = useUser()
  const { otherUserId, groupId, groupName, otherUserName } = route.params

  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [otherProfile, setOtherProfile] = useState<any | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const ws = useRef<WebSocket | null>(null)
  const flatListRef = useRef<FlatList>(null)

  const sendPresence = (action: 'viewing' | 'not_viewing') => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN || !user?.id) return
    const payload: any = { action, viewer_id: user.id }
    if (groupId) payload.group_id = groupId
    else if (otherUserId) { payload.sender_id = user.id; payload.recipient_id = otherUserId }
    try { ws.current.send(JSON.stringify(payload)) } catch (e) {}
  }

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

    ws.current.onopen = () => {
      sendPresence('viewing')
    }

    ws.current.onmessage = async (event: any) => {
      const data = JSON.parse(event.data);
      setMessages(prev => [...prev, data]);
    
      // if (data.sender_id !== user.id) {
      //   try {
      //     const token = await getAccessToken();
      //     await axios.post(`${BASE_URL}/api/messages/mark-read/`, 
      //       groupId ? { group_id: groupId } : { other_user_id: otherUserId },
      //       { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      //     );
      //   } catch (err) {
      //     console.error("Failed to mark new message as read:", err);
      //   }
      // }
    };

    ws.current.onerror = (err: any) => console.error("WebSocket error:", err)

    return () => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        sendPresence('not_viewing')
      }
      ws.current?.close()
    }
  }, [user, otherUserId, groupId])

  useFocusEffect(
    React.useCallback(() => {
      sendPresence('viewing')
      return () => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          sendPresence('not_viewing')
        }
      }
    }, [otherUserId, groupId, user?.id])
  )

  // Fetch other user's profile (for DMs header)
  useEffect(() => {
    const loadProfile = async () => {
      if (!otherUserId) return
      try {
        setProfileLoading(true)
        const token = await getAccessToken()
        if (!token) return
        // Use the all-users endpoint which returns avatar info
        const res = await fetch(endpoints.allUsers(), {
          headers: { Authorization: `Bearer ${token}` },
        })
        const arr = await res.json()
        const match = Array.isArray(arr) ? arr.find((u: any) => Number(u?.id) === Number(otherUserId)) : null
        if (match) setOtherProfile(match)
      } catch (e) {
        console.log("Failed to load user profile", e)
      } finally {
        setProfileLoading(false)
      }
    }
    loadProfile()
  }, [otherUserId])

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

  // Fallback: derive avatar from messages if not loaded yet
  useEffect(() => {
    if (groupId || otherProfile || !messages?.length) return
    const m = messages.find((it: any) => (it?.sender?.id ?? it?.sender_id) === otherUserId)
    if (m?.sender?.avatar) {
      setOtherProfile((prev: any) => prev || { id: otherUserId, username: m.sender.username, name: m.sender.name, avatar: m.sender.avatar })
    }
  }, [messages, groupId, otherProfile, otherUserId])

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
        source={require("../images/cgpt4.png")}
        resizeMode="cover"
        style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {/* Chat Header */}
          <View style={styles.chatHeader}>
            <TouchableOpacity style={styles.headerBack} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </TouchableOpacity>

            {groupId ? (
              <View style={{ flex: 1 }}>
                <Text style={styles.headerName} numberOfLines={1}>{groupName}</Text>
              </View>
            ) : (
              <View style={styles.headerCenterRow}>
                {(() => {
                  const avatarObj = otherProfile?.avatar
                  const avatarPath = avatarObj?.imageUrl || otherProfile?.currentMemoji?.imageUrl || otherProfile?.imageUrl
                  const bg = avatarObj?.backgroundColor || "rgba(255,255,255,0.2)"
                  return (
                    <View style={[styles.headerAvatar, { backgroundColor: bg, justifyContent: 'center', alignItems: 'center' }]}>
                      {avatarPath ? (
                        <Image source={{ uri: `${BASE_URL}${avatarPath}` }} style={{ width: '100%', height: '100%', borderRadius: 17 }} resizeMode="cover" />
                      ) : (
                        <Ionicons name="person" color="#fff" size={18} />
                      )}
                    </View>
                  )
                })()}
                <View style={{ flex: 1 }}>
                  <View style={styles.headerNameRow}>
                    <Text style={styles.headerName} numberOfLines={1} ellipsizeMode="tail">
                      {otherProfile?.name || otherUserName || "Direct Message"}
                    </Text>
                    <TouchableOpacity
                      style={styles.headerChevronBtn}
                      onPress={() => navigation.navigate("Friends3", { friendId: otherUserId })}
                    >
                      <Ionicons name="chevron-forward" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.headerSub} numberOfLines={1}>
                    {otherProfile?.username || `ID: ${otherUserId}`}
                  </Text>
                </View>
              </View>
            )}
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
                          color: "#56608dff",
                          fontWeight: "bold",
                          marginBottom: 2,
                          textShadowColor: "rgba(0,0,0,0.2)",
                          textShadowOffset: { width: 0.5, height: 0.5 },
                          textShadowRadius: 1,
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
          <View style={styles.inputPill}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              placeholderTextColor="#666"
            />
            <TouchableOpacity style={styles.sendInside} onPress={sendMessage} disabled={sending}>
              <Ionicons name="send" size={20} color={sending ? "#888" : "#6a6ca5ff"} />
            </TouchableOpacity>
          </View>
      </ImageBackground>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#89a2d1ff" },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 50,
    paddingBottom: 12,
    borderBottomWidth: 0.8,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  headerBack: {
    padding: 6,
    marginRight: 7,
  },
  headerCenterRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerAvatar: {
    width: 37,
    height: 37,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginRight: 10,
    overflow: "hidden",
    marginTop: 2
  },
  headerName: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 2,
  },
  headerSub: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 13,
    marginLeft: 2,
    marginTop: -1,
  },
  headerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerChevronBtn: {
    marginLeft: -3,
  },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  messageBubble: {
    padding: 10,
    borderRadius: 16,
    marginVertical: 5,
    maxWidth: "75%",
  },
  myMessage: { backgroundColor: "#fff", alignSelf: "flex-end", },
  theirMessage: { backgroundColor: "#d7d8ffff", alignSelf: "flex-start" },
  messageText: { color: "#000", fontSize: 16, fontWeight: 400 },
  myMessageText: { color: "#000", fontSize: 16, fontWeight: 300  },
  inputPill: {
    flexDirection: "row",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 24,
    minHeight: 44,
    paddingLeft: 12,
    paddingRight: 12,
    marginBottom: 12,
    marginTop: 12,
    width: "95%",
    marginLeft: 10,
  },
  input: {
    flex: 1,
    color: "#111",
    paddingVertical: 8,
    fontSize: 15,
    marginLeft: 5,
  },
  sendInside: {
    top: 6,
    width: 49,
    height: 33,
    left: 4,
    borderRadius: 18,
    backgroundColor: "#d7d8ffff",
    alignItems: "center",
    justifyContent: "center",
  },
})

export default Conversation