from app import db
from datetime import datetime, timedelta
import secrets
import string

class Reward(db.Model):
    __tablename__ = 'rewards'

    id = db.Column(db.Integer, primary_key=True)
    merchant_id = db.Column(db.Integer, db.ForeignKey('merchants.id'), nullable=False)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=True)  # null = all branches

    # Content
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    image_url = db.Column(db.String(500))
    category = db.Column(db.String(50))  # Display Category: 'food', 'beverage', 'merchandise', 'discount'
    
    # New Reward Logic Fields
    is_custom = db.Column(db.Boolean, default=True) # True = Manual Title/Desc, False = Linked to system item
    reward_type = db.Column(db.String(50), default='free_item') # 'free_item', 'discount_percentage', 'discount_fixed'
    target_scope = db.Column(db.String(50), default='custom') # 'order', 'product', 'category', 'custom'
    target_id = db.Column(db.Integer, nullable=True) # Linked Product ID or Category ID
    discount_value = db.Column(db.Float, nullable=True) # Amount or Percentage

    # Pricing & Access
    points_cost = db.Column(db.Integer, nullable=False)
    min_rank_required = db.Column(db.String(20), default='bronze')  # bronze/silver/gold/platinum

    # Availability
    is_active = db.Column(db.Boolean, default=True)
    stock_quantity = db.Column(db.Integer, nullable=True)  # null = unlimited
    available_stock = db.Column(db.Integer, nullable=True)

    # Rules
    validity_days = db.Column(db.Integer, default=30)
    redemption_limit_per_user = db.Column(db.Integer, nullable=True)  # null = unlimited
    terms_and_conditions = db.Column(db.Text)
    sort_order = db.Column(db.Integer, default=0)

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    merchant = db.relationship('Merchant', backref='rewards', foreign_keys=[merchant_id])
    redemptions = db.relationship('UserReward', backref='reward', lazy='dynamic')

    def to_dict(self):
        # Resolve target name dynamically
        target_name = None
        if self.target_id:
            try:
                if self.target_scope == 'product':
                    from app.models.menu import Product
                    product = Product.query.get(self.target_id)
                    if product:
                        target_name = product.name
                elif self.target_scope == 'category':
                    from app.models.menu import MenuCategory
                    category = MenuCategory.query.get(self.target_id)
                    if category:
                        target_name = category.name
            except Exception:
                pass # Fail silently if linked item missing

        # Resolve branch name if specific
        branch_name = None
        if self.branch_id:
            try:
                from app.models.merchant import Branch
                branch = Branch.query.get(self.branch_id)
                if branch:
                    branch_name = branch.name
            except Exception: pass

        return {
            'id': self.id,
            'merchant_id': self.merchant_id,
            'branch_id': self.branch_id,
            'branch_name': branch_name, # New Field
            'title': self.title,
            'description': self.description,
            'image_url': self.image_url,
            'category': self.category,
            'is_custom': self.is_custom,
            'reward_type': self.reward_type,
            'target_scope': self.target_scope,
            'target_id': self.target_id,
            'target_name': target_name,
            'discount_value': self.discount_value,
            'points_cost': self.points_cost,
            'min_rank_required': self.min_rank_required,
            'is_active': self.is_active,
            'stock_quantity': self.stock_quantity,
            'available_stock': self.available_stock,
            'validity_days': self.validity_days,
            'redemption_limit_per_user': self.redemption_limit_per_user,
            'terms_and_conditions': self.terms_and_conditions,
            'sort_order': self.sort_order,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    def __repr__(self):
        return f'<Reward {self.title}>'


class UserReward(db.Model):
    __tablename__ = 'user_rewards'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    reward_id = db.Column(db.Integer, db.ForeignKey('rewards.id'), nullable=False)
    merchant_id = db.Column(db.Integer, db.ForeignKey('merchants.id'))

    # Redemption Details
    points_spent = db.Column(db.Integer, nullable=False)
    redemption_code = db.Column(db.String(20), unique=True, nullable=False)  # QR code value

    # Status & Timing
    status = db.Column(db.String(20), default='active')  # active/used/expired/cancelled
    redeemed_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime)

    # Usage Tracking
    used_at = db.Column(db.DateTime, nullable=True)
    used_by_branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=True)

    # Relationships
    user = db.relationship('User', backref='redeemed_rewards')

    def to_dict(self):
        used_at_branch_name = None
        valid_at_branch_name = None
        
        from app.models.merchant import Branch

        if self.used_by_branch_id:
            try:
                branch = Branch.query.get(self.used_by_branch_id)
                if branch:
                    used_at_branch_name = branch.name
            except: pass

        if self.reward and self.reward.branch_id:
            try:
                branch = Branch.query.get(self.reward.branch_id)
                if branch:
                    valid_at_branch_name = branch.name
            except: pass

        return {
            'id': self.id,
            'user_id': self.user_id,
            'reward_id': self.reward_id,
            'merchant_id': self.merchant_id,
            'points_spent': self.points_spent,
            'redemption_code': self.redemption_code,
            'status': self.status,
            'redeemed_at': self.redeemed_at.isoformat() if self.redeemed_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'used_at': self.used_at.isoformat() if self.used_at else None,
            'used_by_branch_id': self.used_by_branch_id,
            'used_at_branch_name': used_at_branch_name,  # New
            'valid_at_branch_name': valid_at_branch_name, # New
            'reward': self.reward.to_dict() if self.reward else None
        }

    @staticmethod
    def generate_redemption_code():
        """Generate a unique 8-character redemption code"""
        return ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))

    def is_expired(self):
        """Check if reward has expired"""
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return True
        return False

    def __repr__(self):
        return f'<UserReward {self.redemption_code}>'


# DEPRECATED: Keep for backward compatibility, will be removed in future
class UserVoucher(db.Model):
    __tablename__ = 'user_vouchers'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    reward_id = db.Column(db.Integer, db.ForeignKey('rewards.id'), nullable=False)
    unique_code = db.Column(db.String(50), unique=True, nullable=False)
    is_used = db.Column(db.Boolean, default=False)
    used_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref='vouchers')
    reward = db.relationship('Reward')

    def __repr__(self):
        return f'<UserVoucher {self.unique_code} used={self.is_used}>'
