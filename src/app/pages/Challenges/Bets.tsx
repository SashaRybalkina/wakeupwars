import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { endpoints } from "../../api"
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native"
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
  id: number
  initiatorName: string
  recipientName: string
  initiatorPoints: number
  recipientPoints: number
  betAmount: number
}

type Member = {
  id: number;
  name: string;
  username: string;
  numCoins: number;
};


const Bets: React.FC<Props> = ({ navigation }) => {
  const route = useRoute()
  const { challId, challName, challengeMembers } = route.params as { 
    challId: number, 
    challName: string, 
    challengeMembers: Member[] }

  const { user } = useUser()

  const [isLoading, setIsLoading] = useState(true)
  const [bets, setBets] = useState<Bet[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) {
        console.error("userId is missing!");
        return;
      }

      setIsLoading(true);

      const fetchData = async () => {

        setIsLoading(true)
        try {

                const accessToken = await getAccessToken();
                if (!accessToken) {
                  throw new Error("Not authenticated");
                }
          const response = await fetch(endpoints.getChallengeBets(challId), {
                headers: {
                  Authorization: `Bearer ${accessToken}`
                }
              });
          const data = await response.json()
        //   fields = [
        //   'id',
        //   'initiator_name',
        //   'recipient_name',
        //   'initiator_points',
        //   'recipient_points',
        //   'bet_amount''
        //   ]
        console.log(data)
        const formattedData = data.map(
            (item: Bet) => ({
                id: item.id,
                initiatorName: item.initiatorName,
                recipientName: item.recipientName,
                initiatorPoints: item.initiatorPoints,
                recipientPoints: item.recipientPoints,
                betAmount: item.betAmount
            })
        )
  
          setBets(formattedData)

        } catch (error) {
          console.error("Failed to fetch bets:", error)
        } finally {
          setIsLoading(false)
        }
      }
  
      fetchData()
    }, [user?.id])
  );


return (
    <ImageBackground source={require("../../images/cgpt.png")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
        style={styles.addNewButton}
        // onPress={() => {
        //   navigation.navigate("GroupChall1", {
        //     groupId: groupData.id,
        //     groupMembers: groupData.members,
        //   })
        // }}
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

        )}
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
})

export default Bets