import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from api.models import Message, User, Group

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user_id = self.scope['url_route']['kwargs'].get('user_id')
        self.other_user_id = self.scope['url_route']['kwargs'].get('other_user_id')
        self.group_id = self.scope['url_route']['kwargs'].get('group_id')
        if self.group_id:
            self.room_group_name = f'chat_group_{self.group_id}'
        elif self.user_id and self.other_user_id:
            # Ensure both users join the same room
            ids = sorted([int(self.user_id), int(self.other_user_id)])
            self.room_group_name = f'chat_user_{ids[0]}_{ids[1]}'
        else:
            await self.close()
            return
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
        data = json.loads(text_data)
        message = data.get('message')
        sender_id = data.get('sender_id')
        recipient_id = data.get('recipient_id')
        group_id = data.get('group_id')
        timestamp = data.get('timestamp')
        # Save message to DB
        await self.save_message(message, sender_id, recipient_id, group_id, timestamp)
        # Broadcast to group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': message,
                'sender_id': sender_id,
                'recipient_id': recipient_id,
                'group_id': group_id,
                'timestamp': timestamp,
            }
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event))

    @database_sync_to_async
    def save_message(self, message, sender_id, recipient_id, group_id, timestamp):
        sender = User.objects.get(id=sender_id)
        recipient = User.objects.get(id=recipient_id) if recipient_id else None
        group = Group.objects.get(id=group_id) if group_id else None
        Message.objects.create(
            message=message,
            sender=sender,
            recipient=recipient,
            groupID=group
        )