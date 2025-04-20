"""
ASGI config for myserver project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/asgi/
"""

import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "myserver.settings")

import django
django.setup()

from django.core.asgi import get_asgi_application

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from api.routing import websocket_urlpatterns
# from api.sudokuStuff import consumers  # updated import path





application = ProtocolTypeRouter({
    "http": django.core.asgi.get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})

