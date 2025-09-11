from django.urls import path

from .views import (LoginView, RegisterView, GroupListView, HelloWorldView, UserProfileView, GetChallengeScheduleView, AddGameToScheduleView,
                    UserMessagesView, GroupDetailsView, CatListView, GameListView,
                    ChallengeListView, GetChallengeInitiatorView,
                    ChallengeDetailView, ChallengeGameScheduleView, CreateManualGroupChallengeView,
                    CreatePendingCollaborativeGroupChallengeView, FriendListView,
                    AddGroupMemberView, SendFriendRequestView, FriendRequestListView,
                    RespondToFriendRequestView, FinalizeCollaborativeGroupChallengeScheduleView,
                    SentFriendRequestListView, AllUsersView, CancelFriendRequestView,
                    CreateGroupView, CreatePersonalChallengeView, GetChallengeInvitesView,
                    GetAvailabilitiesView, SetAvailabilityView, DeclineChallengeInviteView,
                    ChallengeLeaderboardView, SubmitGameScoresView, ChallengeDailyHistoryView,
                    SkillLevelsView)

from .views import CreateSudokuGameView, ValidateSudokuMoveView, get_csrf_token
from .views import CreatePatternGameView, ValidatePatternMoveView
from .views import CreateWordleGameView, ValidateWordleMoveView
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LoginView, RegisterView, GroupListView, HelloWorldView, UserProfileView,
    UserMessagesView, GroupDetailsView, CatListView, GameListView,
    ChallengeListView, GetChallengeInitiatorView, ChallengeDetailView,
    ChallengeGameScheduleView, CreateManualGroupChallengeView,
    CreatePendingCollaborativeGroupChallengeView, FriendListView,
    AddGroupMemberView, SendFriendRequestView, FriendRequestListView,
    RespondToFriendRequestView, FinalizeCollaborativeGroupChallengeScheduleView,
    SentFriendRequestListView, AllUsersView, CancelFriendRequestView,
    CreateGroupView, CreatePersonalChallengeView, GetChallengeInvitesView,
    GetAvailabilitiesView, SetAvailabilityView, DeclineChallengeInviteView,
    ChallengeLeaderboardView, SubmitGameScoresView, ChallengeDailyHistoryView,
    SkillLevelsView, ExternalHandleViewSet, ObligationViewSet, PaymentViewSet,
    FinalizeChallengeView, CreateSudokuGameView, ValidateSudokuMoveView, 
    CreateWordleGameView, ValidateWordleMoveView, get_csrf_token,
)

router = DefaultRouter()
router.register(r'external-handles', ExternalHandleViewSet, basename='external-handle')
router.register(r'obligations', ObligationViewSet, basename='obligation')
router.register(r'payments', PaymentViewSet, basename='payment')

