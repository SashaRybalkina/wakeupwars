import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { endpoints } from "../../api"
import { Alert, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { type NavigationProp, useRoute } from "@react-navigation/native"
import { LinearGradient } from "expo-linear-gradient"
import ChallengeCard from "../Challenges/ChallengeCard"
import PendingChallengeCard from "../Challenges/PendingChallengeCard"
import { useFocusEffect } from "@react-navigation/native"
import { ActivityIndicator } from "react-native"
import { useUser } from "../../context/UserContext"
import { getAccessToken } from "../../auth"

type Props = {
  navigation: NavigationProp<any>
}

type Bet = {
  id: number;
  initiatorId: number;
  recipientId: number;
  winnerId: number | null;
  initiatorName: string;
  recipientName: string;
  initiatorPoints: number;
  recipientPoints: number;
  betAmount: number;
  isPending: boolean;
  isCompleted: boolean;
  isCollected: boolean;
}

type Member = {
  id: number;
  name: string;
  username: string;
  numCoins: number;
};


const Bets: React.FC<Props> = ({ navigation }) => {
  const route = useRoute()
  const { challId, challName, challengeMembers, isCompleted } = route.params as { 
    challId: number, 
    challName: string,
    challengeMembers: Member[],
    isCompleted: boolean }

  const { user } = useUser()

  const [isLoading, setIsLoading] = useState(true)
  const [bets, setBets] = useState<Bet[]>([]);
  const [myBets, setMyBets] = useState<Bet[]>([]);
  const [myPendingBets, setPendingMyBets] = useState<Bet[]>([]);
  const [selectedTab, setSelectedTab] = useState<"all" | "mine">("mine");


  const fetchData = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
        const accessToken = await getAccessToken();
        if (!accessToken) throw new Error("Not authenticated");

        const response = await fetch(endpoints.getChallengeBets(challId, Number(user.id)), {
        headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await response.json();

        const formattedData: Bet[] = data.map((item: any) => ({
        id: item.id,
        initiatorId: item.initiatorId,
        recipientId: item.recipientId,
        winnerId: item.winnerId,
        initiatorName: item.initiator_name,
        recipientName: item.recipient_name,
        initiatorPoints: item.initiator_points,
        recipientPoints: item.recipient_points,
        betAmount: item.betAmount,
        isPending: item.isPending,
        isCompleted: item.isCompleted,
        isCollected: item.isCollected,
        }));

        const allNonPending = formattedData.filter(bet => !bet.isPending);
        const myNonPending = formattedData.filter(
        bet => !bet.isPending && (bet.initiatorId === user.id || bet.recipientId === user.id)
        );
        const myPending = formattedData.filter(
        bet => bet.isPending && (bet.initiatorId === user.id || bet.recipientId === user.id)
        );

        setBets(allNonPending);
        setMyBets(myNonPending);
        setPendingMyBets(myPending);
    } catch (error) {
        console.error("Failed to fetch bets:", error);
    } finally {
        setIsLoading(false);
    }
    };


    useFocusEffect(
        useCallback(() => {
            if (!user?.id) {
            console.error("userId is missing!");
            return;
            }

            setIsLoading(true);
            fetchData();
        }, [user?.id])
    );


  
    const handleRespond = async (betId: number, accept: boolean) => {  
      try {
          const accessToken = await getAccessToken();
          if (!accessToken) throw new Error("Not authenticated");
  
  
          const payload = {
              bet_id: betId,
              accept,
          };
          console.log(JSON.stringify(payload))
  
          const res = await fetch(endpoints.respondToBetInvite(), {
              method: "POST",
              headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify(payload),
          });
  
          if (!res.ok) {
              const error = await res.json();
              throw new Error(error.message || "Failed to respond to bet");
          }
  
          const data = await res.json();
          console.log('Responded to bet:', data);

          // refresh bets
          await fetchData();
  
          Alert.alert('Success', 'Responded to bet successfully')
      
      } catch (err: any) {
        Alert.alert("Error", err.message);
      }
  
    };




return (
    <ImageBackground source={require("../../images/cgpt.png")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>

<View style={styles.tabRow}>
  <TouchableOpacity
    style={[
      styles.tabButton,
      selectedTab === "mine" && styles.tabButtonActive,
    ]}
    onPress={() => setSelectedTab("mine")}
  >
    <Text style={styles.tabText}>My Bets</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={[
      styles.tabButton,
      selectedTab === "all" && styles.tabButtonActive,
    ]}
    onPress={() => setSelectedTab("all")}
  >
    <Text style={styles.tabText}>All Bets</Text>
  </TouchableOpacity>
</View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFD700" />
            <Text style={styles.loadingText}>Loading bets...</Text>
          </View>
        ) : (

<ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
  {selectedTab === "all" ? (
    bets.length === 0 ? (
      <Text style={styles.noBetsText}>No bets yet.</Text>
    ) : (
      bets.map((bet) => (
        <BetCard key={bet.id} bet={bet} user={user} onRefresh={fetchData} />
      )))
  ) : (
    <>
    
    {!isCompleted && (
        <TouchableOpacity
            style={styles.addNewButton}
            onPress={() => {
                navigation.navigate("MakeBet", {
                challId,
                challName,
                challengeMembers,
                isCompleted
                })
            }}
            >
            <Text style={styles.addNewButtonText}>Make A Bet</Text>
        </TouchableOpacity>
    )}


{myPendingBets.length > 0 && (
  <>
    {/* Bets waiting for MY response */}
    <Text style={styles.sectionHeader}>Pending Invites</Text>
    {myPendingBets
      .filter(bet => bet.recipientId === user?.id)
      .map(bet => (
        <View key={bet.id} style={styles.pendingBetCard}>
          <Text style={styles.pendingText}>
            {bet.initiatorName} invited you to bet 💰 {bet.betAmount}
          </Text>
          <View style={styles.pendingActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={() => handleRespond(bet.id, true)}
            >
              <Text style={styles.actionButtonText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.declineButton]}
              onPress={() => handleRespond(bet.id, false)}
            >
              <Text style={styles.actionButtonText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

    {/* Bets I initiated, waiting for others */}
    <Text style={styles.sectionHeader}>Waiting for Others</Text>
    {myPendingBets
      .filter(bet => bet.initiatorId === user?.id)
      .map(bet => (
        <View key={bet.id} style={styles.pendingBetCard}>
          <Text style={styles.pendingText}>
            You challenged {bet.recipientName} for 💰 {bet.betAmount} — waiting for response
          </Text>
        </View>
      ))}
  </>
)}

      {myBets.length === 0 && myPendingBets.length === 0 ? (
        <Text style={styles.noBetsText}>No bets yet.</Text>
      ) : (
        myBets.map((bet) => (
            <BetCard key={bet.id} bet={bet} user={user} onRefresh={fetchData} />
        ))
      )}
    </>
  )}
</ScrollView>
        )}











        {/* <TouchableOpacity
        style={styles.addNewButton}
        onPress={() => {
            navigation.navigate("MakeBet", {
            challId,
            challName,
            challengeMembers,
            })
        }}
        >
        <Text style={styles.addNewButtonText}>Make A Bet</Text>
        </TouchableOpacity>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFD700" />
            <Text style={styles.loadingText}>Loading bets...</Text>
          </View>
        ) : (
        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        {bets.length === 0 ? (
            <Text style={styles.noBetsText}>No bets yet.</Text>
        ) : (
            bets.map((bet) => {
            const initiatorWinning = bet.initiatorPoints > bet.recipientPoints;
            const recipientWinning = bet.recipientPoints > bet.initiatorPoints;

            return (
                <View key={bet.id} style={styles.betCard}>
                <View style={styles.betHeader}>
                    <Text style={styles.betAmountText}>💰 {bet.betAmount} coins</Text>
                </View>

                <View style={styles.playerRow}>
                    <Text style={styles.playerName}>
                    {bet.initiatorName}{" "}
                    {initiatorWinning && <Text style={styles.winnerIcon}>🏆</Text>}
                    </Text>
                    <Text style={styles.pointsText}>{bet.initiatorPoints} pts</Text>
                </View>

                <View style={styles.vsLine}>
                    <Text style={styles.vsText}>vs</Text>
                </View>

                <View style={styles.playerRow}>
                    <Text style={styles.playerName}>
                    {bet.recipientName}{" "}
                    {recipientWinning && <Text style={styles.winnerIcon}>🏆</Text>}
                    </Text>
                    <Text style={styles.pointsText}>{bet.recipientPoints} pts</Text>
                </View>
                </View>
            );
            })
        )}
        </ScrollView>

        )} */}
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
    paddingTop: 50,
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
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
  },
  scrollContainer: {
    flex: 1,
    width: '100%',
    marginTop: 20,
  },
  scrollContent: {
    paddingBottom: 60,
    alignItems: 'center',
  },
  noBetsText: {
    color: 'white',
    fontSize: 16,
    marginTop: 20,
  },
  betCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
    padding: 16,
    marginVertical: 10,
    width: '90%',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 5,
  },
  betHeader: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
    paddingBottom: 6,
    marginBottom: 8,
    alignItems: 'center',
  },
  betAmountText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '600',
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pointsText: {
    color: '#ccc',
    fontSize: 15,
  },
  vsLine: {
    alignItems: 'center',
    marginVertical: 4,
  },
  vsText: {
    color: '#aaa',
    fontSize: 14,
  },
  winnerIcon: {
    fontSize: 14,
    color: '#FFD700',
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
tabRow: {
  flexDirection: "row",
  justifyContent: "center",
  marginTop: 10,
},
tabButton: {
  paddingVertical: 10,
  paddingHorizontal: 20,
  marginHorizontal: 5,
  borderRadius: 20,
  backgroundColor: "rgba(255,255,255,0.2)",
},
tabButtonActive: {
  backgroundColor: "#FFD700",
},
tabText: {
  fontWeight: "600",
  color: "#000",
},
// pendingBetCard: {
//   backgroundColor: "rgba(255,255,255,0.1)",
//   borderRadius: 12,
//   padding: 12,
//   marginVertical: 6,
//   width: "90%",
//   alignItems: "center",
// },
// pendingText: {
//   color: "#fff",
//   fontSize: 16,
//   fontWeight: "600",
// },


sectionHeader: {
  color: '#FFD700',
  fontSize: 18,
  fontWeight: '700',
  marginTop: 20,
  marginBottom: 8,
  textAlign: 'center',
},
pendingBetCard: {
  backgroundColor: 'rgba(255,255,255,0.1)',
  borderRadius: 12,
  padding: 12,
  marginVertical: 6,
  width: '90%',
  alignSelf: 'center',
  alignItems: 'center',
},
pendingText: {
  color: '#FFF',
  fontSize: 15,
  marginBottom: 8,
  textAlign: 'center',
},
pendingActions: {
  flexDirection: 'row',
  justifyContent: 'space-around',
  width: '100%',
},
actionButton: {
  paddingVertical: 8,
  paddingHorizontal: 16,
  borderRadius: 8,
},
acceptButton: {
  backgroundColor: '#4CAF50',
},
declineButton: {
  backgroundColor: '#E53935',
},
actionButtonText: {
  color: '#FFF',
  fontWeight: '600',
},


})

export default Bets




const BetCard: React.FC<{ bet: Bet; user: any; onRefresh: () => Promise<void> }> = ({ bet, user, onRefresh }) => {
  const isComplete = bet.isCompleted;
  const isWinner = bet.winnerId === user?.id;
  const isTie = isComplete && bet.winnerId === null
  const [isCollecting, setIsCollecting] = useState(false);

  const collectWinnings = async (amount: number) => {
    try {
      setIsCollecting(true);
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Not authenticated");

      const res = await fetch(endpoints.collectBetCoins(), {  
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ user_id: user.id, bet_id: bet.id, amount }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      Alert.alert("🎉 Success", `You collected 💰 ${bet.betAmount * 2} coins!`);
      await onRefresh();
    } catch (err) {
      console.error("Collect error:", err);
      Alert.alert("Error", "Failed to collect winnings.");
    } finally {
      setIsCollecting(false);
    }
  };

    const cardColor =
    !isComplete || (isComplete && user.id !== bet.initiatorId && user.id !== bet.recipientId)
        ? "rgba(255,255,255,0.1)" // grey for incomplete or not involved
        : isTie
        ? "rgba(255, 215, 0, 0.2)" // gold/yellow for tie
        : isWinner
            ? "rgba(94, 204, 114, 0.2)" // green for winner
            : "rgba(255, 80, 80, 0.2)"; // red for loser


  return (
    <View style={[styles.betCard, { backgroundColor: cardColor }]}>
      <View style={styles.betHeader}>
        <Text style={styles.betAmountText}>💰 {bet.betAmount} coins</Text>
        {isComplete && (
        <Text style={{ color: "#FFD700", fontWeight: "600", marginTop: 5 }}>
        {bet.winnerId === null
            ? `It's a tie!${
                bet.initiatorId === user.id || bet.recipientId === user.id
                ? ` You have been refunded ${bet.betAmount} coins.`
                : ""
            }`
            : bet.winnerId === user.id
            ? "Winner: You 🏆"
            : `Winner: ${bet.winnerId === bet.initiatorId ? bet.initiatorName : bet.recipientName} — You lose!`}
        </Text>
        )}
      </View>

      <View style={styles.playerRow}>
        <Text style={styles.playerName}>
          {bet.initiatorName} {bet.winnerId === bet.initiatorId && <Text style={styles.winnerIcon}>🏆</Text>}
        </Text>
        <Text style={styles.pointsText}>{bet.initiatorPoints} pts</Text>
      </View>

      <View style={styles.vsLine}>
        <Text style={styles.vsText}>vs</Text>
      </View>

      <View style={styles.playerRow}>
        <Text style={styles.playerName}>
          {bet.recipientName} {bet.winnerId === bet.recipientId && <Text style={styles.winnerIcon}>🏆</Text>}
        </Text>
        <Text style={styles.pointsText}>{bet.recipientPoints} pts</Text>
      </View>

      {isWinner && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: "#4CAF50", marginTop: 10 }]}
          onPress={() => collectWinnings(bet.betAmount * 2)}
          disabled={isCollecting || bet.isCollected}
        >
          <Text style={styles.actionButtonText}>
            {isCollecting ? "Collecting..." : "Collect Winnings"}
          </Text>
        </TouchableOpacity>
      )}

      {/* {isTie && (bet.initiatorId === user.id || bet.recipientId === user.id) && ( // in case of tie, tell them their coins have been given back
          <Text style={styles.actionButtonText}>
            You have been given back {bet.betAmount} coins.
          </Text>
      )} */}
    </View>
  );
};
