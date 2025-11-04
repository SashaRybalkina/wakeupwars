import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NavigationProp, useRoute } from '@react-navigation/native';

import { BASE_URL, endpoints } from '../../api';
import { useUser } from '../../context/UserContext';
import { getAccessToken } from "../../auth";
// import { NativeModules } from "react-native";
// const { AlarmModule } = NativeModules;

const GRID_SIZE = 5;
const MAX_ATTEMPTS = 5;
const CELL_SIZE = 40;

type Props = {
  navigation: NavigationProp<any>;
};

export type GuessResult = {
  letter: string;
  result: 'correct' | 'present' | 'absent';
};

type ServerToClientMessage =
  | {
      type: 'player_list';
      players: string[];
    }
  | {
      type: 'broadcast_move';
      player: string;
      row: number;
      guess: string;
      evaluation: GuessResult[];
      attempt: number;
    }
  | {
      type: 'player_left';
      player: string;
    }
  | {
      type: 'player_joined';
      player: string;
      color: string;
    }
  | {
      type: 'game_complete';
      scores: {
        username: string;
        accuracy: number;
        inaccuracy: number;
        score: number;
      }[];
    };

// Waiting room/lobby messages (mirroring Sudoku)
type LobbyStateMessage = {
  type: 'lobby_state';
  created_at: string;
  join_deadline_at: string | null;
  server_now: string;
  ready_count: number;
  expected_count: number;
  online_ids?: number[];
};

type JoinWindowClosedMessage = {
  type: 'join_window_closed';
  server_now?: string;
};

