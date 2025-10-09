import React, { useEffect, useRef, useState, useCallback } from 'react';
import { endpoints, BASE_URL } from '../../api';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ImageBackground,
  ActivityIndicator,
  Vibration,            // NEW: haptic feedback (optional)
  Platform,
} from 'react-native';
import { getAccessToken } from '../../auth';

// Must match backend utils.ALLOWED_ELEMENTS
const COLORS = ['red', 'blue', 'green', 'yellow'];

/** ---------- WS types (consumers.py multiplayer) ---------- */
type WsLobbyState = {
  type: 'lobby_state';
  started: boolean;
  ready_count: number;
  expected_count: number;
};
type WsLobbyCountdown = {
  type: 'lobby_countdown';
  seconds: number;
};
type WsPatternSequence = {
  type: 'pattern_sequence';
  round_number: number;
  sequence: string[];
};
type WsAnswerResult = {
  type: 'answer_result';
  is_correct: boolean;
  is_complete: boolean;
  round_score?: number;
  error?: string;
};
type WsGameOver = {
  type: 'game_over';
  scores: { username: string; rounds_completed: number; score: number }[];
};
// NEW: in-game round countdown
type WsRoundCountdown = {
  type: 'round_countdown';
  seconds: number;
};

type WsIncoming =
  | WsLobbyState
  | WsLobbyCountdown
  | WsPatternSequence
  | WsAnswerResult
  | WsGameOver
  | WsRoundCountdown;

/*********** REST responses **************/
type CreateResp = {
  success: boolean;
  game_state_id: number;
  current_round: number;
  max_rounds: number;
  is_multiplayer: boolean;
  pattern_sequence?: string[][];
  error?: string;
};

type ValidateResp = {
  success: boolean;
  result: 'correct' | 'incorrect';
  round_score: number;
  is_complete: boolean;
  current_round?: number;
  scores?: { username: string; rounds_completed: number; score: number }[];
  error?: string;
};

type Props = { route: any; navigation: any };



// Generate WS path based on BASE_URL
const wsUrlFor = (gameStateId: number, accessToken: string) => {
  const base = BASE_URL.replace(/\/+$/, '');
  const scheme = base.startsWith('https') ? 'wss' : 'ws';
  return `${scheme}://${base.replace(/^https?:\/\//, '')}/ws/pattern/${gameStateId}/?token=${accessToken}`;
};

