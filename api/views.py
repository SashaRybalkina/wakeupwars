from datetime import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate, get_user_model
from .serializers import UserSerializer, RegisterSerializer, GroupSerializer, UserProfileSerializer, MessageSerializer
from .models import Group, User
from .models import Message

#### Sudoku Game Imports ####
from .models import SudokuGameState, Challenge, SudokuGamePlayer, User, Game
from sudoku import Sudoku

User = get_user_model()

class LoginView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'success': False, 'error': 'Username does not exist'}, status=status.HTTP_404_NOT_FOUND)

        if not user.check_password(password):
            return Response({'success': False, 'error': 'Incorrect password'}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({'success': False, 'error': 'Account is inactive'}, status=status.HTTP_403_FORBIDDEN)

        serializer = UserSerializer(user)
        return Response({'success': True, **serializer.data})


class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save(is_active=True)
            return Response({'success': True, **UserSerializer(user).data}, status=status.HTTP_201_CREATED)
        return Response({'success': False, 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


class GroupListView(APIView):
    def get(self, request):
        groups = Group.objects.all()
        serializer = GroupSerializer(groups, many=True)
        return Response(serializer.data)


class HelloWorldView(APIView):
    def get(self, request):
        return Response({'message': 'Hello from Django REST Framework!'})
    

class UserProfileView(APIView):
    def get(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = UserProfileSerializer(user)
        return Response(serializer.data)
    
class UserMessagesView(APIView):
    def get(self, request, user_id):
        messages = Message.objects.filter(recipient_id=user_id) | Message.objects.filter(sender_id=user_id)
        messages = messages.order_by('-id')
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
################### Sudoku Game ###################

""""
This view creates a new sudoku game for a challenge.

Takes challenge_id and game_id from frontend.

Generates puzzle + solution using sudoku library.

Saves puzzle/solution in DB with the given challenge.

Sends back puzzle and game_id so frontend can render it.
"""
class CreateSudokuGameView(APIView):
    def post(self, request):
        challenge_id = request.data.get('challenge_id')  
        difficulty_level = request.data.get('difficulty', 'easy')  # default
        mode = request.data.get('mode', 'single')  # 'single' or 'multi'

        if not challenge_id :
            return Response({'error': 'Missing challenge_id or game_id'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            challenge = Challenge.objects.get(id=challenge_id)
        except Challenge.DoesNotExist:
            return Response({'error': 'Challenge not found'}, status=status.HTTP_404_NOT_FOUND)
        
        try:
            game = Game.objects.get(name="Sudoku")
        except Game.DoesNotExist:
            return Response({'error': 'Game "Sudoku" not found'}, status=500)

        # Difficulty setting based on mode
        if mode == 'multi':
            difficulty = 0.6  # fixed difficulty for multiplayer
            difficulty_level = 'medium'
        else:
            difficulty_map = {
                'easy': 0.4,
                'medium': 0.6,
                'hard': 0.75,
            }
            difficulty = difficulty_map.get(difficulty_level, 0.4)

        # Generate Sudoku puzzle and solution
        sudoku = Sudoku(3, 3, seed=int(time.time() * 1000)).difficulty(difficulty)
        puzzle = sudoku.board
        solution = sudoku.solve().board

        # Save game state
        game_state = SudokuGameState.objects.create(
            game=game,
            challenge=challenge,
            puzzle=puzzle,
            solution=solution
        )

        return Response({
            'game_id': game_state.id,
            'puzzle': puzzle,
            'difficulty': difficulty_level,
            'mode': mode,
        }, status=status.HTTP_201_CREATED)
    

class ValidateSudokuMoveView(APIView):
    """
        Frontend sends:
      - game_id: the id of the Sudoku game
      - index: a number from 0 to 80 representing the cell position
      - value: the number the user wants to input (as integer)

        Backend checks:
      - Looks up the correct solution from the database
      - If value matches the solution at that index:
          - Updates the puzzle (marks cell with value)
          - Returns "correct" and the new puzzle
      - If value is wrong:
          - Returns "incorrect" and does not change puzzle
    """
    def post(self, request):
        game_id = request.data.get('game_id')
        index = request.data.get('index')
        value = request.data.get('value')

        if game_id is None or index is None or value is None:
            return Response({'error': 'Missing parameters'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            game_state = SudokuGameState.objects.get(id=game_id)
        except SudokuGameState.DoesNotExist:
            return Response({'error': 'Game not found'}, status=status.HTTP_404_NOT_FOUND)

        row, col = divmod(index, 9)

        correct_value = game_state.solution[row][col]

        print(f"[Backend] Checking cell ({row}, {col})")
        print(f"[Backend] Correct value: {correct_value}")
        print(f"[Backend] User input: {value}")

        # --- user answer correct or not ---
        is_correct = (correct_value == value)

        # --- update the answer status ---
        if request.user and request.user.is_authenticated:
            player_record, _ = SudokuGamePlayer.objects.get_or_create(
                gameState=game_state,
                player=request.user,
                defaults={'accuracyCount': 0, 'inaccuracyCount': 0}
            )

            if is_correct:
                player_record.accuracyCount += 1
            else:
                player_record.inaccuracyCount += 1

            player_record.save()

        if is_correct:
            game_state.puzzle[row][col] = value
            game_state.save()
            return Response({'success': True, 'result': 'correct', 'puzzle': game_state.puzzle}, status=status.HTTP_200_OK)
        else:
            return Response({'success': False, 'result': 'incorrect', 'puzzle': game_state.puzzle}, status=status.HTTP_200_OK)


class CompleteSudokuGameView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        game_id = request.data.get('game_id')

        if not game_id:
            return Response({'error': 'Missing game_id'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            game_state = SudokuGameState.objects.get(id=game_id)
        except SudokuGameState.DoesNotExist:
            return Response({'error': 'Game not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            player_record = SudokuGamePlayer.objects.get(gameState=game_state, player=request.user)
        except SudokuGamePlayer.DoesNotExist:
            return Response({'error': 'Player not found for this game'}, status=status.HTTP_404_NOT_FOUND)

        if player_record.completed:
            return Response({'success': True, 'message': 'Already completed'})

        player_record.completed = True
        player_record.completed_at = timezone.now()
        player_record.save()

        return Response({'success': True})