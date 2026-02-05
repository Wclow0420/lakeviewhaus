from app import db
from app.models.notification import Notification
from app.services.socket_service import SocketService

class NotificationService:
    @staticmethod
    def send_notification(user_id, title, body, type, data=None):
        """
        Send a notification to a user.
        1. Save to Database
        2. Emit via WebSocket
        3. (Future) Send Push Notification
        """
        
        # 1. Save to DB
        notif = Notification(
            user_id=user_id,
            title=title,
            body=body,
            type=type,
            data=data or {}
        )
        db.session.add(notif)
        db.session.commit()
        
        # 2. Emit via Socket
        payload = {
            'id': notif.id,
            'title': notif.title,
            'body': notif.body,
            'type': notif.type,
            'data': notif.data,
            'is_read': False,
            'created_at': notif.created_at.isoformat()
        }
        
        # Emit 'new_notification' event
        SocketService.emit_to_user(user_id, 'new_notification', payload)
        
        # Also emit specific events for legacy support or specific frontend handling if needed
        # But 'new_notification' should be the primary driver for the Toast/Badge.
        
        return notif

    @staticmethod
    def mark_as_read(notification_id, user_id):
        notif = Notification.query.filter_by(id=notification_id, user_id=user_id).first()
        if notif and not notif.is_read:
            notif.is_read = True
            db.session.commit()
            return True
        return False

    @staticmethod
    def mark_all_as_read(user_id):
        Notification.query.filter_by(user_id=user_id, is_read=False).update({'is_read': True})
        db.session.commit()
        return True

    @staticmethod
    def get_unread_count(user_id):
        return Notification.query.filter_by(user_id=user_id, is_read=False).count()
