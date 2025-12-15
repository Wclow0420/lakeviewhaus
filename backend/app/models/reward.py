from app import db
from datetime import datetime

class Reward(db.Model):
    __tablename__ = 'rewards'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False) # e.g. "RM1 Voucher"
    cost_points = db.Column(db.Integer, nullable=False) # Points needed to redeem
    voucher_value = db.Column(db.Float, default=0.0) # Monetary value if applicable
    description = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Reward {self.name}>'

class UserVoucher(db.Model):
    __tablename__ = 'user_vouchers'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    reward_id = db.Column(db.Integer, db.ForeignKey('rewards.id'), nullable=False)
    unique_code = db.Column(db.String(50), unique=True, nullable=False) # For QR generation
    is_used = db.Column(db.Boolean, default=False)
    used_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref='vouchers')
    reward = db.relationship('Reward')

    def __repr__(self):
        return f'<UserVoucher {self.unique_code} used={self.is_used}>'
