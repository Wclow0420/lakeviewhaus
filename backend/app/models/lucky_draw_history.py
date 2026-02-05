from app import db
from datetime import datetime
import json
import uuid6


class LuckyDrawHistory(db.Model):
    __tablename__ = 'lucky_draw_history'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid6.uuid7()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    lucky_draw_id = db.Column(db.String(36), db.ForeignKey('lucky_draws.id'), nullable=False)
    prize_won_id = db.Column(db.String(36), db.ForeignKey('lucky_draw_prizes.id'), nullable=False)

    # Spin Details
    points_spent = db.Column(db.Integer, default=0, nullable=False)
    spin_type = db.Column(db.Enum('day7_checkin', 'points_redemption', name='spin_type_enum'), nullable=False)

    # Prize Snapshot (for historical record)
    prize_type = db.Column(db.String(20), nullable=False)
    prize_name = db.Column(db.String(100), nullable=False)
    prize_value_json = db.Column(db.Text)

    # Voucher/Reward Fulfillment
    voucher_code = db.Column(db.String(50), unique=True, nullable=True)
    user_reward_id = db.Column(db.String(36), db.ForeignKey('user_rewards.id'), nullable=True)
    voucher_expiry_date = db.Column(db.DateTime, nullable=True)

    # Status
    is_claimed = db.Column(db.Boolean, default=False, nullable=False)
    claimed_at = db.Column(db.DateTime, nullable=True)

    # Timestamp
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = db.relationship('User', backref='lucky_draw_spins')
    prize = db.relationship('LuckyDrawPrize')
    user_reward = db.relationship('UserReward', foreign_keys=[user_reward_id], backref='lucky_draw_source')

    def to_dict(self):
        prize_value = {}
        if self.prize_value_json:
            try:
                prize_value = json.loads(self.prize_value_json)
            except:
                pass

        return {
            'id': self.id,
            'user_id': self.user_id,
            'lucky_draw_id': self.lucky_draw_id,
            'lucky_draw_name': self.lucky_draw.name if self.lucky_draw else None,
            'prize_won_id': self.prize_won_id,
            'points_spent': self.points_spent,
            'spin_type': self.spin_type,
            'prize_type': self.prize_type,
            'prize_name': self.prize_name,
            'prize_value': prize_value,
            'voucher_code': self.voucher_code,
            'voucher_expiry_date': self.voucher_expiry_date.isoformat() if self.voucher_expiry_date else None,
            'user_reward_id': self.user_reward_id,
            'is_claimed': self.is_claimed,
            'claimed_at': self.claimed_at.isoformat() if self.claimed_at else None,
            'created_at': self.created_at.isoformat(),
        }
