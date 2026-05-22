from app import db
from datetime import datetime, timedelta
import uuid6

class Order(db.Model):
    """
    Model for food ordering system.
    Tracks customer orders with items, options, and payment.
    """
    __tablename__ = 'orders'

    # Single source of truth for the payment window. Changing this value updates
    # the backend scheduler, lazy-expire helper, and the frontend countdown —
    # `expires_at` is surfaced in to_dict() so clients never hardcode it.
    PAYMENT_TIMEOUT_MINUTES = 5

    # Primary Keys and Foreign Keys
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid6.uuid7()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, index=True)
    branch_id = db.Column(db.String(36), db.ForeignKey('branches.id'), nullable=False, index=True)

    # Order Information
    order_number = db.Column(db.String(20), unique=True, nullable=False, index=True)  # e.g., LVH240225001
    order_type = db.Column(db.String(20), nullable=False)  # 'dine_in' or 'pickup'
    table_number = db.Column(db.String(10), nullable=True)  # Required for dine_in

    # Order Data (stored as JSON snapshot)
    items = db.Column(db.JSON, nullable=False)  # Full cart snapshot with selected options
    subtotal = db.Column(db.Float, nullable=False)
    total = db.Column(db.Float, nullable=False)
    points_earned = db.Column(db.Integer, default=0)  # Loyalty points awarded

    # Voucher/Discount Information
    voucher_code = db.Column(db.String(20), nullable=True)  # Redemption code from UserReward
    voucher_discount = db.Column(db.Float, default=0)  # Discount amount applied

    # Status Tracking
    status = db.Column(
        db.String(20),
        nullable=False,
        default='pending',
        index=True
    )  # pending → confirmed → preparing → ready → completed → cancelled

    payment_status = db.Column(
        db.String(20),
        nullable=False,
        default='pending',
        index=True
    )  # pending, paid, failed

    payment_id = db.Column(db.String(36), nullable=True)  # Link to Payment model (if exists)

    # Additional Notes
    notes = db.Column(db.Text, nullable=True)  # Special instructions from customer

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    user = db.relationship('User', backref=db.backref('orders', lazy='dynamic'))
    branch = db.relationship('Branch', backref=db.backref('orders', lazy='dynamic'))

    def __repr__(self):
        return f'<Order {self.order_number} - {self.status}>'

    @staticmethod
    def generate_order_number():
        """
        Generate unique order number in format: LVH + YYMMDD + 4-digit counter
        Example: LVH240225001
        """
        today = datetime.now().strftime('%y%m%d')
        prefix = f'LVH{today}'

        # Count orders with same date prefix
        count = Order.query.filter(
            Order.order_number.like(f'{prefix}%')
        ).count() + 1

        return f'{prefix}{count:04d}'

    def to_dict(self, include_user=False, include_branch=False):
        """Convert order to dictionary for API responses"""
        data = {
            'id': self.id,
            'order_number': self.order_number,
            'order_type': self.order_type,
            'table_number': self.table_number,
            'items': self.items,
            'subtotal': self.subtotal,
            'total': self.total,
            'points_earned': self.points_earned,
            'voucher_code': self.voucher_code,
            'voucher_discount': self.voucher_discount,
            'status': self.status,
            'payment_status': self.payment_status,
            'payment_id': self.payment_id,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None,
            'updated_at': self.updated_at.isoformat() + 'Z' if self.updated_at else None,
            'expires_at': (self.created_at + timedelta(minutes=self.PAYMENT_TIMEOUT_MINUTES)).isoformat() + 'Z' if self.created_at else None,
        }

        if include_user and self.user:
            data['user'] = {
                'id': self.user.id,
                'username': self.user.username,
                'email': self.user.email,
                'phone': self.user.phone
            }

        if include_branch and self.branch:
            data['branch'] = {
                'id': self.branch.id,
                'name': self.branch.name,
                'location': self.branch.location
            }

        return data

    @staticmethod
    def get_status_transitions():
        """
        Define allowed status transitions.
        Returns dict of current_status -> allowed_next_statuses
        """
        return {
            'pending': ['confirmed', 'cancelled'],
            'confirmed': ['preparing', 'cancelled'],
            'preparing': ['ready'],
            'ready': ['completed'],
            'completed': [],  # Final state
            'cancelled': []   # Final state
        }

    def can_transition_to(self, new_status):
        """Check if order can transition to new status"""
        allowed = self.get_status_transitions().get(self.status, [])
        return new_status in allowed

    def get_item_count(self):
        """Get total number of items in order"""
        if not self.items:
            return 0
        return sum(item.get('quantity', 0) for item in self.items)
