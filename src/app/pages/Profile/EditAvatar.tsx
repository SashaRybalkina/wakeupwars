import React, { useRef } from 'react';
import { useEffect, useState } from 'react';
import * as SecureStore from "expo-secure-store";
import { getAccessToken } from "../../auth";
import {
  Alert,
  ImageBackground,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Modal,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { endpoints, BASE_URL } from '../../api';
import { useUser } from '../../context/UserContext';

type Props = {
  navigation: NavigationProp<any>;
};


type Memoji = {
  id: number;
  imageUrl: string;
}


const EditAvatar: React.FC<Props> = ({ navigation }) => {
    const route = useRoute()
    const { currentMemoji } = route.params as { 
      currentMemoji: Memoji | null }
 
  const [currMemoji, setCurrMemoji] = useState<Memoji | null>(currentMemoji);
  const [numCoins, setNumCoins] = useState<number>(0);
  const [avatars, setAvatars] = useState<any[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<null | any>(null);

  const { user } = useUser()


  const fetchAvatars = async () => {
    if (!user) return;
    const access = await getAccessToken();
    const res = await fetch(endpoints.memojies(Number(user.id)), {
      headers: { Authorization: `Bearer ${access}` },
    });
    const data = await res.json();
    setAvatars(data.avatars);
    setNumCoins(data.numCoins);
  };


  useFocusEffect(
  React.useCallback(() => {
    (async () => {
      try {
        await fetchAvatars();
      } catch (e) {
        console.error('Failed to fetch avatars', e);
      }
    })();
  }, [user])
);


const purchaseAvatar = async (badgeId: number) => {
      const payload = {
        user_id: user?.id,
        badge_id: badgeId,
      }
  
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          throw new Error("Not authenticated");
        }
  
        const response = await fetch(endpoints.collectBadge(), {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        })
  
        if (!response.ok) throw new Error(`Server error: ${response.status}`)
  
        Alert.alert("Success", "Badge Collected!")

        await fetchBadges();
      } catch (err) {
        console.error("Failed to collect badge:", err)
        Alert.alert("Error", "Failed to collect badge.")
      }
}


const PulsingBadge = ({ badge, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (badge.earned && !badge.collected) {
      // Start pulsing loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scale.setValue(1); // reset scale when no longer pulsing
    }
  }, [badge.earned, badge.collected]);

  const borderColor = badge.collected
    ? 'rgba(94, 204, 114, 1)'
    : badge.earned
      ? 'gold'
      : 'transparent';

  const opacity = badge.earned ? 1 : 0.3;

  return (
    <TouchableOpacity
      key={badge.id}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Animated.View
        style={{
          transform: [{ scale }],
          width: 60,
          height: 60,
          margin: 5,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: badge.earned ? 2 : 0,
          borderColor,
          backgroundColor: badge.collected
            ? 'rgba(94, 204, 114, 0.2)'
            : badge.earned
              ? 'rgba(255, 215, 0, 0.15)'
              : 'rgba(255,255,255,0.1)',
          shadowColor: badge.earned && !badge.collected ? 'gold' : 'transparent',
          shadowOpacity: badge.earned && !badge.collected ? 0.8 : 0,
          shadowRadius: badge.earned && !badge.collected ? 8 : 0,
          shadowOffset: { width: 0, height: 0 },
        }}
      >
        <Image
          source={{ uri: `${BASE_URL}${badge.imageUrl}` }}
          style={{
            width: 50,
            height: 50,
            opacity,
          }}
          resizeMode="contain"
        />
      </Animated.View>
    </TouchableOpacity>
  );
};


  return (
    <ImageBackground
      source={require('../images/cgpt.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.container}>

      {/* ScrollView wraps all content except the bottom navigation */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        <UserProfileCard
          name={user?.name ?? 'Loading…'}
          avatarSource={{ uri: `${BASE_URL}${currentMemoji}` }}
        />

        <View style={styles.profileButtons}>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('Friends1')}
          >
            <View style={styles.iconShadowContainer}>
              <Ionicons name="people" size={40} color={'#fff'} style={styles.iconWithShadow} />
            </View>
            <Text style={styles.profileButtonText}>Friends</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('PersChall1')}
          >
            <View style={styles.iconShadowContainer}>
              <Ionicons name="trophy" size={40} color={'#FFD700'} style={styles.iconWithShadow} />
            </View>
            <Text style={[styles.profileButtonText, { color: '#FF0' }]}>
              {"  "}Personal {"\n"}Challenges
            </Text>
          </TouchableOpacity>
        </View>

    <View style={styles.container}>
      <Text style={styles.coinText}>{numCoins} 🪙</Text>
      {/* <Text style={styles.coinEmoji}>🪙</Text> */}
    </View>

        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <View style={styles.menuItemContent}>
              <Ionicons
                name="star"
                size={22}
                color="#FFD700"
                style={styles.menuIcon}
              />
              <Text style={styles.menuText}>My Skills</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <View style={styles.menuItemContent}>
              <Ionicons
                name="podium"
                size={22}
                color="#FFD700"
                style={styles.menuIcon}
              />
              <Text style={styles.menuText}>Leaderboard</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <View style={styles.menuItemContent}>
              <Ionicons
                name="alarm"
                size={22}
                color="#FFD700"
                style={styles.menuIcon}
              />
              <Text style={styles.menuText}>Alarms</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <View style={styles.menuItemContent}>
              <Ionicons
                name="help-circle"
                size={22}
                color="#FFD700"
                style={styles.menuIcon}
              />
              <Text style={styles.menuText}>Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>




{/* <ScrollView horizontal contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 5 }}>
  {badges.map((badge) => {
    const borderColor = badge.collected
      ? 'rgba(94, 204, 114, 1)'
      : badge.earned
        ? 'gold'
        : 'transparent';

    const opacity = badge.earned ? 1 : 0.3;

    return (
      <TouchableOpacity
        key={badge.id}
        onPress={() => {
          if (badge.earned && !badge.collected) {
            collectBadge(badge.id); // hit the /collect endpoint
          } else {
            setSelectedBadge(badge);
          }
        }}
        style={{
          width: 60,
          height: 60,
          margin: 5,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: badge.earned ? 2 : 0,
          borderColor,
          backgroundColor: badge.collected
            ? 'rgba(94, 204, 114, 0.2)'
            : badge.earned
              ? 'rgba(255, 215, 0, 0.15)'
              : 'rgba(255,255,255,0.1)',
          ...(badge.earned && !badge.collected
            ? { shadowColor: 'gold', shadowOpacity: 0.7, shadowRadius: 6 }
            : {}),
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


<ScrollView
  horizontal
  contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 5 }}
>
  {badges.map((badge) => (
    <PulsingBadge
      key={badge.id}
      badge={badge}
      onPress={() => {
        if (badge.earned && !badge.collected) {
          collectBadge(badge.id);
        } else {
          setSelectedBadge(badge);
        }
      }}
    />
  ))}
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





        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.8}
          onPress={handleLogout}
        >
          <Ionicons
            name="log-out-outline"
            size={22}
            color="#FFF"
            style={styles.logoutIcon}
          />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        {/* <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.8}
          onPress={() =>
            NotificationService.sendNotification(
              user.id,
              "Wassupppp",
              "This is a real push notification!",
              "FriendsRequests",
              {}
            )
          }
        >
          {/* <Ionicons
            name="game-controller"
            size={22}
            color="#FFF"
            style={styles.logoutIcon}
          />
          <Text style={styles.logoutText}>Notification</Text> */}



        {/* <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.8}
          onPress={() =>
            navigation.navigate('Wordle', {
              challengeId: 211,   // multiplayer Challenge
              challName: 'Multiplayer Wordle Test',
              whichChall: 'wordle',
            })
          }
        >
          <Ionicons
            name="people"   
            size={22}
            color="#FFF"
            style={styles.logoutIcon}
          />
          <Text style={styles.logoutText}>Multiplayer Wordle</Text>
        </TouchableOpacity> */}

        {/* <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.8}
          onPress={() =>
            scheduleAlarms([
              {
                time: new Date(Date.now() + 10000),
                screen: 'Wordle',
                data: {
                  challengeId: 30,
                  challName: 'Test Challenge',
                  whichChall: 'wordle',
                },
              },
            ])
          }
        >
          <Ionicons
            name="alarm"
            size={22}
            color="#FFF"
            style={styles.logoutIcon}
          />
          <Text style={styles.logoutText}>Alarm</Text>
        </TouchableOpacity> */}

        {/* <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.8}
          onPress={setUserAlarms}
        >
          <Ionicons
            name="log-out-outline"
            size={22}
            color="#FFF"
            style={styles.logoutIcon}
          />
          <Text style={styles.logoutText}>Test Schedule Alarms</Text>
        </TouchableOpacity> */}

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
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingTop: 50, 
    paddingHorizontal: 20,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollViewContent: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 20,
  },
  profileContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  coinText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 6,
  },
  coinEmoji: {
    fontSize: 18,
    marginLeft: 4,
  },
  avatar: {
    width: 120,
    height: 120,
    marginTop: 30,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  profileName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 10,
  },
  profileLink: {
    color: '#EEE',
    fontSize: 16,
    marginBottom: 10,
    fontWeight: '600',
  },
  statsContainer: {
    marginTop: 7.5,
    width: '100%',
  },
  statCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 25,
    paddingVertical: 7.5,
    marginVertical: 2.5,
    borderRadius: 10,
  },
  stat: {
    color: '#FFF',
    fontWeight: '600',
  },
  statValue: {
    fontWeight: 'bold',
    color: '#FFD700',
  },
  profileButtons: {
    flexDirection: 'row',
    marginTop: 20,
  },
  profileButton: {
    alignItems: 'center',
    marginHorizontal: 20,
  },
  profileButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    marginTop: 2,
  },
  menu: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 16,
    width: '85%',
    marginTop: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    marginRight: 12,
  },
  menuText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(50, 50, 60, 0.45)',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 12,
    marginTop: 40,
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 100, // Ensure content isn't hidden behind the nav bar
  },
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
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  navText: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },
  activeNavText: {
    color: '#FFD700',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  iconShadowContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
  },
  iconWithShadow: {
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1.5,
  },
});

export default EditAvatar;
