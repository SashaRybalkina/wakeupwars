import React, { useEffect, useState } from 'react';
import {
  Alert,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Image,
} from 'react-native';
import { createSudokuGame, validateSudokuMove, markGameAsCompleted } from './SudokuHelper';
import uuid from 'react-native-uuid';

const CELL_SIZE = 35;
const BORDER_WIDTH_THIN = 1;
const BORDER_WIDTH_THICK = 2;
const GRID_SIZE = CELL_SIZE * 9 + BORDER_WIDTH_THIN * 6 + BORDER_WIDTH_THICK * 2;

const allColors = ['hotpink', 'coral', 'orange', 'lawngreen', 'aqua', 'deepskyblue', 'mediumorchid', 'mediumvioletred', 'magenta', 'purple', 'blue', ];
const assignColor = () => {
  const index = Math.floor(Math.random() * allColors.length);
  const color = allColors[index];
  allColors.splice(index, 1);
  return color ?? 'black';
};

const playerColors = [assignColor(), assignColor(), assignColor()];
const getInitialColor = () => playerColors[Math.floor(Math.random() * playerColors.length)];

const SudokuScreen = ({ route, navigation }) => {
  // TODO: Replace with actual challenge ID from props or context
  const challengeId = route?.params?.challengeId ?? 4; // fallback if not passed 
  const [gameId, setGameId] = useState<number | null>(null);
  const [grid, setGrid] = useState<string[]>(Array(81).fill(''));
  const [initialCells, setInitialCells] = useState<boolean[]>(Array(81).fill(false));
  const [savedColor, setSavedColor] = useState(getInitialColor());
  const [cellColors, setCellColors] = useState(Array(81).fill('white'));
  const [timeLeft, setTimeLeft] = useState(300);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [gameCompleted, setGameCompleted] = useState(false);  
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [pendingInput, setPendingInput] = useState<string>('');
   //const [solution, setSolution] = useState<number[]>([]);

  const handleTouch = (color: string) => setSavedColor(color);
  const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${sec % 60 < 10 ? '0' + sec % 60 : sec % 60}`;

  // INITIALIZE GAME
  const initGame = async () => {
    try {
      const response = await createSudokuGame(challengeId); // 不再傳 uuid 給後端
      const { game_id, puzzle } = response;
  
      setGameId(game_id);
  
      const flatten = (board: number[][]): string[] =>
        board.flat().map((n) => (n === null || n === 0 ? '' : n.toString()));
  
      setGrid(flatten(puzzle));
      setInitialCells(flatten(puzzle).map((n) => n !== ''));
      setCellColors(Array(81).fill('white'));
      setTimeLeft(300);
      setGameCompleted(false);
      setSelectedIndex(null);
      setPendingInput('');
    } catch (error) {
      console.error('Init failed', error);
    }
  };
  
  

  const restartGame = async () => {
    if (intervalId) clearInterval(intervalId);
    setIntervalId(null);
    await initGame();
    const newTimer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    setIntervalId(newTimer);
  };

  // When Timer Ends
  useEffect(() => {
    if (timeLeft === 0) {
      if (intervalId) clearInterval(intervalId);
      Alert.alert("Time's Up!", 'You failed your team!', [{ text: 'Try Again', onPress: restartGame }]);
    }
  }, [timeLeft]);

  // On mount start game
  useEffect(() => {
    initGame();
    const id = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    setIntervalId(id);
    return () => clearInterval(id);
  }, []);

  // when player press the number button and confirm button
  const confirmMove = async () => {
    try {
      console.log('[CONFIRM] Starting confirmMove');
  
      if (selectedIndex !== null && pendingInput !== '') {
        const row = Math.floor(selectedIndex / 9);
        const col = selectedIndex % 9;
        const value = parseInt(pendingInput);
  
        console.log('[CONFIRM] Sending:', { gameId, selectedIndex, value });
  
        const res = await validateSudokuMove(gameId, selectedIndex, value);
  
        console.log('[CONFIRM] Validate response:', res);
  
        if (res.success) {
          const updatedGrid = res.puzzle.flat().map((n, i) => {
            if (n === null || typeof n !== 'number') {
              return '';
            }
            return n === 0 ? '' : n.toString();
          });
          setGrid(updatedGrid);
          const updatedColors = [...cellColors];
          if (selectedIndex !== null) {
            updatedColors[selectedIndex] = savedColor; 
          }
          setCellColors(updatedColors);

          await checkGameCompletion(updatedGrid);
        } else {
          const errorColors = [...cellColors];
          if (selectedIndex !== null) {
            errorColors[selectedIndex] = 'red';
            setCellColors(errorColors);
          }
          Alert.alert('Error', 'wrong answer');
        }
      } else {
        console.log('[CONFIRM] No input or cell selected');
      }
    } catch (err) {
      console.error('[CONFIRM ERROR]', err);
      Alert.alert('Error', 'Server error');
    } finally {
      setPendingInput('');
      setSelectedIndex(null);
    }
  };

  // Handle cell deletion
  const handleDeleteMove = () => {
    if (selectedIndex !== null) {
      if (initialCells[selectedIndex]) {
        return;
      }
      const newGrid = [...grid];
      newGrid[selectedIndex] = '';
      setGrid(newGrid);
  
      const newColors = [...cellColors];
      newColors[selectedIndex] = 'white';
      setCellColors(newColors);
  
      setSelectedIndex(null);
      setPendingInput('');
    }
  };

  const checkGameCompletion = async (currentGrid: string[]) => {
    const isComplete = currentGrid.every((cell) => cell !== '');
  
    if (isComplete && !gameCompleted) {
      setGameCompleted(true);
  
      if (intervalId) {
        clearInterval(intervalId); // stop timer
      }
  
      const timeUsed = 300 - timeLeft;
  
      Alert.alert("🎉 You Win!", `Finished Time：${formatTime(timeUsed)}`);
  
      // try {
      //   await markGameAsCompleted(gameId);
      // } catch (error) {
      //   console.error('❗️ Failed to report completion:', error);
      // }
    }
  };
  

  

  return (
    <ImageBackground source={require('../images/game.jpeg')} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.exitButton} onPress={() => {
            if (gameCompleted) navigation.navigate('Start');
            else Alert.alert('Game in Progress', 'You cannot exit while a game is in progress.', [{ text: 'OK', style: 'cancel' }]);
          }}>
            <Text style={styles.exitText}>Exit</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Sudoku</Text>
          <Text style={styles.timer}>Timer: {formatTime(timeLeft)}</Text>
        </View>

        {/* Color info and instructions */}
        <View style={styles.colorInfoRow}>
          <Text style={styles.colorInfo}>You are color:</Text>
          <View style={[styles.colorBox, { backgroundColor: savedColor }]} />
        </View>
        <Text style={styles.info}>
          You can only work on squares that aren’t already being worked on.{"\n"}
          Tap a cell to highlight. → Pick a number below. → {"\n"} Press ✔ to confirm.
        </Text>


        {/* Number pad*/}
        <View style={styles.numberPad}>

          {/* Number buttons */}
          <View style={styles.numberRow}>
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <TouchableOpacity key={n} style={styles.numButton} onPress={() => setPendingInput(n.toString())}>
                <Text style={styles.numText}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Delete and confirm buttons */}
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

          </View>
        </View>

        {/* Sudoku grid */}
        <View style={styles.gridContainer} key={gameId}>
          {Array.from({ length: 9 }).map((_, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {Array.from({ length: 9 }).map((_, colIndex) => {
                const index = rowIndex * 9 + colIndex;
                const selected = index === selectedIndex;
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setSelectedIndex(index)}
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
        <View style={styles.colorRow}>
          {playerColors.map((color, i) => (
            <TouchableOpacity key={i} style={[styles.avatar, { borderColor: color }]} onPress={() => handleTouch(color)} />
          ))}
          <TouchableOpacity style={styles.restartButton} onPress={restartGame}>
            <Text style={styles.restartText}>Restart</Text>
          </TouchableOpacity>
        </View>

        {/* message box */}
        <View style={styles.chatBox}>
          <TextInput placeholder="Type a message..." style={styles.chatInput} />
        </View>
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
