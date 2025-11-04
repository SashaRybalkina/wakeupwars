// TypingRace.tsx

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
  Dimensions,
} from 'react-native';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { BASE_URL, endpoints } from '../../api';
import { useUser } from '../../context/UserContext';
import { getAccessToken } from "../../auth";
import styles from './Styles'

// ===============================
// ⚙️ Game Config
// ===============================
const GAME_SECONDS = 60; // total game time
const CAR_SIZE = 24;
const COUNTDOWN_START = 3; // pre-game countdown

const screenWidth = Dimensions.get('window').width;
const SIDE_PADDING = 10;
const FLAG_WIDTH = 24;
const PROGRESS_WIDTH = 50;
const remainingWidth = screenWidth - SIDE_PADDING * 2 - FLAG_WIDTH - PROGRESS_WIDTH;

const NAME_RATIO = 0.3;
const TRACK_RATIO = 0.7;
const NAME_WIDTH = remainingWidth * NAME_RATIO;
const TRACK_WIDTH = remainingWidth * TRACK_RATIO;

const COLOR_POOL = [
  'hotpink', 'coral', 'orange', 'lawngreen', 'aqua',
  'deepskyblue', 'mediumorchid', 'mediumvioletred',
  'magenta', 'thistle', 'powderblue', 'plum', 'peachpuff', 'palegreen'
];

// ===============================
// 🧱 Type definitions
// ===============================
type Props = { navigation: NavigationProp<any>; };
type PlayerProgress = { username: string; color: string; progress: number; wpm: number; isMe?: boolean; };

/** ✅ Messages from backend WebSocket server */
type ServerToClientMessage =
  | {
      type: 'lobby_state'; // when waiting room updates
      created_at: string;
      join_deadline_at: string | null;
      server_now: string;
      ready_count: number;
      expected_count: number;
      online_ids?: number[];
    }
  | {
      type: 'join_window_closed'; // when waiting room is closed and countdown should start
      server_now?: string;
    }
  | {
      type: 'leaderboard_update'; // real-time progress update from server
      leaderboard: {
        username: string;
        progress: number;
        accuracy: number;
        score: number;
        rank: number | null;
        is_completed: boolean;
      }[];
      winner?: string; // optional, when someone wins
    }
  | {
      type: 'game_complete'; // final leaderboard after game ends
      leaderboard: {
        username: string;
        score: number;
        accuracy: number;
        rank: number;
      }[];
    };

