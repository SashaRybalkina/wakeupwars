import React, { useState, useEffect } from "react"
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import axios from "axios"
import { BASE_URL, endpoints } from "../api"
import { useUser } from "../context/UserContext"

type Props = {
  route: any
  navigation: any
}

const Conversation: React.FC<Props> = ({ route, navigation }) => {
  const { user } = useUser()
  const { recipientId, recipientName, otherUserId, groupId } = route.params
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [csrfToken, setCsrfToken] = useState<string>("")

  useEffect(() => {
    const fetchCsrf = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/csrf-token/`, {
          credentials: "include", // ✅ include cookies if backend sets them
        })
        const data = await res.json()
        setCsrfToken(data.csrfToken)
        console.log("Fetched CSRF token:", data.csrfToken)
      } catch (err) {
        console.error("Failed to fetch CSRF token:", err)
      }
    }
    fetchCsrf()
  }, [])

  useEffect(() => {
    const fetchConversation = async () => {
      if (!user?.id) return;
  
      try {
        let url = "";
        if (groupId) {
          // Fetch group conversation
          url = `${BASE_URL}/api/conversation/group/${groupId}/`;
        } else if (otherUserId) {
          // Fetch direct conversation
          url = `${BASE_URL}/api/conversation/${user.id}/${otherUserId}/`;
        } else return;
  
        const response = await fetch(url);
        const data = await response.json();
        setMessages(data);
      } catch (error) {
        console.error("Failed to fetch conversation:", error);
      }
    }
  
    fetchConversation();
    const interval = setInterval(fetchConversation, 2000);
    return () => clearInterval(interval);
  }, [user, otherUserId, groupId]);   

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
  
    try {
      if (groupId) {
        await axios.post(
          `${BASE_URL}/api/messages/send/group/${groupId}/`,
          { group_id: groupId, message: newMessage },
          {
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
            withCredentials: true,
          }
        );
        setMessages(prev => [...prev, { sender: user, groupId, message: newMessage, timestamp: new Date().toISOString() }]);
      } else if (otherUserId) {
        await axios.post(
          `${BASE_URL}/api/messages/send/${otherUserId}/`,
          { recipient_id: recipientId, message: newMessage },
          {
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
            withCredentials: true,
          }
        );
        setMessages(prev => [...prev, { sender: user, recipient: recipientId, message: newMessage, timestamp: new Date().toISOString() }]);
      }
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  }  

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlatList
        data={messages}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item }) => (
            <View style={[styles.messageBubble, item.sender.id === user.id ? styles.myMessage : styles.theirMessage]}>
              {groupId && item.sender.id !== user.id && (
                <Text style={{ color: "#FFD700", fontWeight: "bold", marginBottom: 2 }}>
                  {item.sender?.name || item.sender?.username || "Unknown"}
                </Text>
              )}
              <Text
                style={item.sender.id === user.id ? styles.myMessageText : styles.messageText}
              >
                {item.message}
              </Text>
            </View>
          )}          
        contentContainerStyle={{ padding: 16, paddingTop: 80 }}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
        />
        <TouchableOpacity onPress={sendMessage} disabled={sending}>
          <Ionicons name="send" size={24} color={sending ? "#ccc" : "#FFD700"} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111" },
  messageBubble: {
    padding: 10,
    borderRadius: 16,
    marginVertical: 5,
    maxWidth: "75%",
  },
  myMessage: { backgroundColor: "#FFD700", alignSelf: "flex-end" },
  theirMessage: { backgroundColor: "#333", alignSelf: "flex-start" },
  messageText: { color: "#fff", fontSize: 16 },
  myMessageText: { color: "#000", fontSize: 16 },
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