urlpatterns = [
    path('', include(router.urls)),
    path('challenges/<int:challenge_id>/finalize/', FinalizeChallengeView.as_view(), name='finalize-challenge'),
    path('challenges/<int:user_id>/<str:which_chall>/', ChallengeListView.as_view(), name='challenge-list'),
    path('login/', LoginView.as_view(), name='login'),
    path('register/', RegisterView.as_view(), name='register'),
    path('user-groups/<int:user_id>/', GroupListView.as_view(), name='group-list'),
    path('user-friends/<int:user_id>/', FriendListView.as_view(), name='friend-list'),
    path('cats/', CatListView.as_view(), name='cat-list'),
    path('games/<int:cat_id>/<str:sing_or_mult>/', GameListView.as_view(), name='game-list'),
    path('hello/', HelloWorldView.as_view(), name='hello'),
    path('profile/<int:user_id>/', UserProfileView.as_view(), name='user-profile'),
    path('get-initiator/<int:chall_id>/', GetChallengeInitiatorView.as_view(), name='get-initiator'),
    path('messages/<int:user_id>/', UserMessagesView.as_view()),
    path('groups/<int:group_id>/', GroupDetailsView.as_view(), name='group-details'),
    path('group-member-add/<int:group_id>/', AddGroupMemberView.as_view(), name='group-mem-add'),

    path('challenge-detail/<int:chall_id>/', ChallengeDetailView.as_view(), name='challenge-detail'),
    path('challenge-schedule/<int:chall_id>/', ChallengeGameScheduleView.as_view(), name='challenge-schedule'),
    path('get-challenge-schedule/<int:chall_id>/', GetChallengeScheduleView.as_view(), name='get-challenge-schedule'),
    path('create-manual-group-challenge/', CreateManualGroupChallengeView.as_view(), name='create-manual-group-challenge'),
    path('create-pending-collaborative-group-challenge/', CreatePendingCollaborativeGroupChallengeView.as_view(), name='create-pending-collaborative-group-challenge'),
    path('finalize-collaborative-group-challenge-schedule/<int:chall_id>/', FinalizeCollaborativeGroupChallengeScheduleView.as_view(), name='finalize-collaborative-group-challenge-schedule'),
    path('friend-requests/<int:user_id>/', FriendRequestListView.as_view(), name='friend-requests'),
    path('friend-requests-sent/<int:user_id>/', SentFriendRequestListView.as_view(), name='sent-friend-requests'),
    path('friend-request/respond/<int:request_id>/', RespondToFriendRequestView.as_view(), name='respond-friend-request'),
    path('friend-request/send/', SendFriendRequestView.as_view(), name='send-friend-request'),
    path('get-challenge-invites/<int:user_id>/<int:group_id>/', GetChallengeInvitesView.as_view(), name='get-challenge-invites'),
    # path('challenge-invites/<int:user_id>/<int:group_id>/', ChallengeInvitesListView.as_view(), name='challenge-invites'),
    
    # path('get-pending-challenges/<int:group_id>/', GetPendingChallengesView.as_view(), name='get-pending-challenges'),
    path('get-availabilities/<int:chall_id>/', GetAvailabilitiesView.as_view(), name='get-availabilities'),
    path('set-availability/<int:user_id>/<int:chall_id>/', SetAvailabilityView.as_view(), name='set-availability'),
    path('decline-challenge-invite/<int:user_id>/<int:chall_id>/', DeclineChallengeInviteView.as_view(), name='decline-challenge-invite'),

    path('profile/all/', AllUsersView.as_view(), name='all-users'),
    path('friend-request/delete/<int:request_id>/', CancelFriendRequestView.as_view(), name='cancel-friend-request'),
    path('create-group/', CreateGroupView.as_view(), name='create-group'),
    path('sudoku/create/', CreateSudokuGameView.as_view(), name='create-sudoku'),
    path('sudoku/validate/', ValidateSudokuMoveView.as_view(), name='validate-sudoku'),
    path('create-wordle/', CreateWordleGameView.as_view(), name='create-wordle'),
    path('wordle/validate/', ValidateWordleMoveView.as_view(), name='validate-wordle'),
    path('csrf-token/', get_csrf_token, name='get-csrf-token'),
    path("create-personal-challenge/", CreatePersonalChallengeView.as_view(), name="create_personal_challenge"),
    path('pattern/create/',   CreatePatternGameView.as_view(),   name='pattern-create'),
    path('pattern/validate/', ValidatePatternMoveView.as_view(), name='pattern-validate'),
    path('challenge-leaderboard/<int:chall_id>/', ChallengeLeaderboardView.as_view(), name='challenge-leaderboard'),
    path("challenge-leaderboard/<int:chall_id>/history/", ChallengeDailyHistoryView.as_view(), name="challenge-leaderboard-history"),
    path('submit-game-scores/', SubmitGameScoresView.as_view(), name='submit-game-scores'),
    path('add-game-to-schedule/', AddGameToScheduleView.as_view(), name='add-game-to-schedule'),
    path('skill-levels/', SkillLevelsView.as_view(), name="skill-levels"),
]
