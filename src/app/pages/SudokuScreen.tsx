import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  Alert,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Image,
  ToastAndroid
} from 'react-native';
// import { createSudokuGame, validateSudokuMove } from './SudokuHelper';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { endpoints, BASE_URL } from '../api';
import { useUser } from '../context/UserContext';
import { getAccessToken } from '../auth';

const CELL_SIZE = 35;
const BORDER_WIDTH_THIN = 1;
const BORDER_WIDTH_THICK = 2;
const GRID_SIZE = CELL_SIZE * 9 + BORDER_WIDTH_THIN * 6 + BORDER_WIDTH_THICK * 2;

interface BroadcastMoveMessage {
  type: 'broadcast_move';
  cell: number;
  value: number;
  color: string;
  valid: boolean;
}

export interface PlayerJoinedMessage {
  type: 'player_joined';
  player: string; // username or user ID
  color: string;
}
interface LobbyStateMessage {
  type: 'lobby_state';
  created_at: string;
  join_deadline_at: string | null;
  server_now: string;
  ready_count: number;
  expected_count: number;
  online_ids?: number[];
}

interface JoinWindowClosedMessage {
  type: 'join_window_closed';
  server_now?: string;
}

interface TimeoutMessage {
  type: 'timeout';
}

interface TimerExpiredMessage {
  type: 'timer_expired';
}

type PlayerScore = {
  username: string;
  accuracy: number;
  inaccuracy: number;
  score: number; // a number between 0 and 100 (rounded to 2 decimals)
};

type GameCompleteMessage = {
  type: 'game_complete';
  // completed_by: string;
  scores: PlayerScore[];
};

// Client → Server

export interface MakeMoveMessage {
  type: 'make_move';
  index: number;
  value: number;
}

export interface IgnoredMessage {
  type: 'ignored';
}

export type CellLockedMessage = {
  type: 'cell_locked';
  cell: number;     // index of the cell
  player: string;   // who locked the cell
  color: string;    // player's color
};

export type CellUnlockedMessage = {
  type: 'cell_unlocked';
  cell: number;
};

export type LockFailedMessage = {
  type: 'lock_failed';
  cell: number;
};


// Server to client
export type ServerToClientMessage =
  | BroadcastMoveMessage
  | PlayerJoinedMessage
  | GameCompleteMessage
  | LobbyStateMessage
  | JoinWindowClosedMessage
  | IgnoredMessage
  | CellLockedMessage
  | CellUnlockedMessage
  | LockFailedMessage
  | TimeoutMessage
  | TimerExpiredMessage;

// Client to server
export type ClientToServerMessage = MakeMoveMessage;

type Props = {
  navigation: NavigationProp<any>;
};

