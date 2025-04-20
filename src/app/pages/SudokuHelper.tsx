import { endpoints } from '../api';

export type CreateGameResponse = {
  game_id: number;
  puzzle: number[][];
  is_multiplayer: boolean;
};

// export const createSudokuGame = async (challengeId: number): Promise<CreateGameResponse> => {
//   try {
//     const url = endpoints.createSudokuGame;
//     const payload = {
//       challenge_id: challengeId,
//     }; // not doing things for model or difficulty yet so it's always easy level

//     console.log('[Create Game] Calling:', url);
//     console.log('[Create Game] Payload:', payload);

//     const response = await fetch(url, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(payload),
//     });

//     const text = await response.text();
//     console.log('[Create Game] Status:', response.status);
//     //console.log('[Create Game] Raw Response:', text);

//     if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);

//     const data = JSON.parse(text) as CreateGameResponse;
//     return data;
//   } catch (error) {
//     console.error('🛑 Create game error:', error);
//     throw error;
//   }
// };

// type ValidateResponse = {
//   success: boolean;
//   result: 'correct' | 'incorrect';
//   puzzle: number[][];
//   completed: boolean;
// };

// export const validateSudokuMove = async (
//   gameId: number,
//   index: number,
//   value: number
// ): Promise<ValidateResponse> => {
//   try {
//     console.log('[Validate Move] Calling:', endpoints.validateSudokuMove);

//     const response = await fetch(endpoints.validateSudokuMove, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ game_id: gameId, index, value }),
//     });

//     const text = await response.text();

//     try {
//       const data = JSON.parse(text) as ValidateResponse;
//       return data;
//     } catch (parseError) {
//       console.error('[ValidateSudokuMove] JSON parse error:', parseError);
//       console.error('[ValidateSudokuMove] Raw text response:', text);
//       throw new Error('Invalid JSON response from server');
//     }

//   } catch (error) {
//     console.error('Validate move failed:', error);
//     throw error;
//   }
// };

// // export const markGameAsCompleted = async (gameId: number): Promise<void> => {
// //   try {
// //     const response = await fetch(endpoints.completeSudokuGame, {
// //       method: 'POST',
// //       headers: { 'Content-Type': 'application/json' },
// //       body: JSON.stringify({ game_id: gameId }),
// //     });

// //     if (!response.ok) {
// //       const errText = await response.text();
// //       console.error('Failed to mark game as complete:', errText);
// //     } else {
// //       console.log('✅ Game marked as complete');
// //     }
// //   } catch (error) {
// //     console.error('Error marking game as complete:', error);
// //   }
// // };




