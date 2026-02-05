from app import db
from datetime import datetime
import uuid6

class Merchant(db.Model):
    __tablename__ = 'merchants'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid6.uuid7()))
    name = db.Column(db.String(100), nullable=False)
    # Auth moved to Branch
    company_reg_no = db.Column(db.String(50))
    
    # Referral Program Config
    referral_referrer_reward_id = db.Column(db.String(36), db.ForeignKey('rewards.id'), nullable=True) # Linked Reward
    referral_referee_reward_id = db.Column(db.String(36), db.ForeignKey('rewards.id'), nullable=True) # Linked Reward
    referral_referrer_points = db.Column(db.Integer, default=0)
    referral_referee_points = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    branches = db.relationship('Branch', backref='merchant', lazy=True)

    def __repr__(self):
        return f'<Merchant {self.name}>'

class Branch(db.Model):
    __tablename__ = 'branches'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid6.uuid7()))
    merchant_id = db.Column(db.String(36), db.ForeignKey('merchants.id'), nullable=False)
    
    # Auth & Identity
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(100), nullable=False) # e.g. "Main Street Branch"
    
    # Branch Specifics
    location = db.Column(db.String(200))
    is_main = db.Column(db.Boolean, default=False) # If True, has admin rights for Merchant
    
    # Visuals
    logo_url = db.Column(db.String(255)) # Branch specific logo (often same as merchant but allowing override)
    profile_pic_url = db.Column(db.String(255)) # Branch profile/storefront image

    # Points Configuration
    points_multiplier = db.Column(db.Float, default=1.0) # Points multiplier for this branch (default 1.0)

    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    transactions = db.relationship('Transaction', backref='branch', lazy=True)

    def __repr__(self):
        return f'<Branch {self.name}>'
