import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { useUser } from '../../context/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { Svg, Circle } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';

type Props = {
  name: string;
  avatarSource?: any;
  isCurrentUser?: boolean;
};

const UserProfileCard: React.FC<Props> = ({ name, avatarSource, isCurrentUser = true }) => {
  const { skillLevels } = useUser();
  const navigation = useNavigation<any>();
  const [tab, setTab] = React.useState<'skills' | 'badges'>('skills');
  const [infoVisible, setInfoVisible] = React.useState(false);

  const rows: any[][] = [];
  const list = Array.isArray(skillLevels) ? skillLevels : [];
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

  return (
    <View style={styles.profileContainer}>
      {isCurrentUser ? (
        <View style={styles.headerWrap}>
          <View style={styles.headerCard}>
            <Text style={styles.profileName}>{name}</Text>
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
          <Image
            source={avatarSource || require('../../images/game.jpeg')}
            style={[styles.avatar, styles.avatarOnCard]}
          />
        </View>
      ) : (
        <>
          <Image
            source={avatarSource || require('../../images/game.jpeg')}
            style={styles.avatar}
          />
          <Text style={styles.profileNameFriend}>{name}</Text>
        </>
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
                        activeOpacity={0.8}
                        onPress={() => categoryId && navigation.navigate('SkillDetail', { categoryId, categoryName })}
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
            <View style={styles.badgesSection} />
          )}
        </View>
      </View>

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
    marginTop: 50,
  },
  headerWrap: {
    width: '100%',
    marginTop: 14,
    alignItems: 'center',
  },
  headerCard: {
    width: '103%',
    backgroundColor: 'rgba(0, 0, 0, 0.13)',
    borderRadius: 18,
    paddingTop: 100,
    paddingBottom: 23,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 8,
  },
  avatarOnCard: {
    position: 'absolute',
    top: -60,
    alignSelf: 'center',
  },
  avatar: {
    width: 120,
    height: 120,
    marginTop: 10,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  profileName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: -15,
    marginBottom: 30,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  profileNameFriend: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 12,
    textAlign: 'center',
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
});

export default UserProfileCard;