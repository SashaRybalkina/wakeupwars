from django.urls import path
from . import views

urlpatterns = [
    path('hello/', views.hello_world, name='hello'),
    path('login/', views.login_view),
    path('register/', views.register_view, name='register'),
    path('groups/', views.group_list_view),
]
