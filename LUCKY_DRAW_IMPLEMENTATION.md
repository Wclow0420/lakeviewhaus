# Lucky Draw System - Full Implementation Plan

**Project:** Lakeview Haus Loyalty App
**Feature:** Configurable Lucky Draw System with Multi-Prize Support
**Date:** 2026-01-19
**Status:** Ready for Implementation

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [API Specifications](#api-specifications)
6. [Business Rules](#business-rules)
7. [Implementation Checklist](#implementation-checklist)

---

## 🎯 Overview

### Feature Description
A flexible lucky draw system where merchants can create multiple lucky draws with configurable prizes (points, rewards, or discount vouchers). Users can spin lucky draws either for free (Day 7 check-in) or by redeeming points.

### Key Features
- ✅ Merchants create and manage multiple lucky draws
- ✅ Three prize types: Points, Rewards, Discount Vouchers
- ✅ Weighted probability system for prizes
- ✅ Stock management for limited prizes
- ✅ Day 7 check-in integration (replaces old fixed points)
- ✅ Points-based redemption for paid draws
- ✅ Spin history tracking
- ✅ Auto-generated voucher codes
- ✅ Main branch only can create/manage (same as rewards)

### User Flows
1. **Day 7 Check-In:** User checks in on 7th consecutive day → Automatically spins the merchant's Day 7 draw (free) → Receives random prize
2. **Points Redemption:** User browses available lucky draws → Spends points to spin → Receives random prize
3. **Prize Claiming:** User views won prizes in history → Claims vouchers/rewards

---

## 🗄️ Database Schema

### New Tables

#### 1. `lucky_draws` Table
```python
class LuckyDraw(db.Model):
    __tablename__ = 'lucky_draws'

    id = db.Column(db.Integer, primary_key=True)
    merchant_id = db.Column(db.Integer, db.ForeignKey('merchants.id'), nullable=False)

    # Basic Info
    name = db.Column(db.String(100), nullable=False)  # "Grand Prize Draw"
    description = db.Column(db.Text)  # "Win amazing prizes!"
    image_url = db.Column(db.String(500))  # Banner image

    # Redemption Settings
    points_cost = db.Column(db.Integer, default=0, nullable=False)  # 0 = free, 10 = costs 10 points
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    # Day 7 Assignment
    is_day7_draw = db.Column(db.Boolean, default=False, nullable=False)
    # Constraint: Only ONE draw per merchant can have is_day7_draw=True
    # If is_day7_draw=True, then points_cost MUST be 0

    # Limits & Controls
    max_daily_spins_per_user = db.Column(db.Integer, nullable=True)  # NULL = unlimited
    total_available_spins = db.Column(db.Integer, nullable=True)  # NULL = unlimited
    remaining_spins = db.Column(db.Integer, nullable=True)  # Tracks usage

    # Validity Period
    start_date = db.Column(db.DateTime, nullable=True)  # NULL = no start limit
    end_date = db.Column(db.DateTime, nullable=True)  # NULL = no end limit

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    merchant = db.relationship('Merchant', backref='lucky_draws')
    prizes = db.relationship('LuckyDrawPrize', backref='lucky_draw', cascade='all, delete-orphan')
    history = db.relationship('LuckyDrawHistory', backref='lucky_draw')
```

**Indexes:**
- `merchant_id` (for filtering by merchant)
- `is_day7_draw, merchant_id` (composite - for finding Day 7 draw)
- `is_active` (for filtering active draws)

**Constraints:**
- UNIQUE constraint on `(merchant_id, is_day7_draw)` WHERE `is_day7_draw = TRUE`
- CHECK constraint: `is_day7_draw = TRUE` implies `points_cost = 0`

---

#### 2. `lucky_draw_prizes` Table
```python
class LuckyDrawPrize(db.Model):
    __tablename__ = 'lucky_draw_prizes'

    id = db.Column(db.Integer, primary_key=True)
    lucky_draw_id = db.Column(db.Integer, db.ForeignKey('lucky_draws.id'), nullable=False)

    # Prize Type
    prize_type = db.Column(db.Enum('points', 'reward', 'voucher', name='prize_type_enum'), nullable=False)

    # Prize Values (conditional based on prize_type)
    points_amount = db.Column(db.Integer, nullable=True)  # Used if prize_type='points'
    reward_id = db.Column(db.Integer, db.ForeignKey('rewards.id'), nullable=True)  # Used if prize_type='reward'
    voucher_discount_percent = db.Column(db.Numeric(5, 2), nullable=True)  # e.g., 50.00 = 50%
    voucher_discount_amount = db.Column(db.Numeric(10, 2), nullable=True)  # Fixed amount off
    voucher_description = db.Column(db.String(200), nullable=True)  # "50% off next purchase"
    voucher_max_usage = db.Column(db.Integer, default=1)  # How many times voucher can be used
    voucher_expiry_days = db.Column(db.Integer, default=30)  # Days until voucher expires

    # Probability & Stock
    probability_weight = db.Column(db.Integer, nullable=False, default=1)  # Weight for random selection
    stock_quantity = db.Column(db.Integer, nullable=True)  # NULL = unlimited
    stock_remaining = db.Column(db.Integer, nullable=True)  # Decrements on win

    # Display
    name = db.Column(db.String(100), nullable=False)  # "Grand Prize", "Consolation"
    display_order = db.Column(db.Integer, default=0)  # For sorting in UI

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    reward = db.relationship('Reward', foreign_keys=[reward_id])

    # Validation: Ensure correct fields are populated based on prize_type
    __table_args__ = (
        db.CheckConstraint(
            "(prize_type = 'points' AND points_amount IS NOT NULL) OR "
            "(prize_type = 'reward' AND reward_id IS NOT NULL) OR "
            "(prize_type = 'voucher' AND voucher_description IS NOT NULL)",
            name='check_prize_fields'
        ),
    )
```

**Indexes:**
- `lucky_draw_id` (for fetching prizes by draw)
- `reward_id` (for joins)

---

#### 3. `lucky_draw_history` Table
```python
class LuckyDrawHistory(db.Model):
    __tablename__ = 'lucky_draw_history'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    lucky_draw_id = db.Column(db.Integer, db.ForeignKey('lucky_draws.id'), nullable=False)
    prize_won_id = db.Column(db.Integer, db.ForeignKey('lucky_draw_prizes.id'), nullable=False)

    # Spin Details
    points_spent = db.Column(db.Integer, default=0, nullable=False)
    spin_type = db.Column(db.Enum('day7_checkin', 'points_redemption', name='spin_type_enum'), nullable=False)

    # Prize Snapshot (for historical record)
    prize_type = db.Column(db.String(20), nullable=False)  # 'points', 'reward', 'voucher'
    prize_name = db.Column(db.String(100), nullable=False)
    prize_value_json = db.Column(db.Text)  # JSON with prize details

    # Voucher/Reward Fulfillment
    voucher_code = db.Column(db.String(50), unique=True, nullable=True)  # Generated if prize_type='voucher'
    user_reward_id = db.Column(db.Integer, db.ForeignKey('user_rewards.id'), nullable=True)  # If reward given
    voucher_expiry_date = db.Column(db.DateTime, nullable=True)

    # Status
    is_claimed = db.Column(db.Boolean, default=False, nullable=False)
    claimed_at = db.Column(db.DateTime, nullable=True)

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = db.relationship('User', backref='lucky_draw_spins')
    prize = db.relationship('LuckyDrawPrize')
    user_reward = db.relationship('UserReward', foreign_keys=[user_reward_id])
```

**Indexes:**
- `user_id, created_at` (for user history queries)
- `lucky_draw_id` (for analytics)
- `voucher_code` (unique, for redemption lookup)
- `spin_type` (for filtering)

---

### Modified Tables

#### Update `user_rewards` Table
```python
# Add new fields to existing UserReward model
class UserReward(db.Model):
    # ... existing fields ...

    # ADD THESE:
    source_type = db.Column(
        db.Enum('direct_redeem', 'lucky_draw', 'promotion', name='reward_source_enum'),
        default='direct_redeem',
        nullable=False
    )
    lucky_draw_history_id = db.Column(db.Integer, db.ForeignKey('lucky_draw_history.id'), nullable=True)

    # Relationship
    lucky_draw_spin = db.relationship('LuckyDrawHistory', foreign_keys=[lucky_draw_history_id])
```

---

## 🔧 Backend Implementation

### File Structure
```
backend/
├── app/
│   ├── models/
│   │   ├── lucky_draw.py          # NEW
│   │   ├── lucky_draw_prize.py    # NEW
│   │   ├── lucky_draw_history.py  # NEW
│   │   └── user.py                # MODIFY (update user_rewards relationship)
│   ├── routes/
│   │   ├── merchant_lucky_draw.py # NEW
│   │   ├── user_lucky_draw.py     # NEW
│   │   └── gamification.py        # MODIFY (update Day 7 logic)
│   └── utils/
│       └── lucky_draw_utils.py    # NEW (helper functions)
├── migrations/
│   └── versions/
│       └── XXXXX_add_lucky_draw_system.py  # NEW
└── seed_lucky_draw.py             # NEW (optional test data)
```

---

### 1. Models Implementation

#### **File:** `backend/app/models/lucky_draw.py`
```python
from app import db
from datetime import datetime

class LuckyDraw(db.Model):
    __tablename__ = 'lucky_draws'

    id = db.Column(db.Integer, primary_key=True)
    merchant_id = db.Column(db.Integer, db.ForeignKey('merchants.id'), nullable=False)

    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    image_url = db.Column(db.String(500))

    points_cost = db.Column(db.Integer, default=0, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_day7_draw = db.Column(db.Boolean, default=False, nullable=False)

    max_daily_spins_per_user = db.Column(db.Integer, nullable=True)
    total_available_spins = db.Column(db.Integer, nullable=True)
    remaining_spins = db.Column(db.Integer, nullable=True)

    start_date = db.Column(db.DateTime, nullable=True)
    end_date = db.Column(db.DateTime, nullable=True)

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
        if self.total_available_spins is not None and self.remaining_spins <= 0:
            return False

        return True

    def decrement_spins(self):
        """Decrement remaining spins if limited"""
        if self.remaining_spins is not None and self.remaining_spins > 0:
            self.remaining_spins -= 1
```

---

#### **File:** `backend/app/models/lucky_draw_prize.py`
```python
from app import db
from datetime import datetime

class LuckyDrawPrize(db.Model):
    __tablename__ = 'lucky_draw_prizes'

    id = db.Column(db.Integer, primary_key=True)
    lucky_draw_id = db.Column(db.Integer, db.ForeignKey('lucky_draws.id'), nullable=False)

    prize_type = db.Column(db.Enum('points', 'reward', 'voucher', name='prize_type_enum'), nullable=False)

    # Prize values
    points_amount = db.Column(db.Integer, nullable=True)
    reward_id = db.Column(db.Integer, db.ForeignKey('rewards.id'), nullable=True)
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
```

---

#### **File:** `backend/app/models/lucky_draw_history.py`
```python
from app import db
from datetime import datetime
import json

class LuckyDrawHistory(db.Model):
    __tablename__ = 'lucky_draw_history'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    lucky_draw_id = db.Column(db.Integer, db.ForeignKey('lucky_draws.id'), nullable=False)
    prize_won_id = db.Column(db.Integer, db.ForeignKey('lucky_draw_prizes.id'), nullable=False)

    points_spent = db.Column(db.Integer, default=0, nullable=False)
    spin_type = db.Column(db.Enum('day7_checkin', 'points_redemption', name='spin_type_enum'), nullable=False)

    # Snapshot
    prize_type = db.Column(db.String(20), nullable=False)
    prize_name = db.Column(db.String(100), nullable=False)
    prize_value_json = db.Column(db.Text)

    # Fulfillment
    voucher_code = db.Column(db.String(50), unique=True, nullable=True)
    user_reward_id = db.Column(db.Integer, db.ForeignKey('user_rewards.id'), nullable=True)
    voucher_expiry_date = db.Column(db.DateTime, nullable=True)

    is_claimed = db.Column(db.Boolean, default=False, nullable=False)
    claimed_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = db.relationship('User', backref='lucky_draw_spins')
    prize = db.relationship('LuckyDrawPrize')
    user_reward = db.relationship('UserReward', foreign_keys=[user_reward_id])

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
```

---

### 2. Utility Functions

#### **File:** `backend/app/utils/lucky_draw_utils.py`
```python
import random
import string
from datetime import datetime, timedelta
from app.models.lucky_draw_prize import LuckyDrawPrize

def select_prize(lucky_draw_id):
    """
    Weighted random selection of a prize from a lucky draw.
    Only selects from prizes that are in stock.
    """
    # Get all available prizes
    prizes = LuckyDrawPrize.query.filter_by(
        lucky_draw_id=lucky_draw_id
    ).filter(
        db.or_(
            LuckyDrawPrize.stock_remaining > 0,
            LuckyDrawPrize.stock_remaining.is_(None)
        )
    ).all()

    if not prizes:
        return None

    # Calculate total weight
    total_weight = sum(p.probability_weight for p in prizes)

    if total_weight == 0:
        return None

    # Random selection
    rand = random.random() * total_weight

    cumulative = 0
    for prize in prizes:
        cumulative += prize.probability_weight
        if rand < cumulative:
            return prize

    # Fallback (should not reach here)
    return prizes[-1]


def generate_voucher_code(length=12):
    """
    Generate a unique voucher code.
    Format: LUCKY-XXXX-XXXX
    """
    chars = string.ascii_uppercase + string.digits
    part1 = ''.join(random.choices(chars, k=4))
    part2 = ''.join(random.choices(chars, k=4))

    return f"LUCKY-{part1}-{part2}"


def can_user_spin_today(user_id, lucky_draw_id, max_daily_spins):
    """
    Check if user has reached daily spin limit for this draw.
    Returns (can_spin: bool, spins_today: int)
    """
    from app.models.lucky_draw_history import LuckyDrawHistory

    if max_daily_spins is None:
        return True, 0

    # Count spins today
    today = datetime.utcnow().date()
    spins_today = LuckyDrawHistory.query.filter(
        LuckyDrawHistory.user_id == user_id,
        LuckyDrawHistory.lucky_draw_id == lucky_draw_id,
        db.func.date(LuckyDrawHistory.created_at) == today
    ).count()

    can_spin = spins_today < max_daily_spins

    return can_spin, spins_today
```

---

### 3. API Routes - Merchant

#### **File:** `backend/app/routes/merchant_lucky_draw.py`
```python
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.merchant import Branch
from app.models.lucky_draw import LuckyDraw
from app.models.lucky_draw_prize import LuckyDrawPrize
from app.models.reward import Reward
from datetime import datetime

bp = Blueprint('merchant_lucky_draw', __name__, url_prefix='/merchant/lucky-draws')

# ============================================
# GET /merchant/lucky-draws
# List all lucky draws for the merchant
# ============================================
@bp.route('/', methods=['GET'])
@jwt_required()
def list_lucky_draws():
    branch_username = get_jwt_identity()

    branch = Branch.query.filter_by(username=branch_username).first()
    if not branch:
        return jsonify({'error': 'Branch not found'}), 404

    # Only main branch can access
    if not branch.is_main:
        return jsonify({'error': 'Only main branch can manage lucky draws'}), 403

    draws = LuckyDraw.query.filter_by(merchant_id=branch.merchant_id).all()

    return jsonify({
        'lucky_draws': [draw.to_dict(include_prizes=True) for draw in draws]
    }), 200


# ============================================
# POST /merchant/lucky-draws
# Create a new lucky draw
# ============================================
@bp.route('/', methods=['POST'])
@jwt_required()
def create_lucky_draw():
    branch_username = get_jwt_identity()

    branch = Branch.query.filter_by(username=branch_username).first()
    if not branch:
        return jsonify({'error': 'Branch not found'}), 404

    if not branch.is_main:
        return jsonify({'error': 'Only main branch can manage lucky draws'}), 403

    data = request.get_json()

    # Validation
    if not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400

    is_day7 = data.get('is_day7_draw', False)
    points_cost = data.get('points_cost', 0)

    # If Day 7 draw, points_cost must be 0
    if is_day7 and points_cost != 0:
        return jsonify({'error': 'Day 7 draws must be free (points_cost = 0)'}), 400

    # Check if there's already a Day 7 draw for this merchant
    if is_day7:
        existing_day7 = LuckyDraw.query.filter_by(
            merchant_id=branch.merchant_id,
            is_day7_draw=True
        ).first()

        if existing_day7:
            return jsonify({
                'error': f'A Day 7 draw already exists: {existing_day7.name}. Please deactivate it first.'
            }), 400

    # Create lucky draw
    new_draw = LuckyDraw(
        merchant_id=branch.merchant_id,
        name=data['name'],
        description=data.get('description'),
        image_url=data.get('image_url'),
        points_cost=points_cost,
        is_active=data.get('is_active', True),
        is_day7_draw=is_day7,
        max_daily_spins_per_user=data.get('max_daily_spins_per_user'),
        total_available_spins=data.get('total_available_spins'),
        remaining_spins=data.get('total_available_spins'),  # Initialize same as total
        start_date=datetime.fromisoformat(data['start_date']) if data.get('start_date') else None,
        end_date=datetime.fromisoformat(data['end_date']) if data.get('end_date') else None,
    )

    db.session.add(new_draw)
    db.session.commit()

    return jsonify({
        'message': 'Lucky draw created successfully',
        'lucky_draw': new_draw.to_dict()
    }), 201


# ============================================
# GET /merchant/lucky-draws/:id
# Get single lucky draw with prizes
# ============================================
@bp.route('/<int:draw_id>', methods=['GET'])
@jwt_required()
def get_lucky_draw(draw_id):
    branch_username = get_jwt_identity()

    branch = Branch.query.filter_by(username=branch_username).first()
    if not branch or not branch.is_main:
        return jsonify({'error': 'Unauthorized'}), 403

    draw = LuckyDraw.query.filter_by(
        id=draw_id,
        merchant_id=branch.merchant_id
    ).first()

    if not draw:
        return jsonify({'error': 'Lucky draw not found'}), 404

    return jsonify({
        'lucky_draw': draw.to_dict(include_prizes=True)
    }), 200


# ============================================
# PUT /merchant/lucky-draws/:id
# Update lucky draw
# ============================================
@bp.route('/<int:draw_id>', methods=['PUT'])
@jwt_required()
def update_lucky_draw(draw_id):
    branch_username = get_jwt_identity()

    branch = Branch.query.filter_by(username=branch_username).first()
    if not branch or not branch.is_main:
        return jsonify({'error': 'Unauthorized'}), 403

    draw = LuckyDraw.query.filter_by(
        id=draw_id,
        merchant_id=branch.merchant_id
    ).first()

    if not draw:
        return jsonify({'error': 'Lucky draw not found'}), 404

    data = request.get_json()

    # Validation for Day 7 assignment
    is_day7 = data.get('is_day7_draw', draw.is_day7_draw)
    points_cost = data.get('points_cost', draw.points_cost)

    if is_day7 and points_cost != 0:
        return jsonify({'error': 'Day 7 draws must be free'}), 400

    # If setting as Day 7, check no other Day 7 exists
    if is_day7 and not draw.is_day7_draw:
        existing_day7 = LuckyDraw.query.filter_by(
            merchant_id=branch.merchant_id,
            is_day7_draw=True
        ).filter(LuckyDraw.id != draw_id).first()

        if existing_day7:
            return jsonify({
                'error': f'Another Day 7 draw exists: {existing_day7.name}'
            }), 400

    # Update fields
    draw.name = data.get('name', draw.name)
    draw.description = data.get('description', draw.description)
    draw.image_url = data.get('image_url', draw.image_url)
    draw.points_cost = points_cost
    draw.is_active = data.get('is_active', draw.is_active)
    draw.is_day7_draw = is_day7
    draw.max_daily_spins_per_user = data.get('max_daily_spins_per_user', draw.max_daily_spins_per_user)

    # Update total spins (and remaining)
    if 'total_available_spins' in data:
        new_total = data['total_available_spins']
        if new_total is not None:
            # Increase remaining by the difference
            diff = new_total - (draw.total_available_spins or 0)
            draw.remaining_spins = (draw.remaining_spins or 0) + diff
            draw.total_available_spins = new_total
        else:
            draw.total_available_spins = None
            draw.remaining_spins = None

    if 'start_date' in data:
        draw.start_date = datetime.fromisoformat(data['start_date']) if data['start_date'] else None
    if 'end_date' in data:
        draw.end_date = datetime.fromisoformat(data['end_date']) if data['end_date'] else None

    draw.updated_at = datetime.utcnow()

    db.session.commit()

    return jsonify({
        'message': 'Lucky draw updated',
        'lucky_draw': draw.to_dict()
    }), 200


# ============================================
# DELETE /merchant/lucky-draws/:id
# Delete lucky draw
# ============================================
@bp.route('/<int:draw_id>', methods=['DELETE'])
@jwt_required()
def delete_lucky_draw(draw_id):
    branch_username = get_jwt_identity()

    branch = Branch.query.filter_by(username=branch_username).first()
    if not branch or not branch.is_main:
        return jsonify({'error': 'Unauthorized'}), 403

    draw = LuckyDraw.query.filter_by(
        id=draw_id,
        merchant_id=branch.merchant_id
    ).first()

    if not draw:
        return jsonify({'error': 'Lucky draw not found'}), 404

    db.session.delete(draw)
    db.session.commit()

    return jsonify({'message': 'Lucky draw deleted'}), 200


# ============================================
# POST /merchant/lucky-draws/:id/prizes
# Add prize to lucky draw
# ============================================
@bp.route('/<int:draw_id>/prizes', methods=['POST'])
@jwt_required()
def add_prize(draw_id):
    branch_username = get_jwt_identity()

    branch = Branch.query.filter_by(username=branch_username).first()
    if not branch or not branch.is_main:
        return jsonify({'error': 'Unauthorized'}), 403

    draw = LuckyDraw.query.filter_by(
        id=draw_id,
        merchant_id=branch.merchant_id
    ).first()

    if not draw:
        return jsonify({'error': 'Lucky draw not found'}), 404

    data = request.get_json()

    # Validation
    prize_type = data.get('prize_type')
    if prize_type not in ['points', 'reward', 'voucher']:
        return jsonify({'error': 'Invalid prize_type'}), 400

    if not data.get('name'):
        return jsonify({'error': 'Prize name is required'}), 400

    # Type-specific validation
    if prize_type == 'points' and not data.get('points_amount'):
        return jsonify({'error': 'points_amount required for points prize'}), 400

    if prize_type == 'reward':
        reward_id = data.get('reward_id')
        if not reward_id:
            return jsonify({'error': 'reward_id required for reward prize'}), 400

        # Verify reward exists and belongs to this merchant
        reward = Reward.query.filter_by(id=reward_id, merchant_id=branch.merchant_id).first()
        if not reward:
            return jsonify({'error': 'Reward not found'}), 404

    if prize_type == 'voucher' and not data.get('voucher_description'):
        return jsonify({'error': 'voucher_description required for voucher prize'}), 400

    # Create prize
    new_prize = LuckyDrawPrize(
        lucky_draw_id=draw_id,
        prize_type=prize_type,
        name=data['name'],
        probability_weight=data.get('probability_weight', 1),
        display_order=data.get('display_order', 0),
        stock_quantity=data.get('stock_quantity'),
        stock_remaining=data.get('stock_quantity'),  # Initialize
    )

    # Set type-specific fields
    if prize_type == 'points':
        new_prize.points_amount = data['points_amount']
    elif prize_type == 'reward':
        new_prize.reward_id = data['reward_id']
    elif prize_type == 'voucher':
        new_prize.voucher_description = data['voucher_description']
        new_prize.voucher_discount_percent = data.get('voucher_discount_percent')
        new_prize.voucher_discount_amount = data.get('voucher_discount_amount')
        new_prize.voucher_max_usage = data.get('voucher_max_usage', 1)
        new_prize.voucher_expiry_days = data.get('voucher_expiry_days', 30)

    db.session.add(new_prize)
    db.session.commit()

    return jsonify({
        'message': 'Prize added',
        'prize': new_prize.to_dict()
    }), 201


# ============================================
# PUT /merchant/lucky-draws/:id/prizes/:prize_id
# Update prize
# ============================================
@bp.route('/<int:draw_id>/prizes/<int:prize_id>', methods=['PUT'])
@jwt_required()
def update_prize(draw_id, prize_id):
    branch_username = get_jwt_identity()

    branch = Branch.query.filter_by(username=branch_username).first()
    if not branch or not branch.is_main:
        return jsonify({'error': 'Unauthorized'}), 403

    draw = LuckyDraw.query.filter_by(
        id=draw_id,
        merchant_id=branch.merchant_id
    ).first()

    if not draw:
        return jsonify({'error': 'Lucky draw not found'}), 404

    prize = LuckyDrawPrize.query.filter_by(
        id=prize_id,
        lucky_draw_id=draw_id
    ).first()

    if not prize:
        return jsonify({'error': 'Prize not found'}), 404

    data = request.get_json()

    # Update fields
    if 'name' in data:
        prize.name = data['name']
    if 'probability_weight' in data:
        prize.probability_weight = data['probability_weight']
    if 'display_order' in data:
        prize.display_order = data['display_order']

    # Stock refill
    if 'stock_quantity' in data:
        new_stock = data['stock_quantity']
        if new_stock is not None:
            diff = new_stock - (prize.stock_quantity or 0)
            prize.stock_remaining = (prize.stock_remaining or 0) + diff
            prize.stock_quantity = new_stock
        else:
            prize.stock_quantity = None
            prize.stock_remaining = None

    # Type-specific updates
    if prize.prize_type == 'points' and 'points_amount' in data:
        prize.points_amount = data['points_amount']
    elif prize.prize_type == 'reward' and 'reward_id' in data:
        prize.reward_id = data['reward_id']
    elif prize.prize_type == 'voucher':
        if 'voucher_description' in data:
            prize.voucher_description = data['voucher_description']
        if 'voucher_discount_percent' in data:
            prize.voucher_discount_percent = data['voucher_discount_percent']
        if 'voucher_discount_amount' in data:
            prize.voucher_discount_amount = data['voucher_discount_amount']
        if 'voucher_max_usage' in data:
            prize.voucher_max_usage = data['voucher_max_usage']
        if 'voucher_expiry_days' in data:
            prize.voucher_expiry_days = data['voucher_expiry_days']

    db.session.commit()

    return jsonify({
        'message': 'Prize updated',
        'prize': prize.to_dict()
    }), 200


# ============================================
# DELETE /merchant/lucky-draws/:id/prizes/:prize_id
# Delete prize
# ============================================
@bp.route('/<int:draw_id>/prizes/<int:prize_id>', methods=['DELETE'])
@jwt_required()
def delete_prize(draw_id, prize_id):
    branch_username = get_jwt_identity()

    branch = Branch.query.filter_by(username=branch_username).first()
    if not branch or not branch.is_main:
        return jsonify({'error': 'Unauthorized'}), 403

    draw = LuckyDraw.query.filter_by(
        id=draw_id,
        merchant_id=branch.merchant_id
    ).first()

    if not draw:
        return jsonify({'error': 'Lucky draw not found'}), 404

    prize = LuckyDrawPrize.query.filter_by(
        id=prize_id,
        lucky_draw_id=draw_id
    ).first()

    if not prize:
        return jsonify({'error': 'Prize not found'}), 404

    db.session.delete(prize)
    db.session.commit()

    return jsonify({'message': 'Prize deleted'}), 200


# ============================================
# GET /merchant/lucky-draws/:id/statistics
# Get draw analytics
# ============================================
@bp.route('/<int:draw_id>/statistics', methods=['GET'])
@jwt_required()
def get_statistics(draw_id):
    from app.models.lucky_draw_history import LuckyDrawHistory
    from sqlalchemy import func

    branch_username = get_jwt_identity()

    branch = Branch.query.filter_by(username=branch_username).first()
    if not branch or not branch.is_main:
        return jsonify({'error': 'Unauthorized'}), 403

    draw = LuckyDraw.query.filter_by(
        id=draw_id,
        merchant_id=branch.merchant_id
    ).first()

    if not draw:
        return jsonify({'error': 'Lucky draw not found'}), 404

    # Total spins
    total_spins = LuckyDrawHistory.query.filter_by(lucky_draw_id=draw_id).count()

    # Spins by type
    spin_types = db.session.query(
        LuckyDrawHistory.spin_type,
        func.count(LuckyDrawHistory.id)
    ).filter_by(lucky_draw_id=draw_id).group_by(LuckyDrawHistory.spin_type).all()

    # Prizes won
    prizes_won = db.session.query(
        LuckyDrawHistory.prize_type,
        LuckyDrawHistory.prize_name,
        func.count(LuckyDrawHistory.id)
    ).filter_by(lucky_draw_id=draw_id).group_by(
        LuckyDrawHistory.prize_type,
        LuckyDrawHistory.prize_name
    ).all()

    # Total points spent
    total_points_spent = db.session.query(
        func.sum(LuckyDrawHistory.points_spent)
    ).filter_by(lucky_draw_id=draw_id).scalar() or 0

    return jsonify({
        'total_spins': total_spins,
        'spin_types': [{'type': t[0], 'count': t[1]} for t in spin_types],
        'prizes_won': [{'type': p[0], 'name': p[1], 'count': p[2]} for p in prizes_won],
        'total_points_spent': int(total_points_spent),
        'remaining_spins': draw.remaining_spins
    }), 200
```

---

### 4. API Routes - User

#### **File:** `backend/app/routes/user_lucky_draw.py`
```python
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User
from app.models.lucky_draw import LuckyDraw
from app.models.lucky_draw_history import LuckyDrawHistory
from app.models.user_reward import UserReward
from app.utils.lucky_draw_utils import select_prize, generate_voucher_code, can_user_spin_today
from datetime import datetime, timedelta
import json

bp = Blueprint('user_lucky_draw', __name__, url_prefix='/lucky-draws')

# ============================================
# GET /lucky-draws
# List all available lucky draws
# ============================================
@bp.route('/', methods=['GET'])
@jwt_required()
def list_available_draws():
    user_id = get_jwt_identity()

    try:
        user_id = int(user_id)
    except:
        return jsonify({'error': 'Invalid user'}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    now = datetime.utcnow()

    # Get all active lucky draws
    draws = LuckyDraw.query.filter_by(is_active=True).filter(
        db.or_(
            LuckyDraw.start_date.is_(None),
            LuckyDraw.start_date <= now
        ),
        db.or_(
            LuckyDraw.end_date.is_(None),
            LuckyDraw.end_date >= now
        )
    ).all()

    result = []
    for draw in draws:
        # Skip if no remaining spins
        if draw.total_available_spins is not None and draw.remaining_spins <= 0:
            continue

        # Check daily limit
        can_spin, spins_today = can_user_spin_today(
            user_id,
            draw.id,
            draw.max_daily_spins_per_user
        )

        draw_data = draw.to_dict(include_prizes=False)
        draw_data['can_spin'] = can_spin
        draw_data['spins_today'] = spins_today

        result.append(draw_data)

    return jsonify({'lucky_draws': result}), 200


# ============================================
# GET /lucky-draws/:id
# Get lucky draw details with prizes
# ============================================
@bp.route('/<int:draw_id>', methods=['GET'])
@jwt_required()
def get_draw_details(draw_id):
    user_id = get_jwt_identity()

    try:
        user_id = int(user_id)
    except:
        return jsonify({'error': 'Invalid user'}), 403

    draw = LuckyDraw.query.get(draw_id)
    if not draw:
        return jsonify({'error': 'Lucky draw not found'}), 404

    if not draw.is_available():
        return jsonify({'error': 'Lucky draw not available'}), 400

    # Check daily limit
    can_spin, spins_today = can_user_spin_today(
        user_id,
        draw.id,
        draw.max_daily_spins_per_user
    )

    draw_data = draw.to_dict(include_prizes=True)
    draw_data['can_spin'] = can_spin
    draw_data['spins_today'] = spins_today

    return jsonify({'lucky_draw': draw_data}), 200


# ============================================
# POST /lucky-draws/:id/spin
# Spin a lucky draw (points redemption)
# ============================================
@bp.route('/<int:draw_id>/spin', methods=['POST'])
@jwt_required()
def spin_draw(draw_id):
    user_id = get_jwt_identity()

    try:
        user_id = int(user_id)
    except:
        return jsonify({'error': 'Invalid user'}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    draw = LuckyDraw.query.get(draw_id)
    if not draw:
        return jsonify({'error': 'Lucky draw not found'}), 404

    # Validation
    if not draw.is_available():
        return jsonify({'error': 'Lucky draw not available'}), 400

    # Check user has enough points
    if user.points_balance < draw.points_cost:
        return jsonify({'error': 'Insufficient points'}), 400

    # Check daily limit
    can_spin, spins_today = can_user_spin_today(
        user_id,
        draw.id,
        draw.max_daily_spins_per_user
    )

    if not can_spin:
        return jsonify({
            'error': f'Daily spin limit reached ({draw.max_daily_spins_per_user} spins)',
            'spins_today': spins_today
        }), 400

    # Select prize
    prize = select_prize(draw_id)
    if not prize:
        return jsonify({'error': 'No prizes available'}), 500

    # Deduct points
    if draw.points_cost > 0:
        user.deduct_points(draw.points_cost)

    # Award prize
    prize_value = {}
    voucher_code = None
    user_reward_id = None
    voucher_expiry = None

    if prize.prize_type == 'points':
        user.add_points(prize.points_amount)
        prize_value = {'points': prize.points_amount}

    elif prize.prize_type == 'reward':
        # Create UserReward
        new_user_reward = UserReward(
            user_id=user_id,
            reward_id=prize.reward_id,
            source_type='lucky_draw',
            status='available',
            expires_at=datetime.utcnow() + timedelta(days=30)  # Default 30 days
        )
        db.session.add(new_user_reward)
        db.session.flush()  # Get ID

        user_reward_id = new_user_reward.id
        prize_value = {
            'reward_id': prize.reward_id,
            'reward_name': prize.reward.name if prize.reward else 'Reward'
        }

    elif prize.prize_type == 'voucher':
        voucher_code = generate_voucher_code()
        voucher_expiry = datetime.utcnow() + timedelta(days=prize.voucher_expiry_days)

        prize_value = {
            'voucher_code': voucher_code,
            'discount_percent': float(prize.voucher_discount_percent) if prize.voucher_discount_percent else None,
            'discount_amount': float(prize.voucher_discount_amount) if prize.voucher_discount_amount else None,
            'description': prize.voucher_description,
            'max_usage': prize.voucher_max_usage,
            'expiry_date': voucher_expiry.isoformat()
        }

    # Update stock
    prize.decrement_stock()
    draw.decrement_spins()

    # Create history record
    history = LuckyDrawHistory(
        user_id=user_id,
        lucky_draw_id=draw_id,
        prize_won_id=prize.id,
        points_spent=draw.points_cost,
        spin_type='points_redemption',
        prize_type=prize.prize_type,
        prize_name=prize.name,
        prize_value_json=json.dumps(prize_value),
        voucher_code=voucher_code,
        user_reward_id=user_reward_id,
        voucher_expiry_date=voucher_expiry,
        is_claimed=True if prize.prize_type == 'points' else False
    )

    db.session.add(history)

    # Update user_reward with lucky_draw_history_id
    if user_reward_id:
        db.session.flush()
        user_reward = UserReward.query.get(user_reward_id)
        user_reward.lucky_draw_history_id = history.id

    db.session.commit()

    # Build response
    return jsonify({
        'success': True,
        'prize': {
            'id': prize.id,
            'type': prize.prize_type,
            'name': prize.name,
            'value': prize_value,
            'image_url': prize.reward.image_url if prize.prize_type == 'reward' and prize.reward else None
        },
        'history_id': history.id,
        'new_points_balance': user.points_balance
    }), 200


# ============================================
# GET /lucky-draws/history
# Get user's spin history
# ============================================
@bp.route('/history', methods=['GET'])
@jwt_required()
def get_spin_history():
    user_id = get_jwt_identity()

    try:
        user_id = int(user_id)
    except:
        return jsonify({'error': 'Invalid user'}), 403

    history = LuckyDrawHistory.query.filter_by(user_id=user_id).order_by(
        LuckyDrawHistory.created_at.desc()
    ).all()

    return jsonify({
        'history': [h.to_dict() for h in history]
    }), 200


# ============================================
# GET /lucky-draws/history/:id
# Get specific spin details
# ============================================
@bp.route('/history/<int:history_id>', methods=['GET'])
@jwt_required()
def get_spin_details(history_id):
    user_id = get_jwt_identity()

    try:
        user_id = int(user_id)
    except:
        return jsonify({'error': 'Invalid user'}), 403

    history = LuckyDrawHistory.query.filter_by(
        id=history_id,
        user_id=user_id
    ).first()

    if not history:
        return jsonify({'error': 'Spin not found'}), 404

    return jsonify({
        'spin': history.to_dict()
    }), 200
```

---

### 5. Update Gamification Routes

#### **File:** `backend/app/routes/gamification.py` (Modify existing)

```python
# ... existing imports ...
from app.models.lucky_draw import LuckyDraw
from app.models.lucky_draw_history import LuckyDrawHistory
from app.models.user_reward import UserReward
from app.utils.lucky_draw_utils import select_prize, generate_voucher_code
import json

# ... keep existing /status route ...

# MODIFY the /check-in route:
@bp.route('/check-in', methods=['POST'])
@jwt_required()
def check_in():
    user_id = get_jwt_identity()

    try:
        user_id = int(user_id)
    except (ValueError, TypeError):
        return jsonify({'error': 'Gamification not available for this user type'}), 403

    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    today = datetime.utcnow().date()

    if user.last_check_in_date == today:
        return jsonify({'error': 'Already checked in today', 'can_check_in': False}), 400

    # Calculate Streak
    if user.last_check_in_date == (today - timedelta(days=1)):
        user.total_streak = (user.total_streak or 0) + 1
    else:
        user.total_streak = 1

    user.last_check_in_date = today

    # Calculate Cycle Day (1-7)
    cycle_day = (user.total_streak - 1) % 7 + 1

    points_to_add = 0
    prize_description = None
    is_lucky_draw = False
    lucky_draw_prize = None

    # Points Logic
    if cycle_day == 1:
        points_to_add = 1
    elif cycle_day == 2:
        points_to_add = 1
    elif cycle_day == 3:
        points_to_add = 2
    elif cycle_day == 4:
        points_to_add = 2
    elif cycle_day == 5:
        points_to_add = 4
    elif cycle_day == 6:
        points_to_add = 7
    elif cycle_day == 7:
        # NEW: Lucky Draw Logic
        # Try to find an active Day 7 lucky draw
        # For now, we'll use ANY merchant's Day 7 draw (multi-merchant support)
        # In future, can filter by user's preferred merchant

        day7_draw = LuckyDraw.query.filter_by(
            is_day7_draw=True,
            is_active=True
        ).first()

        if day7_draw and day7_draw.is_available():
            # Lucky draw exists! Use it
            is_lucky_draw = True

            # Select prize
            prize = select_prize(day7_draw.id)

            if prize:
                # Award prize
                prize_value = {}
                voucher_code = None
                user_reward_id = None
                voucher_expiry = None

                if prize.prize_type == 'points':
                    points_to_add = prize.points_amount
                    prize_value = {'points': prize.points_amount}
                    prize_description = f"{prize.points_amount} Points - {prize.name}"

                elif prize.prize_type == 'reward':
                    # Create UserReward
                    new_user_reward = UserReward(
                        user_id=user_id,
                        reward_id=prize.reward_id,
                        source_type='lucky_draw',
                        status='available',
                        expires_at=datetime.utcnow() + timedelta(days=30)
                    )
                    db.session.add(new_user_reward)
                    db.session.flush()

                    user_reward_id = new_user_reward.id
                    prize_value = {
                        'reward_id': prize.reward_id,
                        'reward_name': prize.reward.name if prize.reward else 'Reward'
                    }
                    prize_description = prize.name

                elif prize.prize_type == 'voucher':
                    voucher_code = generate_voucher_code()
                    voucher_expiry = datetime.utcnow() + timedelta(days=prize.voucher_expiry_days)

                    prize_value = {
                        'voucher_code': voucher_code,
                        'discount_percent': float(prize.voucher_discount_percent) if prize.voucher_discount_percent else None,
                        'discount_amount': float(prize.voucher_discount_amount) if prize.voucher_discount_amount else None,
                        'description': prize.voucher_description,
                        'max_usage': prize.voucher_max_usage,
                        'expiry_date': voucher_expiry.isoformat()
                    }
                    prize_description = prize.name

                # Update stock
                prize.decrement_stock()
                day7_draw.decrement_spins()

                # Create history
                history = LuckyDrawHistory(
                    user_id=user_id,
                    lucky_draw_id=day7_draw.id,
                    prize_won_id=prize.id,
                    points_spent=0,  # Free for Day 7
                    spin_type='day7_checkin',
                    prize_type=prize.prize_type,
                    prize_name=prize.name,
                    prize_value_json=json.dumps(prize_value),
                    voucher_code=voucher_code,
                    user_reward_id=user_reward_id,
                    voucher_expiry_date=voucher_expiry,
                    is_claimed=True if prize.prize_type == 'points' else False
                )
                db.session.add(history)
                db.session.flush()

                # Update user_reward
                if user_reward_id:
                    user_reward = UserReward.query.get(user_reward_id)
                    user_reward.lucky_draw_history_id = history.id

                lucky_draw_prize = {
                    'id': prize.id,
                    'type': prize.prize_type,
                    'name': prize.name,
                    'value': prize_value,
                    'image_url': prize.reward.image_url if prize.prize_type == 'reward' and prize.reward else None
                }
            else:
                # No prize available, fallback to old logic
                is_lucky_draw = False

        # Fallback to old points logic if no lucky draw
        if not is_lucky_draw:
            # Old Day 7 logic
            rand = random.random() * 100
            if rand < 50:
                points_to_add = 7
            elif rand < 80:
                points_to_add = 9
            elif rand < 95:
                points_to_add = 15
            else:
                points_to_add = 20

            prize_description = f"{points_to_add} Points Lucky Draw!"

    # Add Points (if any)
    if points_to_add > 0:
        user.add_points(points_to_add)

    # Record Check In
    check_in_record = DailyCheckIn(
        user_id=user.id,
        check_in_date=today,
        streak_day_count=cycle_day,
        points_earned=points_to_add
    )
    db.session.add(check_in_record)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

    response = {
        'success': True,
        'points_added': points_to_add,
        'new_total_points': user.points_balance or 0.0,
        'points_balance': user.points_balance or 0.0,
        'points_lifetime': user.points_lifetime or 0.0,
        'streak': user.total_streak,
        'cycle_day': cycle_day,
        'prize': prize_description,
        'is_lucky_draw': is_lucky_draw
    }

    if is_lucky_draw and lucky_draw_prize:
        response['lucky_draw_prize'] = lucky_draw_prize

    return jsonify(response), 200
```

---

## 📱 Frontend Implementation

### File Structure
```
app/
├── (merchant-tabs)/
│   └── lucky-draws/
│       ├── index.tsx               # NEW - Lucky draw management list
│       ├── create.tsx              # NEW - Create/edit lucky draw
│       └── [id]/
│           └── prizes.tsx          # NEW - Manage prizes for a draw
├── (tabs)/
│   └── rewards/
│       └── index.tsx               # MODIFY - Add lucky draws section
components/
├── modals/
│   ├── merchant/
│   │   ├── LuckyDrawFormModal.tsx  # NEW
│   │   └── PrizeFormModal.tsx      # NEW
│   └── user/
│       ├── LuckyDrawSpinModal.tsx  # NEW
│       └── SpinHistoryModal.tsx    # NEW
└── lucky-draw/
    ├── LuckyDrawCard.tsx           # NEW - Card display
    ├── PrizeList.tsx               # NEW - Prize list display
    └── SpinAnimation.tsx           # NEW - Spin animation (reuse CheckInSuccess)
```

---

### Implementation Steps

#### **Step 1: Merchant Lucky Draw Management**

**File:** `app/(merchant-tabs)/lucky-draws/index.tsx`

Features:
- List all lucky draws with card view
- Show status badges (Active, Day 7 Draw, Limited Stock)
- Create new lucky draw button
- Edit/Delete/View Statistics actions
- Mark/Unmark as Day 7 draw toggle

**File:** `components/modals/merchant/LuckyDrawFormModal.tsx`

Form fields:
- Name (required)
- Description
- Image upload
- Points cost (number input, 0 for free)
- Is Day 7 Draw? (checkbox - validates points_cost = 0)
- Max daily spins per user (optional)
- Total available spins (optional)
- Start/End dates (date pickers)

**File:** `components/modals/merchant/PrizeFormModal.tsx`

Form fields:
- Prize Type (radio: Points / Reward / Voucher)
- Conditional fields based on type:
  - **Points:** Amount input
  - **Reward:** Dropdown from existing rewards
  - **Voucher:** Discount %, discount amount, description, expiry days
- Prize name
- Probability weight (slider 1-100)
- Stock quantity (optional)

---

#### **Step 2: User Lucky Draw Experience**

**File:** `app/(tabs)/rewards/index.tsx` (Modify existing)

Add new section:
```tsx
{/* Lucky Draws Section */}
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Lucky Draws</Text>

  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
    {luckyDraws.map(draw => (
      <LuckyDrawCard
        key={draw.id}
        draw={draw}
        onPress={() => openSpinModal(draw)}
      />
    ))}
  </ScrollView>
</View>
```

**File:** `components/modals/user/LuckyDrawSpinModal.tsx`

Features:
- Show draw banner image, name, description
- Display prize list (without probabilities)
- Show points cost or "FREE"
- "Spin Now" button
- Trigger spin animation on tap
- Integrate with CheckInSuccess animation for prize reveal

**File:** `components/modals/user/SpinHistoryModal.tsx`

Features:
- List all past spins with date, prize won
- Show voucher codes for voucher prizes
- Link to claim rewards
- Filter options (All / Unclaimed)

---

#### **Step 3: Update Day 7 Check-In Flow**

**File:** `app/(tabs)/index.tsx` or check-in handler

Modify handleCheckIn:
```tsx
const handleCheckIn = async () => {
  try {
    const response = await api.gamification.checkIn();

    if (response.is_lucky_draw) {
      // Show lucky draw animation
      setLuckyDrawPrize(response.lucky_draw_prize);
      setShowLuckyDrawSuccess(true);
    } else {
      // Show normal check-in success
      setShowCheckInSuccess(true);
    }
  } catch (error) {
    // ...
  }
};
```

---

## 🔒 Business Rules

### 1. Day 7 Assignment Rules
- Only ONE lucky draw per merchant can have `is_day7_draw = True`
- Day 7 draws MUST have `points_cost = 0` (free)
- If merchant deactivates Day 7 draw, system falls back to old fixed points logic

### 2. Stock Management
- Prizes can have limited stock (`stock_quantity`)
- Stock decrements atomically on each win
- If all prizes are out of stock, draw becomes unavailable
- Merchants can refill stock via Update Prize API

### 3. Daily Limits
- `max_daily_spins_per_user` limits spins per user per day
- Resets at midnight UTC
- NULL = unlimited spins

### 4. Prize Selection Algorithm
- Weighted random based on `probability_weight`
- Only selects from prizes with `stock_remaining > 0` or `stock_remaining IS NULL`
- If no prizes available, returns error

### 5. Authorization
- Only `is_main = True` branches can create/manage lucky draws
- Same as rewards system
- Sub-branches can view but not edit

### 6. Multi-Merchant
- Users see lucky draws from ALL merchants (for now)
- Future: Filter by selected branch/merchant

---

## 🧪 Testing Checklist

### Backend Testing
- [ ] Create lucky draw with all field variations
- [ ] Assign Day 7 draw (verify only one allowed)
- [ ] Create prizes of all three types
- [ ] Test weighted random selection (run 100 times, verify distribution)
- [ ] Test stock depletion (prize becomes unavailable)
- [ ] Test daily spin limit
- [ ] Test total spin limit
- [ ] Test date range filtering
- [ ] Test Day 7 check-in integration
- [ ] Test points redemption spin
- [ ] Test prize fulfillment (points, rewards, vouchers)
- [ ] Test history tracking
- [ ] Test statistics endpoint

### Frontend Testing
- [ ] Merchant can create lucky draw
- [ ] Merchant can add/edit/delete prizes
- [ ] Merchant can mark as Day 7 draw (validates cost = 0)
- [ ] Merchant sees statistics
- [ ] User sees available lucky draws
- [ ] User can spin paid draw (points deducted)
- [ ] Day 7 check-in shows lucky draw animation
- [ ] Prize reveal animation works for all prize types
- [ ] Spin history shows correctly
- [ ] Voucher codes display properly

---

## 🚀 Implementation Timeline

### Phase 1: Backend (8-10 hours)
**Day 1-2:**
- [ ] Create database models (2h)
- [ ] Write migration script (1h)
- [ ] Implement utility functions (1h)
- [ ] Build merchant APIs (3h)
- [ ] Build user APIs (2h)
- [ ] Update gamification route (1h)

### Phase 2: Merchant Frontend (6-8 hours)
**Day 3-4:**
- [ ] Lucky draw management screen (3h)
- [ ] Lucky draw form modal (2h)
- [ ] Prize form modal (2h)
- [ ] Statistics display (1h)

### Phase 3: User Frontend (5-7 hours)
**Day 5:**
- [ ] Lucky draws section in rewards (2h)
- [ ] Spin modal with animation (3h)
- [ ] History modal (1h)
- [ ] Update Day 7 check-in flow (1h)

### Phase 4: Testing & Polish (3-4 hours)
**Day 6:**
- [ ] Backend testing (2h)
- [ ] Frontend testing (1h)
- [ ] Bug fixes (1h)

**Total Estimated Time:** 22-29 hours

---

## 📝 Migration Script Template

```python
"""Add lucky draw system

Revision ID: xxxxx
Revises: xxxxx
Create Date: 2026-01-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'xxxxx'
down_revision = 'xxxxx'
branch_labels = None
depends_on = None

def upgrade():
    # Create enum types
    op.execute("CREATE TYPE prize_type_enum AS ENUM ('points', 'reward', 'voucher')")
    op.execute("CREATE TYPE spin_type_enum AS ENUM ('day7_checkin', 'points_redemption')")
    op.execute("CREATE TYPE reward_source_enum AS ENUM ('direct_redeem', 'lucky_draw', 'promotion')")

    # Create lucky_draws table
    op.create_table('lucky_draws',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('merchant_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('image_url', sa.String(length=500), nullable=True),
        sa.Column('points_cost', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_day7_draw', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('max_daily_spins_per_user', sa.Integer(), nullable=True),
        sa.Column('total_available_spins', sa.Integer(), nullable=True),
        sa.Column('remaining_spins', sa.Integer(), nullable=True),
        sa.Column('start_date', sa.DateTime(), nullable=True),
        sa.Column('end_date', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=True, onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['merchant_id'], ['merchants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create unique constraint for Day 7 draw
    op.create_index('idx_merchant_day7_draw', 'lucky_draws',
                    ['merchant_id', 'is_day7_draw'],
                    unique=True,
                    postgresql_where=sa.text('is_day7_draw = true'))

    # Create lucky_draw_prizes table
    op.create_table('lucky_draw_prizes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('lucky_draw_id', sa.Integer(), nullable=False),
        sa.Column('prize_type', postgresql.ENUM('points', 'reward', 'voucher', name='prize_type_enum'), nullable=False),
        sa.Column('points_amount', sa.Integer(), nullable=True),
        sa.Column('reward_id', sa.Integer(), nullable=True),
        sa.Column('voucher_discount_percent', sa.Numeric(5, 2), nullable=True),
        sa.Column('voucher_discount_amount', sa.Numeric(10, 2), nullable=True),
        sa.Column('voucher_description', sa.String(200), nullable=True),
        sa.Column('voucher_max_usage', sa.Integer(), server_default='1'),
        sa.Column('voucher_expiry_days', sa.Integer(), server_default='30'),
        sa.Column('probability_weight', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('stock_quantity', sa.Integer(), nullable=True),
        sa.Column('stock_remaining', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('display_order', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['lucky_draw_id'], ['lucky_draws.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reward_id'], ['rewards.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create lucky_draw_history table
    op.create_table('lucky_draw_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('lucky_draw_id', sa.Integer(), nullable=False),
        sa.Column('prize_won_id', sa.Integer(), nullable=False),
        sa.Column('points_spent', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('spin_type', postgresql.ENUM('day7_checkin', 'points_redemption', name='spin_type_enum'), nullable=False),
        sa.Column('prize_type', sa.String(20), nullable=False),
        sa.Column('prize_name', sa.String(100), nullable=False),
        sa.Column('prize_value_json', sa.Text(), nullable=True),
        sa.Column('voucher_code', sa.String(50), nullable=True, unique=True),
        sa.Column('user_reward_id', sa.Integer(), nullable=True),
        sa.Column('voucher_expiry_date', sa.DateTime(), nullable=True),
        sa.Column('is_claimed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('claimed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['lucky_draw_id'], ['lucky_draws.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['prize_won_id'], ['lucky_draw_prizes.id']),
        sa.ForeignKeyConstraint(['user_reward_id'], ['user_rewards.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # Add columns to user_rewards
    op.add_column('user_rewards',
        sa.Column('source_type', postgresql.ENUM('direct_redeem', 'lucky_draw', 'promotion', name='reward_source_enum'),
                  nullable=False, server_default='direct_redeem'))
    op.add_column('user_rewards',
        sa.Column('lucky_draw_history_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_user_rewards_lucky_draw_history',
                         'user_rewards', 'lucky_draw_history',
                         ['lucky_draw_history_id'], ['id'])

    # Create indexes
    op.create_index('idx_lucky_draws_merchant', 'lucky_draws', ['merchant_id'])
    op.create_index('idx_lucky_draws_active', 'lucky_draws', ['is_active'])
    op.create_index('idx_prizes_draw', 'lucky_draw_prizes', ['lucky_draw_id'])
    op.create_index('idx_history_user_date', 'lucky_draw_history', ['user_id', 'created_at'])
    op.create_index('idx_history_draw', 'lucky_draw_history', ['lucky_draw_id'])

def downgrade():
    # Drop indexes
    op.drop_index('idx_history_draw')
    op.drop_index('idx_history_user_date')
    op.drop_index('idx_prizes_draw')
    op.drop_index('idx_lucky_draws_active')
    op.drop_index('idx_lucky_draws_merchant')
    op.drop_index('idx_merchant_day7_draw')

    # Drop user_rewards columns
    op.drop_constraint('fk_user_rewards_lucky_draw_history', 'user_rewards')
    op.drop_column('user_rewards', 'lucky_draw_history_id')
    op.drop_column('user_rewards', 'source_type')

    # Drop tables
    op.drop_table('lucky_draw_history')
    op.drop_table('lucky_draw_prizes')
    op.drop_table('lucky_draws')

    # Drop enums
    op.execute('DROP TYPE reward_source_enum')
    op.execute('DROP TYPE spin_type_enum')
    op.execute('DROP TYPE prize_type_enum')
```

---

## ✅ Ready to Implement

This document provides complete specifications for implementing the Lucky Draw system. All database schemas, API endpoints, business logic, and frontend requirements are defined.

**Next Steps:**
1. Review this document
2. Confirm all requirements are correct
3. Begin implementation starting with Phase 1 (Backend)

Let me know when you're ready to start! 🚀