const WordleScreen: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { challengeId, challName, whichChall } = (route.params as {
    challengeId: number;
    challName: string;
    whichChall: string;
  }) || {
    challengeId: 30,
    challName: 'Test',
    whichChall: 'wordle',
  };

  const { user } = useUser();

  const [grid, setGrid] = useState<string[][]>(
    Array.from({ length: MAX_ATTEMPTS }, () => Array(GRID_SIZE).fill('')),
  );
  const [results, setResults] = useState<GuessResult[][]>([]);
  const [selectedRow, setSelectedRow] = useState(0);
  const [selectedCol, setSelectedCol] = useState(0);
  const [timeLeft, setTimeLeft] = useState(300);
  const [gameOver, setGameOver] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [first, setFirst] = useState(true);
  const [gameStateId, setGameStateId] = useState<number | null>(null);
  const [opponentRows, setOpponentRows] = useState<{
    [player: string]: { evaluation: GuessResult[]; attempt: number };
  }>({});
  const [submittedRows, setSubmittedRows] = useState<Set<number>>(new Set());
  const [players, setPlayers] = useState<string[]>([]);
  const hasShownResultRef = useRef(false);
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [playerColors, setPlayerColors] = useState<{ [key: string]: string }>({});

  const COLOR_POOL = [
  'hotpink', 'coral', 'orange', 'lawngreen', 'aqua',
  'deepskyblue', 'mediumorchid', 'mediumvioletred',
  'magenta', 'thistle', 'powderblue', 'plum', 'peachpuff', 'palegreen'
];

  // Waiting room state (mirroring Sudoku)
  const [waitingActive, setWaitingActive] = useState<boolean>(false);
  const [joinDeadlineISO, setJoinDeadlineISO] = useState<string | null>(null);
  const [readyCount, setReadyCount] = useState<number>(1);
  const [expectedCount, setExpectedCount] = useState<number>(1);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [members, setMembers] = useState<{ id: number; name: string }[]>([]);
  const [onlineIds, setOnlineIds] = useState<number[]>([]);

  const canStartNow = useMemo(() => readyCount >= 1, [readyCount]);

  const startLocalCountdown = (deadlineISO: string | null) => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (!deadlineISO) {
      setRemainingSec(null);
      return;
    }
    const deadline = new Date(deadlineISO).getTime();
    const tick = () => {
      const now = Date.now();
      const diffMs = Math.max(0, deadline - now);
      setRemainingSec(Math.floor(diffMs / 1000));
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
  };

  // 🔄 Reset game
  const resetGame = () => {
    // Safely close any existing socket before re-initializing
    try {
      const ws = socketRef.current;
      if (ws && ws.readyState !== WebSocket.CLOSING && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
      }
    } catch (e) {
      console.log('[WebSocket] error closing during reset:', e);
    }
    setGrid(
      Array.from({ length: MAX_ATTEMPTS }, () => Array(GRID_SIZE).fill('')),
    );
    setResults([]);
    setSelectedRow(0);
    setSelectedCol(0);
    setTimeLeft(300);
    setGameOver(false);
    setOpponentRows({});
    hasShownResultRef.current = false;
    initGame();
  };

  
  // Initialize game
  const initGame = async () => {
    try {
      if (!user) return;

      console.log(`[Wordle] initGame for challengeId=${challengeId}, user=${user.username}`);



      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const res = await fetch(endpoints.createWordleGame, {
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

      console.log("[Wordle] createWordleGame response status:", res.status);

      if (!res.ok) {
        console.error('[Wordle] Backend error:', res.status);
        return;
      }

      const data = await res.json();
      console.log("[Wordle] Game created:", data);

      const { game_state_id, is_multiplayer, join_deadline_at } = data as any;
      setGameStateId(game_state_id);
      setIsMultiplayer(is_multiplayer);

      //console.log(`[Wordle] Challenge=${challengeId}, game_state_id=${game_state_id}, answer=${answer}`);

      if (is_multiplayer) {
        // If backend supplied a join deadline, start the local countdown immediately
        if (join_deadline_at) {
          setJoinDeadlineISO(join_deadline_at);
          startLocalCountdown(join_deadline_at);
          setWaitingActive(true);
        }
        // Load challenge members for waiting room display
        try {
          const detailRes = await fetch(endpoints.challengeDetail(challengeId), {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          const detail = await detailRes.json();
          setMembers(detail?.members || []);
          setWaitingActive(true);
        } catch (e) {
          console.warn('[Wordle] Failed to load challenge members', e);
        }
        // ✅ Added: include token in WebSocket connection URL
        const wsUrl = `${BASE_URL.replace(/^http/, 'ws')}/ws/wordle/${game_state_id}/?token=${accessToken}`;
        console.log("[WebSocket] Connecting to:", wsUrl); // ✅ Added: debug log
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => console.log('[WebSocket] connected');
        ws.onclose = () => console.log('[WebSocket] 🔌 disconnected');
        ws.onerror = (e) => console.error('[WebSocket] ❌ error:', e);

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data) as any;

          if (msg.type === 'player_list') {
            console.log('[WebSocket] Current players:', msg.players);
            setPlayers(msg.players);
          }

          if (msg.type === 'broadcast_move') {
            console.log(`[WebSocket] Opponent move from ${msg.player}:`, msg);
            // only update the newest
            setOpponentRows((prev) => ({
              ...prev,
              [msg.player]: { evaluation: msg.evaluation, attempt: msg.attempt },
            }));
          }

          if (msg.type === 'player_joined') {
            console.log(`[WebSocket] Player joined: ${msg.player}`);
          }

          if (msg.type === 'player_left') {
            console.log(`[WebSocket] Player left: ${msg.player}`);
          }

          // Waiting room events
          if (msg.type === 'lobby_state') {
            const d = msg as LobbyStateMessage;
            setExpectedCount(d.expected_count);
            setReadyCount(d.ready_count);
            if (d.join_deadline_at) {
              setJoinDeadlineISO(d.join_deadline_at);
              startLocalCountdown(d.join_deadline_at);
            }
            if (Array.isArray(d.online_ids)) setOnlineIds(d.online_ids);
            // Show overlay on first lobby state
            setWaitingActive(true);
          }

          if (msg.type === 'join_window_closed') {
            setWaitingActive(false);
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
              countdownRef.current = null;
            }
            setShowCountdown(false);
            setCountdownValue(null);
          }

          if (msg.type === 'game_complete') {
            if (hasShownResultRef.current) return; // prevent multiple alerts
            
            const scoresArr: { username: string; score: number; accuracy?: number; inaccuracy?: number }[] = Array.isArray(msg.scores) ? msg.scores : [];
            const myScore = scoresArr.find((s: { username: string; score: number }) => s.username === (user?.username ?? ''));
            const topScore = scoresArr.length ? Math.max(...scoresArr.map((s: { username: string; score: number }) => s.score)) : 0;
            const isWinner = myScore?.score === topScore;
            console.log("[DEBUG] Winner check", {
              user: user?.username,
              myScore,
              topScore,
              isWinner
            });
            console.log('[WebSocket] Game complete:', scoresArr);
            // Auto-return after 2s so ChallDetails regains focus and refreshes
            setTimeout(() => {
              navigation.navigate("ChallDetails", { challId: challengeId, challName, whichChall });
            }, 2000);
            Alert.alert(
              isWinner ? '🏆 You Win!' : '❌ Game Over',
              scoresArr.map((s: { username: string; score: number }) => `${s.username}: ${s.score}`).join('\n'),
              [
                {
                  text: 'OK', onPress: () => {
                    navigation.navigate("ChallDetails", { challId: challengeId, challName, whichChall });
                  }
                },
              ],
            );
            hasShownResultRef.current = true;
          }
        };

        ws.onclose = () => console.log('[WebSocket] disconnected');
        socketRef.current = ws;
        setSocket(ws);
      }
    } catch (err) {
      console.error('[initGame] Failed:', err);
    }
  };

  useEffect(() => {
    setPlayerColors(prev => {
      const updated = { ...prev };

      players.forEach(p => {
        if (!updated[p]) {
          
          const usedColors = Object.values(updated);
          
          const availableColors = COLOR_POOL.filter(c => !usedColors.includes(c));
          
          const newColor =
            availableColors.length > 0
              ? availableColors[Math.floor(Math.random() * availableColors.length)]
              : COLOR_POOL[Math.floor(Math.random() * COLOR_POOL.length)];

          updated[p] = newColor;
        }
      });

      return updated;
    });
  }, [players]);

  // 🧽 Cleanup socket on unmount
  useEffect(() => {
    console.log("why am i in worlde")
    if (first) {
      initGame();
      setFirst(false);
    }

    return () => {
      if (socket) {
        try {
          if (socket.readyState !== WebSocket.CLOSING && socket.readyState !== WebSocket.CLOSED) {
            console.log('[WebSocket] closing on unmount...');
            socket.close();
          }
        } catch (e) {
          console.log('[WebSocket] close skipped due to error:', e);
        }
      }
    };
  }, [socket]);

  // Countdown display and auto-start like Sudoku
  useEffect(() => {
    if (!waitingActive || remainingSec === null) {
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
      const ws = socketRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'start_game' }));
      } else {
        console.log('[WebSocket] start_game skipped: socket not open');
      }
      // Dismiss waiting room locally in case the server message is delayed
      setWaitingActive(false);
      setJoinDeadlineISO(null);
      setRemainingSec(null);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    } else {
      if (showCountdown) {
        setShowCountdown(false);
        setCountdownValue(null);
      }
    }
  }, [remainingSec, waitingActive]);

  // Cleanup countdown on unmount
  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);
  
  // ⏳ Timer — paused while waiting room is active
  useEffect(() => {
    if (gameOver || waitingActive) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setGameOver(true);
          Alert.alert('⏰ Time’s up!', ``, [
            { text: 'Play Again', onPress: resetGame },
            { text: 'Exit', 
              onPress: () => 
                navigation.navigate("ChallDetails", { challId: challengeId, challName, whichChall }) 
            },
          ]);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameOver, waitingActive]);

  //  validate API
  const submitGuess = async () => {
    if (gameOver || !gameStateId) return;
    if (submittedRows.has(selectedRow)) {
    console.log(`[Wordle] Row ${selectedRow} already submitted, skipping`);
    return;
  }
    const rowArr = Array.isArray(grid[selectedRow]) ? grid[selectedRow] : [];
    const guess = rowArr.join('');
    setSubmittedRows(prev => new Set(prev).add(selectedRow));
    console.log(`[Wordle] Submitting guess row=${selectedRow}, guess="${guess}"`);

    try {
      const accessToken = await getAccessToken(); // ✅ get token before request
      if (!accessToken) {
        console.error("[Wordle] No access token found");
        return;
      }

      const res = await fetch(endpoints.validateWordleMove, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, // ✅ changed here
        },
        body: JSON.stringify({
          game_state_id: gameStateId,
          row: selectedRow,
          guess,
        }),
      });

      console.log("[Wordle] validateWordleMove response status:", res.status);

      if (!res.ok) {
        console.error('[submitGuess] backend error:', res.status);
        return;
      }

      const data = await res.json();
      setResults((prev) => [...prev, data.feedback]);

      if (socket && socket.readyState === WebSocket.OPEN) {
        console.log("[WebSocket] Sending my move:", guess);
        socket.send(
          JSON.stringify({
            type: 'make_move',
            player: user?.username,
            row: selectedRow,
            guess,
            evaluation: data.feedback,
          }),
        );
      } else {
        console.log('[WebSocket] Skipping send; socket not open');
      }

      if (data.is_correct || data.is_complete) {
        setGameOver(true);
        

        if (!hasShownResultRef.current) {
          const leaderboard = data.scores
            ?.map((p: { username: string; score: number }) => `${p.username}: ${p.score}`)
            .join('\n') || 'No scores yet';

          Alert.alert(
            data.is_correct ? '🎉 You Win!' : '❌ Game Over',
            `Leaderboard:\n${leaderboard}`,
            [
              { text: 'Play Again', onPress: resetGame },
              { text: 'Exit', onPress: () => navigation.navigate("ChallDetails", { challId: challengeId, challName, whichChall }) },
            ],
          );
          hasShownResultRef.current = true;
        }
      } else {
        setSelectedRow((r) => r + 1);
        setSelectedCol(0);
      }
    } catch (err) {
      console.error('[submitGuess] Failed:', err);
    }
  };

  const handleInput = (letter: string) => {
    if (gameOver || !gameStateId) return;
    const newGrid = [...grid];
    newGrid[selectedRow][selectedCol] = letter.toUpperCase();
    setGrid(newGrid);

    if (selectedCol < GRID_SIZE - 1) {
      setSelectedCol((c) => c + 1);
    } else {
      submitGuess();
    }
  };

  const handleDelete = () => {
    if (gameOver || selectedCol === 0) return;
    const newGrid = [...grid];
    newGrid[selectedRow][selectedCol - 1] = '';
    setGrid(newGrid);
    setSelectedCol((c) => c - 1);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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
            <View style={{ marginTop: 8 }}>
              {members.map(m => {
                const isOnline = onlineIds?.some(id => String(id) === String(m.id));
                const initials = (m.name || '')
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map(s => s[0])
                  .join('')
                  .toUpperCase();
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
            <Text style={styles.waitingText}>Players: {readyCount}/{expectedCount}</Text>
            <Text style={styles.waitingText}>
              {remainingSec != null
                ? `Starts in ${Math.floor(Math.max(0, remainingSec) / 60)}:${(Math.max(0, remainingSec) % 60)
                    .toString()
                    .padStart(2, '0')}`
                : 'Starts soon'}
            </Text>
            {canStartNow && socketRef.current && (
              <TouchableOpacity
                style={styles.startBtn}
                onPress={() => {
                  const ws = socketRef.current;
                  if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'start_game' }));
                  } else {
                    console.log('[WebSocket] Start Game tapped but socket not open');
                  }
                }}
              >
                <Text style={styles.startBtnText}>Start Game</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      {showCountdown && (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownText}>{String(countdownValue ?? '')}</Text>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity
          style={styles.exitButton}
          onPress={() => {
              navigation.goBack();
          }}
          // onPress={() => {
          //   AlarmModule.clearLaunchIntent().then(() => {
          //     navigation.goBack();
          //   });
          // }}
        >
          <Text style={styles.exitText}>Exit</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Wordle</Text>
        <Text style={styles.description}>
          Time left: {formatTime(timeLeft)}
        </Text>
        
        {/* Player List */}
        {players.length > 0 && (
          <View 
            style={{ 
              marginVertical: 10, 
              width: '100%', 
              alignItems: 'center',       
              justifyContent: 'center'    
            }}
          >
            <Text 
              style={{ 
                color: 'white', 
                fontWeight: 'bold', 
                fontSize: 18, 
                marginBottom: 5, 
                textAlign: 'center' 
              }}
            >
              👥 Players {/*({players.length})*/}
            </Text>

            <View 
              style={{ 
                flexDirection: 'row', 
                flexWrap: 'wrap',          
                justifyContent: 'center',  
                alignItems: 'center' 
              }}
            >
              {players.map((p, idx) => (
                <View 
                  key={idx} 
                  style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    marginHorizontal: 8,    
                    marginBottom: 8         
                  }}
                >
                  <View
                    style={{
                      backgroundColor: playerColors[p] || '#81C784',
                      width: 14,
                      height: 14,
                      borderRadius: 7,            
                      marginRight: 6,             
                      borderWidth: 1,
                      borderColor: '#fff',
                    }}
                  />
                  <Text 
                    style={{ 
                      color: 'white', 
                      fontWeight: 'bold', 
                      fontSize: 14 
                    }}
                  >
                    {p}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}



        {/* Opponent progress */}
        {Object.keys(opponentRows).length > 0 && (
          <View style={{ marginVertical: 10, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
            {Object.entries(opponentRows).map(([player, info], idx) => (
              <View
                key={idx}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, justifyContent: 'center' }}
              >
                <Text
                  style={{
                    width: 120,
                    color: 'white',
                    fontWeight: 'bold',
                  }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {player} (#{info.attempt})
                </Text>

                {info.evaluation.map((cell, cIndex) => (
                  <View
                    key={cIndex}
                    style={[
                      styles.opponentCell,
                      cell.result === 'correct'
                        ? styles.correctCell
                        : cell.result === 'present'
                        ? styles.presentCell
                        : styles.absentCell,
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Main grid */}
        <View style={styles.gridContainer}>
          {grid.map((row, rIndex) => (
            <View key={rIndex} style={styles.row}>
              {row.map((cell, cIndex) => {
                const status = results[rIndex]?.[cIndex]?.result;
                return (
                  <View
                    key={cIndex}
                    style={[
                      styles.cell,
                      status === 'correct'
                        ? styles.correctCell
                        : status === 'present'
                        ? styles.presentCell
                        : status === 'absent'
                        ? styles.absentCell
                        : {},
                      selectedRow === rIndex &&
                      selectedCol === cIndex &&
                      !gameOver
                        ? styles.selectedCell
                        : {},
                    ]}
                  >
                    <Text style={styles.cellText}>{cell}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* Keyboard */}
        <View style={styles.keyboard}>
          {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => (
            <TouchableOpacity
              key={letter}
              style={styles.key}
              onPress={() => handleInput(letter)}
              disabled={gameOver}
            >
              <Text style={styles.keyText}>{letter}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.key} onPress={handleDelete}>
            <Text style={styles.keyText}>⌫</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: { flex: 1 },
  container: {
    flexGrow: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  exitButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    padding: 8,
    backgroundColor: 'white',
    borderRadius: 5,
  },
  exitText: { fontWeight: 'bold' },
  title: { fontSize: 30, fontWeight: 'bold', color: 'white' },
  description: { fontSize: 18, color: 'white', marginVertical: 10 },
  gridContainer: { marginVertical: 20 },
  row: { flexDirection: 'row', justifyContent: 'center' },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderWidth: 1,
    borderColor: 'black',
    margin: 2,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCell: { borderColor: '#ffbf00', borderWidth: 2 },
  correctCell: { backgroundColor: '#6aaa64' },
  presentCell: { backgroundColor: '#c9b458' },
  absentCell: { backgroundColor: '#787c7e' },
  cellText: { fontSize: 20, fontWeight: 'bold', color: 'black' },
  keyboard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 10,
  },
  key: {
    width: 40,
    height: 40,
    margin: 4,
    backgroundColor: '#ffffffaa',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  keyText: { fontWeight: 'bold', fontSize: 16 },
  opponentCell: {
    width: CELL_SIZE / 2.2,
    height: CELL_SIZE / 2.2,
    borderRadius: 4,
    marginHorizontal: 1,
    backgroundColor: 'white',  
  },
  // Waiting room styles (mirroring Sudoku)
  waitingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,              // full-screen
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  waitingCard: {
    width: '85%',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',  // glass-like
    borderColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
  }, 
  countdownText: {
    fontSize: 72,
    color: '#FFD700',
    fontWeight: '900',
    textAlign: 'center',
    marginVertical: 12,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
  },
  countdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  waitingTitle: { color: 'white', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  waitingText: { color: 'white', fontSize: 14, textAlign: 'center', marginBottom: 6 },
  startBtn: { marginTop: 12, backgroundColor: '#FFD700', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, alignSelf: 'center' },
  startBtnText: { color: '#333', fontWeight: '700' },
});

export default WordleScreen;
