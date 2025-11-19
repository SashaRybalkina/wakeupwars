import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { endpoints } from "../../api"
import { Alert, ImageBackground, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { type NavigationProp, useRoute } from "@react-navigation/native"
import { LinearGradient } from "expo-linear-gradient"
import ChallengeCard from "../Challenges/ChallengeCard"
import PendingChallengeCard from "../Challenges/PendingChallengeCard"
import { useFocusEffect } from "@react-navigation/native"
import { ActivityIndicator } from "react-native"
import { useUser } from "../../context/UserContext"
import { getAccessToken } from "../../auth"
import { Picker } from '@react-native-picker/picker'

type Props = {
  navigation: NavigationProp<any>
}

type Member = {
  id: number;
  name: string;
  username: string;
  numCoins: number;
};


const MakeBet: React.FC<Props> = ({ navigation }) => {
  const route = useRoute()
  const { challId, challName, challengeMembers, existingOpponents, isCompleted } = route.params as { 
    challId: number,
    challName: string,
    challengeMembers: Member[],
    existingOpponents: number[],
    isCompleted: boolean }

  const { user, logout } = useUser()
  const [recipientId, setRecipientId] = useState<number | undefined>(undefined);
  const [betAmount, setBetAmount] = useState<string>('')


  const handleSendBet = async () => {
    if (!recipientId) {
      Alert.alert("Error", "Please select a challenge member.");
      return;
    }

      const trimmed = betAmount.trim();
      console.log(trimmed)
      if (!/^\d+$/.test(trimmed)) {
        Alert.alert('Error', 'Enter a valid positive whole number for the reward');
        return;
      }

      const betAmt = parseInt(trimmed, 10);
      console.log(betAmt)

      if (betAmt <= 0) {
        Alert.alert('Error', 'Enter a valid positive amount for the reward');
        return;
      }

      // get "this" member (where member.id == user.id) and check if they have enough coins
      const me = challengeMembers.find(m => m.id === user?.id);
      if (betAmt > Number(me?.numCoins)) {
        Alert.alert('Error', `You do not have enough coins! You currently have ${Number(me?.numCoins)} coins.`);
        return;
      }

      // get the recipient member and check if they have enough coins
      const recipient = challengeMembers.find(m => m.id === recipientId);
      if (betAmt > Number(recipient?.numCoins)) {
        Alert.alert('Error', `The recipient does not have enough coins! They currently have ${Number(recipient?.numCoins)} coins.`);
        return;
      }

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


        const payload = {
            chall_id: challId,
            initiator_id: user?.id,
            recipient_id: recipientId,
            bet_amount: betAmt
        };
        console.log(JSON.stringify(payload))

        const res = await fetch(endpoints.sendBet(), {
            method: "POST",
            headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || "Failed to send bet");
        }

        const data = await res.json();
        console.log('Bet sent:', data);

        Alert.alert('Success', 'Bet sent successfully', [
            { text: 'OK', onPress: () => navigation.navigate('Bets', {
                challId,
                challName,
                challengeMembers,
                isCompleted,
            }) },
        ]);
    
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

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Select a member to bet with:</Text>
            <View style={styles.inputContainer}>
              <Picker
                selectedValue={recipientId}
                onValueChange={(value) => setRecipientId(value)}
                dropdownIconColor="#FFF"
                style={{ color: "#FFF" }}
              >
                <Picker.Item label="Select member..." value={undefined} />
                {challengeMembers
                .filter(
                  m => m.id !== user?.id && !existingOpponents.includes(m.id) // exclude self and users with bets
                )
                  .map(m => (
                    <Picker.Item
                      key={m.id}
                      label={`${m.username} (${m.numCoins} 🪙)`}
                      value={m.id}
                    />
                ))}
              </Picker>
            </View>
          </View>




          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Set Bet Amount 🪙</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Amount"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                keyboardType="numeric"
                value={betAmount}
                onChangeText={setBetAmount}
              />
            </View>
          </View>


          <TouchableOpacity
            style={styles.createButton}
            onPress={handleSendBet}
          >
            <LinearGradient
              colors={["#FFD700", "#FFC107"]}
              style={styles.createButtonGradient}
            >
              <Text style={styles.createButtonText}>Send Bet</Text>
            </LinearGradient>
          </TouchableOpacity>

      </View>

    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  rewardHeader:{flexDirection:'row',alignItems:'center',marginBottom:12},
  background: {
    flex: 1,
  },
  input: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    color: "#FFF",
    fontSize: 16,
    width: "100%",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    backgroundColor: "#222",
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  formSection: {
    marginBottom: 25,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFF",
    marginBottom: 15,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  inputContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  coinEmoji: {
    fontSize: 20,
    marginLeft: 6,
  },
  container: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
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
  createButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginVertical: 10,
    marginBottom: 30,
  },
  createButtonGradient: {
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonText: {
    color: "#333",
    fontSize: 18,
    fontWeight: "700",
  },
})

export default MakeBet