from flask import Blueprint, request, jsonify
from app import db
from app.models.merchant import Branch
from app.models.reward import Reward, UserReward
from app.models.user import User
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta

bp = Blueprint('rewards', __name__, url_prefix='/rewards')

def get_current_branch():
    """Get the currently authenticated branch from JWT"""
    identity = get_jwt_identity()
    if not identity:
        return None

    # Handle branch identity format: "m_X_b_Y"
    if isinstance(identity, str) and identity.startswith('m_'):
        try:
            parts = identity.split('_')
            branch_id = parts[3]
            return Branch.query.get(branch_id)
        except:
            return None
    return None


def get_current_user():
    """Get the currently authenticated user (customer) from JWT"""
    identity = get_jwt_identity()
    if not identity:
        return None

    # Handle user identity (integer user_id for customers) - JWT returns string
    try:
        user_id = int(identity)
        return User.query.get(user_id)
    except (ValueError, TypeError):
        return None


# Rank hierarchy for access control
RANK_HIERARCHY = {
    'bronze': 0,
    'silver': 1,
    'gold': 2,
    'platinum': 3
}


# --- REWARD MANAGEMENT (is_main only) ---

@bp.route('', methods=['GET'])
@jwt_required()
def get_rewards():
    """Get all rewards for the merchant (with optional filters)"""
    current_branch = get_current_branch()
    if not current_branch:
        return jsonify({'error': 'Unauthorized'}), 401

    # Build query for merchant's rewards
    query = Reward.query.filter_by(merchant_id=current_branch.merchant_id)

    # Filter by category if provided
    category = request.args.get('category')
    if category:
        query = query.filter_by(category=category)

    # Filter by branch if provided
    branch_filter = request.args.get('branch_id')
    if branch_filter:
        if branch_filter == 'all':
            # Show merchant-wide rewards only (branch_id = null)
            query = query.filter(Reward.branch_id.is_(None))
        else:
            # Show specific branch rewards
            query = query.filter_by(branch_id=int(branch_filter))

    # Filter by active status
    active_only = request.args.get('active_only', 'false').lower() == 'true'
    if active_only:
        query = query.filter_by(is_active=True)

    # Sort by sort_order, then by created_at
    rewards = query.order_by(Reward.sort_order, Reward.created_at.desc()).all()

    return jsonify([r.to_dict() for r in rewards]), 200


@bp.route('', methods=['POST'])
@jwt_required()
def create_reward():
    """Create a new reward (is_main branch only)"""
    current_branch = get_current_branch()
    if not current_branch:
        return jsonify({'error': 'Unauthorized'}), 401

    # Only is_main branch can create rewards
    if not current_branch.is_main:
        return jsonify({'error': 'Only main branch can create rewards'}), 403

    data = request.get_json()

    # Validate required fields
    if not data.get('title') or not data.get('points_cost'):
        return jsonify({'error': 'Title and points_cost are required'}), 400

    # Create reward
    reward = Reward(
        merchant_id=current_branch.merchant_id,
        branch_id=data.get('branch_id'),  # null = merchant-wide
        title=data['title'],
        description=data.get('description'),
        image_url=data.get('image_url'),
        category=data.get('category'),
        points_cost=data['points_cost'],
        min_rank_required=data.get('min_rank_required', 'bronze'),
        
        # New Reward Logic Fields
        reward_type=data.get('reward_type', 'free_item'),
        target_scope=data.get('target_scope', 'custom'),
        target_id=data.get('target_id'),
        is_custom=data.get('is_custom', True),
        discount_value=data.get('discount_value'),

        is_active=data.get('is_active', True),
        stock_quantity=data.get('stock_quantity'),
        available_stock=data.get('stock_quantity'),  # Initialize to same as stock_quantity
        validity_days=data.get('validity_days', 30),
        redemption_limit_per_user=data.get('redemption_limit_per_user'),
        terms_and_conditions=data.get('terms_and_conditions'),
        sort_order=data.get('sort_order', 0)
    )

    db.session.add(reward)
    db.session.commit()

    return jsonify(reward.to_dict()), 201


@bp.route('/<int:id>', methods=['GET'])
@jwt_required()
def get_reward(id):
    """Get a single reward by ID"""
    current_branch = get_current_branch()
    current_user = None
    
    if not current_branch:
        current_user = get_current_user()

    if not current_branch and not current_user:
        return jsonify({'error': 'Unauthorized'}), 401

    reward = Reward.query.get(id)
    if not reward:
        return jsonify({'error': 'Reward not found'}), 404

    # If merchant, enforce ownership check
    if current_branch:
        if reward.merchant_id != current_branch.merchant_id:
            return jsonify({'error': 'Access denied'}), 403

    return jsonify(reward.to_dict()), 200


@bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_reward(id):
    """Update a reward (is_main branch only)"""
    current_branch = get_current_branch()
    if not current_branch:
        return jsonify({'error': 'Unauthorized'}), 401

    # Only is_main branch can update rewards
    if not current_branch.is_main:
        return jsonify({'error': 'Only main branch can update rewards'}), 403

    reward = Reward.query.get(id)
    if not reward:
        return jsonify({'error': 'Reward not found'}), 404

    # Check if reward belongs to merchant
    if reward.merchant_id != current_branch.merchant_id:
        return jsonify({'error': 'Access denied'}), 403

    data = request.get_json()

    # Update fields
    if 'title' in data:
        reward.title = data['title']
    if 'description' in data:
        reward.description = data['description']
    if 'image_url' in data:
        reward.image_url = data['image_url']
    if 'category' in data:
        reward.category = data['category']
    if 'points_cost' in data:
        reward.points_cost = data['points_cost']
    if 'min_rank_required' in data:
        reward.min_rank_required = data['min_rank_required']
    if 'is_active' in data:
        reward.is_active = data['is_active']
    if 'stock_quantity' in data:
        # When updating stock_quantity, also update available_stock
        old_stock = reward.stock_quantity or 0
        new_stock = data['stock_quantity']
        if new_stock is not None:
            # Calculate difference and apply to available_stock
            difference = new_stock - old_stock
            reward.stock_quantity = new_stock
            reward.available_stock = (reward.available_stock or 0) + difference
        else:
            # Setting to unlimited
            reward.stock_quantity = None
            reward.available_stock = None
    if 'validity_days' in data:
        reward.validity_days = data['validity_days']
    if 'redemption_limit_per_user' in data:
        reward.redemption_limit_per_user = data['redemption_limit_per_user']
    if 'terms_and_conditions' in data:
        reward.terms_and_conditions = data['terms_and_conditions']
    if 'sort_order' in data:
        reward.sort_order = data['sort_order']
    if 'branch_id' in data:
        reward.branch_id = data['branch_id']
    
    # New Reward Logic Fields Updates (though mainly immutable, allowing update just in case)
    if 'reward_type' in data:
        reward.reward_type = data['reward_type']
    if 'target_scope' in data:
        reward.target_scope = data['target_scope']
    if 'target_id' in data:
        reward.target_id = data['target_id']
    if 'is_custom' in data:
        reward.is_custom = data['is_custom']
    if 'discount_value' in data:
        reward.discount_value = data['discount_value']

    reward.updated_at = datetime.utcnow()

    db.session.commit()

    return jsonify(reward.to_dict()), 200


@bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_reward(id):
    """Delete a reward (is_main branch only)"""
    current_branch = get_current_branch()
    if not current_branch:
        return jsonify({'error': 'Unauthorized'}), 401

    # Only is_main branch can delete rewards
    if not current_branch.is_main:
        return jsonify({'error': 'Only main branch can delete rewards'}), 403

    reward = Reward.query.get(id)
    if not reward:
        return jsonify({'error': 'Reward not found'}), 404

    # Check if reward belongs to merchant
    if reward.merchant_id != current_branch.merchant_id:
        return jsonify({'error': 'Access denied'}), 403

    # Check if there are active redemptions
    active_redemptions = UserReward.query.filter_by(
        reward_id=id,
        status='active'
    ).count()

    if active_redemptions > 0:
        return jsonify({
            'error': f'Cannot delete reward with {active_redemptions} active redemptions'
        }), 400

    db.session.delete(reward)
    db.session.commit()

    return jsonify({'message': 'Reward deleted successfully'}), 200


@bp.route('/categories', methods=['GET'])
@jwt_required()
def get_reward_categories():
    """Get list of unique reward categories for this merchant"""
    current_branch = get_current_branch()
    if not current_branch:
        return jsonify({'error': 'Unauthorized'}), 401

    # Get distinct categories
    categories = db.session.query(Reward.category).filter(
        Reward.merchant_id == current_branch.merchant_id,
        Reward.category.isnot(None)
    ).distinct().all()

    # Extract category strings from tuples
    category_list = [cat[0] for cat in categories if cat[0]]

    return jsonify(category_list), 200


