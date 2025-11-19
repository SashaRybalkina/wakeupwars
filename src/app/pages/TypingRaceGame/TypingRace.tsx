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
const GAME_SECONDS = 90; // total game time
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
  const params = (route.params as any) || {};
  const challId = params.challId ?? params.challengeId;
  const challName = params.challName ?? 'Typing Race';
  const whichChall = params.whichChall ?? 'Public';
  const { user, logout } = useUser();

  // console.log("[DEBUG] TypingRace route params:", params);
  // console.log("[DEBUG] challId resolved:", challId);

  // ===============================
  // 🧠 Helper: Save scores to backend
  // ===============================
  // const saveScores = async (payload: {
  //   challenge_id: number;
  //   game_name?: string;
  //   date?: string;
  //   scores: { username: string; score: number; accuracy?: number; inaccuracy?: number }[];
  // }) => {
  //   try {
  //     const accessToken = await getAccessToken();
  //     if (!accessToken) throw new Error('Not authenticated');

      
  //     const res = await fetch(endpoints.submitGameScores(), {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //         Authorization: `Bearer ${accessToken}`,
  //       },
  //       body: JSON.stringify(payload),
  //     });

  //     if (!res.ok) {
  //       const text = await res.text();
  //       throw new Error(`Submit failed: ${text}`);
  //     }

  //     console.log('[DEBUG] Score saved successfully to leaderboard');
  //   } catch (e) {
  //     console.error('Failed to save score:', e);
  //   }
  // };

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
  const clockOffsetRef = useRef<number>(0);
  const [members, setMembers] = useState<any[]>([]);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
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

  // only track for progress
  const progressMap = useMemo(() => {
    const map: Record<string, number> = {};
    playerProgress.forEach(p => {
      map[p.username] = p.progress;
    });
    return map;
  }, [playerProgress.map(p => p.progress).join(',')]);

  // useEffect(() => {
  //   playerProgress.forEach(p => {
  //     const anim = ensureAnim(p.username);
  //     anim.stopAnimation();
  //     Animated.spring(anim, {
  //       toValue: p.progress,
  //       speed: 12,
  //       bounciness: 0,
  //       useNativeDriver: false,
  //     }).start();
  //   });
  // }, [playerProgress]);
  useEffect(() => {
    Object.entries(progressMap).forEach(([username, progress]) => {
      const anim = ensureAnim(username);
      Animated.timing(anim, {
        toValue: progress,
        duration: 100, 
        useNativeDriver: false,
      }).start();
    });
  }, [progressMap]);

  // ===============================
  // 📡 WebSocket Connection
  // ===============================
  const socketRef = useRef<WebSocket | null>(null);

  /** ✅ Connect to TypingRace WebSocket server */
  const connectWebSocket = async (id: number) => {
    try {
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
      const wsUrl = `${BASE_URL.replace(/^http/, 'ws')}/ws/typingrace/${id}/?token=${accessToken}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[Typing WS] connected');

      };

      // === 🧱 Connection closed handling ===
      ws.onclose = (event) => {
        console.log('[Typing WS] disconnected, code:', event.code);

        if (event.code === 4001) {
          Alert.alert(
            "Join Deadline Passed",
            "You cannot join this game because the join window has already closed.",
            [{ text: "OK", onPress: () => navigation.navigate("ChallDetails", { challId: challId, challName, whichChall }) }]
          );
        } else if (event.code === 4002) {
          Alert.alert(
            "Game Already Completed",
            "This challenge has already been completed today.",
            [{ text: "OK", onPress: () => navigation.navigate("ChallDetails", { challId: challId, challName, whichChall }) }]
          );
        } else if (event.code !== 1000) { // 1000 = normal close
          Alert.alert(
            "Connection Closed",
            "The connection was closed unexpectedly.",
            [{ text: "OK", onPress: () => navigation.navigate("ChallDetails", { challId: challId, challName, whichChall }) }]
          );
        }
      };
      ws.onerror = (e: any) => console.error('[Typing WS] error:', e);

      ws.onmessage = (event) => {
        const msg: ServerToClientMessage | any = JSON.parse(event.data);
        const log = (...args: any[]) => console.log("%c[Typing WS]", "color:#00BFFF;font-weight:bold;", ...args);

        // 🛑 Handle server-side error messages
        if (msg.type === "error") {
          // Alert.alert(
          //   "⚠️ Unable to Join",
          //   msg.message || "An unexpected error occurred. Please try again later.",
          //   [{ text: "OK", onPress: () => navigation.goBack() }]
          // );
          return;
        }

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

          // case "game_complete":
          //   log("🏁 Final results:", msg.leaderboard);
          //   log("👑 Winner:", msg.winner);
          //   break;

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

          if (msg.online_ids) setOnlineIds(msg.online_ids);

          if (msg.join_deadline_at && msg.server_now) {
            const deadlineMs = new Date(msg.join_deadline_at).getTime();
            // Reset any previous ticker
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
              countdownRef.current = null;
            }
            // Use server-provided time as the single source of truth
            const serverNowMs = new Date(msg.server_now).getTime();
            clockOffsetRef.current = Date.now() - serverNowMs;

            const tick = () => {
              const nowAdj = Date.now() - clockOffsetRef.current;
              const diffMs = Math.max(0, deadlineMs - nowAdj);
              const sec = Math.floor(diffMs / 1000);
              setRemainingSec(sec);
              if (sec <= 0 && countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
              }
            };
            tick();
            countdownRef.current = setInterval(tick, 1000);
          } else {
            // Without server_now, do not run a local countdown
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
              countdownRef.current = null;
            }
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

        if (msg.type === 'lobby_countdown') {
          // Server-driven countdown seconds; keep waiting room visible until last 3 seconds
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }

          const secs = Math.max(0, Number(msg.seconds ?? 0));
          setJoinDeadlineISO(null);
          setRemainingSec(secs);            // use server as source of truth for overall countdown

          if (secs <= 3) {
            setShowCountdown(true);         // show big 3-2-1 overlay only at the end
            setCountdownValue(secs);
          } else {
            setShowCountdown(false);
            setCountdownValue(null);
          }

          setWaitingActive(secs > 0);       // keep waiting room visible until countdown reaches 0
        }

        if (msg.type === 'join_window_closed') {
          console.log('[TypingRace] join_window_closed → start 3-second countdown');
          setWaitingActive(false);
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          setShowCountdown(false);
          setCountdownValue(null);
          
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

          // notification for early finisher
          if (p.username === user?.username && p.is_completed) {
            if (!hasFinished) {
              setHasFinished(true);
              Alert.alert(
                "🎉 You finished!",
                "Please wait for final results..."
              );
            }
          }

          if (p.username === user?.username) return;
          //console.log(`[CLIENT][RECV] ${p.username} progress=${p.progress.toFixed(2)}%`);
          setPlayerProgress(prev =>
            prev.map(pp => {
              if (pp.username !== p.username) return pp;

              if (p.progress < pp.progress || Math.abs(p.progress - pp.progress) < 0.3) {
                return pp;
              }

              return { ...pp, progress: p.progress };
            })
          );
        }

        // === 🏁 Leaderboard / Game Complete unified handler ===
        if (msg.type === 'game_complete') {
          const summary = msg.leaderboard
            .map((p: any, i: number) => `${i + 1}. ${p.username} — ${p.score}`)
            .join('\n');

          setTimeout(() => {
            Alert.alert(
              '🏁 Final Results',
              `🏆 Winner: ${msg.winner}\n\n${summary}`,
              [
                {
                text: 'Exit',
                onPress: () => navigation.navigate("ChallDetails", { challId: challId, challName, whichChall }),
                style: 'default',
              },
            ]
          );
          }, 2000);
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
        //client_sent_at: sendTime, // 
      })
    );
    //console.log(`[CLIENT][SEND] ${user?.username} progress=${progress.toFixed(2)}%`);
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

        console.log("[DEBUG] TypingRace route params:", params);
        console.log("[DEBUG] challId resolved:", challId);

        // create the game
        const res = await fetch(endpoints.typingRaceCreate, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ challenge_id: challId }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = data?.detail || 'Join window has closed for this game.';
          Alert.alert('Join Deadline Passed', msg, [
            { text: 'OK', onPress: () => navigation.navigate("ChallDetails", { challId: challId, challName, whichChall }) }
          ]);
          return;
        }

        setPassage(data.text);
        setGameStateId(data.game_state_id);
        setIsMultiplayer(data.is_multiplayer);
        setJoinDeadlineISO(data.join_deadline_at);
        // Show waiting room only in multiplayer
        setWaitingActive(!!data.is_multiplayer);
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
          // 🧍 Single-player: start immediately and ensure no waiting state
          setWaitingActive(false);
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          setJoinDeadlineISO(null);
          setRemainingSec(null);
          setShowCountdown(false);
          setCountdownValue(null);
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

  useEffect(() => {
            if (!waitingActive) {
            if (showCountdown) {
              setShowCountdown(false);
              setCountdownValue(null);
            }
            return;
          }

          if (remainingSec <= 3 && remainingSec > 0) {
            setShowCountdown(true);
            setCountdownValue(remainingSec);
          } else if (remainingSec <= 0) {
            if (showCountdown) {
              setShowCountdown(false);
              setCountdownValue(null);
            }
            // Countdown reached zero: hide waiting overlay and rely on server to start
            setWaitingActive(false);
          } else {
            // more than 3 seconds left
            if (showCountdown) {
              setShowCountdown(false);
              setCountdownValue(null);
            }
          }
        }, [remainingSec, waitingActive]);

  // ===============================
  // 🏁 Finish Game
  // ===============================
  const finishGame = async () => {
    setGameOver(true);
    
    if (!isMultiplayer) {
      setTimeout(() => {
      Alert.alert(
        '🎉 Race Finished',
        `Accuracy: ${accuracy}%\nWPM: ${me?.wpm ?? 0}\nErrors: ${errorCount}`,
        [
          { text: 'Exit', onPress: () => navigation.navigate("ChallDetails", { challId: challId, challName, whichChall }) },
        ]
      );
      }, 2000);
      try {
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

        // ✅ leaderboard update is now handled fully in the backend finalize endpoint
        // The backend automatically updates GamePerformance / Leaderboard based on game_state_id
        console.log('[DEBUG] Game finalized successfully, leaderboard updated via backend.');

        // await saveScores({
        //   challenge_id: challId,
        //   game_name: challName,
        //   date: new Date().toISOString().slice(0, 10),
        //   scores: [
        //     {
        //       username: user?.username || 'You',
        //       score: data.final_score ?? accuracy,
        //       accuracy,
        //       inaccuracy: 100 - accuracy,
        //     },
        //   ],
        // });
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
    lastUpdateTime.current = now;

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

    // only for calculating correct chars
    const correctNow = limited.split('').filter((ch, i) => ch === passage[i]).length;
    const newProgress = Math.min(100, (correctNow / totalChars) * 100);

    const elapsedSeconds = GAME_SECONDS - gameTime;
    const newWpm =
      elapsedSeconds > 0 ? Math.round((correctNow / 5) / (elapsedSeconds / 60)) : 0;

    // multiplayer mode - update self only at frontend
    if (isMultiplayer) {
      setPlayerProgress(prev =>
        prev.map(p =>
          p.isMe ? { ...p, progress: newProgress, wpm: newWpm } : p
        )
      );
    } else {
      // single player
      setPlayerProgress(prev =>
        prev.map(p =>
          p.isMe ? { ...p, progress: newProgress, wpm: newWpm } : p
        )
      );
    }

    setInput(limited);
    lastInputRef.current = limited;

    // only send the number of correct characters to the backend, not total typed
    if (isMultiplayer) {
      const totalErrors = errorCount + errorDelta;
      sendProgressUpdate(correctNow, totalErrors);
    }

   
    if (limited.length === totalChars) {
      if (!isMultiplayer) finishGame();
      else {
        setHasFinished(true);
        sendGameFinished();
      }
    }
  };


  // const onChangeInput = (rawText: string) => {
  //   if (gameOver || waitingActive) return;

  //   const now = Date.now();
  //   const deltaTime = now - lastUpdateTime.current;

  //   // // ✅ every 120ms at most to limit processing
  //   // if (deltaTime < 120) return;
  //   lastUpdateTime.current = now;

  //   // making sure is typing or deleting
  //   const limited = rawText.slice(0, totalChars);
  //   const prev = lastInputRef.current;

  //   if (limited.length < prev.length) {
  //     setInput(limited);
  //     lastInputRef.current = limited;
  //     return;
  //   }

  //   let typedDelta = 0;
  //   let errorDelta = 0;

  //   for (let i = prev.length; i < limited.length; i++) {
  //     typedDelta++;
  //     if (limited[i] !== passage[i]) errorDelta++;
  //   }

  //   setTypedCount(tc => tc + typedDelta);
  //   setErrorCount(ec => ec + errorDelta);

  //   const correctNow = limited.split('').filter((ch, i) => ch === passage[i]).length;
  //   const newProgress = Math.min(100, (correctNow / totalChars) * 100);

  //   const elapsedSeconds = GAME_SECONDS - gameTime;
  //   const newWpm = elapsedSeconds > 0 ? Math.round((correctNow / 5) / (elapsedSeconds / 60)) : 0;

  //   if (!isMultiplayer) {
  //     // single-player: update self only at frontend
  //     setPlayerProgress(prev =>
  //       prev.map(p =>
  //         p.isMe ? { ...p, progress: newProgress, wpm: newWpm } : p
  //       )
  //     );
  //   } else {
  //     setPlayerProgress(prev =>
  //       prev.map(p =>
  //         p.isMe ? { ...p, wpm: newWpm } : p
  //       )
  //     );
  //   }
    
    

  //   setInput(limited);
  //   lastInputRef.current = limited;

  //   // send live progress to server
  //   if (isMultiplayer) {
  //     const correctNow = limited.split('').filter((ch, i) => ch === passage[i]).length;
  //     const currentTotalErrors = errorCount + errorDelta;
  //     sendProgressUpdate(limited.length, currentTotalErrors);
  //   }

  //   // finish when done typing
  //   if (limited.length === totalChars) {
  //     if (!isMultiplayer) {
  //       finishGame();
  //     } else {
  //       setHasFinished(true);
  //       sendGameFinished();
  //     }
  //   }
  // };


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
      source={require('../../images/cgpt4.png')}
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
            {socketRef.current && (
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
          <TouchableOpacity style={styles.exitButton} onPress={() => navigation.navigate("ChallDetails", { challId: challId, challName, whichChall })}>
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
                        // borderColor: p.color,
                        // borderWidth: 1.5,
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
