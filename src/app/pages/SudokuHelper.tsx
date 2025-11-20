/**
 * @file SudokuHelper.tsx
 * @description Defines a response format for storing a game ID, initializing
 * puzzles, and determining the mode (singleplayer or multiplayer).
 */

import { endpoints } from '../api';

export type CreateGameResponse = {
  game_id: number;
  puzzle: number[][];
  is_multiplayer: boolean;
};