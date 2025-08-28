import React, { useEffect, useState } from "react"
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native"
import { NavigationProp, useNavigation, useRoute } from "@react-navigation/native"
import { Ionicons } from "@expo/vector-icons"
import { endpoints } from "../../api"
import { useUser } from "../../context/UserContext"

type Props = {
  navigation: NavigationProp<any>
}

type PendingChallenge = {
  id: number
  name: string
  endDate: string
  groupID: number
}

const ChallengeInvites: React.FC<Props> = ({ navigation }) => {
  const route = useRoute()
  const { groupId } = route.params as { groupId: number }
  const { user } = useUser()

  const [invites, setInvites] = useState<PendingChallenge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) {
        console.error("userId is missing!");
        return;
    }

    const fetchInvites = async () => {
      try {
        const response = await fetch(endpoints.challengeInvites(Number(user.id), groupId))
        const data = await response.json()
        setInvites(data)
      } catch (err) {
        console.error("Failed to fetch invites:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchInvites()
  }, [user])

  const handlePress = (challenge: PendingChallenge) => {
    navigation.navigate("EditAvailability", {
      pendingChallengeId: challenge.id,
    })
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading invites...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pending Challenge Invites</Text>
      {invites.length === 0 ? (
        <Text style={styles.noInvites}>No pending invites</Text>
      ) : (
        <FlatList
          data={invites}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => handlePress(item)}>
              <Ionicons name="alarm-outline" size={24} color="#333" style={{ marginRight: 10 }} />
              <Text style={styles.cardText}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A1A1A",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFF",
    marginBottom: 20,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  cardText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#FFF",
    fontSize: 16,
    marginTop: 10,
  },
  noInvites: {
    color: "#999",
    fontSize: 16,
    textAlign: "center",
    marginTop: 50,
  },
})

export default ChallengeInvites
