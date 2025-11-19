/**
 * @file NavBar.tsx
 * @description This is the bottom navigation bar used throughout various pages in the app.
 * It allows navigation to the Challenges page, Public Challenges page, Groups page, 
 * Messages page, and Profile page
 */


import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface NavBarProps {
  goToPublicChallenges: () => void;
  goToChallenges: () => void;
  goToGroups: () => void;
  goToMessages: () => void;
  goToProfile: () => void;
  active?: "Public" | "Challenges" | "Groups" | "Messages" | "Profile";
}

export default function NavBar({
  goToPublicChallenges,
  goToChallenges,
  goToGroups,
  goToMessages,
  goToProfile,
  active,
}: NavBarProps) {
  return (
    <View style={styles.navBar}>
      <TouchableOpacity style={styles.navButton} onPress={goToChallenges}>
        <Ionicons
          name="trophy-outline"
          size={28}
          color={active === "Challenges" ? "#FFD700" : "#FFF"}
        />
        <Text
          style={active === "Challenges" ? styles.activeNavText : styles.navText}
        >
          Challenges
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navButton} onPress={goToGroups}>
        <Ionicons
          name="people-outline"
          size={28}
          color={active === "Groups" ? "#FFD700" : "#FFF"}
        />
        <Text
          style={active === "Groups" ? styles.activeNavText : styles.navText}
        >
          Groups
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navButton} onPress={goToPublicChallenges}>
        <Ionicons
          name="globe-outline"
          size={28}
          color={active === "Public" ? "#FFD700" : "#FFF"}
        />
        <Text
          style={active === "Public" ? styles.activeNavText : styles.navText}
        >
          Public
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.navButton} onPress={goToMessages}>
        <Ionicons
          name="mail-outline"
          size={28}
          color={active === "Messages" ? "#FFD700" : "#FFF"}
        />
        <Text
          style={active === "Messages" ? styles.activeNavText : styles.navText}
        >
          Messages
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navButton} onPress={goToProfile}>
        <Ionicons
          name="person"
          size={28}
          color={active === "Profile" ? "#FFD700" : "#FFF"}
        />
        <Text
          style={active === "Profile" ? styles.activeNavText : styles.navText}
        >
          Profile
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    backgroundColor: '#211F26',
    flexDirection: 'row',
    height: 80,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 15,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navButton: {
    alignItems: "center",
    flex: 1,
  },
  navText: {
    color: "#FFF",
    fontSize: 12,
  },
  activeNavText: {
    color: "#FFD700",
    fontSize: 12,
    fontWeight: "bold",
  },
});
