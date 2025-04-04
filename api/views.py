from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.hashers import make_password
import json
from .models import Group

User = get_user_model()

@csrf_exempt
def login_view(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Username does not exist'}, status=404)

        if not user.check_password(password):
            return JsonResponse({'success': False, 'error': 'Incorrect password'}, status=401)

        if not user.is_active:
            return JsonResponse({'success': False, 'error': 'Account is inactive'}, status=403)

        return JsonResponse({
            'success': True,
            'username': user.username,
            'name': user.name,
            'email': user.email,
            'userId': user.id,
        })

    return JsonResponse({'error': 'Invalid request method'}, status=405)

@csrf_exempt
def register_view(request):
    if request.method == 'POST':
        data = json.loads(request.body)

        username = data.get('username')
        password = data.get('password')
        name = data.get('name', 'Anonymous')
        email = data.get('email', '')

        if not username or not password:
            return JsonResponse({'success': False, 'error': 'Username and password are required'}, status=400)

        if User.objects.filter(username=username).exists():
            return JsonResponse({'success': False, 'error': 'Username already exists'}, status=400)

        user = User.objects.create(
            username=username,
            name=name,
            email=email,
            password=make_password(password),
            is_active=True
        )

        return JsonResponse({
            'success': True,
            'username': user.username,
            'userId': user.id,
            'name': user.name,
            'email': user.email
        })

    return JsonResponse({'error': 'Invalid request method'}, status=405)

def group_list_view(request):
    if request.method == 'GET':
        groups = Group.objects.all().values('id', 'name')
        return JsonResponse(list(groups), safe=False)
    
def hello_world(request):
    return JsonResponse({'message': 'Hello from Django!'})