from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User
from app.models.check_in import DailyCheckIn
from app.models.reward import Reward, UserVoucher
from datetime import datetime, timedelta
import random
import uuid

bp = Blueprint('gamification', __name__, url_prefix='/gamification')

@bp.route('/status', methods=['GET'])
@jwt_required()
def check_in_status():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Calculate streak status
    today = datetime.utcnow().date()
    last_check_in = user.last_check_in_date
    
    can_check_in = True
    current_streak = user.total_streak or 0
    
    if last_check_in == today:
        can_check_in = False
    elif last_check_in != (today - timedelta(days=1)):
        # Streak broken if not checked in yesterday
        # But for display, if they checked in yesterday, streak is kept.
        # If they missed yesterday, streak will reset on NEXT check-in, but status shows 0 effectively for "next" check in potential if we strictly show current valid streak.
        # Actually, standard UI shows "0" if broken, or just keeps showing old streak until they miss check-in today?
        # Let's say: if last check in was yesterday, streak is alive (e.g. 5).
        # If last check in was today, streak is alive (e.g. 6).
        # If last check in was day before yesterday, streak is broken (will become 1).
        if last_check_in and last_check_in < (today - timedelta(days=1)):
            current_streak = 0
    
    # Calculate Day of Cycle (1-7)
    # If streak is 0, next day is 1.
    # If streak is 5 (checked in yesterday), next is 6.
    # If streak is 5 (checked in today), current is 5 (cycle day 5).
    
    cycle_day = (current_streak % 7) if current_streak > 0 else 0
    # Keep it simple: UI usually wants to know "What day am I on?"
    # If I checked in today, I am on day X.
    # If I haven't, I am potentially on day Y.
    
    return jsonify({
        'can_check_in': can_check_in,
        'total_streak': current_streak,
        'cycle_day': cycle_day,
        'last_check_in': last_check_in.isoformat() if last_check_in else None,
        'points': user.current_points
    }), 200

@bp.route('/check-in', methods=['POST'])
@jwt_required()
def check_in():
    user_id = get_jwt_identity()
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
    has_voucher = False
    
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
        # Lucky Draw Logic
        # (7pt + RM 1 Voucher) 50%
        # (9pt + RM 1 Voucher) 30%
        # (15pt + RM 1 Voucher) 15%
        # (20pt + RM 1 Voucher) 5%
        rand = random.random() * 100
        has_voucher = True
        
        if rand < 50:
            points_to_add = 7
        elif rand < 80: # 50 + 30
            points_to_add = 9
        elif rand < 95: # 80 + 15
            points_to_add = 15
        else: # Remaining 5%
            points_to_add = 20
            
        prize_description = f"{points_to_add} Points + RM 1 Voucher"
    
    # Add Points
    user.current_points += points_to_add
    
    # Handle Voucher if applicable
    if has_voucher:
        # Check if "RM 1 Voucher" exists
        voucher_reward = Reward.query.filter_by(name="RM 1 Voucher").first()
        if not voucher_reward:
            # Create if missing (auto-seeding for convenience)
            voucher_reward = Reward(
                name="RM 1 Voucher",
                cost_points=0, # Free/Prize
                voucher_value=1.00,
                description="Lucky Draw Prize from 7-Day Streak"
            )
            db.session.add(voucher_reward)
            db.session.commit()
            
        # Issue Voucher
        new_voucher = UserVoucher(
            user_id=user.id,
            reward_id=voucher_reward.id,
            unique_code=f"LD-{user.id}-{int(datetime.utcnow().timestamp())}-{random.randint(100,999)}"
        )
        db.session.add(new_voucher)
    
    # Record Check In
    check_in_record = DailyCheckIn(
        user_id=user.id,
        check_in_date=today,
        streak_day_count=cycle_day
    )
    db.session.add(check_in_record)
    
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
        
    return jsonify({
        'success': True,
        'points_added': points_to_add,
        'new_total_points': user.current_points,
        'streak': user.total_streak,
        'cycle_day': cycle_day,
        'prize': prize_description,
        'has_voucher': has_voucher
    }), 200
