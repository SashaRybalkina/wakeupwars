"""
/**
 * @file notifications.py
 * @description Sends FCM push notifications to user.
 * It collects tokens, builds the message, and logs send results.
 */
"""

from django.conf import settings
from firebase_admin import messaging
from api.models import FCMDevice

FCM_URL = "https://fcm.googleapis.com/fcm/send"

def send_fcm_notification(title, body, data, recipient_id):
    """Send an FCM push to a single user (all their registered tokens)."""
    tokens = list(FCMDevice.objects.filter(user_id=recipient_id).values_list("token", flat=True))
    if not tokens:
        print(f"⚠️ No FCM tokens for user {recipient_id}")
        return

    for token in tokens:
        message = messaging.Message(
            data={
                "title": title,
                "body": body,
                **data,
            },
            token=token,
        )
        try:
            response = messaging.send(message)
            print(f"Sent to {token}: {response}")
        except Exception as e:
            print(f"Failed to send to {token}: {e}")