const SudokuScreen: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { challengeId, challName, whichChall } = route.params as {
    // is currently hard coded to 4 (the only current group challenge)
    challengeId: number;

    challName: string;
    whichChall: string;
  };
  console.log("SudokuScreen route params:", route.params);

  const { user, setSkillLevels } = useUser();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  // will only have a color if in a multiplayer game
  const [playerColor, setPlayerColor] = useState<string>('');
  const [playerColors, setPlayerColors] = useState<Record<string, string>>({});
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [gameId, setGameId] = useState<number | null>(null);
  // {
  //   "alice": "aqua",
  //   "bob": "orange"
  // }

  const [gameStateId, setGameStateId] = useState<number>(1);
  const [grid, setGrid] = useState<string[]>(Array(81).fill(''));
  const [initialCells, setInitialCells] = useState<boolean[]>(Array(81).fill(false));
  // const [savedColor, setSavedColor] = useState(getInitialColor());
  const [cellColors, setCellColors] = useState(Array(81).fill('white'));
  // const [timeLeft, setTimeLeft] = useState(300);
  // const [intervalId, setIntervalId] = useState<ReturnType<typeof setInterval> | null>(null);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [cellLocks, setCellLocks] = useState<{ [key:number]: string }>({});
  const [cellBorderColors, setCellBorderColors] = useState<string[]>(Array(81).fill('black'));

  // const [pendingInput, setPendingInput] = useState<string>('');
  // Multiplayer waiting room state
  const [waitingActive, setWaitingActive] = useState<boolean>(false);
  const [joinDeadlineISO, setJoinDeadlineISO] = useState<string | null>(null);
  const [readyCount, setReadyCount] = useState<number>(1);
  const [expectedCount, setExpectedCount] = useState<number>(1);
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 3-2-1 countdown overlay
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [members, setMembers] = useState<{ id: number; name: string }[]>([]);
  const [onlineIds, setOnlineIds] = useState<number[]>([]);

   // 5-minute game timer
  const [gameTimeLeft, setGameTimeLeft] = useState<number>(30); // 5 minutes in seconds
  const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerExpiredSentRef = useRef(false);
  
  const canStartNow = useMemo(() => {
    return readyCount >= 1;
  }, [readyCount]);

  const startLocalCountdown = (deadlineISO: string | null) => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (!deadlineISO) {
      setRemainingSec(0);
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

  useEffect(() => () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);
  
  const handleTimerExpired = async () => {
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
            model: 'SudokuGameState',
            game_state_id: gameStateId,
          }),
        });
        
        const data = await response.json();
        console.log('[Sudoku] Timer expired signal sent to backend', data);
        
        // For single-player games (no WebSocket), handle the response directly
        if (!isMultiplayer) {
          if (gameTimerRef.current) clearInterval(gameTimerRef.current);
          Alert.alert(
            "Time's Up!",
            'The 5-minute game timer has expired. Final scores have been calculated.',
            [{ text: 'OK', onPress: () => navigation.navigate('ChallDetails', { challId: challengeId, challName, whichChall }) }]
          );
        }
        // For multiplayer, the WebSocket handler will show the alert
      } catch (e) {
        console.error('[Sudoku] Failed to send timer expired signal:', e);
      }
  };
  
    // Watch for game timer expiry
  useEffect(() => {
    if (gameTimeLeft === 0 && !gameCompleted) {
      handleTimerExpired();
    }
  }, [gameTimeLeft, gameCompleted]);

  const startGameTimer = () => {
      if (gameTimerRef.current) {
        clearInterval(gameTimerRef.current);
      }
      setGameTimeLeft(30);
      timerExpiredSentRef.current = false;
      gameTimerRef.current = setInterval(() => {
        setGameTimeLeft((prev) => {
          if (prev <= 1) {
            if (gameTimerRef.current) clearInterval(gameTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
  };
  
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

    const refreshSkills = async () => {
      try {
              const accessToken = await getAccessToken();
              if (!accessToken) {
                throw new Error("Not authenticated");
              }
        const res = await fetch(endpoints.skillLevels(Number(user?.id)), {
                headers: {
                  Authorization: `Bearer ${accessToken}`
                }
              });
        const data = await res.json();
        setSkillLevels(data.skillLevels);
      } catch (err) {
        console.error("skill refresh failed", err);
      }
    };
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
        // countdown finished → auto-start
        if (showCountdown) {
          setShowCountdown(false);
          setCountdownValue(null);
        }
        // setWaitingActive(false);
        // Ask server to close joins (safe even if close task fires too)
        socketRef.current?.send(JSON.stringify({ type: 'start_game' }));
      } else {
        // more than 3 seconds left
        if (showCountdown) {
          setShowCountdown(false);
          setCountdownValue(null);
        }
      }
    }, [remainingSec, waitingActive]);
  // AI - Save scores
   const saveScores = async (payload: {
     challenge_id: number;
     game_id?: number;
     game_name?: string;
     date?: string;
     scores: { username: string; score: number; accuracy?: number; inaccuracy?: number }[];
   }) => {
     try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          throw new Error("Not authenticated");
        }

        const doPost = async () => fetch(endpoints.submitGameScores(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        });
        let res = await doPost();
        if (!res.ok) {
          await new Promise(r => setTimeout(r, 150));
          res = await doPost();
          if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw new Error(`Submit failed (${res.status}) ${txt}`);
          }
        }
     } catch (e) {
       console.error('Failed to submit scores', e);
     }
   };

  // INITIALIZE GAME
  const initGame = async () => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const res = await fetch(endpoints.createSudokuGame, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ challenge_id: challengeId }),
      });

      // Friendly message if game cannot be joined
      if (res.status === 403) {
        const errData = await res.json().catch(() => ({} as any));
        const code = (errData as any)?.code as string | undefined;
        const detail = (errData as any)?.detail as string | undefined;
        let title = 'Game Unavailable';
        let message = detail || 'This game is closed. \nPlease join next time.';
        if (code === 'JOINS_CLOSED') {
          title = 'Join Window Closed';
          message = detail || 'The join window has closed. \nPlease join next time.';
        } else if (code === 'GAME_ENDED') {
          title = 'Game Finished';
          message = detail || 'This game has already finished for today.';
        }
        Alert.alert(title, message);
        navigation.goBack();
        return;
      }

      const data = await res.json();
      console.log("Response data:", data);

      const { game_id, game_state_id, puzzle, is_multiplayer, created_at, join_deadline_at } = data;

      setIsMultiplayer(!!is_multiplayer);

      const board = puzzle as number[][];
      if (!Array.isArray(board)) {
        console.error("Puzzle data is invalid:", board);
        return; // Or handle the case where puzzle is not an array
      }
      setGameStateId(game_state_id);
      setGameId(game_id);

      // Set up board
      const flatten = (board: number[][]): string[] =>
        board.flat().map((n) => (n === null || n === 0 ? '' : n.toString()));

      setGrid(flatten(puzzle));
      setInitialCells(flatten(puzzle).map((n) => n !== ''));

      setCellColors(Array(81).fill('white'));
      // setTimeLeft(300);
      setGameCompleted(false);
      setSelectedIndex(null);
      // setPendingInput('');

      // WebSocket connection for multiplayer
      console.log("Is multiplayer:", is_multiplayer);
      if (is_multiplayer) {
        const resDetail = await fetch(endpoints.challengeDetail(challengeId), {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const detail = await resDetail.json();
        setMembers(detail.members || []); // [{id, name}]
        setWaitingActive(true);
        if (join_deadline_at) {
          setJoinDeadlineISO(join_deadline_at);
          startLocalCountdown(join_deadline_at);
        }
        const ws = new WebSocket(`${BASE_URL.replace(/^http/, 'ws')}/ws/sudoku/${game_state_id}/?token=${accessToken}`);

        socketRef.current = ws;

        ws.onopen = () => console.log("[WebSocket] connected");

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data) as ServerToClientMessage;
          console.log("[WebSocket] Message received:", data);

          // 🧪 new: check for ignored
          if (data.type === 'ignored') {
            ToastAndroid.show("⚠️ This cell has already been completed", ToastAndroid.SHORT);
            return;
          }

          if (data.type === 'cell_locked') {
            setCellLocks(prev => ({ ...prev, [data.cell]: data.player }));

            setCellBorderColors(prev => {
              const updated = [...prev];
              updated[data.cell] = data.color;
              console.log('[DEBUG cell_locked] border color for cell', data.cell, 'set to', data.color);
              return updated;
            });
            return;
          }

          if (data.type === 'cell_unlocked') {
            setCellLocks(prev => {
              const updated = { ...prev };
              delete updated[data.cell];
              return updated;
            });

            // reset border color to black if not locked by anyone else
            setCellBorderColors(prev => {
              const updated = [...prev];
              updated[data.cell] = 'black';
              console.log('[DEBUG cell_unlocked] border color reset for cell', data.cell);
              return updated;
            });
            return;
          }


          switch (data.type) {

            case 'broadcast_move': {
              const { cell, value, color, valid } = data;

              if (valid) {
                setGrid(prevGrid => {
                  const updatedGrid = [...prevGrid];
                  updatedGrid[cell] = value.toString();
                  return updatedGrid;
                });

                setCellColors(prevColors => {
                  const updatedColors = [...prevColors];
                  updatedColors[cell] = color;
                  return updatedColors;
                });
              }

              else {
                setCellColors(prevColors => {
                  const updatedColors = [...prevColors];
                  updatedColors[cell] = 'red';
                  console.log("here");
                  return updatedColors;
                });
              }

              break;
            }

            case 'player_joined': {
              console.log(`${data.player} joined the game as color ${data.color}`);

              // Assume you have access to the current user's username somehow:
              if (data.player === user?.username) {
                console.log('setting my own color');
                setPlayerColor(data.color);
              }

              setPlayerColors(prev => ({
                ...prev,
                [data.player]: data.color,
              }));
              setReadyCount(rc => Math.max(rc, Object.keys(playerColors).length + 1));

              break;
            }
            case 'lobby_state': {
              const d = data as LobbyStateMessage;
              setExpectedCount(d.expected_count);
              console.log("expected count: ", d.expected_count);
              setReadyCount(d.ready_count);
              if (d.join_deadline_at) {
                setJoinDeadlineISO(d.join_deadline_at);
                startLocalCountdown(d.join_deadline_at);
              }
              if (Array.isArray(d.online_ids)) {
                setOnlineIds(d.online_ids);
              }

              console.log('online_ids from socket:', d.online_ids);
              console.log('member ids:', (members || []).map(x => x.id));
              break;
            }
            
            case 'join_window_closed': {
              setWaitingActive(false);
              if (countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
              }
              setShowCountdown(false);
              setCountdownValue(null);
            // Start 5-minute game timer when join window closes
              startGameTimer();
              break;
            }

          case 'timeout': {
            Alert.alert('Timeout', 'You have been timed out for inactivity.', [
              { text: 'OK', onPress: () => navigation.navigate('ChallDetails', { challId: challengeId, challName, whichChall }) },
            ]);
            break;
          }

          case 'timer_expired': {
            if (gameTimerRef.current) clearInterval(gameTimerRef.current);
            Alert.alert('Time\'s Up!', 'The 5-minute game timer has expired.', [
              { text: 'OK', onPress: () => navigation.navigate('ChallDetails', { challId: challengeId, challName, whichChall }) },
            ]);
            break;
          }

          case 'game_complete': {
              const { scores } = data;
              console.log("game complete score: ", scores);

              (async () => {
                try {
                  await refreshSkills();
                  // Auto-navigate to ChallDetails after 2s to allow backend to finalize
                  Alert.alert(
                    "🎉 Puzzle Complete!",
                    `\n\nScores:\n` +
                      scores
                        .sort((a, b) => b.score - a.score)
                        .map(s => `${s.username}: ${s.score} (✅ ${s.accuracy} / ❌ ${s.inaccuracy})`)
                        .join("\n"),
                    [{ text: "OK", onPress: () => navigation.navigate("ChallDetails", { challId: challengeId, challName, whichChall }) }]
                  );
                } catch (err) {
                  console.error("submit score failed", err);
                }
              })();
              break;
            }
            default:
              console.warn('Unknown message type', data);
          }
        };

        ws.onerror = (error) => console.error("[WebSocket] Error:", error);
        ws.onclose = () => console.log("[WebSocket] closed");

        setSocket(ws);
      }
      else {  // Single-player: start game timer immediately
        console.log('[Sudoku] Single-player mode - starting game timer');
        startGameTimer();
      }
    } catch (error) {
      console.error('Init failed', error);
    }
  };

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    };
  }, []);
  // const restartGame = async () => {
  //   if (intervalId) clearInterval(intervalId);
  //   setIntervalId(null);
  //   await initGame();
  //   const newTimer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
  //   setIntervalId(newTimer);
  // };

  // // When Timer Ends
  // useEffect(() => {
  //   if (timeLeft === 0) {
  //     if (intervalId) clearInterval(intervalId);
  //     Alert.alert("Time's Up!", 'You failed your team!', [{ text: 'Try Again', onPress: restartGame }]);
  //   }
  // }, [timeLeft]);

  // On mount start game
  useEffect(() => {
    initGame();
    // const id = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    // setIntervalId(id);
    return () => {
      // clearInterval(id);
      if (socketRef.current) {
        socketRef.current.close();
      }
      setSocket(null);
      socketRef.current = null;
    };
  }, []);



  const confirmMove = async (index: number, value: number) => {
    try {
      if (index !== null) {
        if (socketRef.current) {
          const message = { type: 'make_move', index, value };
          socketRef.current.send(JSON.stringify(message));
        } else {
          // single-player API fallback
          // Single-player — validate via API
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Not authenticated");
      }

          const res = await fetch(endpoints.validateSudokuMove, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              "Authorization": `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              game_state_id: gameStateId,
              index,
              value,
            }),
          });

          const data = await res.json();

          if (data.success) {
            console.log("correct");

            // Update the grid with the new puzzle values
            setGrid(prevGrid => {
              const updatedGrid = [...prevGrid];
              updatedGrid[index] = value.toString(); // Update the cell with the correct value
              return updatedGrid;
            });

            // Reset the color to white if the previous color was red
            setCellColors(prevColors => {
              const updatedColors = [...prevColors];
              if (prevColors[index] === 'red') {
                updatedColors[index] = 'white'; // Reset to white if it was previously red
              }
              return updatedColors;
            });

            if (data.completed) {
              setGameCompleted(true);

              (async () => {
                if (user?.username) {
                  try {
                    await refreshSkills();
                  } catch (e) {
                    console.error("submit score failed", e);
                  }
                }
                Alert.alert("🎉 Puzzle Complete!", "", [
                  { text: "OK", onPress: () => navigation.navigate("ChallDetails", { challId: challengeId, challName, whichChall }) },
                ]);
              })();
            }

          } else {
            // If the move is incorrect, set the color to red
            setCellColors(prevColors => {
              const updatedColors = [...prevColors];
              updatedColors[index] = 'red';
              return updatedColors;
            });
          }


          // if (data.success) {
          //   console.log("correct");
          //   const updatedGrid = data.puzzle.flat().map((n: number) => n ? n.toString() : '');
          //   setGrid(updatedGrid);
          //   // get rid of red if it's there
          //   if (cellColors[index] === 'red') {
          //     const updatedColors = [...cellColors];
          //     updatedColors[index] = 'white';
          //     setCellColors(updatedColors);
          //   }

          //   if (data.completed) {
          //     setGameCompleted(true);
          //     // if (intervalId) clearInterval(intervalId);
          //     Alert.alert("🎉 Puzzle Complete!");
          //     // Alert.alert("🎉 You Win!", `Time: ${formatTime(300 - timeLeft)}`);
          //   }
          // } else {
          //   const updatedColors = [...cellColors];
          //   updatedColors[index] = 'red';
          //   setCellColors(updatedColors);
          //   // Alert.alert('Oops!', 'Wrong answer!');
          // }
        }
      }
    } catch (err) {
      console.error('Error validating move', err);
    } finally {
      // setPendingInput('');
      setSelectedIndex(null);
    }
  };

  // temp function for checking if the cell is already filled
  // const checkIfBoardFilled = () => {
  //   const allFilled = grid.every(cell => cell !== '');
  //   if (allFilled) {
  //     setGameCompleted(true);
  //     Alert.alert("✅ Board Filled", "All cells have been filled. Game marked as complete.");
  //   } else {
  //     Alert.alert("🕵️ Not Yet", "There are still empty cells.");
  //   }
  // };



  // // Handle cell deletion
  // const handleDeleteMove = () => {
  //   if (selectedIndex !== null) {
  //     if (initialCells[selectedIndex]) {
  //       return;
  //     }
  //     const newGrid = [...grid];
  //     newGrid[selectedIndex] = '';
  //     setGrid(newGrid);

  //     const newColors = [...cellColors];
  //     newColors[selectedIndex] = 'white';
  //     setCellColors(newColors);

  //     setSelectedIndex(null);
  //     // setPendingInput('');
  //   }
  // };

  return (
    <ImageBackground source={require('../images/cgpt.png')} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
      {waitingActive && (
      <View style={styles.waitingOverlay}>
        <View style={styles.waitingCard}>
          <Text style={styles.waitingTitle}>Waiting Room</Text>

          <View style={{ marginTop: 8 }}>
          {members.map(m => {
          const isOnline = onlineIds?.some(id => String(id) === String(m.id)); // robust compare
          const initials = (m.name || '')
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map(s => s[0])
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
                <Text style={{ color: isOnline ? '#333' : '#eee', fontWeight: '700' }}>
                  {initials || '?'}
                </Text>
              </View>
              <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
                {m.name}
              </Text>
              {isOnline && (
                <View style={{ marginLeft: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#00E676' }} />
              )}
            </View>
          );
        })}
        </View>

          <Text style={styles.waitingText}>
            Players: {readyCount}/{expectedCount}
          </Text>
          <Text style={styles.waitingText}>
            Starts in {Math.floor(Math.max(0, remainingSec) / 60)}:
            {(Math.max(0, remainingSec) % 60).toString().padStart(2, '0')}
          </Text>

          {canStartNow && socketRef.current && (
            <TouchableOpacity
              style={styles.startBtn}
              onPress={() => {
                console.log('[Sudoku] Starting game');
                socketRef.current?.send(JSON.stringify({ type: 'start_game' }));
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
            <Text style={styles.countdownText}>{countdownValue}</Text>
          </View>
        )}
        <View style={styles.header}>
          <TouchableOpacity style={styles.exitButton} onPress={() => {
            if (gameCompleted) navigation.navigate('ChallDetails', {
              challId: challengeId, challName: challName,
              whichChall: whichChall,});
            else Alert.alert('Game in Progress', 'You cannot exit while a game is in progress.', [{ text: 'OK', style: 'cancel' }]);
          }}>
            <Text style={styles.exitText}>Exit</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Sudoku</Text>
          {!waitingActive && (
            <Text style={[styles.timer, { color: gameTimeLeft < 60 ? '#ffffffff' : 'white' }]}>
              Game Timer: {formatTime(gameTimeLeft)}
            </Text>
          )}
          {/* <Text style={styles.timer}>Timer: {formatTime(timeLeft)}</Text> */}

          {/*Temp function for checking board is full and exit is working*/}
          {/* <TouchableOpacity style={styles.exitButton} onPress={checkIfBoardFilled}>
            <Text style={styles.exitText}>Check</Text>
          </TouchableOpacity> */}
        </View>

        {playerColor !== '' && (
          <View style={styles.colorInfoRow}>
            <Text style={styles.colorInfo}>You are color:</Text>
            <View style={[styles.colorBox, { backgroundColor: playerColor }]} />
          </View>
        )}

        <Text style={styles.info}>
          {/* You can only work on squares that aren’t already being worked on.{"\n"} */}
          Tap a cell to highlight. → Pick a number below to enter.
        </Text>


        {/* Number pad*/}
        <View style={styles.numberPad}>

          {/* Number buttons */}
          <View style={styles.numberRow}>
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <TouchableOpacity
              key={n}
              style={styles.numButton}
              onPress={() => {
                if (selectedIndex !== null && !initialCells[selectedIndex]) {
                  confirmMove(selectedIndex, n);
                }
              }}
            >
              <Text style={styles.numText}>{n}</Text>
            </TouchableOpacity>
              // <TouchableOpacity key={n} style={styles.numButton} onPress={() => setPendingInput(n.toString())}>
              //   <Text style={styles.numText}>{n}</Text>
              // </TouchableOpacity>
            ))}
          </View>

          {/* Delete and confirm buttons
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleDeleteMove}
            >
              <Image source={require('../images/trash.png')} style={{ width: 20, height: 20, resizeMode: 'contain',}} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={confirmMove}
            >
              <Image source={require('../images/check.png')} style={{ width: 20, height: 20, resizeMode: 'contain',}} />
            </TouchableOpacity>

          </View> */}
        </View>

        {/* Sudoku grid */}
        <View style={styles.gridContainer} key={gameStateId}>
          {Array.from({ length: 9 }).map((_, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {Array.from({ length: 9 }).map((_, colIndex) => {
                const index = rowIndex * 9 + colIndex;
                const selected = index === selectedIndex;
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => {
                      if (initialCells[index]) return;

                      // 🟡 If the player taps the same cell again → unselect it and show a toast
                      if (selectedIndex === index) {
                        ToastAndroid.show('⚠️ You have already selected this cell', ToastAndroid.SHORT);
                        setSelectedIndex(null); // remove yellow highlight
                        if (socketRef.current) {
                          socketRef.current.send(JSON.stringify({ type: 'unlock_cell', index }));
                        }
                        return;
                      }

                      // 🧭 Step 1: If another cell was previously locked → unlock it
                      if (socketRef.current && selectedIndex !== null && selectedIndex !== index) {
                        socketRef.current.send(JSON.stringify({ type: 'unlock_cell', index: selectedIndex }));
                      }

                      // 🧭 Step 2: Check if this cell is locked by another player
                      const lockedBy = cellLocks[index];
                      if (lockedBy && lockedBy !== user?.username) {
                        ToastAndroid.show(`⚠️ This cell is locked by ${lockedBy}`, ToastAndroid.SHORT);
                        return;
                      }

                      // 🧭 Step 3: If not locked → lock this cell
                      if (!lockedBy && socketRef.current) {
                        socketRef.current.send(JSON.stringify({ type: 'lock_cell', index }));
                      }

                      // 🧭 Step 4: Update current selection
                      setSelectedIndex(index);
                    }}
                    style={[
                      styles.cell,
                      { 
                        // singleplayer & multiplayer color handling
                        ...(selected
                          ? (playerColor
                              ? { borderColor: playerColor, borderWidth: 2 }  // multiplayer mode
                              : styles.selectedCell)                           // singleplayer mode
                          : { borderColor: cellBorderColors[index], borderWidth: cellLocks[index] ? 3 : BORDER_WIDTH_THIN }),
                      },
                      rowIndex % 3 === 0 && rowIndex !== 0 ? styles.thickTopBorder : {},
                      colIndex % 3 === 0 && colIndex !== 0 ? styles.thickLeftBorder : {},
                    ]}>
                    <Text style={styles.cellText}>{grid[index]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* Player color info and restart button */}
        {Object.keys(playerColors).length > 0 && (
          <View style={styles.colorRow}>
            {Object.entries(playerColors).map(([player, color]) => (
              <View key={player} style={styles.playerBadge}>
                <View style={[styles.colorCircle, { backgroundColor: color }]} />
                <Text style={styles.playerName}>{player}</Text>
              </View>
            ))}
            {/* <TouchableOpacity style={styles.restartButton} onPress={restartGame}>
              <Text style={styles.restartText}>Restart</Text>
            </TouchableOpacity> */}
          </View>
        )}

        {/* message box */}
        {/* <View style={styles.chatBox}>
          <TextInput placeholder="Type a message..." style={styles.chatInput} />
        </View> */}
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: { flex: 1 },
  container: { flex: 1, alignItems: 'center' },

  // header styles
  header: { flexDirection: 'row', justifyContent: 'space-between', width: '90%', marginTop: 20, alignItems: 'center' },
  exitButton: { backgroundColor: 'white', padding: 5, borderRadius: 5 },
  exitText: { fontWeight: 'bold' },
  title: { fontSize: 30, fontWeight: 'bold', color: 'white', marginVertical: 5, marginHorizontal: 5, alignItems: 'center' },
  timer: { fontSize: 18, color: 'white', marginVertical: 5 },

  // color info styles
  colorInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  colorInfo: { fontSize: 16, color: 'white', marginRight: 8},
  colorBox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: 'black'},
  info: { color: 'white', textAlign: 'center', marginBottom: 5 },

  // number pad, delete, and confirm button styles
  numberPad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', marginVertical: 10, gap: 10,},
  numberRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  numButton: {
    backgroundColor: 'white',
    paddingVertical: 7,
    paddingHorizontal: 12,
    margin: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  numText: { fontSize: 14, fontWeight: 'bold' },
  actionRow: {
    flexDirection: 'row',
    marginTop: 5,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    paddingVertical: 5,
    paddingHorizontal: 40,
    marginHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#aaa',
  },
  playerBadge: {
    alignItems: 'center',
    marginRight: 10,
  },
  colorCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginBottom: 2,
  },
  playerName: {
    fontSize: 12,
    color: 'white',
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
  // waiting room styles
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
  // Big 3-2-1
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
  waitingTitle: { color: 'white', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  waitingText: { color: 'white', fontSize: 14, textAlign: 'center', marginBottom: 6 },
  startBtn: { marginTop: 12, backgroundColor: '#FFD700', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, alignSelf: 'center' },
  startBtnText: { color: '#333', fontWeight: '700' },
  // Sudoku grid styles
  gridContainer: { backgroundColor: 'black' },
  row: { flexDirection: 'row' },
  cell: { width: CELL_SIZE, height: CELL_SIZE, borderWidth: BORDER_WIDTH_THIN, borderColor: 'black', justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' },
  selectedCell: { borderColor: '#ffbf00', borderWidth: 2 },
  thickTopBorder: { borderTopWidth: BORDER_WIDTH_THICK },
  thickLeftBorder: { borderLeftWidth: BORDER_WIDTH_THICK },
  cellText: { fontSize: 16 },

  // player color and restart button styles
  colorRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
  avatar: { width: 40, height: 40, borderWidth: 3, borderRadius: 20, marginHorizontal: 5, backgroundColor: 'gray' },
  restartButton: { backgroundColor: 'lightgreen', padding: 8, borderRadius: 5, marginLeft: 10 },
  restartText: { fontWeight: 'bold' },

  // message input
  chatBox: { width: '90%', backgroundColor: 'white', borderRadius: 5, padding: 5 },
  chatInput: { fontSize: 16 },
});

export default SudokuScreen;