from app import db
from datetime import datetime

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(20), unique=True, nullable=False) # Added phone
    profile_pic_url = db.Column(db.String(255)) # Added profile pic
    password_hash = db.Column(db.String(255))
    
    # Verification
    is_verified = db.Column(db.Boolean, default=False)
    otp_code = db.Column(db.String(6))
    otp_expires_at = db.Column(db.DateTime)

    # Gamification - Dual Points System
    points_balance = db.Column(db.Float, default=0.0)      # Spendable points (for rewards)
    points_lifetime = db.Column(db.Float, default=0.0)     # Total earned (for rank, never decreases)
    current_points = db.Column(db.Float, default=0.0)      # DEPRECATED: Keep for migration compatibility

    total_streak = db.Column(db.Integer, default=0)
    last_check_in_date = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Referral System
    referral_code = db.Column(db.String(20), unique=True, index=True)
    referred_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # Self-referential relationship
    referred_by = db.relationship('User', remote_side=[id], backref='referrals')

    @staticmethod
    def generate_referral_code():
        """Generate a random 6-character referral code"""
        import secrets
        import string
        chars = string.ascii_uppercase + string.digits
        return ''.join(secrets.choice(chars) for _ in range(6))

    @property
    def rank(self):
        """Calculate rank based on lifetime points (never drops when spending)"""
        points = self.points_lifetime or 0.0
        if points >= 5000:
            return 'platinum'
        elif points >= 2000:
            return 'gold'
        elif points >= 500:
            return 'silver'
        else:
            return 'bronze'

    def add_points(self, amount):
        """Add points to both balance and lifetime, and sync legacy current_points"""
        amount = round(float(amount), 2)
        if self.points_balance is None:
            self.points_balance = 0.0
        if self.points_lifetime is None:
            self.points_lifetime = 0.0
        if self.current_points is None:
            self.current_points = 0.0

        self.points_balance = round(self.points_balance + amount, 2)
        self.points_lifetime = round(self.points_lifetime + amount, 2)
        self.current_points = round(self.current_points + amount, 2) # Sync legacy column

    def deduct_points(self, amount):
        """Deduct points from balance and sync legacy current_points"""
        amount = round(float(amount), 2)
        if self.points_balance is None:
            self.points_balance = 0.0
        if self.current_points is None:
            self.current_points = 0.0

        self.points_balance = round(self.points_balance - amount, 2)
        self.current_points = round(self.current_points - amount, 2) # Sync legacy column

    def __repr__(self):
        return f'<User {self.username}>'
