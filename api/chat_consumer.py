import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from api.models import Friendship, GroupMembership, Message, User, Group, UserNotification
from api.utils.notifications import send_fcm_notification

ACTIVE_CHAT_USERS = {}

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user_id = self.scope['url_route']['kwargs'].get('user_id')
        self.other_user_id = self.scope['url_route']['kwargs'].get('other_user_id')
        self.group_id = self.scope['url_route']['kwargs'].get('group_id')
        self.room_group_names = []
        path = self.scope.get('path', '')

        if path.startswith('/ws/chat/groups/') and self.user_id:
            group_ids = await self.get_user_group_ids(self.user_id)
            self.room_group_names = [f'chat_group_{gid}' for gid in group_ids]
        elif path.startswith('/ws/chat/users/') and self.user_id:
            # Join all 1-1 chat rooms for this user
            friend_ids = await self.get_user_friend_ids(self.user_id)
            self.room_group_names = [f'chat_user_{min(int(self.user_id), fid)}_{max(int(self.user_id), fid)}' for fid in friend_ids]
        elif self.group_id:
            self.room_group_names = [f'chat_group_{self.group_id}']
        elif self.user_id and self.other_user_id:
            ids = sorted([int(self.user_id), int(self.other_user_id)])
            self.room_group_names = [f'chat_user_{ids[0]}_{ids[1]}']
        else:
            await self.close()
            return
        
        for room in self.room_group_names:
            await self.channel_layer.group_add(room, self.channel_name)
        self.viewing_ids = {}
        
        await self.accept()

    async def disconnect(self, close_code):
        for room in self.room_group_names:
            await self.channel_layer.group_discard(room, self.channel_name)
            if hasattr(self, 'viewing_ids'):
                vid = self.viewing_ids.get(room)
                if vid is not None and room in ACTIVE_CHAT_USERS:
                    ACTIVE_CHAT_USERS[room].discard(str(vid))
                    if not ACTIVE_CHAT_USERS[room]:
                        del ACTIVE_CHAT_USERS[room]

    async def receive(self, text_data): 
        data = json.loads(text_data)
        message = data.get('message')
        sender_id = data.get('sender_id')
        recipient_id = data.get('recipient_id')
        group_id = data.get('group_id')
        timestamp = data.get('timestamp')

        action = data.get('action')
        if action in ('viewing', 'not_viewing'):
            # Determine room name for presence tracking
            if group_id:
                room_name = f'chat_group_{group_id}'
            elif sender_id and recipient_id:
                ids = sorted([int(sender_id), int(recipient_id)])
                room_name = f'chat_user_{ids[0]}_{ids[1]}'
            else:
                room_name = None

            viewer_id = data.get('viewer_id') or sender_id or self.user_id
            if room_name and viewer_id:
                viewer_id = str(viewer_id)
                if action == 'viewing':
                    if room_name not in ACTIVE_CHAT_USERS:
                        ACTIVE_CHAT_USERS[room_name] = set()
                    ACTIVE_CHAT_USERS[room_name].add(viewer_id)
                    # track for disconnect cleanup
                    if not hasattr(self, 'viewing_ids'):
                        self.viewing_ids = {}
                    self.viewing_ids[room_name] = viewer_id
                elif action == 'not_viewing':
                    if room_name in ACTIVE_CHAT_USERS:
                        ACTIVE_CHAT_USERS[room_name].discard(viewer_id)
                        if not ACTIVE_CHAT_USERS[room_name]:
                            del ACTIVE_CHAT_USERS[room_name]
                    if hasattr(self, 'viewing_ids') and room_name in self.viewing_ids:
                        self.viewing_ids.pop(room_name, None)
            return

        # Save message to DB
        await self.save_message(message, sender_id, recipient_id, group_id, timestamp)

        # Fetch sender object
        sender = await database_sync_to_async(User.objects.get)(id=sender_id)
        group_name = None

        # Determine which room to broadcast to
        if group_id:
            room_group_name = f'chat_group_{group_id}'
            group = await database_sync_to_async(Group.objects.get)(id=group_id)
            group_name = group.name
        elif sender_id and recipient_id:
            ids = sorted([int(sender_id), int(recipient_id)])
            room_group_name = f'chat_user_{ids[0]}_{ids[1]}'
        else:
            room_group_name = None

        if room_group_name:
            await self.channel_layer.group_send(
                room_group_name,
                {
                    'type': 'chat_message',
                    'message': message,
                    'sender': {
                        'id': sender.id,
                        'name': sender.name,
                        'username': sender.username
                    },
                    'recipient_id': recipient_id,
                    'group_id': group_id,
                    'group_name': group_name,
                    'timestamp': timestamp,
                }
            )
        
        if group_id:
            room_name = f'chat_group_{group_id}'
        else:
            ids = sorted([int(sender_id), int(recipient_id)])
            room_name = f'chat_user_{ids[0]}_{ids[1]}'
        
        active_users_in_room = ACTIVE_CHAT_USERS.get(room_name, set())

        if recipient_id:
            if str(recipient_id) in active_users_in_room:
                return
            await database_sync_to_async(self.send_push_to_user)(sender, recipient_id, message)
        elif group_id:
            await database_sync_to_async(self.send_push_to_group)(sender, group_id, message)

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event))
        
    async def notify(self, event):
        await self.send(text_data=json.dumps(event))
    
    def send_push_to_user(self, sender, recipient_id, message):
        """Send push for a 1:1 chat"""
        sender_name = sender.name
        title = sender_name
        body = message[:100]
        data = {
            "screen": "Notifications",
        }
        send_fcm_notification(title, body, data, recipient_id)
        
        UserNotification.objects.create(
            user_id=recipient_id,
            title=title,
            body=body,
            type="message",
            screen="Messages",
        )
    
    def send_push_to_group(self, sender, group_id, message):
        """Send push for group chat"""
        from api.models import GroupMembership
        group_members = GroupMembership.objects.filter(groupID_id=group_id).exclude(uID_id=sender.id)
        group = Group.objects.filter(id=group_id).first()
        active_set = ACTIVE_CHAT_USERS.get(f'chat_group_{group_id}', set())
        for member in group_members:
            if str(member.uID_id) in active_set:
                continue
            title = f"{sender.name}, {group.name}"
            body = message[:100]
            data = {"screen": "Notifications"}
            send_fcm_notification(title, body, data, member.uID_id)
            
            UserNotification.objects.create(
                user_id=member.uID_id,
                title=title,
                body=body,
                type="message",
                screen="Messages",
            )

    @database_sync_to_async
    def get_user_group_ids(self, user_id):
        return list(GroupMembership.objects.filter(uID_id=user_id).values_list('groupID_id', flat=True))

    @database_sync_to_async
    def get_user_friend_ids(self, user_id):
        u1_friends = Friendship.objects.filter(uID1_id=user_id).values_list('uID2_id', flat=True)
        u2_friends = Friendship.objects.filter(uID2_id=user_id).values_list('uID1_id', flat=True)
        # Convert to Python sets to safely merge
        return list(set(u1_friends) | set(u2_friends))

    @database_sync_to_async
    def save_message(self, message, sender_id, recipient_id, group_id, timestamp):
        sender = User.objects.get(id=sender_id)
        recipient = User.objects.get(id=recipient_id) if recipient_id else None
        group = Group.objects.get(id=group_id) if group_id else None
        Message.objects.create(
            message=message,
            sender=sender,
            recipient=recipient,
            groupID=group,
            is_read=0
        )