import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Svg, Circle } from 'react-native-svg';
import type { NavigationProp } from '@react-navigation/native';
import { useUser } from '../../context/UserContext';
import { getAccessToken } from '../../auth';
import { endpoints } from '../../api';

type Props = { navigation: NavigationProp<any> };

const MySkills: React.FC<Props> = ({ navigation }) => {
  const { skillLevels, setSkillLevels } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const access = await getAccessToken();
        const res = await fetch(endpoints.skillLevels(), {
          headers: { Authorization: `Bearer ${access}` },
        });
        const data = await res.json();
        if (!cancelled) setSkillLevels(data);
      } catch (e: any) {
        if (!cancelled) setError('Failed to load skills');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setSkillLevels]);

  const computeSkill = (earned: number, possible: number) => {
    if (!possible || possible <= 0) return 0;
    const v = Math.min(10, 10 * (earned / possible));
    return Math.round(v * 100) / 100;
    };

  return (
    <ImageBackground source={require('../../images/cgpt.png')} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>My Skills</Text>

        {loading && (
          <View style={styles.center}> 
            <ActivityIndicator color="#FFF" />
          </View>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.grid}>
          {(skillLevels as any[]).map((sl, idx) => {
            const categoryId = sl?.category?.id;
            const categoryName = sl?.category?.categoryName ?? 'Unknown';
            const serverVal = sl?.skill != null ? Number(sl.skill) : null;
            const fallback = computeSkill(Number(sl?.totalEarned || 0), Number(sl?.totalPossible || 0));
            const val = serverVal != null ? serverVal : fallback;
            const iconName = (
              categoryName?.toLowerCase().includes('math') ? 'calculator-outline' :
              categoryName?.toLowerCase().includes('word') ? 'book-outline' :
              categoryName?.toLowerCase().includes('memory') ? 'grid-outline' :
              categoryName?.toLowerCase().includes('logic') ? 'cube-outline' :
              'star-outline'
            );
            const size = 92;
            const stroke = 8;
            const r = (size - stroke) / 2;
            const c = 2 * Math.PI * r;
            const pct = Math.max(0, Math.min(1, Number(val) / 10));
            const dash = c * pct;
            return (
              <TouchableOpacity
                key={`${categoryId ?? idx}`}
                style={styles.item}
                activeOpacity={0.8}
                onPress={() => categoryId && navigation.navigate('SkillDetail', { categoryId, categoryName })}
              >
                <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={size} height={size}>
                    <Circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} fill="transparent" />
                    <Circle
                      cx={size/2}
                      cy={size/2}
                      r={r}
                      stroke="#FFD700"
                      strokeWidth={stroke}
                      strokeDasharray={`${dash}, ${c}`}
                      strokeLinecap="round"
                      fill="transparent"
                      transform={`rotate(-90 ${size/2} ${size/2})`}
                    />
                  </Svg>
                  <Ionicons name={iconName as any} size={28} color="#FFF" style={{ position: 'absolute' }} />
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{Number(val).toFixed(1)}</Text>
                  </View>
                </View>
                <Text style={styles.label} numberOfLines={2}>{categoryName}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  bg: { flex: 1 },
  container: { flex: 1 },
  content: { padding: 20 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 12, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  error: { color: '#ff7070', marginVertical: 8 },
  center: { paddingVertical: 20, alignItems: 'center' },
  grid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  item: { width: '30%', alignItems: 'center', marginBottom: 18 },
  badge: { position: 'absolute', bottom: -4, alignSelf: 'center', backgroundColor: '#00B5D8', borderRadius: 14, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 2, borderColor: '#0A1015' },
  badgeText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  label: { color: '#FFF', fontWeight: '700', textAlign: 'center', marginTop: 8 },
});

export default MySkills;
