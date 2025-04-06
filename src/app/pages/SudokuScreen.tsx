import React, { useEffect, useState } from 'react';
import {
  Alert,
  ImageBackground,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NavigationProp } from '@react-navigation/native';

import {
  generateSudokuGame,
  isCorrectSolution,
  isGameComplete,
} from './SudokuGameLogic';

// Adjust the import path as necessary

const CELL_SIZE = 40;
const BORDER_WIDTH_THIN = 1;
const BORDER_WIDTH_THICK = 3;
const GRID_SIZE =
  CELL_SIZE * 9 + BORDER_WIDTH_THIN * 6 + BORDER_WIDTH_THICK * 2;
var allColors = [
  'hotpink',
  'red',
  'coral',
  'orange',
  'yellow',
  'lawngreen',
  'aqua',
  'deepskyblue',
  'mediumorchid',
  'mediumvioletred',
  'magenta',
];

const assignColor = () => {
  var index = Math.floor(Math.random() * allColors.length);
  var color = allColors[index];
  allColors.splice(index, 1);
  return color + '';
};

const playerColors = [assignColor(), assignColor(), assignColor()];

const SudokuScreen = ({ navigation }) => {
  const [solution, setSolution] = useState<number[]>([]);

  const [grid, setGrid] = useState<string[]>(Array(81).fill(''));
  const [initialCells, setInitialCells] = useState<boolean[]>(
    Array(81).fill(false),
  );
  const [savedColor, setSavedColor] = useState('');
  const [cellColors, setCellColors] = useState(Array(81).fill('white'));
  const [timeLeft, setTimeLeft] = useState(300);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

  const handleTouch = (color: string) => {
    setSavedColor(color);
    console.log('Saved Color:', color);
  };

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
  };

  const initGame = () => {
    const { puzzle, solution } = generateSudokuGame('easy');
    setGrid(puzzle.map((n) => (n === 0 ? '' : n.toString())));
    setInitialCells(puzzle.map((n) => n !== 0));
    setSolution(solution);
    setCellColors(Array(81).fill('white'));
    setTimeLeft(300);
  };

  // restart the game
  const restartGame = () => {
    if (intervalId) clearInterval(intervalId); // Stop previous timer
    initGame();
    const newId = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1); // Start new timer
    }, 1000);
    setIntervalId(newId);
  };

  // Timer reaches 0
  useEffect(() => {
    if (timeLeft === 0) {
      if (intervalId) clearInterval(intervalId);
      Alert.alert("Time's Up!", 'You failed your team!', [
        { text: 'Try Again', onPress: restartGame },
      ]);
    }
  }, [timeLeft]);

  // （Start timer on mount）
  useEffect(() => {
    initGame();
    const id = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    setIntervalId(id);
    return () => clearInterval(id);
  }, []);

  const handleInputChange = (index, value) => {
    if (value === '' || /^[1-9]$/.test(value)) {
      // Prevent editing fixed cells
      if (
        !initialCells[index] &&
        (cellColors[index] === 'white' || cellColors[index] === savedColor)
      ) {
        const newGrid = [...grid];
        const newColors = [...cellColors];

        newGrid[index] = value;
        newColors[index] = value ? savedColor : 'white';

        setGrid(newGrid);
        setCellColors(newColors);

        if (isGameComplete(newGrid)) {
          if (isCorrectSolution(newGrid, solution)) {
            if (intervalId) clearInterval(intervalId); // Stop the timer
            Alert.alert('🎉 Good job!', "You've solved the puzzle correctly!");
          } else {
            Alert.alert(
              '😵 Oops',
              'The puzzle is full, but some answers are wrong.',
            );
          }
        }
      } else {
        Alert.alert(
          'Cannot Edit',
          'This square is locked by another player color.',
        );
      }
    } else {
      Alert.alert('Invalid Input', 'Please enter a number between 1 and 9.');
    }
  };

  return (
    <ImageBackground
      source={require('../images/game.jpeg')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        {/* Header with title and timer */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.exitButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.exitText}>Exit</Text>
          </TouchableOpacity>
          <Text style={styles.title}> Sudoku</Text>
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>Timer:</Text>
            <Text style={styles.timerValue}>{formatTime(timeLeft)}</Text>
          </View>
        </View>

        {/* color and hint */}
        <View style={styles.infoContainer}>
          <Text style={[styles.infoText, { marginRight: 10 }]}>
            You are color:
          </Text>
          <View style={styles.colorIndicator} />
        </View>

        <Text
          style={[styles.infoText, { marginBottom: 15, paddingHorizontal: 40 }]}
        >
          You can only work on squares that aren’t already being worked on
        </Text>

        {/* Sudoku grid */}
        <View style={styles.outerContainer}>
          <View style={styles.gridContainer}>
            {Array.from({ length: 9 }).map((_, rowIndex) => (
              <View style={styles.row} key={rowIndex}>
                {Array.from({ length: 9 }).map((_, colIndex) => {
                  const index = rowIndex * 9 + colIndex;
                  return (
                    <TextInput
                      key={index}
                      style={[
                        styles.cell,
                        { backgroundColor: cellColors[index] },
                        rowIndex % 3 === 0 && rowIndex !== 0
                          ? styles.thickTopBorder
                          : {},
                        colIndex % 3 === 0 && colIndex !== 0
                          ? styles.thickLeftBorder
                          : {},
                      ]}
                      editable={!initialCells[index]} // Prevent editing fixed cells
                      value={grid[index]}
                      onChangeText={(value) => handleInputChange(index, value)}
                      keyboardType="numeric"
                      maxLength={1}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        {/* choose color */}
        <View style={styles.avatarsContainer}>
          <TouchableOpacity
            style={[styles.avatarWrapper, { borderColor: playerColors[0] }]}
            onPress={() => handleTouch(playerColors[0] + '')}
          >
            <View style={styles.avatar} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.avatarWrapper, { borderColor: playerColors[1] }]}
            onPress={() => handleTouch(playerColors[1] + '')}
          >
            <View style={styles.avatar} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.avatarWrapper, { borderColor: playerColors[2] }]}
            onPress={() => handleTouch(playerColors[2] + '')}
          >
            <View style={styles.avatar} />
          </TouchableOpacity>
          {/* Restart button */}
          <TouchableOpacity style={styles.restartButton} onPress={restartGame}>
            <Text style={styles.restartButtonText}>Restart</Text>
          </TouchableOpacity>
        </View>

        {/* Message input */}
        <View style={styles.messageInput}>
          <TextInput placeholder="Type a message..." style={styles.input} />
        </View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    width: '90%',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  exitButton: {
    backgroundColor: 'white',
    padding: 5,
    borderRadius: 5,
    width: 75,
    height: 30,
  },
  exitText: {
    fontSize: 17,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 35,
    fontWeight: 'bold',
    color: 'white',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
  timerValue: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  infoText: {
    fontSize: 20,
    marginBottom: 5,
    textAlign: 'center',
    color: 'white',
    marginVertical: 5,
    fontWeight: '500',
  },
  colorIndicator: {
    width: 20,
    height: 20,
    backgroundColor: 'red',
    borderColor: 'black',
    borderWidth: 1,
  },
  outerContainer: {
    backgroundColor: 'black',
  },
  gridContainer: {
    width: GRID_SIZE,
    height: GRID_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderWidth: BORDER_WIDTH_THIN,
    borderColor: 'black',
    textAlign: 'center',
    textAlignVertical: 'center', // android-specific to vertically center the text in TextInput
    fontSize: 18,
    backgroundColor: 'white',
    padding: 0,
    includeFontPadding: false, // Android-specific to prevent extra padding in TextInput
  },
  thickTopBorder: {
    borderTopWidth: BORDER_WIDTH_THICK,
  },
  thickLeftBorder: {
    borderLeftWidth: BORDER_WIDTH_THICK,
  },
  avatarsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 10,
  },
  avatarWrapper: {
    borderWidth: 3,
    borderColor: 'white',
    borderRadius: 50,
    margin: 5,
    padding: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    backgroundColor: 'gray',
    borderRadius: 20,
  },
  restartButton: {
    backgroundColor: 'lightgreen',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginLeft: 10,
    alignSelf: 'center',
  },
  restartButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'black',
  },
  messageInput: {
    flexDirection: 'row',
    width: '90%',
    borderWidth: 1,
    borderRadius: 5,
    padding: 5,
    marginTop: 10,
    backgroundColor: 'white',
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
});

export default SudokuScreen;
