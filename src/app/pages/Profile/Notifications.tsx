import React, { useEffect, useState, useRef } from "react"
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ImageBackground, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { NavigationProp } from "@react-navigation/native"
import { useUser } from "../../context/UserContext"
import { getAccessToken } from "../../auth"
import { BASE_URL, endpoints } from "../../api"
import { formatDistanceToNow } from "date-fns"

type Props = {
  navigation: NavigationProp<any>
}

const NotificationsPage: React.FC<Props> = ({ navigation }) => {
  const { user, logout } = useUser()
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const wsRef = useRef<WebSocket | null>(null)

  const fetchNotifications = async () => {
    if (!user?.id) return
    try {
      setLoading(true)
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
      const res = await fetch(endpoints.notifications(Number(user.id)), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      setNotifications(data)
    } catch (e) {
      console.error("Failed to fetch notifications:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [user])

  useEffect(() => {
    if (!user?.id) return
    const wsUrl = `${BASE_URL.replace(/^http/, "ws")}/ws/user/notifications/${user.id}/`
    wsRef.current = new WebSocket(wsUrl)
    wsRef.current.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === "notification_event") {
        setNotifications((prev) => [data, ...prev])
      }
    }
    return () => wsRef.current?.close()
  }, [user])

  const getTimeAgo = (ts: string) =>
    ts ? formatDistanceToNow(new Date(ts), { addSuffix: true }) : ""

  const handlePress = (n: any) => {
    console.log(n)
    if (n.screen === "ChallDetails" || n.screen === "ChallSchedule") {
      navigation.navigate(n.screen as string, {
        challId: n.challengeId || n.challenge_id,
        challName: n.challName,
        whichChall: n.whichChall,
      })
    } 
    else if (n.screen === "Profile") {
      navigation.navigate(n.screen as string, {
        changeTab: true,
      })
    }
    else if (n.screen === "GroupDetails") {
      navigation.navigate(n.screen as string, {
        groupId: n.groupId,
      })
    }
    else if (n.screen === "EditAvailability") {
      navigation.navigate(n.screen as string, {
        groupId: n.groupId,
        pendingChallengeId: n.challengeId, 
        pendingChallengeName: n.challName, 
        pendingChallengeStartDate: n.startDate,
        pendingChallengeEndDate: n.endDate,
        accepted: n.accepted,
      })
    }
    else if (n.screen === "Bets") {
      navigation.navigate(n.screen as string, {
        challId: n.challengeId, 
        challName: n.challName,
        challengeMembers: n.members,
        isCompleted: n.isCompleted,
      })
    }
    else {
      navigation.navigate(n.screen as string)
    }
  }

  const deleteNotification = async (id: number) => {
    const token = await getAccessToken()
    if (!token) {
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
    await fetch(`${BASE_URL}/api/notifications/${id}/delete/`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const confirmDelete = (id: number) => {
    Alert.alert("Delete Notification", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteNotification(id) },
    ])
  }

  return (
    <ImageBackground source={require("../../images/cgpt.png")} style={styles.bg}>
      <View style={styles.container}>
                  <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                  </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size={100} color="#FFF" />
          </View>
        ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {notifications.length > 0 ? (
            notifications.map((n, i) => (
              <TouchableOpacity key={i} style={styles.card} onPress={() => handlePress(n)}>
                <Ionicons name="notifications" size={28} color="#FFD700" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <View style={styles.header}>
                    <Text style={styles.name}>{n.title}</Text>
                    <Text style={styles.time}>{getTimeAgo(n.timestamp)}</Text>
                    <TouchableOpacity onPress={() => confirmDelete(n.id)}>
                      <Ionicons name="close" size={18} color="#FFD700" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.body}>{n.body}</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={60} color="#FFF" />
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          )}
        </ScrollView>
        )}
      </View>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
    backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: { color: "#fff", fontSize: 38, fontWeight: "800", marginBottom: 20 },
  card: {
    flexDirection: "row",
    backgroundColor: "rgba(50,50,60,0.3)",
    padding: 15,
    borderRadius: 16,
    marginBottom: 12,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { color: "#FFD700", fontSize: 18, fontWeight: "700", flex: 1 },
  time: { color: "#FFF", fontSize: 12, marginHorizontal: 6 },
  body: { color: "#FFF", fontSize: 15, marginTop: 4 },
  empty: { alignItems: "center", marginTop: 100 },
  emptyText: { color: "#FFF", marginTop: 10, fontSize: 16 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 80,
  },
})

export default NotificationsPage
