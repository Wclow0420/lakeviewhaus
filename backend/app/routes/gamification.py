from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User
from app.models.check_in import DailyCheckIn
from app.models.lucky_draw import LuckyDraw
from app.models.lucky_draw_history import LuckyDrawHistory
from app.models.reward import UserReward, Reward
from datetime import datetime, timedelta
import random
import json

bp = Blueprint('gamification', __name__, url_prefix='/gamification')

@bp.route('/status', methods=['GET'])
@jwt_required()
def check_in_status():
    user_id = get_jwt_identity()
    
    # Validation: Merchants have 'm_' prefix, Customers are raw UUIDs
    if user_id.startswith('m_'):
        return jsonify({'error': 'Gamification not available for this user type'}), 403

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
        'points': user.points_balance or 0.0,
        'points_balance': user.points_balance or 0.0,
        'points_lifetime': user.points_lifetime or 0.0
    }), 200

@bp.route('/check-in', methods=['POST'])
@jwt_required()
def check_in():
    user_id = get_jwt_identity()

    if user_id.startswith('m_'):
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
        # Check if Day 7 Lucky Draw is configured
        day7_draw = None
        # Check if Day 7 Lucky Draw is configured
        day7_draw = LuckyDraw.query.filter_by(
            is_day7_draw=True,
            is_active=True
        ).first()

        # If Day 7 draw exists and is available, user should spin it instead
        # If Day 7 draw exists and is available, execute the spin immediately
        if day7_draw and day7_draw.is_available():
            # 1. Fetch available prizes
            available_prizes = [
                p for p in day7_draw.prizes.all() 
                if p.is_available()
            ]

            if not available_prizes:
                # Fallback if no prizes available (shouldn't happen in config usually, but safety net)
                points_to_add = 5
                prize_description = "Day 7 Consolation Bonus"
            else:
                # 2. Weighted Random Selection
                total_weight = sum(p.probability_weight for p in available_prizes)
                rand_val = random.randint(1, total_weight)
                
                selected_prize = None
                current_weight = 0
                for prize in available_prizes:
                    current_weight += prize.probability_weight
                    if rand_val <= current_weight:
                        selected_prize = prize
                        break
                
                # Default to first if something goes wrong with random logic
                if not selected_prize:
                    selected_prize = available_prizes[0]

                # 3. Create Lucky Draw History Record
                history_record = LuckyDrawHistory(
                    user_id=user.id,
                    lucky_draw_id=day7_draw.id,
                    prize_won_id=selected_prize.id,
                    points_spent=0,
                    spin_type='day7_checkin',
                    prize_type=selected_prize.prize_type,
                    prize_name=selected_prize.name,
                    prize_value_json=json.dumps(selected_prize.to_dict()),
                    is_claimed=True,
                    claimed_at=datetime.utcnow()
                )
                db.session.add(history_record)
                db.session.flush()

                # 4. Award the Prize
                points_to_add = 0
                prize_description = selected_prize.name
                stock_decremented = False

                if selected_prize.prize_type == 'points':
                    points_to_add = selected_prize.points_amount or 0
                    selected_prize.decrement_stock()
                    stock_decremented = True
                    
                elif selected_prize.prize_type in ['reward', 'voucher']:
                    selected_prize.decrement_stock()
                    stock_decremented = True

                    # Create UserReward record if linked to a reward
                    if selected_prize.reward_id:
                        reward = Reward.query.get(selected_prize.reward_id)
                        if reward:
                            validity = reward.validity_days or 30
                            expires_at = datetime.utcnow() + timedelta(days=validity)
                            
                            user_reward = UserReward(
                                user_id=user.id,
                                reward_id=reward.id,
                                merchant_id=reward.merchant_id,
                                points_spent=0,
                                redemption_code=UserReward.generate_redemption_code(),
                                status='active',
                                source_type='lucky_draw',
                                lucky_draw_history_id=history_record.id,
                                expires_at=expires_at
                            )
                            db.session.add(user_reward)
                            db.session.flush()
                            
                            # Link back to history
                            history_record.user_reward_id = user_reward.id

                # Decrement draw spins if limited
                day7_draw.decrement_spins()

            # Add Points to User Account
            user.add_points(points_to_add)

            # Record check-in
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

            # Return success with the prize result immediately
            # Frontend can show a "Tap to Reveal" animation which then displays this 'prize' field.
            return jsonify({
                'success': True,
                'is_day7': True,
                'points_added': points_to_add,
                'new_total_points': (user.points_balance or 0.0) + points_to_add, # Add here since we add to user object later in shared code? 
                # Wait, we need to explicitly add points to user object if we return here!
                # Logic below 'user.add_points(points_to_add)' is skipped if we return early.
                # So we must add points here.
                'points_balance': (user.points_balance or 0.0) + points_to_add,
                'points_lifetime': (user.points_lifetime or 0.0) + points_to_add,
                'streak': user.total_streak,
                'cycle_day': cycle_day,
                'prize': prize_description,
                'prize_details': selected_prize.to_dict() if 'selected_prize' in locals() and selected_prize else None,
                'message': f'You won {prize_description}!'
            }), 200

        else:
            # Fallback to old points-based lucky draw logic
            # 7pt 50%
            # 9pt 30%
            # 15pt 15%
            # 20pt 5%
            rand = random.random() * 100

            if rand < 50:
                points_to_add = 7
            elif rand < 80: # 50 + 30
                points_to_add = 9
            elif rand < 95: # 80 + 15
                points_to_add = 15
            else: # Remaining 5%
                points_to_add = 20

            prize_description = f"{points_to_add} Points Lucky Draw!"

    # Add Points
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
        
    return jsonify({
        'success': True,
        'points_added': points_to_add,
        'new_total_points': user.points_balance or 0.0,
        'points_balance': user.points_balance or 0.0,
        'points_lifetime': user.points_lifetime or 0.0,
        'streak': user.total_streak,
        'cycle_day': cycle_day,
        'prize': prize_description
    }), 200
