import type React from "react"
import { useEffect, useState } from "react"
import { useFocusEffect } from "@react-navigation/native"
import { useUser } from "../context/UserContext"
import { endpoints } from "../api"
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View, ScrollView } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { NavigationProp } from "@react-navigation/native"
import UserProfileCard from "./Components/UserProfileCard"

type Props = {
  navigation: NavigationProp<any>
}

const Profile: React.FC<Props> = ({ navigation }) => {
  //--------------------------
  //const goToPatternGame = () => navigation.navigate("PatternGame")
  //-------------
  


  const goToChallenges = () => navigation.navigate("Challenges")
  const goToGroups = () => navigation.navigate("Groups")
  const goToMessages = () => navigation.navigate("Messages")
  const goToProfile = () => {
    navigation.navigate("Profile")
  }
  const [profileData, setProfileData] = useState<any>(null)
  const { user, setUser, setSkillLevels } = useUser()

  const handleLogout = () => {
    setUser(null)

    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    })
  }

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res  = await fetch(endpoints.skillLevels(), { credentials: "include" });
        setSkillLevels(await res.json());
      } catch {}
    })();
  }, [user, setSkillLevels]);

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;

      (async () => {
        try {
          const res  = await fetch(endpoints.skillLevels(), { credentials: "include" });
          const data = await res.json();
          if (!cancelled) setSkillLevels(data);
        } catch (e) {
          console.error("refresh skills failed", e);
        }
      })();

      return () => { cancelled = true };
    }, [setSkillLevels]),
  );

  return (
    <ImageBackground source={require("../images/cgpt.png")} style={styles.background} resizeMode="cover">
      {/* ScrollView wraps all content except the bottom navigation */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        <UserProfileCard name={user?.name ?? "Loading…"} />

        <View style={styles.profileButtons}>
          <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate("Friends1")}>
            <View style={styles.iconShadowContainer}>
              <Ionicons name="people" size={40} color={"#fff"} />
            </View>
            <Text style={styles.profileButtonText}>Friends</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate("PersChall1")}>
            <View style={styles.iconShadowContainer}>
              <Ionicons name="trophy" size={40} color={"#FFD700"}  />
            </View>
            <Text style={[styles.profileButtonText, { color: "#FF0" }]}>Challenges</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <View style={styles.menuItemContent}>
              <Ionicons name="star" size={22} color="#FFD700" style={styles.menuIcon} />
              <Text style={styles.menuText}>My Skills</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <View style={styles.menuItemContent}>
              <Ionicons name="podium" size={22} color="#FFD700" style={styles.menuIcon} />
              <Text style={styles.menuText}>Leaderboard</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <View style={styles.menuItemContent}>
              <Ionicons name="alarm" size={22} color="#FFD700" style={styles.menuIcon} />
              <Text style={styles.menuText}>Alarms</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <View style={styles.menuItemContent}>
              <Ionicons name="help-circle" size={22} color="#FFD700" style={styles.menuIcon} />
              <Text style={styles.menuText}>Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} activeOpacity={0.8} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#FFF" style={styles.logoutIcon} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} activeOpacity={0.8} onPress={() => navigation.navigate("Wordle")}>
          <Ionicons name="log-out-outline" size={22} color="#FFF" style={styles.logoutIcon} />
          <Text style={styles.logoutText}>Wordle</Text>
        </TouchableOpacity>
        
        {/* Add padding at the bottom to ensure content isn't hidden behind the nav bar */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Navigation Bar stays fixed at the bottom */}
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
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollViewContent: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 20,
  },
  profileContainer: {
    alignItems: "center",
    marginTop: 50,
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
  },
  profileLink: {
    color: "#EEE",
    fontSize: 16,
    marginBottom: 10,
    fontWeight: "600",
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
  profileButtons: {
    flexDirection: "row",
    marginTop: 20,
  },
  profileButton: {
    alignItems: "center",
    marginHorizontal: 20,
  },
  profileButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  menu: {
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 16,
    width: "85%",
    marginTop: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  menuItemContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuIcon: {
    marginRight: 12,
  },
  menuText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(50, 50, 60, 0.45)",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 12,
    marginTop: 40,
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  bottomPadding: {
    height: 100, // Ensure content isn't hidden behind the nav bar
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
  iconShadowContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
    elevation: 5,
  },
  iconWithShadow: {
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
})

export default Profile