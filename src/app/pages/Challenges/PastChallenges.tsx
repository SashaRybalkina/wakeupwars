import React, { useCallback, useState } from "react"
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useFocusEffect, type NavigationProp, useRoute } from "@react-navigation/native"
import { useUser } from "../../context/UserContext"
import { endpoints } from "../../api"
import { getAccessToken } from "../../auth"
import ChallengeCard from "./ChallengeCard"
import PublicChallengeCard from "./PublicChallengeCard"

 type Props = {
  navigation: NavigationProp<any>
 }

 type RouteParams = {
  type: 'Personal' | 'Group' | 'Public'
  groupId?: number
 }

 const PastChallenges: React.FC<Props> = ({ navigation }) => {
  const route = useRoute()
  const { type, groupId } = route.params as RouteParams
  const { user } = useUser()

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<any[]>([])

  useFocusEffect(
    useCallback(() => {
      const run = async () => {
        try {
          setLoading(true)
          const accessToken = await getAccessToken();
          if (!accessToken) throw new Error('Not authenticated')

          if (type === 'Personal') {
            const res = await fetch(endpoints.challengeList(Number(user!.id), 'Personal'), {
              headers: { Authorization: `Bearer ${accessToken}` },
            })
            const data = await res.json()
            const past = (data || []).filter((c: any) => c.isCompleted)
            setItems(past)
          } else if (type === 'Group') {
            if (!groupId) throw new Error('groupId is required for Group past challenges')
            const res = await fetch(endpoints.groupProfile(groupId), {
              headers: { Authorization: `Bearer ${accessToken}` },
            })
            const data = await res.json()
            const past = (data?.challenges || []).filter((c: any) => c.isCompleted)
            setItems(past)
          } else if (type === 'Public') {
            const res = await fetch(endpoints.getPublicChallenges(Number(user!.id)), {
              headers: { Authorization: `Bearer ${accessToken}` },
            })
            const data = await res.json()
            const past = (data || []).filter((c: any) => c.isCompleted)
            setItems(past)
          }
        } catch (e) {
          console.error('Failed to load past challenges:', e)
          setItems([])
        } finally {
          setLoading(false)
        }
      }
      if (user?.id) run()
    }, [user?.id, type, groupId])
  )

  const goToMessages = () => navigation.navigate("Messages")
  const goToGroups = () => navigation.navigate("Groups")
  const goToChallenges = () => navigation.navigate("Challenges")
  const goToProfile = () => navigation.navigate("Profile")

  return (
    <ImageBackground source={require("../../images/cgpt.png")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.headerSection}>
          <Text style={styles.sectionTitle}>Past Challenges</Text>
          <View style={styles.decorativeLine} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFD700" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
            {items.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Ionicons name="time-outline" size={40} color="rgba(255,255,255,0.7)" />
                <Text style={styles.emptyStateText}>No past challenges</Text>
              </View>
            ) : (
              <View style={styles.challengeCardsContainer}>
                {items.map((c: any) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.challengeCardWrapper}
                    onPress={() =>
                      navigation.navigate('ChallDetails', {
                        challId: c.id,
                        challName: c.name,
                        whichChall: type === 'Public' ? 'Public' : (type === 'Group' ? 'Group' : 'Personal'),
                        isCompleted: true,
                      })
                    }
                  >
                    {type === 'Public' ? (
                      <PublicChallengeCard
                        title={c.name}
                        icon={require("../../images/school.png")}
                        startDate={c.startDate}
                        endDate={c.endDate}
                        daysOfWeek={c.daysOfWeek}
                        daysCompleted={c.daysCompleted}
                        totalDays={c.totalDays || 30}
                        isCompleted={true}
                        categories={c.categories}
                        averageSkillLevel={c.averageSkillLevel}
                      />
                    ) : (
                      <ChallengeCard
                        title={c.name}
                        icon={require("../../images/school.png")}
                        startDate={c.startDate}
                        endDate={c.endDate}
                        daysOfWeek={c.daysOfWeek}
                        daysCompleted={c.daysCompleted}
                        totalDays={c.totalDays || 30}
                        isCompleted={true}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </ImageBackground>
  )
 }

 const styles = StyleSheet.create({
  background: { flex: 1 },
  container: { flex: 1, paddingTop: 50 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 20,
  },
  headerSection: { alignItems: 'center', marginTop: -5, marginBottom: 10, paddingHorizontal: 10 },
  sectionTitle: { fontSize: 30, fontWeight: '700', color: '#FFF', marginTop: 10, marginBottom: 6, textShadowColor: 'rgba(0, 0, 0, 0.3)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 2 },
  decorativeLine: { width: 60, height: 4, backgroundColor: '#FFD700', borderRadius: 2, marginBottom: 10 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#FFF', fontSize: 18, fontWeight: '600' },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingBottom: 100, paddingHorizontal: 20 },
  emptyStateContainer: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: 15, padding: 30 },
  emptyStateText: { color: '#FFF', fontSize: 18, fontWeight: '600', marginTop: 10 },
  challengeCardsContainer: { width: '100%' },
  challengeCardWrapper: {
    marginBottom: 15,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },  
 })

 export default PastChallenges