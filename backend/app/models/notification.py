from app import db
from datetime import datetime
import uuid6

class Notification(db.Model):
    __tablename__ = 'notifications'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid6.uuid7()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    body = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(50), nullable=False)  # 'lucky_draw', 'transaction', 'system'
    data = db.Column(db.JSON, nullable=True)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('notifications', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'body': self.body,
            'type': self.type,
            'data': self.data,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat()
        }
