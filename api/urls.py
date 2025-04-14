from django.urls import path
from .views import LoginView, RegisterView, GroupListView, HelloWorldView, UserProfileView, UserMessagesView, GroupDetailsView, CatListView, GameListView

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('register/', RegisterView.as_view(), name='register'),
    path('user-groups/<int:user_id>/', GroupListView.as_view(), name='group-list'),
    path('cats/<str:sing_or_mult>/', CatListView.as_view(), name='cat-list'),
    path('games/<int:cat_id>/', GameListView.as_view(), name='game-list'),
    path('hello/', HelloWorldView.as_view(), name='hello'),
    path('profile/<int:user_id>/', UserProfileView.as_view(), name='user-profile'),
    path('messages/<int:user_id>/', UserMessagesView.as_view()),
    path('groups/<int:group_id>/', GroupDetailsView.as_view(), name='group-details'),
]
