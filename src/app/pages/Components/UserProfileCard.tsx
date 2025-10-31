import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useUser } from '../../context/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { BASE_URL } from '../../api';

type Props = {
  name: string;
  currentMemoji: Memoji | null
};


type Memoji = {
  id: number;
  imageUrl: string;
}


const UserProfileCard: React.FC<Props> = ({ name, currentMemoji }) => {
  const navigation = useNavigation<NavigationProp<any>>();
  const { skillLevels } = useUser();

  return (
    <View style={styles.profileContainer}>
      {/* Avatar container */}
      <View style={styles.avatarContainer}>
      <Image
        source={
          currentMemoji?.imageUrl
            ? { uri: `${BASE_URL}${currentMemoji.imageUrl}` }
            : require('../../../../assets/memojies/JaneDefault.webp')
        }
        style={styles.avatar}
        resizeMode="contain"
      />
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('EditAvatar', {
                currentMemoji,
            })}
        >
          <Ionicons name="pencil" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Name below the avatar */}
      <Text style={styles.profileName}>{name}</Text>

      {/* Stats */}
      <View style={styles.statsContainer}>
        {skillLevels.map((s, i) => {
          const level =
            s.totalPossible === 0
              ? '0.0'
              : ((s.totalEarned / s.totalPossible) * 10).toFixed(1);

          return (
            <View style={styles.statCard} key={i}>
              <View style={styles.statRow}>
                <Text style={styles.stat}>{s.category.categoryName}</Text>
                <Text style={styles.statValue}>{level} / 10</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  profileContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  avatarContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    marginBottom: 15, // ✅ adds space below avatar for name
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  editButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    borderRadius: 15,
    padding: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
  },
  profileName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 10, // ✅ spacing before stats
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  statsContainer: {
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
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

export default UserProfileCard;