from app import db
from datetime import datetime
import uuid6


class LuckyDraw(db.Model):
    __tablename__ = 'lucky_draws'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid6.uuid7()))
    merchant_id = db.Column(db.String(36), db.ForeignKey('merchants.id'), nullable=False)

    # Basic Info
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    image_url = db.Column(db.String(500))

    # Redemption Settings
    points_cost = db.Column(db.Integer, default=0, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    # Day 7 Assignment
    is_day7_draw = db.Column(db.Boolean, default=False, nullable=False)

    # Limits & Controls
    max_daily_spins_per_user = db.Column(db.Integer, nullable=True)
    total_available_spins = db.Column(db.Integer, nullable=True)
    remaining_spins = db.Column(db.Integer, nullable=True)

    # Validity Period
    start_date = db.Column(db.DateTime, nullable=True)
    end_date = db.Column(db.DateTime, nullable=True)

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    merchant = db.relationship('Merchant', backref='lucky_draws')
    prizes = db.relationship('LuckyDrawPrize', backref='lucky_draw',
                            cascade='all, delete-orphan', lazy='dynamic')
    history = db.relationship('LuckyDrawHistory', backref='lucky_draw', lazy='dynamic')

    def to_dict(self, include_prizes=False):
        data = {
            'id': self.id,
            'merchant_id': self.merchant_id,
            'name': self.name,
            'description': self.description,
            'image_url': self.image_url,
            'points_cost': self.points_cost,
            'is_active': self.is_active,
            'is_day7_draw': self.is_day7_draw,
            'max_daily_spins_per_user': self.max_daily_spins_per_user,
            'total_available_spins': self.total_available_spins,
            'remaining_spins': self.remaining_spins,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

        if include_prizes:
            data['prizes'] = [p.to_dict() for p in self.prizes.all()]

        return data

    def is_available(self):
        """Check if draw is currently available"""
        now = datetime.utcnow()

        # Check active status
        if not self.is_active:
            return False

        # Check date range
        if self.start_date and now < self.start_date:
            return False
        if self.end_date and now > self.end_date:
            return False

        # Check remaining spins
        if self.total_available_spins is not None and self.remaining_spins is not None:
            if self.remaining_spins <= 0:
                return False

        return True

    def decrement_spins(self):
        """Decrement remaining spins if limited"""
        if self.remaining_spins is not None and self.remaining_spins > 0:
            self.remaining_spins -= 1
