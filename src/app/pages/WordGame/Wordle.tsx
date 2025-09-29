import React, { useEffect, useState } from 'react';
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
import { evaluateGuess, GuessResult, isWinningGuess } from './WordleHelper';
import { getAccessToken } from "../../auth";

const GRID_SIZE = 5;
const MAX_ATTEMPTS = 5;
const CELL_SIZE = 50;

type Props = {
  navigation: NavigationProp<any>;
};

type ServerToClientMessage =
  | {
      type: 'broadcast_move';
      player: string;
      row: number;
      guess: string;
      evaluation: GuessResult[];
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
  const [answer, setAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(300);
  const [gameOver, setGameOver] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [first, setFirst] = useState(true);
  const [gameStateId, setGameStateId] = useState<number | null>(null);
  const [opponentRows, setOpponentRows] = useState<{
    [player: string]: GuessResult[];
  }>({});

  // 🔄 Reset game
  const resetGame = () => {
    setGrid(
      Array.from({ length: MAX_ATTEMPTS }, () => Array(GRID_SIZE).fill('')),
    );
    setResults([]);
    setSelectedRow(0);
    setSelectedCol(0);
    setTimeLeft(300);
    setGameOver(false);
    setOpponentRows({});
    setAnswer('');
    initGame();
  };

  // Initialize game
  const initGame = async () => {
    try {
      if (!user) {
        console.warn('[Wordle] User context not loaded');
        return;
      }
      if (typeof challengeId !== 'number' || isNaN(challengeId)) {
        console.warn('[Wordle] Invalid challengeId:', challengeId);
        return;
      }

      // const token = await fetch(`${BASE_URL}/api/csrf-token/`, {
      //   credentials: 'include',
      // });
      // const tokenData = await token.json();
      // const csrfToken = tokenData.csrfToken;
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

      if (!res.ok) {
        const errorText = await res.text();
        console.error('[Wordle] Backend error:', res.status, errorText);
        return;
      }

      const data = await res.json();
      setAnswer(data.answer);

      const { game_state_id, is_multiplayer } = data;
      setGameStateId(game_state_id);
      console.log('[Wordle] Correct answer is:', data.answer);
      console.log('route.params: ', route.params);

      // if (is_multiplayer) {
      //   console.log('multiplayer');
      //   const ws = new WebSocket(
      //     `${BASE_URL.replace(/^http/, 'ws')}/ws/wordle/${game_state_id}/`,
      //   );
      //   ws.onopen = () => console.log('[WebSocket] connected');

      //   ws.onmessage = (event) => {
      //     const msg: ServerToClientMessage = JSON.parse(event.data);

      //     switch (msg.type) {
      //       case 'player_joined':
      //         console.log(
      //           `[WebSocket] Player joined: ${msg.player} with color ${msg.color}`,
      //         );
      //         break;
      //       case 'broadcast_move':
      //         setOpponentRows((prev) => ({
      //           ...prev,
      //           [msg.player]: msg.evaluation,
      //         }));
      //         break;
      //       case 'game_complete':
      //         const leaderboard = msg.scores
      //           .sort((a, b) => b.score - a.score)
      //           .map(
      //             (s) =>
      //               `${s.username}: ${s.score} (✅ ${s.accuracy} / ❌ ${s.inaccuracy})`,
      //           )
      //           .join('\n');

      //         Alert.alert('🎉 Game Complete!', leaderboard, [
      //           {
      //             text: 'OK',
      //             onPress: () =>
      //               navigation.navigate('ChallSchedule', {
      //                 challId: challengeId,
      //                 challName,
      //                 whichChall,
      //               }),
      //           },
      //         ]);
      //         break;
      //       default:
      //         console.warn('Unhandled WebSocket message:', msg);
      //     }
      //   };

      //   ws.onerror = (e) => console.error('[WebSocket] error:', e);
      //   ws.onclose = () => console.log('[WebSocket] closed');

      //   setSocket(ws);
      // }
    } catch (err) {
      console.error('[initGame] Failed:', err);
    }
  };

  useEffect(() => {
    if (first) {
      initGame();
      setFirst(false);
    }
    if (gameOver) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setGameOver(true);
          Alert.alert('⏰ Time’s up!', `The word was ${answer}`, [
            { text: 'Play Again', onPress: resetGame },
            { text: 'Exit', onPress: () => navigation.goBack() },
          ]);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameOver, answer]);

  const submitGuess = () => {
    if (gameOver || !answer) return;
    const guess = grid[selectedRow].join('');
    const evaluation = evaluateGuess(guess, answer);
    setResults((prev) => [...prev, evaluation]);

    if (socket) {
      socket.send(
        JSON.stringify({
          type: 'make_move',
          player: user.username,
          row: selectedRow,
          guess,
          evaluation,
        }),
      );
    }

    if (isWinningGuess(guess, answer)) {
      setGameOver(true);
      Alert.alert('🎉 You Win!', `The word was ${answer}`, [
        { text: 'Play Again', onPress: resetGame },
        { text: 'Exit', onPress: () => navigation.goBack() },
      ]);
    } else if (selectedRow === MAX_ATTEMPTS - 1) {
      setGameOver(true);
      Alert.alert('❌ Game Over', `The word was ${answer}`, [
        { text: 'Play Again', onPress: resetGame },
        { text: 'Exit', onPress: () => navigation.goBack() },
      ]);
    } else {
      setSelectedRow((r) => r + 1);
      setSelectedCol(0);
    }
  };

  const handleInput = (letter: string) => {
    if (gameOver || !answer) return;
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
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity
          style={styles.exitButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.exitText}>Exit</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Wordle</Text>
        <Text style={styles.description}>
          Time left: {formatTime(timeLeft)}
        </Text>

        {/* Opponent progress */}
        {Object.keys(opponentRows).length > 0 && (
          <View style={{ marginVertical: 10, width: '100%' }}>
            {Object.entries(opponentRows).map(([player, row], idx) => (
              <View key={idx} style={{ flexDirection: 'row', marginBottom: 4 }}>
                <Text style={{ width: 70, color: 'white', fontWeight: 'bold' }}>
                  {player}
                </Text>
                {row.map((cell, cIndex) => (
                  <View
                    key={cIndex}
                    style={[
                      styles.cell,
                      cell.status === 'correct'
                        ? styles.correctCell
                        : cell.status === 'present'
                          ? styles.presentCell
                          : styles.absentCell,
                    ]}
                  >
                    <Text style={styles.cellText}>{cell.letter}</Text>
                  </View>
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
                const status = results[rIndex]?.[cIndex]?.status;
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
});

export default WordleScreen;
