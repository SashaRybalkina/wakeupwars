// version 1.0.0
// export const initialSudokuBoard: number[] = [
//     5, 3, 4, 6, 7, 8, 9, 1, 2,
//     6, 7, 2, 1, 9, 5, 3, 4, 8,
//     0, 9, 8, 0, 0, 0, 0, 6, 0,
//     8, 5, 9, 7, 6, 1, 4, 2, 3,
//     4, 2, 6, 8, 5, 3, 7, 9, 1,
//     7, 1, 3, 9, 2, 4, 8, 5, 6,
//     9, 6, 1, 5, 3, 7, 2, 8, 4,
//     2, 8, 7, 4, 1, 9, 6, 3, 5,
//     3, 4, 5, 2, 8, 6, 1, 7, 9,
//   ];

// export const solutionBoard: number[] = [
//     5, 3, 4, 6, 7, 8, 9, 1, 2,
//     6, 7, 2, 1, 9, 5, 3, 4, 8,
//     1, 9, 8, 3, 4, 2, 5, 6, 7,
//     8, 5, 9, 7, 6, 1, 4, 2, 3,
//     4, 2, 6, 8, 5, 3, 7, 9, 1,
//     7, 1, 3, 9, 2, 4, 8, 5, 6,
//     9, 6, 1, 5, 3, 7, 2, 8, 4,
//     2, 8, 7, 4, 1, 9, 6, 3, 5,
//     3, 4, 5, 2, 8, 6, 1, 7, 9,
//   ];

// export const isGameComplete = (board: string[]): boolean => {
//   for (let i = 0; i < 81; i++) {
//     const value = board[i];
//     if (!value || !/^[1-9]$/.test(value)) return false;
//   }
//   return true;
// };

// export const isCorrectSolution = (board: string[]): boolean => {
//   return board.every((value, index) => parseInt(value) === solutionBoard[index]);
// };

// version 1.0.1
import { getSudoku } from 'sudoku-gen';

type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export const generateSudokuGame = (difficulty: Difficulty = 'easy') => {
  const { puzzle, solution } = getSudoku(difficulty);

  const puzzleArray = puzzle
    .split('')
    .map((char) => (char === '-' ? 0 : parseInt(char)));
  const solutionArray = solution.split('').map((char) => parseInt(char));

  solutionArray.forEach((_, i) => {
    if (i % 9 === 0) {
      console.log(solutionArray.slice(i, i + 9).join(' '));
    }
  });

  return {
    puzzle: puzzleArray,
    solution: solutionArray,
  };
};

export const isGameComplete = (board: string[]): boolean => {
  return board.every((val) => /^[1-9]$/.test(val));
};

export const isCorrectSolution = (
  board: string[],
  solution: number[],
): boolean => {
  return board.every((val, idx) => parseInt(val) === solution[idx]);
};
