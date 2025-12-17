from app import db
from datetime import datetime

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255))
    
    # Verification
    is_verified = db.Column(db.Boolean, default=False)
    otp_code = db.Column(db.String(6))
    otp_expires_at = db.Column(db.DateTime)

    current_points = db.Column(db.Integer, default=0)
    total_streak = db.Column(db.Integer, default=0)
    last_check_in_date = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def rank(self):
        points = self.current_points
        if points >= 5000:
            return 'Platinum'
        elif points >= 2000:
            return 'Gold'
        elif points >= 500:
            return 'Silver'
        else:
            return 'Bronze'

    def __repr__(self):
        return f'<User {self.username}>'
