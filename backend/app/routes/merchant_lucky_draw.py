from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.merchant import Branch
from app.models.lucky_draw import LuckyDraw
from app.models.lucky_draw_prize import LuckyDrawPrize
from app.models.lucky_draw_history import LuckyDrawHistory
from app.models.reward import Reward
from datetime import datetime
from sqlalchemy import func

bp = Blueprint('merchant_lucky_draw', __name__, url_prefix='/merchant/lucky-draws')


def get_current_branch():
    """Helper to get current authenticated branch"""
    identity = get_jwt_identity()

    # Identity format: "m_{merchant_id}_b_{branch_id}"
    if not identity or not identity.startswith('m_'):
        return None, {'error': 'Unauthorized'}, 401

    try:
        parts = identity.split('_')
        branch_id = parts[3]
        branch = Branch.query.get(branch_id)

        if not branch:
            return None, {'error': 'Branch not found'}, 404

        if not branch.is_main:
            return None, {'error': 'Only main branch can manage lucky draws'}, 403

        return branch, None, None
    except:
        return None, {'error': 'Invalid authentication'}, 401


@bp.route('', methods=['POST'])
@jwt_required()
def create_lucky_draw():
    """Create a new lucky draw"""
    branch, error, status = get_current_branch()
    if error:
        return jsonify(error), status

    data = request.get_json()

    # Validate required fields
    if not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400

    points_cost = data.get('points_cost', 0)
    is_day7_draw = data.get('is_day7_draw', False)

    # Validation: Day 7 draw must be free
    if is_day7_draw and points_cost != 0:
        return jsonify({'error': 'Day 7 lucky draw must be free (points_cost = 0)'}), 400

    # Validation: Only one Day 7 draw per merchant
    if is_day7_draw:
        existing_day7 = LuckyDraw.query.filter_by(
            merchant_id=branch.merchant_id,
            is_day7_draw=True
        ).first()

        if existing_day7:
            return jsonify({'error': 'Only one Day 7 lucky draw allowed per merchant. Please deactivate the existing one first.'}), 400

    # Parse dates if provided
    start_date = None
    end_date = None

    if data.get('start_date'):
        try:
            start_date = datetime.fromisoformat(data['start_date'].replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'error': 'Invalid start_date format'}), 400

    if data.get('end_date'):
        try:
            end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'error': 'Invalid end_date format'}), 400

    # Create lucky draw
    lucky_draw = LuckyDraw(
        merchant_id=branch.merchant_id,
        name=data['name'],
        description=data.get('description'),
        image_url=data.get('image_url'),
        points_cost=points_cost,
        is_active=data.get('is_active', True),
        is_day7_draw=is_day7_draw,
        max_daily_spins_per_user=data.get('max_daily_spins_per_user'),
        total_available_spins=data.get('total_available_spins'),
        remaining_spins=data.get('total_available_spins'),  # Initialize remaining = total
        start_date=start_date,
        end_date=end_date
    )

    db.session.add(lucky_draw)
    db.session.commit()

    return jsonify({
        'message': 'Lucky draw created successfully',
        'lucky_draw': lucky_draw.to_dict()
    }), 201


@bp.route('', methods=['GET'])
@jwt_required()
def get_lucky_draws():
    """Get all lucky draws for the merchant"""
    branch, error, status = get_current_branch()
    if error:
        return jsonify(error), status

    lucky_draws = LuckyDraw.query.filter_by(
        merchant_id=branch.merchant_id
    ).order_by(LuckyDraw.created_at.desc()).all()

    return jsonify({
        'lucky_draws': [ld.to_dict() for ld in lucky_draws]
    }), 200


@bp.route('/<draw_id>', methods=['GET'])
@jwt_required()
def get_lucky_draw(draw_id):
    """Get a specific lucky draw with prizes"""
    branch, error, status = get_current_branch()
    if error:
        return jsonify(error), status

    lucky_draw = LuckyDraw.query.filter_by(
        id=draw_id,
        merchant_id=branch.merchant_id
    ).first()

    if not lucky_draw:
        return jsonify({'error': 'Lucky draw not found'}), 404

    return jsonify(lucky_draw.to_dict(include_prizes=True)), 200


