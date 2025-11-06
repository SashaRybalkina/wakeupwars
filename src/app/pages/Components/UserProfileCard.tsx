import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Modal, Animated, Alert } from 'react-native';
import { SkillLevel, useUser } from '../../context/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { BASE_URL, endpoints } from '../../api';
import { Svg, Circle } from 'react-native-svg';
import { getAccessToken } from '../../auth';

type Props = {
  name: string;
  avatarSource?: any;
  isCurrentUser?: boolean;
  skillLevelsOverride?: any[];
  disableSkillDetail?: boolean;
  currentMemoji: Memoji | null;
  bgColor: string;
  numCoins: number;
  badgesGiven: Badge[]
};

type Memoji = {
  id: number;
  imageUrl: string;
}

type Badge = {
  id: number;
  imageUrl: string;
  earned: boolean;
  collected: boolean;
  name?: string;
};


const UserProfileCard: React.FC<Props> = ({ name, currentMemoji, bgColor, numCoins, isCurrentUser = true, skillLevelsOverride, disableSkillDetail, badgesGiven }) => {
  const { skillLevels, user } = useUser();
  const navigation = useNavigation<any>();
  const [tab, setTab] = React.useState<'skills' | 'badges'>('skills');
  const [infoVisible, setInfoVisible] = React.useState(false);

  const [badges, setBadges] = useState<Badge[]>(badgesGiven || []);
  const [selectedBadge, setSelectedBadge] = useState<null | any>(null);
  useEffect(() => {
    setBadges(badgesGiven || []);
  }, [badgesGiven]);

  console.log(skillLevelsOverride)
  const rows: any[][] = [];
  const effectiveSkills = Array.isArray(skillLevelsOverride) ? skillLevelsOverride : skillLevels;
  const list = Array.isArray(effectiveSkills) ? effectiveSkills : [];
  for (let i = 0; i < list.length; i += 3) rows.push(list.slice(i, i + 3));

  const getVal = (sl: any) => {
    const serverVal = sl?.skill != null ? Number(sl.skill) : null;
    const totalEarned = Number(sl?.totalEarned || 0);
    const totalPossible = Number(sl?.totalPossible || 0);
    const fallback = totalPossible > 0 ? Math.min(10, 10 * (totalEarned / totalPossible)) : 0;
    return serverVal != null ? serverVal : fallback;
  };

  const iconFor = (name?: string) => (
    name?.toLowerCase().includes('math') ? 'calculator-outline' :
    name?.toLowerCase().includes('word') ? 'book-outline' :
    name?.toLowerCase().includes('memory') ? 'grid-outline' :
    name?.toLowerCase().includes('logic') ? 'cube-outline' :
    'star-outline'
  );


  // will only be called if is current user and they collect a badge, just for refresh purposes
  const fetchBadges = async () => {
    if (!user) return;
    const access = await getAccessToken();
    const res = await fetch(endpoints.badges(Number(user.id)), {
      headers: { Authorization: `Bearer ${access}` },
    });
    const data = await res.json();
    setBadges(data);
  };


const collectBadge = async (badgeId: number) => {
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
    if (isCurrentUser && badge.earned && !badge.collected) {
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
    <View style={styles.profileContainer}>
      {isCurrentUser ? (
        <View style={styles.headerWrap}>
          <View style={styles.headerCard}>
      <View style={styles.avatarWrapper}>
      {/* Inner avatar container (clipped circle) */}
      <View style={[styles.avatarContainer, { backgroundColor: bgColor }]}>
        <Image
          source={
            currentMemoji?.imageUrl
              ? { uri: `${BASE_URL}${currentMemoji.imageUrl}` }
              : require('../../../../assets/memojies/JaneBase.webp')
          }
          style={styles.avatar}
          resizeMode="contain"
        />
        </View>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() =>
            navigation.navigate('EditAva', {
              currentMemojiId: currentMemoji?.id,
            })
          }
        >
          <Ionicons name="pencil" size={18} color="#fff" />
        </TouchableOpacity>
        </View>
            <Text style={styles.profileName}>{name}</Text>
            <Text style={styles.coinText}>{numCoins} 🪙</Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.actionItem, styles.actionItemLeft]} onPress={() => navigation.navigate('Friends1')}>
                <Ionicons name="people" size={42} color="#9ed3ffff" style={styles.actionIcon} />
                <Text style={[styles.actionLabel, styles.actionLabelLeft]}>Friends</Text>
              </TouchableOpacity>
              <View style={styles.actionDivider} />
              <TouchableOpacity style={[styles.actionItem, styles.actionItemRight]} onPress={() => navigation.navigate('PersChall1')}>
                <Ionicons name="trophy" size={42} color="#FFD700" style={styles.actionIcon} />
                <Text style={[styles.actionLabel, styles.actionLabelRight]}>Personal{"\n"}Challenges</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.headerWrap}>
          <View style={styles.headerCard}>
            <Text style={styles.profileName}>{name}</Text>
            <Text style={styles.coinText}>{numCoins} 🪙</Text>
          </View>
      <View style={styles.avatarWrapper}>
      {/* Inner avatar container (clipped circle) */}
      <View style={[styles.avatarContainer, { backgroundColor: bgColor }]}>
        <Image
          source={
            currentMemoji?.imageUrl
              ? { uri: `${BASE_URL}${currentMemoji.imageUrl}` }
              : require('../../../../assets/memojies/JaneBase.webp')
          }
          style={styles.avatar}
          resizeMode="contain"
        />
        </View>
        </View>
        </View>
      )}



      <View style={styles.skillsCardWrap}>
        <View style={styles.skillsCard}>
          <View style={styles.tabsRow}>
            <TouchableOpacity onPress={() => setTab('skills')} style={[styles.tabBtn, tab === 'skills' && styles.tabBtnActive]}>
              <Text style={[styles.tabText, tab === 'skills' && styles.tabTextActive]}>Skills</Text>
            </TouchableOpacity>
            {tab === 'skills' && (
              <TouchableOpacity onPress={() => setInfoVisible(true)} style={styles.infoBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="help-circle" size={25} color="rgba(255,255,255,0.85)" style={styles.infoIcon} />
              </TouchableOpacity>
            )}
            <View style={styles.tabsDivider} />
            <TouchableOpacity onPress={() => setTab('badges')} style={[styles.tabBtn, tab === 'badges' && styles.tabBtnActive]}>
              <Text style={[styles.tabText, tab === 'badges' && styles.tabTextActive]}>Badges</Text>
            </TouchableOpacity>
          </View>

          {tab === 'skills' ? (
            <View style={styles.skillsSection}>
              {rows.map((row, idx) => (
                <View key={idx} style={[styles.skillsRow, row.length === 3 ? styles.row3 : styles.row2]}> 
                  {row.map((sl, j) => {
                    const categoryId = sl?.category?.id;
                    const categoryName = sl?.category?.categoryName ?? 'Unknown';
                    const val = getVal(sl);
                    const size = 86;
                    const stroke = 7;
                    const r = (size - stroke) / 2;
                    const c = 2 * Math.PI * r;
                    const pct = Math.max(0, Math.min(1, Number(val) / 10));
                    const dash = c * pct;
                    const iconName = iconFor(categoryName);
                    return (
                      <TouchableOpacity
                        key={`${categoryId ?? j}`}
                        style={styles.skillItem}
                        activeOpacity={isCurrentUser && !disableSkillDetail ? 0.8 : 1}
                        onPress={() => {
                          if (isCurrentUser && !disableSkillDetail && categoryId) {
                            navigation.navigate('SkillDetail', { categoryId, categoryName });
                          }
                        }}
                      >
                        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                          <Svg width={size} height={size}>
                            <Circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.20)" strokeWidth={stroke} fill="transparent" />
                            <Circle
                              cx={size/2}
                              cy={size/2}
                              r={r}
                              stroke="#ffc400ff"
                              strokeWidth={stroke}
                              strokeDasharray={`${dash}, ${c}`}
                              strokeLinecap="round"
                              fill="transparent"
                              transform={`rotate(-90 ${size/2} ${size/2})`}
                            />
                          </Svg>
                          <Ionicons name={iconName as any} size={32} color="#FFF" style={{ position: 'absolute' }} />
                          <View style={styles.skillBadge}>
                            <Text style={styles.skillBadgeText}>{Number(val).toFixed(1)}</Text>
                          </View>
                        </View>
                        <Text style={styles.skillLabel} numberOfLines={2}>{categoryName}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.skillsSection}>
              {badges && badges.length > 0 && (() => {
                // Filter based on current user
                const visibleBadges = isCurrentUser ? badges : badges.filter(b => b.earned);
                const rows: Badge[][] = [];
                for (let i = 0; i < visibleBadges.length; i += 3) {
                  rows.push(visibleBadges.slice(i, i + 3));
                }
                return rows.map((row, idx) => (
                  <View key={idx} style={[styles.skillsRow, row.length === 3 ? styles.row3 : styles.row2]}>
                    {row.map((badge) => (
                      <PulsingBadge
                        key={badge.id}
                        badge={badge}
                        onPress={() => {
                          if (isCurrentUser && badge.earned && !badge.collected) {
                            collectBadge(badge.id);
                          } else {
                            setSelectedBadge(badge);
                          }
                        }}
                      />
                    ))}
                  </View>
                ));
              })()}
            </View>
          )}
        </View>
      </View>



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


      <Modal transparent visible={infoVisible} animationType="fade" onRequestClose={() => setInfoVisible(false)}>
        <View style={styles.infoBackdrop}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>What are Skills?</Text>
            <Text style={styles.infoText}>
              Skill levels (0–10) show your current proficiency per category. They’re computed
              from recent game results with time-decay, so recent play counts more.
            </Text>
            <TouchableOpacity style={styles.infoClose} onPress={() => setInfoVisible(false)}>
              <Text style={styles.infoCloseText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

  </View>
);
};

const styles = StyleSheet.create({
  profileContainer: {
    alignItems: 'center',
    marginTop: 80,
  },
  headerWrap: {
    width: '100%',
    marginTop: 14,
    alignItems: 'center',
  },
headerCard: {
  width: '90%',
  backgroundColor: 'rgba(0, 0, 0, 0.13)',
  borderRadius: 18,
  paddingTop: 60, // half the avatar size
  paddingBottom: 23,
  paddingHorizontal: 18,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.28)',
  alignItems: 'center', // center children horizontally
},

  avatarOnCard: {
    position: 'absolute',
    top: -60,
    alignSelf: 'center',
  },

avatarWrapper: {
  position: 'absolute',
  top: -60, // half the avatar height
  alignSelf: 'center',
  width: 120,
  height: 120,
  alignItems: 'center',
  justifyContent: 'center',
},

avatarContainer: {
  width: 120,
  height: 120,
  borderRadius: 60,
  overflow: 'hidden',
  borderWidth: 3,
  borderColor: '#FFD700',
  alignItems: 'center',
  justifyContent: 'center',
},


  avatar: {
    width: '100%',
    height: '100%',
  },

  // ✅ Button now outside clipped area
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
  profileLink: {
    color: '#EEE',
    fontSize: 16,
    marginBottom: 10,
    fontWeight: '600',
  },
  actionsRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '85%',
    alignSelf: 'center',
  },
  actionItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
  },
  actionDivider: {
    width: 1,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginHorizontal: 14,
    borderRadius: 1,
  },
  actionIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  actionLabel: {
    color: '#FFF',
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  actionItemLeft: {
    transform: [{ translateY: -2 }],
  },
  actionItemRight: {
    transform: [{ translateY: 2 }],
  },
  actionLabelLeft: {
    marginTop: 6,
  },
  actionLabelRight: {
    marginTop: 4,
    lineHeight: 16,
  },
  skillsCardWrap: {
    width: '100%',
    marginTop: 18,
    alignItems: 'center',
  },
  skillsCard: {
    width: '110%',
    backgroundColor: 'rgba(0, 0, 0, 0.14)',
    marginTop: 23,
    borderRadius: 18,
    paddingTop: 17,
    paddingBottom: 10,
    paddingHorizontal: 19,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 6,
  },
  tabsDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginHorizontal: 14,
    borderRadius: 1,
  },
  tabBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  tabBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  tabText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  tabTextActive: {
    color: '#FFD700',
  },
  badgesSection: {
    minHeight: 80,
  },
  infoBtn: {
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIcon: {

    textShadowColor: 'rgba(0, 0, 0, 0.30)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  infoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  infoCard: {
    width: '90%',
    backgroundColor: 'rgba(40, 40, 48, 0.65)',
    borderRadius: 26,
    padding: 23,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  infoTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  infoText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
  },
  infoClose: {
    alignSelf: 'flex-end',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
  },
  infoCloseText: {
    color: '#FFF',
    fontWeight: '700',
  },
  chipsRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
    alignSelf: 'center',
  },
  chipsRowCenter: {
    marginTop: 10,
    alignItems: 'center',
  },
  chip: {
    backgroundColor: '#FFD700',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  chipWide: {
    paddingHorizontal: 20,
  },
  chipText: {
    color: '#000',
    fontWeight: '800',
  },
  skillsSection: {
    marginTop: 14,
    width: '88%',
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    marginBottom: 14,
  },
  row3: {
    width: '90%',
    justifyContent: 'space-between',
  },
  row2: {
    width: '45%',
    alignSelf: 'center',
    justifyContent: 'space-between',
  },
  skillItem: {
    width: '30%',
    alignItems: 'center',
  },
  skillBadge: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    backgroundColor: '#FFD700',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 0,
    borderColor: '#0A1015',
  },
  skillBadgeText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 12,
  },
  skillLabel: {
    color: '#FFF',
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },

profileName: {
  fontSize: 26,
  fontWeight: 'bold',
  color: '#FFF',
  marginTop: 12, // space below avatar
  marginBottom: 6, // space above coins
  textAlign: 'center',
  textShadowColor: 'rgba(0, 0, 0, 0.75)',
  textShadowOffset: { width: 1, height: 1 },
  textShadowRadius: 3,
},

coinText: {
  color: "#fff",
  fontSize: 16,
  fontWeight: "600",
  marginTop: 4,
  textAlign: 'center',
},

});


export default UserProfileCard;