@bp.route('/available', methods=['GET'])
@jwt_required()
def get_available_rewards():
    """Get all available rewards for customers"""
    # Verify user is a customer
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Unauthorized'}), 401

    # Get all active rewards
    query = Reward.query.filter_by(is_active=True)

    # Filter by category if provided
    category = request.args.get('category')
    if category:
        query = query.filter_by(category=category)

    # Sort by sort_order, then by points_cost (cheapest first)
    rewards = query.order_by(Reward.sort_order, Reward.points_cost.asc()).all()

    return jsonify([r.to_dict() for r in rewards]), 200


# --- CUSTOMER REDEMPTION ---

@bp.route('/<int:id>/redeem', methods=['POST'])
@jwt_required()
def redeem_reward(id):
    """Customer redeems a reward with their points"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Unauthorized'}), 401

    reward = Reward.query.get(id)
    if not reward:
        return jsonify({'error': 'Reward not found'}), 404

    # Check if reward is active
    if not reward.is_active:
        return jsonify({'error': 'This reward is no longer available'}), 400

    # Check stock availability
    if reward.stock_quantity is not None and (reward.available_stock or 0) <= 0:
        return jsonify({'error': 'This reward is out of stock'}), 400

    # Check rank requirement
    user_rank_level = RANK_HIERARCHY.get(current_user.rank, 0)
    required_rank_level = RANK_HIERARCHY.get(reward.min_rank_required, 0)

    if user_rank_level < required_rank_level:
        return jsonify({
            'error': f'You need {reward.min_rank_required} rank or higher to redeem this reward'
        }), 403

    # Check points balance
    if current_user.points_balance < reward.points_cost:
        return jsonify({
            'error': f'Insufficient points. You need {reward.points_cost} points but have {current_user.points_balance}'
        }), 400

    # Check redemption limit per user
    if reward.redemption_limit_per_user:
        existing_redemptions = UserReward.query.filter_by(
            user_id=current_user.id,
            reward_id=reward.id
        ).count()

        if existing_redemptions >= reward.redemption_limit_per_user:
            return jsonify({
                'error': f'You have reached the maximum redemption limit ({reward.redemption_limit_per_user}) for this reward'
            }), 400

    # Calculate expiry date
    expires_at = datetime.utcnow() + timedelta(days=reward.validity_days)

    # Generate unique redemption code
    redemption_code = UserReward.generate_redemption_code()
    # Ensure uniqueness
    while UserReward.query.filter_by(redemption_code=redemption_code).first():
        redemption_code = UserReward.generate_redemption_code()

    # Create redemption record
    user_reward = UserReward(
        user_id=current_user.id,
        reward_id=reward.id,
        merchant_id=reward.merchant_id,
        points_spent=reward.points_cost,
        redemption_code=redemption_code,
        status='active',
        expires_at=expires_at
    )

    # Deduct points from balance (but not from lifetime)
    current_user.deduct_points(reward.points_cost)

    # Decrease available stock if applicable
    if reward.stock_quantity is not None:
        reward.available_stock = (reward.available_stock or 0) - 1

    db.session.add(user_reward)
    db.session.commit()

    return jsonify({
        'message': 'Reward redeemed successfully',
        'redemption': user_reward.to_dict(),
        'remaining_balance': current_user.points_balance
    }), 201


@bp.route('/my-rewards', methods=['GET'])
@jwt_required()
def get_my_rewards():
    """Get current user's redeemed rewards"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Unauthorized'}), 401

    # Filter by status if provided
    status = request.args.get('status')
    query = UserReward.query.filter_by(user_id=current_user.id)

    if status:
        query = query.filter_by(status=status)

    # Get rewards ordered by redemption date
    rewards = query.order_by(UserReward.redeemed_at.desc()).all()

    # Auto-expire old rewards
    now = datetime.utcnow()
    for reward in rewards:
        if reward.status == 'active' and reward.is_expired():
            reward.status = 'expired'

    db.session.commit()

    return jsonify([r.to_dict() for r in rewards]), 200


# --- MERCHANT VALIDATION ---

