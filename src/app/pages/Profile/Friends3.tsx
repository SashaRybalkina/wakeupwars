import React from "react"
import { useEffect, useState } from "react"
import { Alert, ImageBackground, StyleSheet, Text, TouchableOpacity, View, Animated, Modal, ScrollView, Image } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { type NavigationProp, useFocusEffect, useRoute } from "@react-navigation/native"
import UserProfileCard from "../Components/UserProfileCard"
import { BASE_URL, endpoints } from "../../api"
import { LinearGradient } from "expo-linear-gradient"
import { getAccessToken } from "../../auth"
import { SkillLevel } from '../../context/UserContext';

type Props = {
  navigation: NavigationProp<any>
}

type Memoji = {
  id: number;
  imageUrl: string;
}


const Friends3: React.FC<Props> = ({ navigation }) => {
  const route = useRoute()
  const { friendId, groupId } = route.params as { friendId: number; groupId?: number }
  console.log(`groupId: ${groupId}`)

  const [isLoading, setIsLoading] = useState(false)
  const [buttonScale] = useState(new Animated.Value(1))
  const [infoVisible, setInfoVisible] = useState(false)

  const [currentMemoji, setCurrentMemoji] = useState<Memoji | null>(null);
  const [numCoins, setNumCoins] = useState<number>(0);
  const [name, setName] = useState<string>("");
  const [backgroundColor, setBackgroundColor] = useState<string>('#FFB3BA');
  const [skillLevels, setSkillLevels] = useState<SkillLevel[]>([]);
  const [dataLoading, setDataLoading] = useState(true)
  const [badges, setBadges] = useState<any[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<null | any>(null);

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;

      (async () => {
        setDataLoading(true)
        try {
                const access = await getAccessToken();
                if (!access) {
                  throw new Error("Not authenticated");
                }
        const res = await fetch(endpoints.userData(friendId), {
          headers: {
            Authorization: `Bearer ${access}`
          }
        });
          const data = await res.json();
          console.log(JSON.stringify(data, null, 2))
          if (!cancelled) {
            setName(data.name)
            setSkillLevels(data.skillLevels);
            setNumCoins(data.numCoins);
            setCurrentMemoji(data.currentMemoji);
            setBackgroundColor(data.backgroundColor);
          }
        } catch (e) {
          console.error('refresh skills failed', e);
        } finally {
          setDataLoading(false)
        }

      })();

      return () => {
        cancelled = true;
      };
    }, [friendId]),
  );



  const fetchBadges = async () => {
    const access = await getAccessToken();
    const res = await fetch(endpoints.badges(friendId), {
      headers: { Authorization: `Bearer ${access}` },
    });
    const data = await res.json();
    setBadges(data);
  };


  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          await fetchBadges();
        } catch (e) {
          console.error('Failed to fetch badges', e);
        }
      })();
    }, [friendId])
  );



  const handleAddToGroup = async () => {
    if (isLoading) return;
    setIsLoading(true);
  
    const payload = {
      group_id: groupId,
      recipient_id: friendId,
    };
  
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Not authenticated");
  
      const response = await fetch(endpoints.sendGroupInvite(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
  
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Failed to send invite");
  
      console.log("Friend added to group", data);
      Alert.alert("Success!", `${name || "Friend"} has been invited to your group.`, [
        { text: "OK", onPress: () => navigation.navigate("GroupDetails", { groupId }) },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setIsLoading(false);
    }
  };  

  const goToChallenges = () => navigation.navigate("Challenges")
  const goToGroups = () => navigation.navigate("Groups")
  const goToMessages = () => navigation.navigate("Messages")
  const goToProfile = () => {
    navigation.navigate("Profile")
  }

  return (
    <ImageBackground source={require("../../images/tertiary.png")} style={styles.background} resizeMode="cover">

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
        >

      <View style={styles.backButtonContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={30} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Profile Section */}
      {!dataLoading && (
        <UserProfileCard
          name={name}
          isCurrentUser={false}
          skillLevelsOverride={skillLevels}
          disableSkillDetail={true}
          currentMemoji={currentMemoji}
          bgColor={backgroundColor}
          numCoins={numCoins}
          badgesGiven={badges}
        />
      )}
{/* 
      <ScrollView horizontal contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 5 }}>
        {badges
          .filter((badge) => badge.earned)
          .map((badge) => {
            const borderColor = 'rgba(94, 204, 114, 1)';
            const opacity = 1;

            return (
              <TouchableOpacity
                key={badge.id}
                onPress={() => setSelectedBadge(badge)}
                style={{
                  width: 60,
                  height: 60,
                  margin: 5,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor,
                  backgroundColor: 'rgba(94, 204, 114, 0.2)',
                }}
              >
                <Image
                  source={{ uri: `${BASE_URL}${badge.imageUrl}` }}
                  style={{ width: 50, height: 50, opacity }}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            );
          })}
      </ScrollView> */}

      
      </ScrollView>


{selectedBadge && (
  <Modal
    transparent
    animationType="fade"
    visible={!!selectedBadge}
    onRequestClose={() => setSelectedBadge(null)}
  >
    <View style={{
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    }}>
      <View style={{
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        width: '100%',
        maxWidth: 300,
        alignItems: 'center',
      }}>
        <Image
          source={{ uri: `${BASE_URL}${selectedBadge.imageUrl}` }}
          style={{ width: 80, height: 80 }}
          resizeMode="contain"
        />
        <Text style={{ fontWeight: 'bold', fontSize: 18, marginTop: 10 }}>
          {selectedBadge.name}
        </Text>
        <Text style={{ fontSize: 14, textAlign: 'center', marginTop: 5 }}>
          {selectedBadge.description}
        </Text>
        <TouchableOpacity
          onPress={() => setSelectedBadge(null)}
          style={{ marginTop: 15, padding: 10 }}
        >
          <Text style={{ color: '#007BFF', fontWeight: 'bold' }}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
)}


{/* Add to Group Button */}
{!dataLoading && groupId && (
  <View style={styles.buttonContainer}>
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handleAddToGroup}
      disabled={isLoading}
    >
      <LinearGradient
        colors={["#FFD700", "#FFA500"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.addButton}
      >
        <View style={styles.buttonContent}>
          <Ionicons
            name="person-add"
            size={24}
            color="#FFF"
            style={styles.buttonIcon}
          />
          <Text style={styles.addText}>
            {isLoading ? "Adding..." : "Add to Group"}
          </Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  </View>
)}

      
      {/* Create Challenge for Friend Button */}
      {!groupId && !dataLoading && (
        <TouchableOpacity
          style={styles.createChallengeButton}
          onPress={() => navigation.navigate("CreateChallengeForFriend", { friendId })}
        >
          <LinearGradient
            colors={["rgba(50, 50, 60, 0.35)", "rgba(50, 50, 60, 0.35)"]}
            style={[styles.createButtonGradient, { borderColor: "rgba(255, 255, 255, 0.5)" }]}
          >
            <Text style={styles.createButtonText}>Create Challenge</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Floating Info icon and modal */}
      {!groupId && !dataLoading && (
        <>
          <TouchableOpacity style={styles.infoFab} onPress={() => setInfoVisible(true)}>
            <Ionicons name="information-circle-outline" size={26} color="#FFF" />
          </TouchableOpacity>
          <Modal
            transparent
            visible={infoVisible}
            animationType="fade"
            onRequestClose={() => setInfoVisible(false)}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <Text style={styles.infoTitle}>What happens?</Text>
                <View style={styles.infoBulletRow}>
                  <View style={styles.infoBulletDot} />
                  <Text style={styles.infoBulletText}>Choose games and set alarms for your friend</Text>
                </View>
                <View style={styles.infoBulletRow}>
                  <View style={styles.infoBulletDot} />
                  <Text style={styles.infoBulletText}>We notify {name} to join</Text>
                </View>
                <View style={styles.infoBulletRow}>
                  <View style={styles.infoBulletDot} />
                  <Text style={styles.infoBulletText}>Send a customized challenge just for them</Text>
                </View>
                <View style={styles.infoBulletRow}>
                  <View style={styles.infoBulletDot} />
                  <Text style={styles.infoBulletText}>Your friend can accept or decline</Text>
                </View>
                <TouchableOpacity style={styles.modalCloseButton} onPress={() => setInfoVisible(false)}>
                  <Text style={styles.modalCloseText}>Got it</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </>
      )}

      

      {/* Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navButton} onPress={goToChallenges}>
          <Ionicons name="star" size={28} color="#FFF" />
          <Text style={styles.navText}>Challenges</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={goToGroups}>
          <Ionicons name="people-outline" size={28} color="#FFF" />
          <Text style={styles.navText}>Groups</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={goToMessages}>
          <Ionicons name="mail-outline" size={28} color="#FFF" />
          <Text style={styles.navText}>Messages</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={goToProfile}>
          <Ionicons name="person-outline" size={28} color="#FFD700" />
          <Text style={styles.activeNavText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    alignItems: "center",
  },
  backButtonContainer: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
  },
  profileContainer: {
    marginTop: 0,
  },
  avatar: {
    width: 120,
    height: 120,
    marginTop: 30,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#FFD700",
  },
  profileName: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#FFF",
    marginTop: 10,
    marginBottom: 20,
  },
  statsContainer: {
    marginTop: 7.5,
    width: "100%",
  },
  statCard: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    paddingHorizontal: 25,
    paddingVertical: 7.5,
    marginVertical: 2.5,
    borderRadius: 10,
  },
  stat: {
    color: "#FFF",
    fontWeight: "600",
  },
  statValue: {
    fontWeight: "bold",
    color: "#FFD700",
  },
buttonContainer: {
  position: "absolute",
  bottom: 100, // adjust above nav bar
  left: 0,
  right: 0,
  alignItems: "center",
  zIndex: 10,
},
  addButton: {
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minWidth: 220,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
    marginTop: 10,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonIcon: {
    marginRight: 10,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  addText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 20,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
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
  infoFab: {
    position: "absolute",
    left: 40, // align near content margin, just left of the button (button left is 40)
    bottom: 105, // vertically centered with 56px-tall button placed at bottom: 105
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(50, 50, 60, 0.35)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    zIndex: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "rgba(40, 40, 48, 0.95)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  modalCloseButton: {
    marginTop: 14,
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  modalCloseText: {
    color: "#FFF",
    fontWeight: "600",
  },
  infoCard: {
    backgroundColor: "rgba(50, 50, 60, 0.25)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 12,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  infoTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  infoBulletRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  infoBulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    marginRight: 8,
  },
  infoBulletText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    flexShrink: 1,
  },
   createChallengeButton: {
    position: "absolute",
    bottom: 105, // above the 80px nav bar + padding
    left: 100,
    right: 0,
    borderRadius: 24,
    overflow: "hidden",
    width: "65%",
    zIndex: 5,
    shadowColor: "#000",
    shadowOffset: { width: 10, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  createButtonGradient: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  createButtonText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollViewContent: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 20,
    flexGrow: 1,
  },
})

export default Friends3