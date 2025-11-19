import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, ImageBackground, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import type { NavigationProp, RouteProp, ParamListBase } from '@react-navigation/native';
import { getAccessToken } from '../../auth';
import { endpoints } from '../../api';
import { useUser } from '../../context/UserContext';
import { Ionicons } from '@expo/vector-icons';

type SkillDetailRouteParams = { categoryId: number; categoryName?: string };
type Props = {
  navigation: NavigationProp<ParamListBase>;
  route: RouteProp<ParamListBase, string>;
};

const SkillDetail: React.FC<Props> = ({ route, navigation }) => {
  const params = (route?.params ?? {}) as Partial<SkillDetailRouteParams>;
  const categoryId = params.categoryId as number;
  const categoryNameParam = params.categoryName;

  const [detail, setDetail] = useState<any | null>(null);
  const [history, setHistory] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [filterOpen, setFilterOpen] = useState(false);
  const [startDateStr, setStartDateStr] = useState<string>(''); // YYYY-MM-DD
  const [endDateStr, setEndDateStr] = useState<string>('');   // YYYY-MM-DD

  const { logout } = useUser();

  const title = categoryNameParam || detail?.category?.name || 'Skill';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const access = await getAccessToken();
        if (!access) {
                  Alert.alert(
                    "Session expired",
                    "Your login session has expired. Please log in again.",
                    [
                      {
                        text: "OK",
                        onPress: async () => {
                          await logout();
                          navigation.reset({
                            index: 0,
                            routes: [{ name: "Login" }],
                          });
                        },
                      },
                    ],
                    { cancelable: false }
                  );

                  return;
        }
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

  const filteredItems = useMemo(() => {
    const items = Array.isArray(history?.items) ? history!.items.slice() : [];
    const isValid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
    const toKey = (s: string) => s; // ISO date strings compare lexicographically

    let out = items;
    if (startDateStr && isValid(startDateStr)) {
      out = out.filter((it: any) => (it?.date && toKey(it.date) >= startDateStr));
    }
    if (endDateStr && isValid(endDateStr)) {
      out = out.filter((it: any) => (it?.date && toKey(it.date) <= endDateStr));
    }
    out.sort((a: any, b: any) => (sortOrder === 'desc' ? (a.date < b.date ? 1 : -1) : (a.date > b.date ? 1 : -1)));
    return out;
  }, [history, sortOrder, startDateStr, endDateStr]);

  return (
    <ImageBackground source={require('../../images/cgpt.png')} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{title}</Text>
        </View>

        <View style={styles.controlsRow}>
          <View style={styles.sortWrap}>
            <TouchableOpacity
              style={[styles.sortBtn, sortOrder === 'desc' && styles.sortBtnActive]}
              onPress={() => setSortOrder('desc')}
              activeOpacity={0.8}
            >
              <Text style={[styles.sortText, sortOrder === 'desc' && styles.sortTextActive]}>Latest</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortBtn, sortOrder === 'asc' && styles.sortBtnActive]}
              onPress={() => setSortOrder('asc')}
              activeOpacity={0.8}
            >
              <Text style={[styles.sortText, sortOrder === 'asc' && styles.sortTextActive]}>Oldest</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterOpen(true)} activeOpacity={0.85}>
            <Text style={styles.filterText}>Filter dates</Text>
          </TouchableOpacity>
        </View>

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

      {!!filteredItems?.length && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contributions</Text>
          <View style={styles.divider} />
          {filteredItems.map((it: any, idx: number) => (
            <View key={`${it.date}-${idx}`} style={[styles.itemRow, idx > 0 && styles.itemRowDivider]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemDate}>{it.date}</Text>
                <Text style={styles.itemDesc}>
                  <Text style={styles.itemDescGame}>{it.game_name || 'Game'}</Text>
                  {` • Score ${it.raw_score} × weight ${Number(it.weight).toFixed(3)}`}
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

      {/* Date Range Modal */}
      <Modal transparent visible={filterOpen} animationType="fade" onRequestClose={() => setFilterOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Filter by Date</Text>
            <Text style={styles.modalHint}>Use YYYY-MM-DD</Text>
            <View style={styles.modalRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.modalLabel}>Start</Text>
                <TextInput
                  value={startDateStr}
                  onChangeText={setStartDateStr}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#aaa"
                  style={styles.modalInput}
                  autoCapitalize="none"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.modalLabel}>End</Text>
                <TextInput
                  value={endDateStr}
                  onChangeText={setEndDateStr}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#aaa"
                  style={styles.modalInput}
                  autoCapitalize="none"
                />
              </View>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => setFilterOpen(false)}>
                <Text style={styles.modalBtnText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalApply]} onPress={() => setFilterOpen(false)}>
                <Text style={[styles.modalBtnText, { color: '#000' }]}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  bg: { flex: 1 },
  container: { flex: 1 },
  content: { padding: 30 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    top: 25,
    right: 10,
    bottom: 20,
  },
  backText: { color: '#fff', fontWeight: '700', marginLeft: 4 },
  titleWrap: { alignItems: 'center', marginTop: 38, marginBottom: 30 },
  title: { marginTop: -15, color: '#fff', fontSize: 30, fontWeight: '800', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  error: { color: '#ff7070', marginVertical: 8 },
  center: { paddingVertical: 24, alignItems: 'center' },
  card: { backgroundColor: 'rgba(0, 0, 0, 0.25)', borderRadius: 16, padding: 12, marginBottom: 16, borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 6 },
  metricLabel: { color: '#fff', fontSize: 20, fontWeight: '700', paddingHorizontal:6, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  metricValue: { color: '#FFD700', fontSize: 18, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  subLabel: { color: '#ddd', fontSize: 14, paddingHorizontal:6 },
  subValue: { color: '#fff', fontSize: 14, fontWeight: '600', paddingHorizontal:6 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 8 },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 5, marginBottom: 8, paddingHorizontal: 6, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  itemRowDivider: { borderTopColor: 'rgba(255,255,255,0.1)', borderTopWidth: 1 },
  itemDate: { color: '#fff', fontWeight: '700', paddingHorizontal:6, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  itemDesc: { color: '#ddd', marginTop: 2, paddingHorizontal:6 },
  itemDescGame: { color: '#FFD700', fontWeight: '300' },
  itemEarned: { color: '#FFD700', fontWeight: '700', paddingHorizontal:6, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  itemSkill: { color: '#ccc', marginTop: 2, paddingHorizontal:6, fontWeight: '400' },

  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sortWrap: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 999, padding: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  sortBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  sortBtnActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  sortText: { color: '#fff', fontWeight: '700' },
  sortTextActive: { color: '#FFD700' },
  filterBtn: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 65, backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  filterText: { color: '#fff', fontWeight: '700' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '90%', backgroundColor: 'rgba(40,40,48,0.9)', borderRadius: 26, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  modalHint: { color: '#bbb', marginTop: 6, marginBottom: 10 },
  modalRow: { flexDirection: 'row' },
  modalLabel: { color: '#fff', marginBottom: 6 },
  modalInput: { height: 40, borderRadius: 8, paddingHorizontal: 10, backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  modalBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginLeft: 8 },
  modalCancel: { backgroundColor: 'rgba(255,255,255,0.12)' },
  modalApply: { backgroundColor: '#FFD700' },
  modalBtnText: { color: '#fff', fontWeight: '700' },
});

export default SkillDetail;