@bp.route('/preview', methods=['POST'])
@jwt_required()
def preview_redemption():
    """Preview redemption details without marking as used (for validation modal)"""
    current_branch = get_current_branch()
    if not current_branch:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    redemption_code = data.get('redemption_code')

    if not redemption_code:
        return jsonify({'error': 'Redemption code is required'}), 400

    # Find the redemption
    user_reward = UserReward.query.filter_by(
        redemption_code=redemption_code.upper()
    ).first()

    if not user_reward:
        return jsonify({'error': 'Invalid redemption code'}), 404

    # Check if belongs to same merchant
    if user_reward.merchant_id != current_branch.merchant_id:
        return jsonify({'error': 'This reward belongs to a different merchant'}), 403

    # Get the reward details
    reward = Reward.query.get(user_reward.reward_id)
    if not reward:
        return jsonify({'error': 'Reward not found'}), 404

    # Get user details
    user = User.query.get(user_reward.user_id)

    # Check branch permission
    can_redeem = True
    error_message = None
    if reward.branch_id is not None and reward.branch_id != current_branch.id:
        can_redeem = False
        allowed_branch = Branch.query.get(reward.branch_id)
        branch_name = allowed_branch.name if allowed_branch else f"Branch #{reward.branch_id}"
        error_message = f'This reward can only be redeemed at {branch_name}'

    # Check status
    if user_reward.status == 'used':
        can_redeem = False
        error_message = 'This reward has already been used'
    elif user_reward.status == 'expired' or user_reward.is_expired():
        can_redeem = False
        error_message = 'This reward has expired'
    elif user_reward.status == 'cancelled':
        can_redeem = False
        error_message = 'This reward has been cancelled'

    return jsonify({
        'can_redeem': can_redeem,
        'error_message': error_message,
        'redemption': user_reward.to_dict(),
        'reward': reward.to_dict(),
        'user': {
            'username': user.username if user else 'Unknown',
            'rank': user.rank if user else 'bronze'
        }
    }), 200


@bp.route('/validate', methods=['POST'])
@jwt_required()
def validate_redemption():
    """Validate and use a redemption code (merchant branch)"""
    current_branch = get_current_branch()
    if not current_branch:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    redemption_code = data.get('redemption_code')

    if not redemption_code:
        return jsonify({'error': 'Redemption code is required'}), 400

    # Find the redemption
    user_reward = UserReward.query.filter_by(
        redemption_code=redemption_code.upper()
    ).first()

    if not user_reward:
        return jsonify({'error': 'Invalid redemption code'}), 404

    # Check if belongs to same merchant
    if user_reward.merchant_id != current_branch.merchant_id:
        return jsonify({'error': 'This reward belongs to a different merchant'}), 403

    # Get the reward details to check branch permissions
    reward = Reward.query.get(user_reward.reward_id)
    if not reward:
        return jsonify({'error': 'Reward not found'}), 404

    # Check branch permission: if reward is branch-specific, only that branch can validate
    if reward.branch_id is not None and reward.branch_id != current_branch.id:
        # Get the allowed branch name for better error message
        allowed_branch = Branch.query.get(reward.branch_id)
        branch_name = allowed_branch.name if allowed_branch else f"Branch #{reward.branch_id}"
        return jsonify({
            'error': f'This reward can only be redeemed at {branch_name}',
            'allowed_branch_id': reward.branch_id,
            'current_branch_id': current_branch.id
        }), 403

    # Check if already used
    if user_reward.status == 'used':
        return jsonify({
            'error': 'This reward has already been used',
            'used_at': user_reward.used_at.isoformat() if user_reward.used_at else None,
            'used_by_branch': user_reward.used_by_branch_id
        }), 400

    # Check if expired
    if user_reward.status == 'expired' or user_reward.is_expired():
        user_reward.status = 'expired'
        db.session.commit()
        return jsonify({'error': 'This reward has expired'}), 400

    # Check if cancelled
    if user_reward.status == 'cancelled':
        return jsonify({'error': 'This reward has been cancelled'}), 400

    # Mark as used
    user_reward.status = 'used'
    user_reward.used_at = datetime.utcnow()
    user_reward.used_by_branch_id = current_branch.id

    db.session.commit()

    return jsonify({
        'message': 'Reward validated and marked as used',
        'redemption': user_reward.to_dict()
    }), 200


@bp.route('/redemptions', methods=['GET'])
@jwt_required()
def get_redemptions():
    """Get list of redemptions for merchant (all branches or specific)"""
    current_branch = get_current_branch()
    if not current_branch:
        return jsonify({'error': 'Unauthorized'}), 401

    # Build query for merchant's redemptions
    query = UserReward.query.filter_by(merchant_id=current_branch.merchant_id)

    # Filter by branch if provided (only is_main can filter)
    branch_filter = request.args.get('branch_id')
    if branch_filter and current_branch.is_main:
        if branch_filter != 'all':
            query = query.filter_by(used_by_branch_id=int(branch_filter))
    else:
        # Non-main branches can only see their own redemptions
        if not current_branch.is_main:
            query = query.filter_by(used_by_branch_id=current_branch.id)

    # Filter by status
    status = request.args.get('status')
    if status:
        query = query.filter_by(status=status)

    # Sort by redemption date
    redemptions = query.order_by(UserReward.redeemed_at.desc()).all()

    return jsonify([r.to_dict() for r in redemptions]), 200
