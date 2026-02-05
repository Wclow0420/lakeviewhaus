from app import db
from datetime import datetime
import uuid6

class Transaction(db.Model):
    __tablename__ = 'transactions'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid6.uuid7()))
    branch_id = db.Column(db.String(36), db.ForeignKey('branches.id'), nullable=False)
    member_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    amount_spent = db.Column(db.Float, nullable=False) # e.g. RM 10.50
    points_earned = db.Column(db.Float, nullable=False)
    transaction_type = db.Column(db.String(50), default='purchase')
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    # branch is defined in Branch model via backref 'transactions'
    member = db.relationship('User', foreign_keys=[member_id], backref='transactions_made')

    def __repr__(self):
        return f'<Transaction member={self.member_id} amount={self.amount_spent} pts={self.points_earned}>'
