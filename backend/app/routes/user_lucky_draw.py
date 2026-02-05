from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User
from app.models.lucky_draw import LuckyDraw
from app.models.lucky_draw_prize import LuckyDrawPrize
from app.models.lucky_draw_history import LuckyDrawHistory
from app.models.reward import UserReward
from app.utils.lucky_draw_utils import select_prize, generate_voucher_code, can_user_spin_today
from datetime import datetime, timedelta
import json

bp = Blueprint('user_lucky_draw', __name__, url_prefix='/lucky-draws')


def get_current_user():
    """Helper to get current authenticated user"""
    current_user_id = get_jwt_identity()

    # Check if this is a branch user (format: "m_{merchant_id}_b_{branch_id}")
    if isinstance(current_user_id, str) and current_user_id.startswith('m_'):
        return None, {'error': 'This endpoint is for customers only'}, 403

    try:
        user = User.query.get(current_user_id)
    except (ValueError, TypeError):
        return None, {'error': 'Invalid user ID'}, 400

    if not user:
        return None, {'error': 'User not found'}, 404

    return user, None, None


@bp.route('', methods=['GET'])
@jwt_required()
def get_available_draws():
    """Get all available lucky draws for the user"""
    user, error, status = get_current_user()
    if error:
        return jsonify(error), status

    # Get all active draws (Platform-wide or Single Tenant assumption)
    draws = LuckyDraw.query.filter_by(
        is_active=True
    ).all()

    # Filter by availability and add user-specific info
    available_draws = []
    for draw in draws:
        # Check standard availability (dates, stock)
        if not draw.is_available():
            continue

        # For normal list api, usually exclude hidden "Day 7" draws unless we specifically want them
        # User asked to see them, so we include them if active.
        
        draw_dict = draw.to_dict(include_prizes=True)

        # Add user eligibility info
        can_spin, spins_today = can_user_spin_today(
            user.id,
            draw.id,
            draw.max_daily_spins_per_user
        )

        draw_dict['user_can_spin'] = can_spin
        draw_dict['user_spins_today'] = spins_today
        draw_dict['user_has_enough_points'] = user.points_balance >= draw.points_cost # Use points_balance

        available_draws.append(draw_dict)

    return jsonify({
        'lucky_draws': available_draws,
        'user_points': user.points_balance
    }), 200


@bp.route('/<draw_id>', methods=['GET'])
@jwt_required()
def get_draw_details(draw_id):
    """Get details of a specific lucky draw"""
    user, error, status = get_current_user()
    if error:
        return jsonify(error), status

    draw = LuckyDraw.query.filter_by(
        id=draw_id,
        is_active=True
    ).first()

    if not draw:
        return jsonify({'error': 'Lucky draw not found'}), 404

    draw_dict = draw.to_dict(include_prizes=True)

    # Add user eligibility info
    can_spin, spins_today = can_user_spin_today(
        user.id,
        draw.id,
        draw.max_daily_spins_per_user
    )

    draw_dict['user_can_spin'] = can_spin
    draw_dict['user_spins_today'] = spins_today
    draw_dict['user_has_enough_points'] = user.points_balance >= draw.points_cost

    return jsonify(draw_dict), 200


