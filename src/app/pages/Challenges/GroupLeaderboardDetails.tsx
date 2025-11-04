"use client"

import type React from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, type NavigationProp } from "@react-navigation/native";
import { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { endpoints, groupLeaderboardHistory } from "../../api";
import { getAccessToken } from "../../auth";

type LeaderRow = { name: string; points: number; rank: number };
type RouteParams = { groupId: number; myName: string };
type Props = { navigation: NavigationProp<any> };

// local date helpers
const parseLocalDate = (iso: string) => {
  const parts = (iso || '').split('-');
  const y = Number(parts[0] ?? 1970);
  const m = Number(parts[1] ?? 1);
  const d = Number(parts[2] ?? 1);
  return new Date(y, Math.max(0, m - 1), d);
};
const toISODateLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const GroupLeaderboardDetails: React.FC<Props> = ({ navigation }) => {
  const { params } = useRoute() as { params: RouteParams };
  const { groupId, myName } = params;

  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [history, setHistory] = useState<Record<string, LeaderRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  // optional date pickers (no strict min/max window for groups)
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [picker, setPicker] = useState<"start" | "end" | null>(null);

  // overall leaderboard
  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) throw new Error("Not authenticated");
        const res = await axios.get(endpoints.groupLeaderboard(groupId), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (ignore) return;
        const data = res.data;
        setRows(Array.isArray(data) ? data : data.leaderboard ?? []);
      } catch {
        if (!ignore) setErr("Failed to load group leaderboard");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [groupId]);

  // history (date range)
  useEffect(() => {
    let ignore = false;
    if (!showHistory) return;
    if (!startDate && !endDate) { setHistory({}); return; }
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) throw new Error("Not authenticated");
        const url = groupLeaderboardHistory(groupId, startDate ?? undefined, endDate ?? undefined);
        const res = await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!ignore) setHistory(res.data.history ?? {});
      } catch {
        if (!ignore) setErr("Failed to load history");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [groupId, showHistory, startDate, endDate]);

  // helpers
  const filterRows = (arr: LeaderRow[]) => {
    const q = query.trim().toLowerCase();
    return q ? arr.filter(r => r.name.toLowerCase().includes(q)) : arr;
  };
  const sectionData = useMemo(() => {
    if (!showHistory) return [];
    return Object.entries(history)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, list]) => ({ title: date, data: filterRows(list) }));
  }, [history, showHistory, query]);
  const listData = useMemo(() => filterRows(rows), [rows, query]);

  const renderRow = useCallback(({ item }: { item: LeaderRow }) => (
    <View style={[styles.row, item.name === myName && styles.meRow]}>
      <Text style={styles.rank}>{item.rank}.</Text>
      <Text style={[styles.name, item.name === myName && styles.meName]}>
        {item.name === myName ? "You" : item.name}
      </Text>
      <Text style={styles.points}>{item.points}</Text>
    </View>
  ), [myName]);

  return (
    <ImageBackground source={require("../../images/cgpt.png")} style={styles.bg} resizeMode="cover">
      <View style={styles.container}>
        {/* header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.h1}>Group Leaderboard</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.togglePill, !showHistory && styles.toggleActive]}
            onPress={() => setShowHistory(false)}
          >
            <Text style={[styles.toggleTxt, !showHistory && styles.toggleTxtActive]}>Overall</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.togglePill, showHistory && styles.toggleActive]}
            onPress={() => setShowHistory(true)}
          >
            <Text style={[styles.toggleTxt, showHistory && styles.toggleTxtActive]}>History</Text>
          </TouchableOpacity>
        </View>

        {/* date-range (history only) */}
        {showHistory && (
          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setPicker("start")}>
              <Ionicons name="calendar-outline" size={16} color="#ffd700" />
              <Text style={styles.dateTxt}>{startDate ?? "Start date"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setPicker("end")}>
              <Ionicons name="calendar-outline" size={16} color="#ffd700" />
              <Text style={styles.dateTxt}>{endDate ?? "End date"}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* search */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#999" />
          <TextInput
            placeholder="Search members…"
            placeholderTextColor="#999"
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        {/* pickers */}
        {picker && (
          <DateTimePicker
            value={parseLocalDate((picker === "start" ? (startDate ?? toISODateLocal(new Date())) : (endDate ?? toISODateLocal(new Date()))))}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={(_, d) => {
              setPicker(null);
              if (!d) return;
              const iso = toISODateLocal(d);
              if (picker === "start") setStartDate(iso); else setEndDate(iso);
            }}
          />
        )}

        {/* errors / loader */}
        {loading && <ActivityIndicator color="#FFD700" style={{ marginTop: 30 }} />}
        {err && <Text style={styles.error}>{err}</Text>}

        {/* list */}
        {!loading && !err && (
          showHistory ? (
            <SectionList
              sections={sectionData}
              keyExtractor={item => item.name + item.rank}
              renderItem={renderRow}
              renderSectionHeader={({ section: { title } }) => (
                <Text style={styles.sectionHeader}>{title}</Text>
              )}
              contentContainerStyle={{ paddingBottom: 60 }}
              stickySectionHeadersEnabled={false}
            />
          ) : (
            <SectionList
              sections={[{ title: "", data: listData }]}
              keyExtractor={item => item.name}
              renderItem={renderRow}
              contentContainerStyle={{ paddingBottom: 60 }}
              stickySectionHeadersEnabled={false}
            />
          )
        )}
      </View>
    </ImageBackground>
  );
};

export default GroupLeaderboardDetails;

const styles = StyleSheet.create({
  bg: { flex: 1 },
  container: { flex: 1, paddingTop: 50, paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  h1: { flex: 1, textAlign: "center", color: "#fff", fontSize: 28, fontWeight: "700" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },

  toggleRow:  { flexDirection: 'row', alignSelf: 'center', marginBottom: 15 },
  togglePill: { paddingHorizontal: 28, paddingVertical: 10, borderRadius: 18, marginHorizontal: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'transparent' },
  toggleActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  toggleTxt:  { color: '#fff', fontWeight: '600' },
  toggleTxtActive: { color: '#FFD700' },

  dateRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  dateBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(50,50,60,0.30)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, flex: 1, marginHorizontal: 4 },
  dateTxt: { marginLeft: 6, color: "#fff" },

  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(50,50,60,0.30)", borderRadius: 15, paddingHorizontal: 14, marginBottom: 18 },
  searchInput: { flex: 1, height: 44, color: "#fff", marginLeft: 6 },

  error: { color: "#F88", textAlign: "center", marginTop: 20 },

  sectionHeader: { marginTop: 24, marginBottom: 8, fontSize: 18, fontWeight: "700", color: "#FFD700" },

  row: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(50,50,60,0.25)", borderRadius: 14, padding: 14, marginBottom: 10 },
  meRow: { backgroundColor: "rgba(255,215,0,0.20)" },
  rank: { width: 36, color: "#FFD700", fontWeight: "600" },
  name: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "600" },
  meName: { color: "#FFD700" },
  points: { width: 80, textAlign: "right", color: "#FFD700", fontWeight: "700" },
});
