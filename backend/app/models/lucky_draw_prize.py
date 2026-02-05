from app import db
from datetime import datetime
import uuid6


class LuckyDrawPrize(db.Model):
    __tablename__ = 'lucky_draw_prizes'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid6.uuid7()))
    lucky_draw_id = db.Column(db.String(36), db.ForeignKey('lucky_draws.id'), nullable=False)

    # Prize Type
    prize_type = db.Column(db.Enum('points', 'reward', 'voucher', name='prize_type_enum'), nullable=False)

    # Prize Values (conditional based on prize_type)
    points_amount = db.Column(db.Integer, nullable=True)
    reward_id = db.Column(db.String(36), db.ForeignKey('rewards.id'), nullable=True)
    voucher_discount_percent = db.Column(db.Numeric(5, 2), nullable=True)
    voucher_discount_amount = db.Column(db.Numeric(10, 2), nullable=True)
    voucher_description = db.Column(db.String(200), nullable=True)
    voucher_max_usage = db.Column(db.Integer, default=1)
    voucher_expiry_days = db.Column(db.Integer, default=30)

    # Probability & Stock
    probability_weight = db.Column(db.Integer, nullable=False, default=1)
    stock_quantity = db.Column(db.Integer, nullable=True)
    stock_remaining = db.Column(db.Integer, nullable=True)

    # Display
    name = db.Column(db.String(100), nullable=False)
    display_order = db.Column(db.Integer, default=0)

    # Timestamp
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    reward = db.relationship('Reward', foreign_keys=[reward_id])

    def to_dict(self, include_reward=True):
        data = {
            'id': self.id,
            'lucky_draw_id': self.lucky_draw_id,
            'prize_type': self.prize_type,
            'name': self.name,
            'display_order': self.display_order,
            'probability_weight': self.probability_weight,
            'stock_quantity': self.stock_quantity,
            'stock_remaining': self.stock_remaining,
            'created_at': self.created_at.isoformat(),
        }

        # Add type-specific fields
        if self.prize_type == 'points':
            data['points_amount'] = self.points_amount
        elif self.prize_type == 'reward':
            data['reward_id'] = self.reward_id
            if include_reward and self.reward:
                data['reward'] = self.reward.to_dict()
        elif self.prize_type == 'voucher':
            data['voucher_discount_percent'] = float(self.voucher_discount_percent) if self.voucher_discount_percent else None
            data['voucher_discount_amount'] = float(self.voucher_discount_amount) if self.voucher_discount_amount else None
            data['voucher_description'] = self.voucher_description
            data['voucher_max_usage'] = self.voucher_max_usage
            data['voucher_expiry_days'] = self.voucher_expiry_days

        return data

    def is_available(self):
        """Check if prize is still available"""
        if self.stock_remaining is not None:
            return self.stock_remaining > 0
        return True

    def decrement_stock(self):
        """Decrement stock if limited"""
        if self.stock_remaining is not None and self.stock_remaining > 0:
            self.stock_remaining -= 1
