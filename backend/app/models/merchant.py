from app import db
from datetime import datetime

class Merchant(db.Model):
    __tablename__ = 'merchants'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    company_reg_no = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    branches = db.relationship('Branch', backref='merchant', lazy=True)

    def __repr__(self):
        return f'<Merchant {self.name}>'

class Branch(db.Model):
    __tablename__ = 'branches'
    
    id = db.Column(db.Integer, primary_key=True)
    merchant_id = db.Column(db.Integer, db.ForeignKey('merchants.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False) # e.g. "Main Street Branch"
    location = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    transactions = db.relationship('Transaction', backref='branch', lazy=True)

    def __repr__(self):
        return f'<Branch {self.name}>'