// ===============================
// 🕒 Helper for time formatting
// ===============================
const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// ===============================
// 🏁 Main Component
// ===============================
const TypingRace: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { challId, challName = 'Typing Race' } = (route.params as any) || {};
  const { user } = useUser();

  // ===============================
  // 🧠 Helper: Save scores to backend
  // ===============================
  const saveScores = async (payload: {
    challenge_id: number;
    game_name?: string;
    date?: string;
    scores: { username: string; score: number; accuracy?: number; inaccuracy?: number }[];
  }) => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error('Not authenticated');

      const res = await fetch(endpoints.submitGameScores(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Submit failed: ${text}`);
      }

      console.log('[DEBUG] Score saved successfully to leaderboard');
    } catch (e) {
      console.error('Failed to save score:', e);
    }
  };

  // ===============================
  // 🧭 Game State
  // ===============================
  const [waitingActive, setWaitingActive] = useState(false); // true if waiting room active
  const [countdown, setCountdown] = useState<number | null>(COUNTDOWN_START);
  const [gameTime, setGameTime] = useState(GAME_SECONDS);
  const [gameOver, setGameOver] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const [isMultiplayer, setIsMultiplayer] = useState(false);

  const [readyCount, setReadyCount] = useState(0);
  const [expectedCount, setExpectedCount] = useState(0);
  const [joinDeadlineISO, setJoinDeadlineISO] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [canStartNow, setCanStartNow] = useState(false);
  const [onlineIds, setOnlineIds] = useState<number[]>([]);


  // ===============================
  // 🧍 Player Progress
  // ===============================
  const [playerProgress, setPlayerProgress] = useState<PlayerProgress[]>([
    { username: user?.username || 'You', color: 'gold', progress: 0, wpm: 0, isMe: true },
  ]);

  const playerMapRef = useRef<Map<string, Animated.Value>>(new Map());
  const [input, setInput] = useState('');
  const lastInputRef = useRef('');
  const [typedCount, setTypedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [passage, setPassage] = useState('');
  const [gameStateId, setGameStateId] = useState<number | null>(null);
  const colorAssignmentsRef = useRef<Map<string, string>>(new Map());

  const totalChars = passage.length;

  const me = useMemo(() => playerProgress.find(p => p.isMe) || playerProgress[0], [playerProgress]);

  const accuracy = useMemo(() => {
    if (typedCount === 0) return 0;
    const correct = Math.max(0, typedCount - errorCount);
    return Math.round((correct / typedCount) * 100);
  }, [typedCount, errorCount]);

  // ===============================
  // 🎬 Animation setup
  // ===============================
  const ensureAnim = (username: string) => {
    if (!playerMapRef.current.has(username)) {
      playerMapRef.current.set(username, new Animated.Value(0));
    }
    return playerMapRef.current.get(username)!;
  };

  useEffect(() => {
    playerProgress.forEach(p => {
      const anim = ensureAnim(p.username);
      anim.stopAnimation();
      Animated.spring(anim, {
        toValue: p.progress,
        speed: 12,
        bounciness: 0,
        useNativeDriver: false,
      }).start();
    });
  }, [playerProgress]);

  // ===============================
  // 📡 WebSocket Connection
  // ===============================
  const socketRef = useRef<WebSocket | null>(null);

  /** ✅ Connect to TypingRace WebSocket server */
  const connectWebSocket = async (id: number) => {
    try {
      const accessToken = await getAccessToken();
      const wsUrl = `${BASE_URL.replace(/^http/, 'ws')}/ws/typingrace/${id}/?token=${accessToken}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[Typing WS] connected');

      };

      ws.onclose = () => console.log('[Typing WS] disconnected');
      ws.onerror = (e: any) => console.error('[Typing WS] error:', e);

      ws.onmessage = (event) => {
        const msg: ServerToClientMessage | any = JSON.parse(event.data);
        const log = (...args: any[]) => console.log("%c[Typing WS]", "color:#00BFFF;font-weight:bold;", ...args);

        switch (msg.type) {
          // case "lobby_state":
          //   log("🏠 Lobby update:", {
          //     ready: `${msg.ready_count}/${msg.expected_count}`,
          //     members: msg.members?.map((m: any) => m.name ?? m.username),
          //     canStart: msg.can_start_now,
          //   });
          //   break;

          // case "join_window_closed":
          //   log("🚦 Join window closed → start countdown");
          //   break;

          // case "player_progress_update":
          //   log("🚗 Player progress:", msg.player);
          //   break;

          // case "leaderboard_update":
          //   log("🏎️ Leaderboard update:", msg.leaderboard);
          //   if (msg.winner) log("👑 Winner:", msg.winner);
          //   break;

          case "game_complete":
            log("🏁 Final results:", msg.leaderboard);
            log("👑 Winner:", msg.winner);
            break;

          // default:
          //   log("⚙️ Other message:", msg);
          //   break;
        }

        // === 🧭 Waiting room updates ===
        if (msg.type === 'lobby_state') {         
          setWaitingActive(true);
          setReadyCount(msg.ready_count);
          setExpectedCount(msg.expected_count);
          setJoinDeadlineISO(msg.join_deadline_at || null);

          if (msg.members) {
            type Member = { id: number; name?: string; username?: string };
            const members: Member[] = msg.members || [];
            setMembers(members);

          //   setPlayerProgress(prev => {
          //     const existingUsernames = prev.map(p => p.username);
          //     const usedColors = new Set(prev.map(p => p.color));

          //     const newEntries: PlayerProgress[] = members
          //       .filter(m => !existingUsernames.includes(m.name ?? m.username ?? `Player${m.id}`))
          //       .map(m => {
          //         const username = m.name ?? m.username ?? `Player${m.id}`;

          //         const availableColors = COLOR_POOL.filter(c => !usedColors.has(c));
          //         const assignedColor: string =
          //           availableColors.length > 0
          //             ? availableColors[Math.floor(Math.random() * availableColors.length)]
          //             : COLOR_POOL[Math.floor(Math.random() * COLOR_POOL.length)];

          //         usedColors.add(assignedColor);

          //         return {
          //           username,
          //           color: username === user?.username ? 'gold' : assignedColor,
          //           progress: 0,
          //           wpm: 0,
          //           isMe: username === user?.username,
          //         };
          //       });

          //     return [...prev, ...newEntries];
          //   });
          }

          if (msg.can_start_now !== undefined) setCanStartNow(msg.can_start_now);
          if (msg.online_ids) setOnlineIds(msg.online_ids);

          if (msg.join_deadline_at) {
            const deadline = new Date(msg.join_deadline_at).getTime();
            if (countdownRef.current) clearInterval(countdownRef.current);

            const tick = () => {
              const now = Date.now();
              const diffMs = Math.max(0, deadline - now);
              const sec = Math.floor(diffMs / 1000);
              setRemainingSec(sec);
            };

            tick();
            countdownRef.current = setInterval(tick, 1000);
          }
        }

        // === 👥 Player list update ===
        if (msg.type === "player_list") {
          //console.log("[TypingRace] Player list updated:", msg.players);

            const players = msg.players || [];

            
            setPlayerProgress(() => {
              const usedColors = new Set<string>();
              return players.map((p: any) => {
                const username = p.name;
                const color =
                  username === user?.username
                    ? "gold"
                    : [...COLOR_POOL].find(c => !usedColors.has(c)) || "#00BFFF";
                usedColors.add(color);
                return {
                  username,
                  color,
                  progress: 0,
                  wpm: 0,
                  isMe: username === user?.username,
                };
              });
            });
          }


        // === 🚦 Countdown start ===
        if (msg.type === 'join_window_closed') {
          console.log('[TypingRace] join_window_closed → start 3-second countdown');
          setWaitingActive(false);
          setJoinDeadlineISO(null);
          setRemainingSec(null);

          if (countdownRef.current) clearInterval(countdownRef.current);

          // Show 3-2-1 countdown overlay
          setShowCountdown(true);
          setCountdownValue(COUNTDOWN_START);

          let c = COUNTDOWN_START;
          const timer = setInterval(() => {
            c -= 1;
            setCountdownValue(c);
            if (c <= 0) {
              clearInterval(timer);
              setShowCountdown(false);
            }
          }, 1000);
        }

        // === 🚀 Player progress update ===
        if (msg.type === 'player_progress_update') {
          // const recvTime = Date.now();
          // const sentAt = msg?.player?.client_sent_at ?? null;
          // const latency = sentAt ? recvTime - sentAt : null;

          // console.debug(
          //   `[CLIENT][RECV] ${msg.player.username} progress=${msg.player.progress.toFixed(2)}% recvAt=${recvTime}`
          //   + (latency ? ` latency=${latency}ms` : '')
          // );

          const p = msg.player;
          //if (p.username === user?.username) return;
          setPlayerProgress(prev =>
            prev.map(pp =>
              pp.username === p.username
                ? { ...pp, progress: p.progress, wpm: pp.isMe ? pp.wpm : 0 }
                : pp
            )
          );
        }

        // === 🏁 Leaderboard / Game Complete unified handler ===
        if (msg.type === 'game_complete') {
          const summary = msg.leaderboard
            .map((p: any, i: number) => `${i + 1}. ${p.username} — ${p.score}`)
            .join('\n');

          Alert.alert(
            '🏁 Final Results',
            `🏆 Winner: ${msg.winner}\n\n${summary}`,
            [
              {
                text: 'Exit',
                onPress: () => navigation.goBack(),
                style: 'default',
              },
            ]
          );

          setGameOver(true);
        }


        // if (msg.type === 'leaderboard_update' || msg.type === 'game_complete') {
        //   const newProgressList = msg.leaderboard.map((p: any) => ({
        //     username: p.username,
        //     color: p.username === user?.username ? 'gold' : '#00BFFF',
        //     progress: p.progress ?? 0,
        //     wpm: 0,
        //     isMe: p.username === user?.username,
        //   }));
        //   setPlayerProgress(newProgressList);

        //   // === 🔔 Only show alert once at the end ===
        //   if (msg.type === 'game_complete') {
        //     const summary = msg.leaderboard
        //       .map((p: any, i: number) => `${i + 1}. ${p.username} — ${p.score}`)
        //       .join('\n');

        //     const winnerText = msg.winner ? `🏆 Winner: ${msg.winner}\n\n` : '';

        //     Alert.alert(
        //       '🏁 Final Results',
        //       `${winnerText}${summary}`,
        //     );
        //     setGameOver(true);
        //   }
        // }
      };

      socketRef.current = ws;
    } catch (err) {
      console.error('[Typing WS] connection failed:', err);
    }
  };

  /** Send progress updates to the server */
  let lastSentProgress = useRef<number>(0);
  const sendProgressUpdate = (typed: number, errors: number) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    // Calculate current progress based on passage length
    const textLen = passage.length;
    const progress = textLen > 0 ? (typed / textLen) * 100 : 0;

    // Skip sending if progress difference is too small (to prevent duplicate sends)
    if (Math.abs(progress - lastSentProgress.current) < 0.3) return;

    lastSentProgress.current = progress;

    // const sendTime = Date.now();
    // console.debug(`[CLIENT][SEND] ${user?.username} progress=${progress.toFixed(2)}% sentAt=${sendTime}`);

    socketRef.current.send(
      JSON.stringify({
        type: 'progress_update',
        total_typed: typed,
        total_errors: errors,
        //client_sent_at: sendTime, // ✅ 附上時間戳給後端（可在 consumers.py 打印）
      })
    );
  };

  /** Notify server when finished */
  const sendGameFinished = () => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({ type: 'game_finished' }));
  };

  // ===============================
  // 🧭 Initialize game
  // ===============================
  useEffect(() => {
    const fetchGame = async () => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) throw new Error('Not authenticated');

        // create the game
        const res = await fetch(endpoints.typingRaceCreate, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ challenge_id: challId }),
        });

        if (!res.ok) throw new Error('Failed to create game');
        const data = await res.json();

        setPassage(data.text);
        setGameStateId(data.game_state_id);
        setIsMultiplayer(data.is_multiplayer);

        // 🧍 Wait for lobby_state to load members from WebSocket
        setWaitingActive(true);
        //console.log('[TypingRace] Waiting for lobby members via WebSocket...');
        // try {
        //   const detailRes = await fetch(endpoints.challengeDetail(challId), {
        //     headers: { 'Authorization': `Bearer ${accessToken}` },
        //   });
        //   const detail = await detailRes.json();
        //   setMembers(detail?.members || []);
        //   console.log('[TypingRace] Loaded challenge members:', detail?.members);
        //   setWaitingActive(true);
        // } catch (e) {
        //   console.warn('[TypingRace] Failed to load challenge members', e);
        // }

        // 👥 Multiplayer mode
        if (data.is_multiplayer) {
          connectWebSocket(data.game_state_id);
        } else {
          // 🧍 Single-player: start immediately
          setWaitingActive(false);
        }
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to start game.');
      }
    };

    fetchGame();
    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, [challId]);

  // ===============================
  // 🕒 Countdown timer before start
  // ===============================
  useEffect(() => {
    if (remainingSec === 0 && waitingActive) {
      //console.log("[TypingRace] Countdown ended, auto starting game!");
      const ws = socketRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "start_game" }));
      }
      setWaitingActive(false);
      setJoinDeadlineISO(null);
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
  }, [remainingSec, waitingActive]);


  // ===============================
  // ⏳ Game timer countdown
  // ===============================
  useEffect(() => {
    if (!passage || waitingActive || gameOver) return;
    if (gameTime <= 0) {
      if (isMultiplayer) {
        // multiplayer mode let server handle finish
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: "game_timeout" }));
        }
      }
      // this is single-player
      finishGame();
      return;
    }
    const t = setInterval(() => setGameTime(t => t - 1), 1000);
    return () => clearInterval(t);
  }, [passage, waitingActive, gameOver, gameTime]);

  // ===============================
  // 🔄 Reset Game (Play Again)
  // ===============================
  const resetRace = async () => {
    //console.log('[TypingRace] Resetting game...');

    
    setInput('');
    lastInputRef.current = '';
    setTypedCount(0);
    setErrorCount(0);
    setPlayerProgress(ps => ps.map(p => ({ ...p, progress: 0, wpm: 0 })));

    
    setWaitingActive(false);
    setCountdown(COUNTDOWN_START);
    setGameTime(GAME_SECONDS);
    setHasFinished(false);
    setGameOver(false);

    try {
      
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }

      
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error('Not authenticated');

      
      const res = await fetch(endpoints.typingRaceCreate, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ challenge_id: challId }),
      });

      if (!res.ok) throw new Error('Failed to create new game');
      const data = await res.json();

      
      setPassage(data.text);
      setGameStateId(data.game_state_id);
      setIsMultiplayer(data.is_multiplayer);

      
      if (data.is_multiplayer) {
        //console.log('[TypingRace] Multiplayer restart — reconnecting...');
        setWaitingActive(true);
        connectWebSocket(data.game_state_id);
      } else {
        console.log('[TypingRace] Single-player restart.');
        setWaitingActive(false);
      }
    } catch (err) {
      console.error('[TypingRace] Failed to reset game:', err);
      Alert.alert('Error', 'Failed to restart game.');
    }
  };

  // ===============================
  // 🏁 Finish Game
  // ===============================
  const finishGame = async () => {
    setGameOver(true);
    
    if (!isMultiplayer) {
      Alert.alert(
        '🎉 Race Finished',
        `Accuracy: ${accuracy}%\nWPM: ${me?.wpm ?? 0}\nErrors: ${errorCount}`,
        [
          { text: 'Play Again', onPress: () => resetRace() },
          { text: 'Exit', onPress: () => navigation.goBack() },
        ]
      );
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) throw new Error('Not authenticated');

        const res = await fetch(endpoints.typingRaceFinalize, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            game_state_id: gameStateId,
            accuracy,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Submit failed');

        await saveScores({
          challenge_id: challId,
          game_name: challName,
          date: new Date().toISOString().slice(0, 10),
          scores: [
            {
              username: user?.username || 'You',
              score: data.final_score ?? accuracy,
              accuracy,
              inaccuracy: 100 - accuracy,
            },
          ],
        });
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to submit result.');
      }
    }
  };

  // ===============================
  // ⌨️ Handle Player Input
  // ===============================
  const lastUpdateTime = useRef<number>(0);

  const onChangeInput = (rawText: string) => {
    if (gameOver || waitingActive) return;

    const now = Date.now();
    const deltaTime = now - lastUpdateTime.current;

    // // ✅ every 120ms at most to limit processing
    // if (deltaTime < 120) return;
    lastUpdateTime.current = now;

    // making sure is typing or deleting
    const limited = rawText.slice(0, totalChars);
    const prev = lastInputRef.current;

    if (limited.length < prev.length) {
      setInput(limited);
      lastInputRef.current = limited;
      return;
    }

    let typedDelta = 0;
    let errorDelta = 0;

    for (let i = prev.length; i < limited.length; i++) {
      typedDelta++;
      if (limited[i] !== passage[i]) errorDelta++;
    }

    setTypedCount(tc => tc + typedDelta);
    setErrorCount(ec => ec + errorDelta);

    const correctNow = limited.split('').filter((ch, i) => ch === passage[i]).length;
    const newProgress = Math.min(100, (correctNow / totalChars) * 100);

    const elapsedSeconds = GAME_SECONDS - gameTime;
    const newWpm = elapsedSeconds > 0 ? Math.round((correctNow / 5) / (elapsedSeconds / 60)) : 0;

    if (!isMultiplayer) {
      // single-player: update self only at frontend
      setPlayerProgress(prev =>
        prev.map(p =>
          p.isMe ? { ...p, progress: newProgress, wpm: newWpm } : p
        )
      );
    }


    setInput(limited);
    lastInputRef.current = limited;

    // send live progress to server
    if (isMultiplayer) {
      const correctNow = limited.split('').filter((ch, i) => ch === passage[i]).length;
      const totalErrors = errorCount + errorDelta;
      sendProgressUpdate(correctNow, totalErrors);
    }

    // finish when done typing
    if (limited.length === totalChars) {
      if (!isMultiplayer) {
        finishGame();
      } else {
        setHasFinished(true);
        sendGameFinished();
      }
    }
  };


  // ===============================
  // 📝 Render Typing Passage
  // ===============================
  const renderTypingText = () => {
    const typed = input;
    const correctLen = typed.split('').findIndex((ch, i) => ch !== passage[i]);
    const firstIncorrectIndex = correctLen === -1 ? typed.length : correctLen;

    const correctPart = passage.slice(0, firstIncorrectIndex);
    const incorrectPart = passage.slice(firstIncorrectIndex, typed.length);
    const remainingPart = passage.slice(typed.length);

    return (
      <Text style={styles.textLine}>
        <Text style={styles.correct}>{correctPart}</Text>
        <Text style={styles.incorrect}>{incorrectPart}</Text>
        <Text style={styles.remaining}>{remainingPart}</Text>
      </Text>
    );
  };

  return (
    <ImageBackground
      source={require('../../images/cgpt.png')}
      style={styles.background}
      resizeMode="cover"
    >
      {waitingActive && (
        <View style={styles.waitingOverlay}>
          <View style={styles.waitingCard}>
            <Text style={styles.waitingTitle}>Waiting Room</Text>

            {/* 👥 Players List */}
            <View style={{ marginTop: 8 }}>
              {members.map(m => {
                const isOnline = onlineIds?.some(id => String(id) === String(m.id));
                const initials = (m.name || '')
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((s: string) => (s.length > 0 ? s[0] : ''))
                  .join('')
                  .toUpperCase();

                return (
                  <View
                    key={m.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 6,
                      opacity: isOnline ? 1 : 0.5,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        marginRight: 10,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: isOnline ? '#FFD700' : '#999',
                        borderWidth: isOnline ? 2 : 1,
                        borderColor: isOnline ? '#fff' : '#666',
                      }}
                    >
                      <Text
                        style={{
                          color: isOnline ? '#333' : '#eee',
                          fontWeight: '700',
                        }}
                      >
                        {initials || '?'}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: 'white',
                        fontSize: 16,
                        fontWeight: '600',
                      }}
                    >
                      {m.name}
                    </Text>
                    {isOnline && (
                      <View
                        style={{
                          marginLeft: 8,
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: '#00E676',
                        }}
                      />
                    )}
                  </View>
                );
              })}
            </View>

            {/* 👥 Status + Countdown */}
            <Text style={styles.waitingText}>
              Players: {readyCount}/{expectedCount}
            </Text>
            <Text style={styles.waitingText}>
              {remainingSec != null
                ? `Starts in ${Math.floor(Math.max(0, remainingSec) / 60)}:${(
                    Math.max(0, remainingSec) % 60
                  )
                    .toString()
                    .padStart(2, '0')}`
                : 'Starts soon'}
            </Text>

            {/* 🚦 Start button (for host only) */}
            {canStartNow && socketRef.current && (
              <TouchableOpacity
                style={styles.startBtn}
                onPress={() => {
                  const ws = socketRef.current;
                  if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'start_game' }));
                  } else {
                    console.log('[TypingRace] Start Game tapped but socket not open');
                  }
                }}
              >
                <Text style={styles.startBtnText}>Start Game</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* 🕒 Countdown overlay (3,2,1) */}
      {showCountdown && (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownText}>{String(countdownValue ?? '')}</Text>
        </View>
      )}


      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.exitButton} onPress={() => navigation.goBack()}>
            <Text style={styles.exitText}>Exit</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{challName}</Text>

          {/* 🏎️ Progress Board */}
          <View style={styles.progressBoard}>
            {playerProgress.map(p => {
              const anim = ensureAnim(p.username);
              const animatedLeft = anim.interpolate({
                inputRange: [0, 100],
                outputRange: [0, TRACK_WIDTH - CAR_SIZE],
              });

              return (
                <View key={p.username} style={styles.playerRow}>
                  <View
                    style={[
                      styles.nameBox,
                      p.isMe && {
                        backgroundColor: `${p.color}30`,
                        borderColor: p.color,
                        borderWidth: 1.5,
                      },
                    ]}
                  >
                    <Text style={styles.playerName} numberOfLines={1} ellipsizeMode="tail">
                      {p.username}
                    </Text>
                  </View>

                  <View style={styles.trackWrapper}>
                    <View style={[styles.track, { width: TRACK_WIDTH }]}>
                      <View style={styles.trackLine} />
                      <Animated.View
                        style={[
                          styles.car,
                          { left: animatedLeft, backgroundColor: p.color },
                        ]}
                      >
                        <Text style={styles.carIcon}>🚗</Text>
                      </Animated.View>
                    </View>
                  </View>

                  <View style={styles.finishFlag}>
                    <Text style={styles.flagIcon}>🏁</Text>
                  </View>

                  <Text style={styles.progressText}>{Math.round(p.progress)}%</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.headerStats}>
            <Text style={styles.headerStatText}>⏱ {formatTime(gameTime)}</Text>
            <Text style={styles.headerStatText}>WPM {me?.wpm ?? 0}</Text>
            <Text style={styles.headerStatText}>❌ {errorCount}</Text>
            <Text style={styles.headerStatText}>Acc {accuracy}%</Text>
          </View>

          <View style={styles.typingArea}>
            {renderTypingText()}
            <TextInput
              style={styles.input}
              placeholder="Start typing here..."
              placeholderTextColor="#ccc"
              value={input}
              onChangeText={onChangeInput}
              autoCorrect={false}
              autoCapitalize="none"
              editable={!waitingActive && !gameOver}
              multiline
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
};





export default TypingRace;
