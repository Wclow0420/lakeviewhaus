from app import db
from datetime import datetime
import uuid6

class DailyCheckIn(db.Model):
    __tablename__ = 'daily_check_ins'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid6.uuid7()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    check_in_date = db.Column(db.Date, nullable=False, default=datetime.utcnow().date)
    streak_day_count = db.Column(db.Integer, default=1) # 1 to 7
    points_earned = db.Column(db.Integer, default=0) # Points earned from this check-in
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship
    user = db.relationship('User', backref=db.backref('check_ins', lazy=True))

    def __repr__(self):
        return f'<DailyCheckIn user={self.user_id} date={self.check_in_date} streak={self.streak_day_count} points={self.points_earned}>'
