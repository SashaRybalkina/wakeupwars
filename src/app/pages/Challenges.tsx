import type React from "react"
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View, StatusBar } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { NavigationProp } from "@react-navigation/native"
import { Button } from "tamagui"

type Props = {
  navigation: NavigationProp<any>
}

const ChallengeButton = ({
  title,
  icon,
  onPress,
}: {
  title: string
  icon: React.ComponentProps<typeof Ionicons>["name"]
  onPress: () => void
}) => {
  return (
    <TouchableOpacity style={styles.challengeButton} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.buttonContent}>
        <Ionicons name={icon} size={32} color="#FFF" style={styles.buttonIcon} />
        <Text style={styles.buttonText}>{title}</Text>
      </View>
      <View style={styles.arrowContainer}>
        <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.8)" />
      </View>
    </TouchableOpacity>
  )
}

const Challenges: React.FC<Props> = ({ navigation }) => {
  const goToChall1 = (whichChall: string) => {
    navigation.navigate("Chall1", { whichChall })
  }

  const goToPublicChallenges = () => {
    console.log("here")
    navigation.navigate("PublicChallenges")
  }

  const goToChallenges = () => navigation.navigate('Challenges');

  const goToGroups = () => {
    navigation.navigate("Groups")
  }

  const goToMessages = () => {
    navigation.navigate("Messages")
  }

  const goToProfile = () => {
    navigation.navigate("Profile")
  }
  
  return (
    <ImageBackground source={require("../images/cgpt.png")} style={styles.background} resizeMode="cover">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.headerContainer}>
        <Text style={styles.title}>My Challenges</Text>
        <View style={styles.titleUnderline} />
      </View>

      <View style={styles.container}>
        <View style={styles.challengesContainer}>
          <ChallengeButton title="Personal" icon="person-outline" onPress={() => goToChall1("Personal")} />

          <ChallengeButton title="Group" icon="people-outline" onPress={() => goToChall1("Group")} />

          {/* <ChallengeButton title="Public" icon="people-outline" onPress={() => goToPublicChallenges()} /> */}
          <ChallengeButton title="Public" icon="people-outline" onPress={() => goToChall1("Public")} />

        </View>
      </View>

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navButton} onPress={goToChallenges}>
          <Ionicons name="star" size={28} color="#FFD700" />
          <Text style={styles.activeNavText}>Challenges</Text>
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
          <Ionicons name="person-outline" size={28} color="#FFF" />
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  headerContainer: {
    alignItems: "center",
    marginTop: 150,
    marginBottom: 20,
  },
  title: {
    color: "#FFF",
    fontSize: 42,
    fontWeight: "800",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  titleUnderline: {
    width: 60,
    height: 4,
    backgroundColor: "#FFD700",
    borderRadius: 2,
    marginTop: 10,
  },
  container: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  challengesContainer: {
    width: "100%",
    marginTop: 20,
  },
  challengeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(50, 50, 60, 0.29)",
    borderRadius: 16,
    marginVertical: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 1,
    width: "90%",
    alignSelf: "center",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  buttonIcon: {
    marginRight: 15,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "700",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  arrowContainer: {
    backgroundColor: "transparent",
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  statCard: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 16,
    padding: 20,
    width: "47%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  statNumber: {
    color: "#FFD700",
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 5,
  },
  statLabel: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
    opacity: 0.9,
  },
  buttons: {
    backgroundColor: "rgba(33, 31, 38, 0.95)",
    flexDirection: "row",
    height: 90,
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 20,
  },
  button: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: 0,
    borderWidth: 0,
    flex: 1,
    height: "100%",
  },
  navBar: {
    backgroundColor: "#211F26",
    flexDirection: "row",
    height: 80,
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 15,
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
})

export default Challenges