@bp.route('/<draw_id>', methods=['PUT'])
@jwt_required()
def update_lucky_draw(draw_id):
    """Update a lucky draw"""
    branch, error, status = get_current_branch()
    if error:
        return jsonify(error), status

    lucky_draw = LuckyDraw.query.filter_by(
        id=draw_id,
        merchant_id=branch.merchant_id
    ).first()

    if not lucky_draw:
        return jsonify({'error': 'Lucky draw not found'}), 404

    data = request.get_json()

    # Check if trying to change is_day7_draw status
    new_is_day7 = data.get('is_day7_draw', lucky_draw.is_day7_draw)

    # If enabling Day 7, validate no other Day 7 draw exists
    if new_is_day7 and not lucky_draw.is_day7_draw:
        existing_day7 = LuckyDraw.query.filter_by(
            merchant_id=branch.merchant_id,
            is_day7_draw=True
        ).filter(LuckyDraw.id != draw_id).first()

        if existing_day7:
            return jsonify({'error': 'Only one Day 7 lucky draw allowed per merchant'}), 400

    # Validate points_cost for Day 7 draw
    new_points_cost = data.get('points_cost', lucky_draw.points_cost)
    if new_is_day7 and new_points_cost != 0:
        return jsonify({'error': 'Day 7 lucky draw must be free (points_cost = 0)'}), 400

    # Update fields
    if 'name' in data:
        lucky_draw.name = data['name']
    if 'description' in data:
        lucky_draw.description = data['description']
    if 'image_url' in data:
        lucky_draw.image_url = data['image_url']
    if 'points_cost' in data:
        lucky_draw.points_cost = data['points_cost']
    if 'is_active' in data:
        lucky_draw.is_active = data['is_active']
    if 'is_day7_draw' in data:
        lucky_draw.is_day7_draw = data['is_day7_draw']
    if 'max_daily_spins_per_user' in data:
        lucky_draw.max_daily_spins_per_user = data['max_daily_spins_per_user']
    if 'total_available_spins' in data:
        # Adjust remaining spins proportionally
        if lucky_draw.total_available_spins and lucky_draw.remaining_spins is not None:
            used = lucky_draw.total_available_spins - lucky_draw.remaining_spins
            lucky_draw.total_available_spins = data['total_available_spins']
            lucky_draw.remaining_spins = max(0, data['total_available_spins'] - used)
        else:
            lucky_draw.total_available_spins = data['total_available_spins']
            lucky_draw.remaining_spins = data['total_available_spins']

    # Update dates
    if 'start_date' in data:
        if data['start_date']:
            try:
                lucky_draw.start_date = datetime.fromisoformat(data['start_date'].replace('Z', '+00:00'))
            except ValueError:
                return jsonify({'error': 'Invalid start_date format'}), 400
        else:
            lucky_draw.start_date = None

    if 'end_date' in data:
        if data['end_date']:
            try:
                lucky_draw.end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00'))
            except ValueError:
                return jsonify({'error': 'Invalid end_date format'}), 400
        else:
            lucky_draw.end_date = None

    lucky_draw.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({
        'message': 'Lucky draw updated successfully',
        'lucky_draw': lucky_draw.to_dict()
    }), 200


@bp.route('/<draw_id>', methods=['DELETE'])
@jwt_required()
def delete_lucky_draw(draw_id):
    """Delete a lucky draw"""
    branch, error, status = get_current_branch()
    if error:
        return jsonify(error), status

    lucky_draw = LuckyDraw.query.filter_by(
        id=draw_id,
        merchant_id=branch.merchant_id
    ).first()

    if not lucky_draw:
        return jsonify({'error': 'Lucky draw not found'}), 404

    # Check if draw has been used
    spin_count = LuckyDrawHistory.query.filter_by(lucky_draw_id=draw_id).count()
    if spin_count > 0:
        return jsonify({'error': f'Cannot delete lucky draw with {spin_count} spin history records. Consider deactivating instead.'}), 400

    db.session.delete(lucky_draw)
    db.session.commit()

    return jsonify({'message': 'Lucky draw deleted successfully'}), 200


