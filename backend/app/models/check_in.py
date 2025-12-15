from app import db
from datetime import datetime

class DailyCheckIn(db.Model):
    __tablename__ = 'daily_check_ins'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    check_in_date = db.Column(db.Date, nullable=False, default=datetime.utcnow().date)
    streak_day_count = db.Column(db.Integer, default=1) # 1 to 7
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship
    user = db.relationship('User', backref=db.backref('check_ins', lazy=True))

    def __repr__(self):
        return f'<DailyCheckIn user={self.user_id} date={self.check_in_date} streak={self.streak_day_count}>'