@bp.route('/<draw_id>/spin', methods=['POST'])
@jwt_required()
def spin_lucky_draw(draw_id):
    """Spin a lucky draw and get a prize"""
    user, error, status = get_current_user()
    if error:
        return jsonify(error), status

    data = request.get_json() or {}
    spin_type = data.get('spin_type', 'points_redemption')

    if spin_type not in ['day7_checkin', 'points_redemption']:
        return jsonify({'error': 'Invalid spin_type'}), 400

    # Get lucky draw
    draw = LuckyDraw.query.filter_by(
        id=draw_id,
        is_active=True
    ).first()

    if not draw:
        return jsonify({'error': 'Lucky draw not found or inactive'}), 404

    # Check availability
    if not draw.is_available():
        return jsonify({'error': 'Lucky draw is not available'}), 400

    # Check daily limit
    can_spin, spins_today = can_user_spin_today(
        user.id,
        draw.id,
        draw.max_daily_spins_per_user
    )

    if not can_spin:
        return jsonify({
            'error': f'Daily spin limit reached ({draw.max_daily_spins_per_user} spins per day)',
            'spins_today': spins_today
        }), 400

    # Check points requirement
    if spin_type == 'points_redemption':
        if user.points_balance < draw.points_cost:
            return jsonify({
                'error': 'Insufficient points',
                'required': draw.points_cost,
                'current': user.points_balance
            }), 400

    # Validate spin type for Day 7 draws
    if draw.is_day7_draw and spin_type != 'day7_checkin':
        return jsonify({'error': 'This is a Day 7 check-in draw only'}), 400

    # Select prize
    prize = select_prize(draw_id)
    if not prize:
        return jsonify({'error': 'No prizes available'}), 400

    # Deduct points if needed
    points_spent = 0
    if spin_type == 'points_redemption':
        user.deduct_points(draw.points_cost) # Use helper method
        points_spent = draw.points_cost

    # Process prize based on type
    prize_value = {}
    voucher_code = None
    user_reward_id = None
    voucher_expiry = None

    if prize.prize_type == 'points':
        # Award points
        user.add_points(prize.points_amount) # Use helper method
        prize_value = {'points_amount': prize.points_amount}

    elif prize.prize_type == 'reward':
        # Create UserReward entry
        if prize.reward:
            expiry_date = datetime.utcnow() + timedelta(days=prize.reward.validity_days)

            user_reward = UserReward(
                user_id=user.id,
                reward_id=prize.reward_id,
                merchant_id=draw.merchant_id, # Use Draw's Merchant ID
                points_spent=0,  # Lucky draw rewards are free (already paid for spin)
                redemption_code=UserReward.generate_redemption_code(),
                status='active',  # Different from direct redeem
                expires_at=expiry_date,
                source_type='lucky_draw'
            )

            db.session.add(user_reward)
            db.session.flush()  # Get the ID

            user_reward_id = user_reward.id
            prize_value = {
                'reward_id': prize.reward_id,
                'reward_title': prize.reward.title,
                'redemption_code': user_reward.redemption_code,
                'expires_at': expiry_date.isoformat()
            }

    elif prize.prize_type == 'voucher':
        # Generate voucher code
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

    # Create history record
    history = LuckyDrawHistory(
        user_id=user.id,
        lucky_draw_id=draw_id,
        prize_won_id=prize.id,
        points_spent=points_spent,
        spin_type=spin_type,
        prize_type=prize.prize_type,
        prize_name=prize.name,
        prize_value_json=json.dumps(prize_value),
        voucher_code=voucher_code,
        voucher_expiry_date=voucher_expiry,
        user_reward_id=user_reward_id,
        is_claimed=False
    )

    db.session.add(history)

    # Link user_reward back to history if reward prize
    if user_reward_id:
        user_reward.lucky_draw_history_id = history.id

    # Decrement stock
    prize.decrement_stock()
    draw.decrement_spins()

    db.session.commit()

    return jsonify({
        'message': 'Spin successful!',
        'prize': {
            'id': prize.id,
            'name': prize.name,
            'type': prize.prize_type,
            'value': prize_value
        },
        'history_id': history.id,
        'user_points': user.points_balance
    }), 200


@bp.route('/history', methods=['GET'])
@jwt_required()
def get_spin_history():
    """Get user's lucky draw spin history"""
    user, error, status = get_current_user()
    if error:
        return jsonify(error), status

    # Pagination
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    # Optional filter by draw_id
    draw_id = request.args.get('draw_id')

    query = LuckyDrawHistory.query.filter_by(user_id=user.id)

    if draw_id:
        query = query.filter_by(lucky_draw_id=draw_id)

    # Order by most recent
    query = query.order_by(LuckyDrawHistory.created_at.desc())

    # Paginate
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    history_items = [item.to_dict() for item in pagination.items]

    return jsonify({
        'history': history_items,
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages
    }), 200


@bp.route('/history/<history_id>', methods=['GET'])
@jwt_required()
def get_spin_details(history_id):
    """Get details of a specific spin"""
    user, error, status = get_current_user()
    if error:
        return jsonify(error), status

    history = LuckyDrawHistory.query.filter_by(
        id=history_id,
        user_id=user.id
    ).first()

    if not history:
        return jsonify({'error': 'Spin record not found'}), 404

    return jsonify(history.to_dict()), 200


@bp.route('/day7-draw', methods=['GET'])
@jwt_required()
def get_day7_draw():
    """Get the Day 7 check-in lucky draw for the platform"""
    user, error, status = get_current_user()
    if error:
        return jsonify(error), status

    # Find active Day 7 draw (Assuming single tenant or platform-wide for now)
    draw = LuckyDraw.query.filter_by(
        is_day7_draw=True,
        is_active=True
    ).first()

    if not draw:
        return jsonify({
            'has_day7_draw': False,
            'message': 'No Day 7 lucky draw configured'
        }), 200

    if not draw.is_available():
        return jsonify({
            'has_day7_draw': False,
            'message': 'Day 7 lucky draw is not available'
        }), 200

    draw_dict = draw.to_dict(include_prizes=True)

    # Add user eligibility
    can_spin, spins_today = can_user_spin_today(
        user.id,
        draw.id,
        draw.max_daily_spins_per_user
    )

    draw_dict['user_can_spin'] = can_spin
    draw_dict['user_spins_today'] = spins_today
    draw_dict['has_day7_draw'] = True

    return jsonify(draw_dict), 200