@bp.route('/<draw_id>/prizes', methods=['POST'])
@jwt_required()
def add_prize(draw_id):
    """Add a prize to a lucky draw"""
    branch, error, status = get_current_branch()
    if error:
        return jsonify(error), status

    lucky_draw = LuckyDraw.query.filter_by(
        id=draw_id,
        merchant_id=branch.merchant_id
    ).first()

    if not lucky_draw:
        return jsonify({'error': 'Lucky draw not found'}), 404

    data = request.get_json()

    # Validate required fields
    prize_type = data.get('prize_type')
    if prize_type not in ['points', 'reward', 'voucher']:
        return jsonify({'error': 'Invalid prize_type. Must be points, reward, or voucher'}), 400

    if not data.get('name'):
        return jsonify({'error': 'Prize name is required'}), 400

    # Validate conditional fields based on prize_type
    if prize_type == 'points':
        if not data.get('points_amount'):
            return jsonify({'error': 'points_amount is required for points prize'}), 400

    elif prize_type == 'reward':
        reward_id = data.get('reward_id')
        if not reward_id:
            return jsonify({'error': 'reward_id is required for reward prize'}), 400

        # Verify reward exists and belongs to merchant
        reward = Reward.query.filter_by(
            id=reward_id,
            merchant_id=branch.merchant_id
        ).first()

        if not reward:
            return jsonify({'error': 'Reward not found or does not belong to this merchant'}), 404

    elif prize_type == 'voucher':
        if not data.get('voucher_discount_percent') and not data.get('voucher_discount_amount'):
            return jsonify({'error': 'Either voucher_discount_percent or voucher_discount_amount is required'}), 400

    # Create prize
    prize = LuckyDrawPrize(
        lucky_draw_id=draw_id,
        prize_type=prize_type,
        name=data['name'],
        display_order=data.get('display_order', 0),
        probability_weight=data.get('probability_weight', 1),
        stock_quantity=data.get('stock_quantity'),
        stock_remaining=data.get('stock_quantity')  # Initialize remaining = quantity
    )

    # Set conditional fields
    if prize_type == 'points':
        prize.points_amount = data['points_amount']

    elif prize_type == 'reward':
        prize.reward_id = data['reward_id']

    elif prize_type == 'voucher':
        prize.voucher_discount_percent = data.get('voucher_discount_percent')
        prize.voucher_discount_amount = data.get('voucher_discount_amount')
        prize.voucher_description = data.get('voucher_description')
        prize.voucher_max_usage = data.get('voucher_max_usage', 1)
        prize.voucher_expiry_days = data.get('voucher_expiry_days', 30)

    db.session.add(prize)
    db.session.commit()

    return jsonify({
        'message': 'Prize added successfully',
        'prize': prize.to_dict()
    }), 201


@bp.route('/<draw_id>/prizes/<prize_id>', methods=['PUT'])
@jwt_required()
def update_prize(draw_id, prize_id):
    """Update a prize"""
    branch, error, status = get_current_branch()
    if error:
        return jsonify(error), status

    # Verify lucky draw belongs to merchant
    lucky_draw = LuckyDraw.query.filter_by(
        id=draw_id,
        merchant_id=branch.merchant_id
    ).first()

    if not lucky_draw:
        return jsonify({'error': 'Lucky draw not found'}), 404

    prize = LuckyDrawPrize.query.filter_by(
        id=prize_id,
        lucky_draw_id=draw_id
    ).first()

    if not prize:
        return jsonify({'error': 'Prize not found'}), 404

    data = request.get_json()

    # Update basic fields
    if 'name' in data:
        prize.name = data['name']
    if 'display_order' in data:
        prize.display_order = data['display_order']
    if 'probability_weight' in data:
        prize.probability_weight = data['probability_weight']

    # Update stock (can refill)
    if 'stock_quantity' in data:
        old_quantity = prize.stock_quantity or 0
        new_quantity = data['stock_quantity']

        if prize.stock_remaining is not None:
            # Adjust remaining stock proportionally
            used = old_quantity - prize.stock_remaining
            prize.stock_remaining = max(0, new_quantity - used)
        else:
            prize.stock_remaining = new_quantity

        prize.stock_quantity = new_quantity

    # Update prize type specific fields
    if prize.prize_type == 'points' and 'points_amount' in data:
        prize.points_amount = data['points_amount']

    elif prize.prize_type == 'reward' and 'reward_id' in data:
        # Verify new reward belongs to merchant
        reward = Reward.query.filter_by(
            id=data['reward_id'],
            merchant_id=branch.merchant_id
        ).first()

        if not reward:
            return jsonify({'error': 'Reward not found or does not belong to this merchant'}), 404

        prize.reward_id = data['reward_id']

    elif prize.prize_type == 'voucher':
        if 'voucher_discount_percent' in data:
            prize.voucher_discount_percent = data['voucher_discount_percent']
        if 'voucher_discount_amount' in data:
            prize.voucher_discount_amount = data['voucher_discount_amount']
        if 'voucher_description' in data:
            prize.voucher_description = data['voucher_description']
        if 'voucher_max_usage' in data:
            prize.voucher_max_usage = data['voucher_max_usage']
        if 'voucher_expiry_days' in data:
            prize.voucher_expiry_days = data['voucher_expiry_days']

    db.session.commit()

    return jsonify({
        'message': 'Prize updated successfully',
        'prize': prize.to_dict()
    }), 200