const PatternGameScreen: React.FC<Props> = ({ route, navigation }) => {
  // Use only the formal route params
  const challengeId: number | undefined = route?.params?.challengeId;

  // -------- Game state --------
  const [loading, setLoading] = useState(true);
  const [gameStateId, setGameStateId] = useState<number | null>(null);
  const [level, setLevel] = useState<number>(1);
  const [maxRounds, setMaxRounds] = useState<number>(5);

  // Single-player stores the entire pattern; multiplayer relies on server-pushed sequence each round
  const [patternSeq, setPatternSeq] = useState<string[][]>([]);
  const [currentSeqLen, setCurrentSeqLen] = useState<number>(0);

  // -------- UI state --------
  const [showingPattern, setShowingPattern] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [playerInput, setPlayerInput] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Lobby/WS (multiplayer)
  const [lobbyStatus, setLobbyStatus] = useState<string>(''); // e.g., waiting...
  const [countdown, setCountdown] = useState<number | null>(null); // shared for lobby & in-game
  const [isMultiplayer, setIsMultiplayer] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Non-blocking toast
  const [toast, setToast] = useState<string>('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((text: string, ms = 1200) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(text);
    toastTimerRef.current = setTimeout(() => setToast(''), ms);
  }, []);

  // Play queue (avoids missing animations during popups/actions)
  const queueRef = useRef<string[][]>([]);
  const playingRef = useRef<boolean>(false);

  // Small sleep helper
  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  // Play a single sequence (works for single/multiplayer)
  const playSequence = useCallback(
    async (seq: string[]) => {
      if (!seq?.length) return;
      playingRef.current = true;
      setShowingPattern(true);
      setPlayerInput([]);
      for (const color of seq) {
        const idx = COLORS.indexOf(color);
        setHighlightIndex(idx >= 0 ? idx : null);
        await sleep(600);
        setHighlightIndex(null);
        await sleep(200);
      }
      setShowingPattern(false);
      playingRef.current = false;
    },
    []
  );

  // Queue scheduler
  const drainQueue = useCallback(async () => {
    if (playingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    await playSequence(next);
    if (queueRef.current.length) drainQueue();
  }, [playSequence]);

  // For single-player: play a specific round (sequence from patternSeq)
  const playRound = useCallback(
    async (roundNumber: number, fullSeq: string[][] = patternSeq) => {
      const seq = fullSeq[roundNumber - 1] || [];
      setCurrentSeqLen(seq.length);
      queueRef.current.push(seq);
      drainQueue();
    },
    [patternSeq, drainQueue]
  );

  // Create WS (multiplayer)
  const openWs = useCallback(
    async (id: number) => {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Not authenticated");
      }
      const url = wsUrlFor(id, accessToken);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setLobbyStatus('connected');
        // Immediately declare ready (could also be manual via button)
        ws.send(JSON.stringify({ type: 'player_ready' }));
      };

      ws.onmessage = async (ev) => {
        let msg: WsIncoming;
        try {
          msg = JSON.parse(ev.data as string) as WsIncoming;
        } catch {
          return;
        }

        switch (msg.type) {
          case 'lobby_state': {
            const s = msg.started
              ? 'started'
              : `waiting ${msg.ready_count}/${msg.expected_count}`;
            setLobbyStatus(s);
            break;
          }
          case 'lobby_countdown': {
            setCountdown(msg.seconds);
            setLobbyStatus(`starting in ${msg.seconds}`);
            break;
          }
          case 'round_countdown': { // NEW: in-game countdown
            setCountdown(msg.seconds);
            setLobbyStatus(`Next round in ${msg.seconds}`);
            break;
          }
          case 'pattern_sequence': {
            // Server pushes sequence for this round (multiplayer)
            setLobbyStatus('');
            setCountdown(null);
            setLevel(msg.round_number);
            setCurrentSeqLen(msg.sequence.length);
            queueRef.current.push(msg.sequence);
            drainQueue();
            break;
          }
          case 'answer_result': {
            if (msg.error) {
              // NEW: special UX for frozen
              if (msg.error === 'Round frozen') {
                showToast('⏸️ Next round starting…');
              } else {
                showToast(`⚠️ ${msg.error}`);
              }
              break;
            }
            // if (msg.is_complete) {
            //   Alert.alert('🎉 Finished', 'Great job!', [
            //     { text: 'OK', onPress: () => navigation.goBack() },
            //   ]);
            //   break;
            // }
            if (msg.is_correct) {
              if (Platform.OS === 'android')  
              showToast('✅ Correct');
              setPlayerInput([]);
            } else {
              if (Platform.OS === 'android') Vibration.vibrate([0, 150, 60, 150]); // NEW: pattern
              showToast('❌ Incorrect, try again');
              setPlayerInput([]);
              // Depending on server design, it may resend the sequence. If not, we could replay here.
            }
            break;
          }
          case 'game_over': {
            const lines = msg.scores
              .sort((a, b) => b.score - a.score)
              .map((s) => `${s.username}: ${s.score} (R${s.rounds_completed})`)
              .join('\n');
            Alert.alert('🏁 Game Completed', lines || 'No scores', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
            break;
          }
        }
      };

      ws.onerror = (e) => {
        setLobbyStatus('ws error');
        console.log('WS error', e);
      };
      ws.onclose = () => {
        setLobbyStatus('disconnected');
      };
    },
    [navigation, showToast, drainQueue]
  );

  const cleanupWs = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    try { ws.close(1000, 'screen exit'); } catch {}
    wsRef.current = null;
  }, []);

  // Init: create/reuse a game; multiplayer → open WS; single-player → play immediately
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        if (challengeId == null) throw new Error('Missing challengeId');

      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Not authenticated");
      }

        const res = await fetch(endpoints.patternCreate, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ challenge_id: challengeId }),
        });
        if (res.status === 403) {
          const data = await res.json();
          if (data.code === 'JOINS_CLOSED' || data.code === 'GAME_ENDED') {
              Alert.alert('Join closed', 'This game can no longer be joined.');
              navigation.goBack();
              return;
          }
      }
        const j: CreateResp = await res.json();
        if (!res.ok || !j.success) throw new Error(j?.error || 'create failed');

        setGameStateId(j.game_state_id);
        setLevel(j.current_round);
        setMaxRounds(j.max_rounds);
        setIsMultiplayer(!!j.is_multiplayer);

        if (j.is_multiplayer) {
          openWs(j.game_state_id);
          // Multiplayer: sequence is pushed by server
        } else {
          // Single-player: use provided pattern
          if (Array.isArray(j.pattern_sequence)) {
            setPatternSeq(j.pattern_sequence);
            setCurrentSeqLen(j.pattern_sequence[j.current_round - 1]?.length ?? 0);
            await playRound(j.current_round, j.pattern_sequence);
          } else {
            Alert.alert('Missing pattern', 'pattern_sequence not provided by server.');
          }
        }
      } catch (e: any) {
        Alert.alert('Init Error', e?.message ?? 'Failed to init pattern game');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    init();
    return () => {
      wsRef.current?.close();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId]);

  // Single-player resync (multiplayer does not need)
  const resyncFromServer = useCallback(async () => {
    if (isMultiplayer) return;
    try {
      if (challengeId == null) return;

      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Not authenticated");
      }
      const res = await fetch(endpoints.patternCreate, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ challenge_id: challengeId }),
      });
      const j: CreateResp = await res.json();
      if (!res.ok || !j.success) throw new Error(j?.error || 'resync failed');

      setGameStateId(j.game_state_id);
      setLevel(j.current_round);
      setMaxRounds(j.max_rounds);
      if (Array.isArray(j.pattern_sequence)) {
        setPatternSeq(j.pattern_sequence);
        setCurrentSeqLen(j.pattern_sequence[j.current_round - 1]?.length ?? 0);
        await playRound(j.current_round, j.pattern_sequence);
      }
    } catch (e: any) {
      Alert.alert('Resync Error', e?.message ?? 'Failed to resync');
    }
  }, [challengeId, isMultiplayer, playRound]);

  // Handle color taps
  const handlePress = (color: string) => {
    // NEW: also block during countdown
    if (showingPattern || submitting || countdown !== null) return;
    setPlayerInput((prev) => [...prev, color]);
  };

  // Submit (multiplayer via WS; single-player via REST)
  const submitAnswer = async () => {
    // NEW: also block during countdown
    if (showingPattern || submitting || countdown !== null) return;
    if (!gameStateId) {
      Alert.alert('Error', 'Missing game_state_id');
      return;
    }
    // Restrict input length (single-player: from pattern; multiplayer: from server sequence)
    if (currentSeqLen > 0 && playerInput.length !== currentSeqLen) {
      Alert.alert('Incomplete', `This round needs ${currentSeqLen} taps.`);
      return;
    }

    if (isMultiplayer && wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: 'player_answer',
          round_number: level,
          sequence: playerInput,
        })
      );
      return;
    }

    // Single-player → REST
    try {
      setSubmitting(true);
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Not authenticated");
      }
      const res = await fetch(endpoints.patternValidate, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          game_state_id: gameStateId,
          round_number: level,
          player_sequence: playerInput,
        }),
      });
      const j: ValidateResp = await res.json();

      if (!res.ok) {
        Alert.alert('Validate Error', j?.error ?? 'Failed to validate');
        setPlayerInput([]);
        await resyncFromServer();
        return;
      }

      if (j.success && j.result === 'correct') {
        if (j.is_complete) {
          Alert.alert('🎉 Finished', `Great job! +${j.round_score}`, [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          if (Platform.OS === 'android')  // NEW
          showToast(`✅ +${j.round_score}`);
          const nextRound =
            typeof j.current_round === 'number' && j.current_round > level
              ? j.current_round
              : level + 1;
          setLevel(nextRound);
          setPlayerInput([]);
          await playRound(nextRound);
        }
      } else {
        if (Platform.OS === 'android') Vibration.vibrate([0, 150, 60, 150]); // NEW
        showToast('❌ Incorrect');
        setPlayerInput([]);
        await playRound(level);
      }
    } catch (e: any) {
      Alert.alert('Network Error', e?.message ?? 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ImageBackground source={require('../../images/cgpt.png')} style={styles.background} resizeMode="cover">
        <View style={styles.container}>
          <ActivityIndicator />
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={require('../../images/cgpt.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        {/* Exit */}
        <TouchableOpacity style={styles.exitButton} onPress={() => { cleanupWs(); navigation.goBack(); }}>
          <Text style={styles.exitText}>Exit</Text>
        </TouchableOpacity>

        <Text style={styles.title}>🧠 Pattern Memory Game</Text>
        <Text style={styles.subtitle}>Round: {level}/{maxRounds}</Text>

        {/* Multiplayer lobby status / countdown */}
        {isMultiplayer && (
          <Text style={[styles.subtitle, { marginTop: -4 }]}>
            {countdown != null ? `Starting in ${countdown}…` : lobbyStatus || 'connecting…'}
          </Text>
        )}

        {/* Palette */}
        <View style={styles.patternRow}>
          {COLORS.map((c, i) => (
            <View
              key={c}
              style={[
                styles.patternBox,
                { backgroundColor: c },
                highlightIndex === i && styles.highlightBox,
              ]}
            />
          ))}
        </View>

        {/* Controls */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          {/* No Replay for multiplayer (server handles it) */}
          {!isMultiplayer && (
            <TouchableOpacity
              style={[styles.smallBtn, showingPattern && { opacity: 0.5 }]}
              onPress={() => playRound(level)}
              disabled={showingPattern || submitting}
            >
              <Text style={styles.smallBtnText}>{showingPattern ? 'Playing...' : 'Replay Round'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.smallBtn, (showingPattern || playerInput.length === 0) && { opacity: 0.5 }]}
            onPress={() => setPlayerInput([])}
            disabled={showingPattern || playerInput.length === 0 || submitting}
          >
            <Text style={styles.smallBtnText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.smallBtnPrimary,
              // NEW: also dim when countdown is active
              (showingPattern || submitting || playerInput.length === 0 || countdown !== null) && { opacity: 0.6 },
            ]}
            onPress={submitAnswer}
            disabled={showingPattern || submitting || playerInput.length === 0 || countdown !== null}
          >
            <Text style={styles.smallBtnPrimaryText}>{submitting ? 'Submitting...' : 'Submit'}</Text>
          </TouchableOpacity>
        </View>

        {/* Player input preview (shows required length this round) */}
        <Text style={styles.subtitle}>
          Your Input ({playerInput.length}/{currentSeqLen}): {playerInput.join(', ')}
        </Text>

        {/* Color buttons */}
        <View style={styles.colorRow}>
          {COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.colorButton,
                { backgroundColor: c, opacity: showingPattern ? 0.6 : 1 },
              ]}
              disabled={showingPattern || submitting || countdown !== null}  // NEW: block during countdown
              onPress={() => handlePress(c)}
            />
          ))}
        </View>

        {/* Countdown overlay (for lobby & in-game) */}
        {isMultiplayer && countdown !== null && (
          <View style={styles.overlay}>
            <Text style={[styles.countdownText]}>
              {countdown}
            </Text>
          </View>
        )}

        {/* Non-blocking toast */}
        {!!toast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  exitButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'white',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    zIndex: 10,
  },
  exitText: { fontWeight: 'bold' },
  title: { fontSize: 30, fontWeight: 'bold', color: 'white', marginBottom: 10 },
  subtitle: { fontSize: 18, color: 'white', marginBottom: 10 },
  patternRow: { flexDirection: 'row', marginBottom: 20 },
  patternBox: { width: 50, height: 50, margin: 5, borderRadius: 6, opacity: 0.85 },
  highlightBox: { borderWidth: 3, borderColor: 'white' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  colorButton: { width: 70, height: 70, margin: 10, borderRadius: 12, borderWidth: 2, borderColor: 'black' },
  smallBtn: { backgroundColor: 'white', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  smallBtnText: { fontWeight: '600' },
  smallBtnPrimary: { backgroundColor: '#0ea5e9', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  smallBtnPrimaryText: { color: 'white', fontWeight: '700' },

  // overlays
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  countdownText: { fontSize: 64, fontWeight: '900', color: '#fff' },

  toast: {
    position: 'absolute',
    top: 90,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  toastText: { color: '#fff', fontWeight: '700' },
});

export default PatternGameScreen;
