import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { BASE_URL, endpoints } from "../../api"
import { ImageBackground, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { type NavigationProp, useRoute } from "@react-navigation/native"
import { LinearGradient } from "expo-linear-gradient"
import ChallengeCard from "../Challenges/ChallengeCard"
import PendingChallengeCard from "../Challenges/PendingChallengeCard"
import { useFocusEffect } from "@react-navigation/native"
import { ActivityIndicator } from "react-native"
import { useUser } from "../../context/UserContext"
import { getAccessToken } from "../../auth"
import NavBar from "../Components/NavBar"

type Props = {
  navigation: NavigationProp<any>
}

type Challenge = {
  id: number
  name: string
  startDate: string
  endDate: string
  isGroupChallenge: boolean
  daysOfWeek: string[]
  daysCompleted: number
  totalDays?: number
  isCompleted?: boolean
}

type PendingChallenge = {
  id: number
  name: string
  startDate: string
  endDate: string
  accepted: number
  initiatorId: number | null
}

type LeaderRow = { name: string; points: number; rank: number }

// type InviteStatus = {
//   id: number;
//   accepted: number;
// };

type GroupData = {
  id: number
  name: string
  challenges: Challenge[]
  members: {
    id: number;
    name: string;
    avatar?: {
      id: number;
      imageUrl: string;
      backgroundColor: string;
    };
  }[];
}

const GroupDetails: React.FC<Props> = ({ navigation }) => {
  const route = useRoute()
  const { groupId } = route.params as { groupId: number }
  
  const { user, activeGroupName, setActiveGroupName, setActiveGroupId, logout } = useUser()

  const [groupData, setGroupData] = useState<GroupData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [pendingChallenges, setPendingChallenges] = useState<PendingChallenge[]>([]);

  // group leaderboard state
  const [lbRows, setLbRows] = useState<LeaderRow[]>([])
  const [lbSince, setLbSince] = useState<string | null>(null)
  const [lbUntil, setLbUntil] = useState<string | null>(null)
  const [lbLoading, setLbLoading] = useState(false)
  const [lbError, setLbError] = useState<string | null>(null)



useFocusEffect(
  useCallback(() => {
    if (!user?.id) {
      console.error("userId is missing!");
      return;
    }

    console.log("[GroupDetails] focus triggered, starting fetch");
      setActiveGroupId(groupId);
    setIsLoading(true);

    const fetchGroupData = async () => {
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

        // Start all fetches concurrently
        const [groupRes, lbRes, inviteRes] = await Promise.allSettled([
          fetch(endpoints.groupProfile(groupId), { headers: { Authorization: `Bearer ${accessToken}` } }),
          fetch(endpoints.groupLeaderboard(groupId), { headers: { Authorization: `Bearer ${accessToken}` } }),
          fetch(endpoints.getChallengeInvites(Number(user.id), groupId), { headers: { Authorization: `Bearer ${accessToken}` } }),
        ]);

        // --- Group Data ---
        if (groupRes.status === "fulfilled") {
          const data = await groupRes.value.json();
          if (data.challenges) {
            const now = new Date();
            data.challenges = data.challenges.map((challenge: Challenge) => ({
              ...challenge,
              totalDays: challenge.totalDays ?? 30,
              isCompleted: challenge.isCompleted || false,
            }));
          }
          setGroupData(data);          
          setActiveGroupName(data?.name ?? null)

        } else {
          console.error("Failed to fetch group profile:", groupRes.reason);
        }

        // --- Leaderboard ---
        if (lbRes.status === "fulfilled") {
          setLbLoading(true);
          setLbError(null);
          try {
            const text = await lbRes.value.text();
            const d: any = text ? JSON.parse(text) : null;
            const rows: LeaderRow[] = Array.isArray(d) ? d : (d?.leaderboard ?? []);
            setLbRows(rows);
            setLbSince(d?.since ?? null);
            setLbUntil(d?.until ?? null);
          } catch (e) {
            setLbError("Failed to parse leaderboard");
          } finally {
            setLbLoading(false);
          }
        } else {
          console.error("Failed to fetch leaderboard:", lbRes.reason);
          setLbError("Failed to load leaderboard");
        }

        // --- Pending Invites ---
        if (inviteRes.status === "fulfilled") {
          const inviteData = await inviteRes.value.json();
          const formatted = inviteData.invited_challenges.map(
            (item: PendingChallenge) => ({
              id: item.id,
              name: item.name,
              startDate: item.startDate,
              endDate: item.endDate,
              accepted: item.accepted,
              initiatorId: item.initiatorId,
            })
          );
          setPendingChallenges(formatted);
        } else {
          console.error("Failed to fetch invites:", inviteRes.reason);
        }

      } catch (error) {
        console.error("Failed to fetch group details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroupData();
  }, [user?.id, groupId])
);


  const handleDelete = async (challId: number) => {
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

      const res = await fetch(endpoints.deleteChallenge(challId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${accessToken}`,
        },
      });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.message || "Failed to delete challenge");
          }
          console.log('Challenge deleted:', data);

                // Remove from local state
                setPendingChallenges((prev) =>
                  prev.filter((c) => c.id !== challId)
                );


    } catch (err) {
      console.error("Failed to delete challenge:", err)
      Alert.alert("Error", "Failed to delete challenge.")
    }
  }

    
  const goToMessages = () => navigation.navigate("Messages")
  const goToGroups = () => navigation.navigate("Groups")
  const goToChallenges = () => navigation.navigate("Challenges")
  const goToProfile = () => navigation.navigate("Profile")

  const currentChallenges = groupData?.challenges?.filter((c) => !c.isCompleted) ?? []
  const pastChallenges = groupData?.challenges?.filter((c) => c.isCompleted) ?? []

  // Get member initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  // Get random pastel color for member avatars
  const getRandomPastelColor = (seed: number) => {
    const hue = (seed * 137.5) % 360
    return `hsl(${hue}, 70%, 80%)`
  }

  const myName = user?.username || user?.name || ""
  const getRankEmoji = (rank: number): string => (rank === 1 ? "👑" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`)
  const displayRows = (): Array<LeaderRow | { ellipsis: true }> => {
    if (!lbRows.length) return []
    const top3 = lbRows.slice(0, 3)
    const me = lbRows.find(r => r.name === myName)
    if (!me || me.rank <= 3) return top3
    return [...top3, { ellipsis: true } as const, me]
  }

  return (
    <ImageBackground source={require("../../images/cgpt.png")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>

        <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerSection}>
              <Text style={styles.groupTitle}>{activeGroupName ?? groupData?.name ?? "Group"}</Text>
              <View style={styles.decorativeLine} />
            </View>

            <View style={styles.membersSection}>
              <Text style={styles.sectionTitle}>Members</Text>
              <View style={styles.membersRow}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.membersScrollContent}
                >
                  {isLoading || !groupData?.members ? (
                    <View style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
                      <ActivityIndicator size="small" color="#FFD700" />
                    </View>
                  ) : groupData.members.length === 0 ? (
                    <Text style={{ color: '#fff' }}>No members yet</Text>
                  ) : (
                    groupData.members.map((member) => {
                      const bgColor = member.avatar?.backgroundColor ?? getRandomPastelColor(member.id);
                      return (
                        <View key={member.id} style={styles.memberContainer}>
                          <View style={[styles.memberAvatar, { backgroundColor: bgColor }]}> 
                            {member.avatar?.imageUrl ? (
                              <Image
                                source={{ uri: `${BASE_URL}${member.avatar.imageUrl}` }}
                                style={styles.memberAvatarImage}
                                resizeMode="contain"
                              />
                            ) : (
                              <Text style={styles.memberInitials}>{getInitials(member.name)}</Text>
                            )}
                          </View>
                          <Text style={styles.memberName}>{member.name}</Text>
                        </View>
                      );
                    })
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={styles.addMemberButton}
                  onPress={() => navigation.navigate("Friends1", { groupId: Number(groupId) })}
                >
                  <View style={styles.addMemberCircle}>
                    <Ionicons name="person-add-outline" size={24} color="#FFF" />
                  </View>
                  <Text style={styles.addMemberText}></Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Group Ranking (overall) */}
            <View style={styles.challengesSection}>
              <Text style={styles.sectionTitle}>Overall Ranking</Text>
              <View style={styles.leaderboardCard}>
                {lbSince && lbUntil && (
                  <Text style={{ color: "#f6be25ff", textAlign: "center", marginBottom: 8, fontSize: 12 }}>
                    Window: {lbSince} – {lbUntil}
                  </Text>
                )}
                {lbLoading && <Text style={{ color: "#FFD700", textAlign: "center" }}>Loading…</Text>}
                {lbError && <Text style={{ color: "#F88", textAlign: "center" }}>{lbError}</Text>}
                {!lbLoading && !lbError && displayRows().length === 0 && (
                  <Text style={{ color: "#f8c12bff", textAlign: "center" }}>No scores yet — be the first!</Text>
                )}
                {!lbLoading && !lbError && displayRows().map((row, index) => (
                  'ellipsis' in (row as any) ? (
                    <View key={`ellipsis-${index}`} style={styles.rankItem}>
                      <Text style={styles.ellipsisText}>…</Text>
                    </View>
                  ) : (
                    <View key={`${(row as LeaderRow).name}-${index}`} style={styles.rankItem}>
                      <View style={styles.rankPosition}>
                        <Text style={styles.rankEmoji}>{getRankEmoji((row as LeaderRow).rank)}</Text>
                      </View>
                      <Text style={[styles.rankName, (row as LeaderRow).name === myName && { color: "#fec936ff" }]}>
                        {(row as LeaderRow).name === myName ? "You" : (row as LeaderRow).name}
                      </Text>
                      <Text style={styles.rankPoints}>{(row as LeaderRow).points} pts</Text>
                    </View>
                  )
                ))}
                <TouchableOpacity
                  style={styles.viewDetailsButton}
                  onPress={() => navigation.navigate("GroupLeaderboardDetails", { groupId, myName })}
                >
                <LinearGradient
                  colors={["#FFD700", "#f7aa1cff"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.scheduleButtonGradient}
                >
                  <Text style={styles.scheduleButtonText}>View leaderboard details</Text>
                </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.challengesSection}>
              {pendingChallenges.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Pending Challenges</Text>
                  <View style={styles.challengeCardsContainer}>
      {pendingChallenges.map((challenge) => (
        <TouchableOpacity
          key={challenge.id}
          style={styles.challengeCardWrapper}
          onPress={() =>
            navigation.navigate("EditAvailability", {
              pendingChallengeId: challenge.id,
              pendingChallengeName: challenge.name,
              pendingChallengeStartDate: challenge.startDate,
              pendingChallengeEndDate: challenge.endDate,
              accepted: challenge.accepted,
              groupId
            })
          }
        >
          <PendingChallengeCard
            title={challenge.name}
            icon={require("../../images/school.png")}
            showInvite={challenge.accepted === 2}
            isOwner={user?.id === challenge.initiatorId} // Pass ownership
            onDelete={async () => handleDelete(challenge.id)}
          />
        </TouchableOpacity>
      ))}
                  </View>
                </>
              )}

              <Text style={styles.sectionTitle}>Current Challenges</Text>

              {currentChallenges.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  {isLoading ? (
                    <>
                      <ActivityIndicator size="small" color="#FFD700" />
                    </>
                  ) : (
                    <>
                      <Ionicons name="flag-outline" size={40} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.emptyStateText}>No active challenges</Text>
                      <Text style={styles.emptyStateSubText}>Create a challenge to get started</Text>
                    </>
                  )}
                </View>
              ) : (
                <View style={styles.challengeCardsContainer}>
                  {currentChallenges.map((challenge) => (
                    <TouchableOpacity
                      key={challenge.id}
                      style={styles.challengeCardWrapper}
                      onPress={() =>
                        navigation.navigate("ChallDetails", {
                          challId: challenge.id,
                          challName: challenge.name,
                          whichChall: "Group",
                          isCompleted: challenge.isCompleted
                        })
                      }
                    >
                      <ChallengeCard
                        title={challenge.name}
                        icon={require("../../images/school.png")}
                        startDate={challenge.startDate}
                        endDate={challenge.endDate}
                        daysOfWeek={challenge.daysOfWeek}
                        daysCompleted={challenge.daysCompleted}
                        totalDays={challenge.totalDays || 30}
                        isCompleted={challenge.isCompleted || false}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {groupData && (
                <TouchableOpacity
                  style={styles.addNewButton}
                  onPress={() => {
                    navigation.navigate("GroupChallCollab", {
                      groupId: groupData.id,
                      groupMembers: groupData.members,
                    })
                  }}
                >
                  <Text style={styles.addNewButtonText}>Add new +</Text>
                </TouchableOpacity>
              )}
            </View>

<TouchableOpacity
  style={styles.pastButtonWrapper}
  onPress={() => navigation.navigate("PastChallenges", { type: "Group", groupId })}
>
  <LinearGradient
    colors={["#FFD700", "#fdb021ff"]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
    style={styles.pastButtonGradient}
  >
    <Text style={styles.pastButtonText}>View past challenges</Text>
  </LinearGradient>
</TouchableOpacity>

          </ScrollView>
      </View>

      <NavBar
        goToPublicChallenges={() => navigation.navigate("PublicChallenges")}
        goToChallenges={() => navigation.navigate("Challenges")}
        goToGroups={() => navigation.navigate("Groups")}
        goToMessages={() => navigation.navigate("Messages")}
        goToProfile={() => navigation.navigate("Profile")}
        active="Groups"
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
    paddingTop: 50,
  },
  scheduleButtonGradient: {
    width: "100%",
    height: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  scheduleButtonText: {
    color: "#333",
    fontWeight: "700",
    fontSize: 16,
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 20,
    marginBottom: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#ffcf4dff",
    fontSize: 18,
    fontWeight: "600",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: "#ffcf4dff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 10,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  groupTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFF",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  decorativeLine: {
    width: 60,
    height: 4,
    backgroundColor: "#FFD700",
    borderRadius: 2,
    marginTop: 10,
  },
  leaderboardButton: {
    marginTop: 14,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  leaderboardButtonText: {
    color: '#FFD700',
    fontWeight: '700',
  },
  groupImageContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  groupImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  membersSection: {
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFF",
    marginTop: 20,
    marginBottom: 15,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  membersScrollContent: {
    paddingRight: 20,
  },
  memberContainer: {
    alignItems: "center",
    marginRight: 15,
    width: 70,
  },
  memberAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  memberInitials: {
    color: "#333",
    fontSize: 20,
    fontWeight: "700",
  },
  memberName: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  challengesSection: {
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  addNewButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: "center",
    marginTop: 30,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  addNewButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  pastButtonContainer: {
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 5,
    width: "90%",
  },
pastButtonWrapper: {
  alignSelf: "center",
  marginTop: 20,
  width: "90%",
  height: 45,        
  borderRadius: 22.5,
  overflow: "hidden",
},

pastButtonGradient: {
  width: "100%",
  height: "100%",
  justifyContent: "center",
  alignItems: "center",
  borderRadius: 22.5,
},

  pastButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "700",
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  pastButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateContainer: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 15,
    padding: 30,
  },
  emptyStateText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 10,
  },
  emptyStateSubText: {
    color: "#fff",
    fontSize: 14,
    marginTop: 5,
  },
  challengeCardsContainer: {
    width: "100%",
  },
  challengeCardWrapper: {
    marginBottom: 15,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  /* Leaderboard styles (mirrors ChallDetails) */
  leaderboardCard: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  leaderboardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: -40,
  },
  trophyIcon: { marginRight: 10 },
  leaderboardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffffff",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  rankItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  rankPosition: { width: 40, alignItems: "center" },
  rankEmoji: { fontSize: 20, color: "#FFD700" },
  rankName: { flex: 1, fontSize: 18, fontWeight: "600", color: "#000000ff", marginLeft: 10 },
  rankPoints: { fontSize: 18, fontWeight: "700", color: "#ffcf4dff", textShadowColor: "rgba(0, 0, 0, 0.1)", textShadowOffset: { width: 0, height: 0.5 }, textShadowRadius: 1 },
  ellipsisText: { color: "#888", fontSize: 18, textAlign: "center", width: "100%" },
  viewDetailsButton: { height: 45, borderRadius: 22.5, overflow: "hidden", marginTop: 20 },
  viewDetailsGradient: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center" },
  viewDetailsText: { color: "#333", fontWeight: "700", fontSize: 16, textShadowColor: "rgba(0, 0, 0, 0.1)", textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  navBar: {
    backgroundColor: "#211F26",
    flexDirection: "row",
    height: 80,
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 15,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
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
  membersContainer: {
    flexGrow: 0,
    maxWidth: "85%",
  },
  membersWithAddContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  addMember: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 0, // Change from 10 to 0 to move it right
  },
  membersRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  addMemberButton: {
    marginLeft: 10,
    alignItems: "center",
  },
  addMemberCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  addMemberText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 5,
  },
  memberAvatarImage: {
    width: '100%',
    height: '100%',
  },
})

export default GroupDetails