@bp.route('/<draw_id>/prizes/<prize_id>', methods=['DELETE'])
@jwt_required()
def delete_prize(prize_id, draw_id):
    """Delete a prize"""
    branch, error, status = get_current_branch()
    if error:
        return jsonify(error), status

    # Verify lucky draw belongs to merchant
    lucky_draw = LuckyDraw.query.filter_by(
        id=draw_id,
        merchant_id=branch.merchant_id
    ).first()

    if not lucky_draw:
        return jsonify({'error': 'Lucky draw not found'}), 404

    prize = LuckyDrawPrize.query.filter_by(
        id=prize_id,
        lucky_draw_id=draw_id
    ).first()

    if not prize:
        return jsonify({'error': 'Prize not found'}), 404

    # Check if prize has been won
    won_count = LuckyDrawHistory.query.filter_by(prize_won_id=prize_id).count()
    if won_count > 0:
        return jsonify({'error': f'Cannot delete prize that has been won {won_count} times'}), 400

    db.session.delete(prize)
    db.session.commit()

    return jsonify({'message': 'Prize deleted successfully'}), 200


@bp.route('/<draw_id>/statistics', methods=['GET'])
@jwt_required()
def get_statistics(draw_id):
    """Get statistics for a lucky draw"""
    branch, error, status = get_current_branch()
    if error:
        return jsonify(error), status

    lucky_draw = LuckyDraw.query.filter_by(
        id=draw_id,
        merchant_id=branch.merchant_id
    ).first()

    if not lucky_draw:
        return jsonify({'error': 'Lucky draw not found'}), 404

    # Total spins
    total_spins = LuckyDrawHistory.query.filter_by(lucky_draw_id=draw_id).count()

    # Spins by type
    day7_spins = LuckyDrawHistory.query.filter_by(
        lucky_draw_id=draw_id,
        spin_type='day7_checkin'
    ).count()

    points_spins = LuckyDrawHistory.query.filter_by(
        lucky_draw_id=draw_id,
        spin_type='points_redemption'
    ).count()

    # Total points earned (from points prizes)
    total_points_awarded = db.session.query(
        func.sum(LuckyDrawHistory.points_spent)
    ).filter(
        LuckyDrawHistory.lucky_draw_id == draw_id,
        LuckyDrawHistory.prize_type == 'points'
    ).scalar() or 0

    # Total points spent (for redemption spins)
    total_points_spent = db.session.query(
        func.sum(LuckyDrawHistory.points_spent)
    ).filter(
        LuckyDrawHistory.lucky_draw_id == draw_id,
        LuckyDrawHistory.spin_type == 'points_redemption'
    ).scalar() or 0

    # Prize distribution
    prize_stats = db.session.query(
        LuckyDrawPrize.id,
        LuckyDrawPrize.name,
        LuckyDrawPrize.prize_type,
        func.count(LuckyDrawHistory.id).label('won_count')
    ).outerjoin(
        LuckyDrawHistory,
        LuckyDrawHistory.prize_won_id == LuckyDrawPrize.id
    ).filter(
        LuckyDrawPrize.lucky_draw_id == draw_id
    ).group_by(
        LuckyDrawPrize.id,
        LuckyDrawPrize.name,
        LuckyDrawPrize.prize_type
    ).all()

    prize_distribution = [
        {
            'prize_id': stat.id,
            'prize_name': stat.name,
            'prize_type': stat.prize_type,
            'won_count': stat.won_count
        }
        for stat in prize_stats
    ]

    # Unique participants
    unique_users = db.session.query(
        func.count(func.distinct(LuckyDrawHistory.user_id))
    ).filter(
        LuckyDrawHistory.lucky_draw_id == draw_id
    ).scalar() or 0

    return jsonify({
        'lucky_draw_id': draw_id,
        'lucky_draw_name': lucky_draw.name,
        'total_spins': total_spins,
        'day7_spins': day7_spins,
        'points_spins': points_spins,
        'total_points_awarded': total_points_awarded,
        'total_points_spent': total_points_spent,
        'unique_participants': unique_users,
        'prize_distribution': prize_distribution,
        'remaining_spins': lucky_draw.remaining_spins,
        'is_active': lucky_draw.is_active
    }), 200
