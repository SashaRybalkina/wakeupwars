import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, ImageBackground } from 'react-native';
import type { NavigationProp, RouteProp, ParamListBase } from '@react-navigation/native';
import { getAccessToken } from '../../auth';
import { endpoints } from '../../api';

type SkillDetailRouteParams = { categoryId: number; categoryName?: string };
type Props = {
  navigation: NavigationProp<ParamListBase>;
  route: RouteProp<ParamListBase, string>;
};

const SkillDetail: React.FC<Props> = ({ route }) => {
  const params = (route?.params ?? {}) as Partial<SkillDetailRouteParams>;
  const categoryId = params.categoryId as number;
  const categoryNameParam = params.categoryName;

  const [detail, setDetail] = useState<any | null>(null);
  const [history, setHistory] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const title = categoryNameParam || detail?.category?.name || 'Skill';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const access = await getAccessToken();
        const [dRes, hRes] = await Promise.all([
          fetch(endpoints.skillLevelDetail(categoryId), { headers: { Authorization: `Bearer ${access}` } }),
          fetch(endpoints.skillLevelHistory(categoryId, 200), { headers: { Authorization: `Bearer ${access}` } }),
        ]);
        const d = await dRes.json();
        const h = await hRes.json();
        if (!cancelled) {
          setDetail(d);
          setHistory(h);
        }
      } catch (e: any) {
        if (!cancelled) setError('Failed to load skill details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [categoryId]);

  const skillValue = useMemo(() => (detail?.skill != null ? Number(detail.skill) : 0), [detail]);

  return (
    <ImageBackground source={require('../../images/cgpt.png')} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{title}</Text>

        {loading && (
          <View style={styles.center}><ActivityIndicator color="#FFF" /></View>
        )}
      {!!error && <Text style={styles.error}>{error}</Text>}

      {!!detail && (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.metricLabel}>Current Skill</Text>
            <Text style={styles.metricValue}>{skillValue.toFixed(2)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.rowBetween}>
            <Text style={styles.subLabel}>Games considered</Text>
            <Text style={styles.subValue}>{detail?.counts?.games_considered ?? 0}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.subLabel}>Last played</Text>
            <Text style={styles.subValue}>{detail?.counts?.last_played || '—'}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.subLabel}>Time window</Text>
            <Text style={styles.subValue}>{detail?.config?.window_days ?? '∞'} days</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.subLabel}>Half-life</Text>
            <Text style={styles.subValue}>{detail?.config?.half_life_days ?? '—'} days</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.subLabel}>Totals considered</Text>
            <Text style={styles.subValue}>
              {Number(detail?.totals?.computed?.earned || 0).toFixed(2)} / {Number(detail?.totals?.computed?.possible || 0).toFixed(2)}
            </Text>
          </View>
        </View>
      )}

      {!!history?.items?.length && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contributions</Text>
          {history.items.map((it: any, idx: number) => (
            <View key={`${it.date}-${idx}`} style={[styles.itemRow, idx > 0 && styles.itemRowDivider]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemDate}>{it.date}</Text>
                <Text style={styles.itemDesc}>
                  {(it.game_name || 'Game')} • Score {it.raw_score} × weight {Number(it.weight).toFixed(3)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.itemEarned}>{Number(it.earned).toFixed(2)} / {Number(it.possible).toFixed(2)}</Text>
                <Text style={styles.itemSkill}>Skill {Number(it.cumulative_skill).toFixed(2)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
      </ScrollView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  bg: { flex: 1 },
  container: { flex: 1 },
  content: { padding: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 12, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  error: { color: '#ff7070', marginVertical: 8 },
  center: { paddingVertical: 24, alignItems: 'center' },
  card: { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 16, padding: 12, marginBottom: 16, borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 6 },
  metricLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  metricValue: { color: '#FFD700', fontSize: 18, fontWeight: '800' },
  subLabel: { color: '#ddd', fontSize: 14 },
  subValue: { color: '#fff', fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 8 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  itemRowDivider: { borderTopColor: 'rgba(255,255,255,0.1)', borderTopWidth: 1 },
  itemDate: { color: '#fff', fontWeight: '700' },
  itemDesc: { color: '#ddd', marginTop: 2 },
  itemEarned: { color: '#FFD700', fontWeight: '700' },
  itemSkill: { color: '#ccc', marginTop: 2 },
});

export default SkillDetail;
