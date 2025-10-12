import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from api.models import UserNotification, User

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user_id = self.scope['url_route']['kwargs'].get('user_id')
        if not self.user_id:
            await self.close()
            return
        self.room_group_name = f'notifications_{self.user_id}'
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        # Optionally handle client-initiated events (e.g., mark as read)
        pass

    async def notification_event(self, event):
        await self.send(text_data=json.dumps(event))

    @database_sync_to_async
    def save_notification(self, user_id, title, body, type, screen):
        user = User.objects.get(id=user_id)
        return UserNotification.objects.create(user=user, title=title, body=body, type=type, screen=screen)
