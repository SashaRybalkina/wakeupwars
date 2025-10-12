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
}

interface JoinWindowClosedMessage {
  type: 'join_window_closed';
  server_now?: string;
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
  | LockFailedMessage;

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

    // having these to navigate back to the schedule page
    challName: string;
    whichChall: string;
  };
  console.log("SudokuScreen route params:", route.params);

  const { user, setSkillLevels } = useUser();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  // will only have a color if in a multiplayer game
  const [playerColor, setPlayerColor] = useState<string>('');
  const [playerColors, setPlayerColors] = useState<Record<string, string>>({});
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

  // const [pendingInput, setPendingInput] = useState<string>('');
  // Multiplayer waiting room state
  const [waitingActive, setWaitingActive] = useState<boolean>(false);
  const [joinDeadlineISO, setJoinDeadlineISO] = useState<string | null>(null);
  const [readyCount, setReadyCount] = useState<number>(1);
  const [expectedCount, setExpectedCount] = useState<number>(1);
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canStartNow = useMemo(() => {
    // allow start if 2+ players present (best-effort)
    const playersOnline = Object.keys(playerColors).length; // include self
    return playersOnline >= 1 || readyCount >= 1;
  }, [playerColors, readyCount]);

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

  // const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${sec % 60 < 10 ? '0' + sec % 60 : sec % 60}`;

    const refreshSkills = async () => {
      try {
              const accessToken = await getAccessToken();
              if (!accessToken) {
                throw new Error("Not authenticated");
              }
        const res = await fetch(endpoints.skillLevels(), {
                headers: {
                  Authorization: `Bearer ${accessToken}`
                }
              });
        const data = await res.json();
        setSkillLevels(data);
      } catch (err) {
        console.error("skill refresh failed", err);
      }
    };
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

       await fetch(endpoints.submitGameScores(), {
         method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            "Authorization": `Bearer ${accessToken}`,
          },
         body: JSON.stringify(payload),
       });

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

      if (res.status === 403) {
        const data = await res.json();
        console.log("Response data:", data.code); // Check the response from the server

        if (data.code === 'JOINS_CLOSED' || data.code === 'GAME_ENDED') {
            Alert.alert('Join closed', 'This game can no longer be joined.');
            navigation.goBack();
            return;
        }
    }
      const data = await res.json();
      console.log("Response data:", data); // Check the response from the server

      const { game_id, game_state_id, puzzle, is_multiplayer, created_at, join_deadline_at } = data;

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
      if (is_multiplayer) {
        setWaitingActive(true);
        if (join_deadline_at) {
          setJoinDeadlineISO(join_deadline_at);
          startLocalCountdown(join_deadline_at);
        }
        const ws = new WebSocket(`${BASE_URL.replace(/^http/, 'ws')}/ws/sudoku/${game_state_id}/?token=${accessToken}`);

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
            return;
          }

          if (data.type === 'cell_unlocked') {
            setCellLocks(prev => {
              const updated = { ...prev };
              delete updated[data.cell];
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
              setReadyCount(d.ready_count);
              setJoinDeadlineISO(d.join_deadline_at);
              startLocalCountdown(d.join_deadline_at);
              break;
            }
            
            case 'join_window_closed': {
              setWaitingActive(false);
              if (countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
              }
              break;
            }

            case 'game_complete': {
              const { scores } = data;

              (async () => {
                try {
                  await saveScores({
                    challenge_id: challengeId,
                    ...(gameId ? { game_id: gameId } : { game_name: 'Sudoku' }),
                    date: new Date().toLocaleDateString('en-CA'), // to fetch today's game data
                    scores: scores.map(s => ({
                      username: s.username,
                      score: s.score,
                      accuracy: s.accuracy,
                      inaccuracy: s.inaccuracy,
                    })),
                  });
                  await refreshSkills();
                } catch (err) {
                  console.error("submit score failed", err);
                }
              })();

              Alert.alert(
                "🎉 Puzzle Complete!",
                `\n\nScores:\n` +
                  scores
                    .sort((a, b) => b.score - a.score)
                    .map(s => `${s.username}: ${s.score} (✅ ${s.accuracy} / ❌ ${s.inaccuracy})`)
                    .join("\n"),
                [{ text: "OK", onPress: () => navigation.navigate("ChallDetails", { challId: challengeId, challName, whichChall }) }]
              );
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
    } catch (error) {
      console.error('Init failed', error);
    }
  };

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
      if (socket) {
        socket.close();
      }
    };
  }, []);



  const confirmMove = async (index: number, value: number) => {
    try {
      if (index !== null) {
        if (socket) {
          // Multiplayer — send over socket
          const message = {
            type: 'make_move',
            index,
            value,
          };
          socket.send(JSON.stringify(message));
        } else {
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
                    await saveScores({
                      challenge_id: challengeId,
                      ...(gameId ? { game_id: gameId } : { game_name: 'Sudoku' }),
                      date: new Date().toISOString().slice(0,10),
                      scores: [{ username: user.username, score: 100 }],
                    });
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
          <Text style={styles.waitingTitle}>Waiting Room</Text>
            <Text style={styles.waitingText}>
              Players: {readyCount}/{expectedCount}
            </Text>
          <Text style={styles.waitingText}>
            Time remaining: {Math.floor(remainingSec / 60)}:{(remainingSec % 60).toString().padStart(2, '0')}
          </Text>
            {canStartNow && socket && (
              <TouchableOpacity
                style={styles.startBtn}
                onPress={() => socket?.send(JSON.stringify({ type: 'start_game' }))}
              >
                <Text style={styles.startBtnText}>Start Game</Text>
              </TouchableOpacity>
            )}
        </View>
      )}
        <View style={styles.header}>
          <TouchableOpacity style={styles.exitButton} onPress={() => {
            if (gameCompleted) navigation.navigate('ChallDetails', {
              challId: challengeId,hallName: challName,
              whichChall: whichChall,});
            else Alert.alert('Game in Progress', 'You cannot exit while a game is in progress.', [{ text: 'OK', style: 'cancel' }]);
          }}>
            <Text style={styles.exitText}>Exit</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Sudoku</Text>
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
                        if (socket) {
                          socket.send(JSON.stringify({
                            type: 'unlock_cell',
                            index: index
                          }));
                        }
                        return;
                      }

                      // 🧭 Step 1: If another cell was previously locked → unlock it
                      if (socket && selectedIndex !== null && selectedIndex !== index) {
                        socket.send(JSON.stringify({
                          type: 'unlock_cell',
                          index: selectedIndex
                        }));
                      }

                      // 🧭 Step 2: Check if this cell is locked by another player
                      const lockedBy = cellLocks[index];
                      if (lockedBy && lockedBy !== user?.username) {
                        ToastAndroid.show(`⚠️ This cell is locked by ${lockedBy}`, ToastAndroid.SHORT);
                        return;
                      }

                      // 🧭 Step 3: If not locked → lock this cell
                      if (!lockedBy && socket) {
                        socket.send(JSON.stringify({
                          type: 'lock_cell',
                          index: index
                        }));
                      }

                      // 🧭 Step 4: Update current selection
                      setSelectedIndex(index);
                    }}
                    style={[
                      styles.cell,
                      { backgroundColor: cellColors[index] },
                      selected && styles.selectedCell,
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
  title: { fontSize: 30, fontWeight: 'bold', color: 'white' },
  timer: { fontSize: 16, color: 'white' },

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
    elevation: 2, // for Android
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
  // waiting room styles
  waitingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingTop: 40,
    paddingBottom: 16,
    alignItems: 'center',
    zIndex: 10,
  },
  waitingTitle: { color: 'white', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  waitingText: { color: 'white', fontSize: 14, marginBottom: 4 },
  startBtn: { marginTop: 8, backgroundColor: '#FFD700', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
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