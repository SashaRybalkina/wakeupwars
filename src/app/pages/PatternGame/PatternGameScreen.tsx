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
import { useUser } from '../../context/UserContext';

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
// NEW: join-window closed event
type WsJoinWindowClosed = {
  type: 'join_window_closed';
  server_now?: string;
};

type WsTimerExpired = { type: 'timer_expired' };
type WsTimeout = { type: 'timeout' };

type WsIncoming =
  | WsLobbyState
  | WsLobbyCountdown
  | WsPatternSequence
  | WsAnswerResult
  | WsGameOver
  | WsRoundCountdown
  | WsJoinWindowClosed
  | WsTimerExpired
  | WsTimeout;

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
  const challengeId: number = route?.params?.challengeId as number;
  const challName: string | undefined = route?.params?.challName;
  const whichChall: string | undefined = route?.params?.whichChall;

  const { logout } = useUser();

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
  const [lobbyStatus, setLobbyStatus] = useState<string>('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isMultiplayer, setIsMultiplayer] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const [waitingActive, setWaitingActive] = useState<boolean>(false);
  const [readyCount, setReadyCount] = useState<number>(0);
  const [expectedCount, setExpectedCount] = useState<number>(0);
  const [members, setMembers] = useState<{ id: number; name: string }[]>([]);
  const [onlineIds, setOnlineIds] = useState<number[]>([]);
  const [joinDeadlineISO, setJoinDeadlineISO] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 5-minute game timer (mirrors Sudoku)
  const [gameTimeLeft, setGameTimeLeft] = useState<number>(30); // 300 for prod
  const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerExpiredSentRef = useRef(false);
  const gameTimerStartedRef = useRef(false);
  const [gameCompleted, setGameCompleted] = useState(false);

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

  // Start a local countdown to the join deadline (for waiting room)
  const startLocalCountdown = useCallback((deadlineISO: string | null) => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setJoinDeadlineISO(deadlineISO);
    if (!deadlineISO) { setRemainingSec(null); return; }
    const deadline = new Date(deadlineISO).getTime();
    const tick = () => {
      const now = Date.now();
      const diffMs = Math.max(0, deadline - now);
      setRemainingSec(Math.floor(diffMs / 1000));
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
  }, []);

  // Game timer helpers
  const handleTimerExpired = useCallback(async () => {
    if (timerExpiredSentRef.current || !gameStateId) return;
    timerExpiredSentRef.current = true;
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;
      const response = await fetch(endpoints.gameTimerExpired, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          model: 'PatternMemorizationGameState',
          game_state_id: gameStateId,
        }),
      });
      const data = await response.json().catch(() => ({} as any));
      console.log('[Pattern] Timer expired signal sent to backend', data);
      // For single-player, show alert here (no WS)
      if (!isMultiplayer) {
        if (gameTimerRef.current) clearInterval(gameTimerRef.current);
        Alert.alert("Time's Up!", 'The 5-minute game timer has expired.', [
          { text: 'OK', onPress: () => navigation.navigate('ChallDetails', { challId: challengeId, challName, whichChall }) },
        ]);
      }
    } catch (e) {
      console.error('[Pattern] Failed to send timer expired signal:', e);
    }
  }, [gameStateId, isMultiplayer, navigation, challengeId, challName, whichChall]);

  const startGameTimer = useCallback(() => {
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    setGameTimeLeft(30);
    timerExpiredSentRef.current = false;
    gameTimerStartedRef.current = true;
    gameTimerRef.current = setInterval(() => {
      setGameTimeLeft((prev) => {
        if (prev <= 1) {
          if (gameTimerRef.current) clearInterval(gameTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

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
      const url = wsUrlFor(id, accessToken);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setLobbyStatus('connected');
        setWaitingActive(true);
        ws.send(JSON.stringify({ type: 'player_ready' }));
        (async () => {
          try {
            const detailRes = await fetch(endpoints.challengeDetail(challengeId), {
              headers: { 'Authorization': `Bearer ${accessToken}` },
            });
            const detail = await detailRes.json();
            setMembers(detail?.members || []);
          } catch {}
        })();
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
            setReadyCount((msg as any).ready_count || 0);
            setExpectedCount((msg as any).expected_count || 0);
            if (Array.isArray((msg as any).online_ids)) setOnlineIds((msg as any).online_ids);
            // Join window deadline for waiting-room countdown
            if ((msg as any).join_deadline_at) startLocalCountdown((msg as any).join_deadline_at as any);
            setWaitingActive(!msg.started);
            if (msg.started && !gameTimerStartedRef.current) {
              startGameTimer();
            }
            break;
          }
          case 'lobby_countdown': {
            // Hide waiting overlay so 3-2-1 can be fully visible
            setWaitingActive(false);
            // Stop join-window countdown once 3-2-1 begins
            if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
            setJoinDeadlineISO(null);
            setRemainingSec(null);
            setCountdown(msg.seconds);
            setLobbyStatus(`starting in ${msg.seconds}`);
            break;
          }
          case 'join_window_closed': {
            setWaitingActive(false);
            // Stop join-window countdown immediately when closed
            if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
            setJoinDeadlineISO(null);
            setRemainingSec(null);
            setLobbyStatus('join window closed');
            if (!gameTimerStartedRef.current) startGameTimer();
            break;
          }
          case 'round_countdown': { // NEW: in-game countdown
            setCountdown(msg.seconds);
            setLobbyStatus(`Next round in ${msg.seconds}`);
            break;
          }
          case 'timer_expired': {
            if (gameTimerRef.current) clearInterval(gameTimerRef.current);
            setTimeout(() => navigation.navigate("ChallDetails", { challId: challengeId, challName, whichChall }), 2000);
            Alert.alert("Time's Up!", 'The 5-minute game timer has expired.', [
              { text: 'OK', onPress: () => navigation.navigate('ChallDetails', { challId: challengeId, challName, whichChall }) },
            ]);
            break;
          }
          case 'timeout': {
            setTimeout(() => navigation.navigate("ChallDetails", { challId: challengeId, challName, whichChall }), 2000);
            Alert.alert('Timeout', 'You have been timed out for inactivity.', [
              { text: 'OK', onPress: () => navigation.navigate('ChallDetails', { challId: challengeId, challName, whichChall }) },
            ]);
            break;
          }
          case 'pattern_sequence': {
            // Server pushes sequence for this round (multiplayer)
            setLobbyStatus('');
            setCountdown(null);
            setLevel(msg.round_number);
            setCurrentSeqLen(msg.sequence.length);
            // Fallback: ensure game timer started when first round arrives
            if (!gameTimerStartedRef.current) startGameTimer();
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
            setGameCompleted(true);
            if (gameTimerRef.current) clearInterval(gameTimerRef.current);
            setTimeout(() => navigation.navigate("ChallDetails", { challId: challengeId, challName, whichChall }), 2000);
            const lines = msg.scores
              .sort((a, b) => b.score - a.score)
              .map((s) => `${s.username}: ${s.score} (R${s.rounds_completed})`)
              .join('\n');
            Alert.alert('🏁 Game Completed', lines || 'No scores', [
              { text: 'OK', onPress: () => navigation.navigate("ChallDetails", { challId: challengeId, challName, whichChall }) },
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
            // Single-player: start game timer immediately
            startGameTimer();
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
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId]);

  // Watch for game timer expiry
  useEffect(() => {
    if (gameTimeLeft === 0 && !gameCompleted) {
      handleTimerExpired();
    }
  }, [gameTimeLeft, gameCompleted, handleTimerExpired]);

  // Single-player resync (multiplayer does not need)
  const resyncFromServer = useCallback(async () => {
    if (isMultiplayer) return;
    try {
      if (challengeId == null) return;

      const accessToken = await getAccessToken();
      if (!accessToken) {
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
          try {
            if (!isMultiplayer && gameStateId) {
              const token2 = await getAccessToken();
              if (token2) {
                await fetch(endpoints.gameTimerExpired, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token2}`,
                  },
                  body: JSON.stringify({
                    model: 'PatternMemorizationGameState',
                    game_state_id: gameStateId,
                  }),
                });
              }
            }
          } catch (e) {
            console.error('[Pattern] finalize on complete failed', e);
          }
          Alert.alert('🎉 Finished', `Great job! +${j.round_score}`, [
            { text: 'OK', onPress: () => navigation.navigate('ChallDetails', { challId: challengeId, challName, whichChall }) },
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
      <ImageBackground source={require('../../images/cgpt4.png')} style={styles.background} resizeMode="cover">
        <View style={styles.container}>
          <ActivityIndicator />
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={require('../../images/cgpt4.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <TouchableOpacity style={styles.exitButton} onPress={() => { cleanupWs(); navigation.goBack(); }}>
          <Text style={styles.exitText}>Exit</Text>
        </TouchableOpacity>

        {isMultiplayer && waitingActive && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10 }}>
            <View style={{ width: '80%', padding: 16, backgroundColor: '#222', borderRadius: 12, borderWidth: 1, borderColor: '#444' }}>
              <Text style={{ color: 'white', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>Waiting Room</Text>
              {remainingSec != null && (
                <Text style={{ color: 'white', textAlign: 'center' }}>Starts in {formatTime(remainingSec)}</Text>
              )}
              <View style={{ marginTop: 8 }}>
                {members.map(m => {
                  const isOnline = onlineIds?.some(id => String(id) === String(m.id));
                  const initials = (m.name || '').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
                  return (
                    <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, opacity: isOnline ? 1 : 0.5 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: isOnline ? '#FFD700' : '#999', borderWidth: isOnline ? 2 : 1, borderColor: isOnline ? '#fff' : '#666' }}>
                        <Text style={{ color: isOnline ? '#333' : '#eee', fontWeight: '700' }}>{initials || '?'}</Text>
                      </View>
                      <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>{m.name}</Text>
                      {isOnline && <View style={{ marginLeft: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#00E676' }} />}
                    </View>
                  );
                })}
              </View>
              <Text style={{ color: 'white', textAlign: 'center', marginTop: 8 }}>Players: {readyCount}/{expectedCount}</Text>
            </View>
          </View>
        )}

        <Text style={styles.title}>🧠 Pattern Memory Game</Text>
        <Text style={styles.subtitle}>Round: {level}/{maxRounds}</Text>
        <Text style={[styles.subtitle, { marginTop: -4 }]}>Game Timer: {formatTime(gameTimeLeft)}</Text>

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
  title: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 10, marginTop: -30, textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 2 },
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
    zIndex: 20, // ensure above waiting room overlay
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
