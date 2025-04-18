import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

type SkillLevel = {
  category: { categoryName: string };
  totalEarned: number;
  totalPossible: number;
};

type Props = {
  name: string;
  skillLevels: SkillLevel[];
  avatarSource?: any; // Optional override
};

const UserProfileCard: React.FC<Props> = ({ name, skillLevels, avatarSource }) => {
  return (
    <View style={styles.profileContainer}>
      <Image
        source={avatarSource || require('../../images/game.jpeg')}
        style={styles.avatar}
      />
      <Text style={styles.profileName}>{name}</Text>
      <View style={styles.statsContainer}>
        {skillLevels.map((skill, index) => {
          const skillLevel =
            skill.totalPossible === 0
              ? 0
              : ((skill.totalEarned / skill.totalPossible) * 10).toFixed(1);
          return (
            <View style={styles.statCard} key={index}>
              <Text style={styles.stat}>
                {skill.category.categoryName}{' '}
                <Text style={styles.statValue}>{skillLevel} Points</Text>
              </Text>
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
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
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
});

export default UserProfileCard;