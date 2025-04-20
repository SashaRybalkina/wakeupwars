from django.urls import path
from .views import LoginView, RegisterView, GroupListView, HelloWorldView, UserProfileView, UserMessagesView
from .views import CreateSudokuGameView, ValidateSudokuMoveView, get_csrf_token

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('register/', RegisterView.as_view(), name='register'),
    path('groups/', GroupListView.as_view(), name='group-list'),
    path('hello/', HelloWorldView.as_view(), name='hello'),
    path('profile/<int:user_id>/', UserProfileView.as_view(), name='user-profile'),
    path('messages/<int:user_id>/', UserMessagesView.as_view()),
    path('sudoku/create/', CreateSudokuGameView.as_view(), name='create-sudoku'),
    path('sudoku/validate/', ValidateSudokuMoveView.as_view(), name='validate-sudoku'),
    path('csrf-token/', get_csrf_token, name='get-csrf-token'),
]
