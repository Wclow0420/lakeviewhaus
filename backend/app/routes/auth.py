from flask import Blueprint, request, jsonify
from app import db, mail, limiter
from app.utils.sms import send_sms
from app.models.user import User
from app.models.merchant import Merchant, Branch
from app.models.reward import Reward
from app.models.transaction import Transaction
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from flask_mail import Message
from app.services.notification_service import NotificationService
import random
import datetime

bp = Blueprint('auth', __name__, url_prefix='/auth')

def generate_otp():
    return str(random.randint(100000, 999999))

# Helper for referral rewards
def process_referral_rewards(user):
    from app.models.reward import Reward, UserReward
    from app.models.merchant import Merchant
    
    # Find referrer
    if not user.referred_by_id:
        return

    # Find Main Merchant Config
    # Assuming single merchant system or logic to pick main
    merchant = Merchant.query.first()
    if not merchant:
        return

    # 1. Reward Referrer
    if merchant.referral_referrer_reward_id:
        reward = Reward.query.get(merchant.referral_referrer_reward_id)
        if reward and reward.is_active:
             # Check stock...
             # Issue reward
             expiry = datetime.datetime.utcnow() + datetime.timedelta(days=reward.validity_days)
             code = UserReward.generate_redemption_code()
             while UserReward.query.filter_by(redemption_code=code).first():
                 code = UserReward.generate_redemption_code()
                 
             ur = UserReward(
                 user_id=user.referred_by_id,
                 reward_id=reward.id,
                 merchant_id=merchant.id,
                 points_spent=0, # Free
                 redemption_code=code,
                 status='active',
                 expires_at=expiry
             )
             db.session.add(ur)

             # Notify Referrer (Voucher)
             NotificationService.send_notification(
                user_id=user.referred_by_id,
                title='Referral Reward! 🎁',
                body=f'You earned a {reward.title} for referring {user.username}!',
                type='referral',
                data={
                    'reward_name': reward.title,
                    'friend_username': user.username
                }
             )

    # 1.1 Reward Referrer Points
    if merchant.referral_referrer_points > 0:
        main_branch = Branch.query.filter_by(merchant_id=merchant.id, is_main=True).first()
        if main_branch:
             tx = Transaction(
                 branch_id=main_branch.id,
                 member_id=user.referred_by_id,
                 amount_spent=0,
                 points_earned=merchant.referral_referrer_points,
                 transaction_type='referral_bonus'
             )
             referrer = User.query.get(user.referred_by_id)
             if referrer:
                 referrer.add_points(merchant.referral_referrer_points)
                 db.session.add(tx)

                 # Notify Referrer (Points)
                 NotificationService.send_notification(
                    user_id=user.referred_by_id,
                    title='Referral Bonus! 👥',
                    body=f'You earned {merchant.referral_referrer_points} points for referring {user.username}!',
                    type='referral',
                    data={
                        'points_earned': merchant.referral_referrer_points,
                        'friend_username': user.username
                    }
                 )

    # 2. Reward Referee (New User)
    if merchant.referral_referee_reward_id:
        reward = Reward.query.get(merchant.referral_referee_reward_id)
        if reward and reward.is_active:
             expiry = datetime.datetime.utcnow() + datetime.timedelta(days=reward.validity_days)
             code = UserReward.generate_redemption_code()
             while UserReward.query.filter_by(redemption_code=code).first():
                 code = UserReward.generate_redemption_code()
                 
             ur = UserReward(
                 user_id=user.id,
                 reward_id=reward.id,
                 merchant_id=merchant.id,
                 points_spent=0, # Free
                 redemption_code=code,
                 status='active',
                 expires_at=expiry
             )
             db.session.add(ur)

    # 2.1 Reward Referee Points
    if merchant.referral_referee_points > 0:
        main_branch = Branch.query.filter_by(merchant_id=merchant.id, is_main=True).first()
        if main_branch:
             tx = Transaction(
                 branch_id=main_branch.id,
                 member_id=user.id,
                 amount_spent=0,
                 points_earned=merchant.referral_referee_points,
                 transaction_type='referral_bonus'
             )
             user.add_points(merchant.referral_referee_points)
             db.session.add(tx)


def ensure_referral_code(user):
    if not user.referral_code:
        code = User.generate_referral_code()
        while User.query.filter_by(referral_code=code).first():
            code = User.generate_referral_code()
        user.referral_code = code
        db.session.commit()

# --- MEMBER AUTH ---
@bp.route('/register', methods=['POST'])
@limiter.limit("5 per minute")
def register():
    # ... existing code ...
    # but I need to replace the whole User creation block to add otp_last_sent_at
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    phone = data.get('phone')
    password = data.get('password')
    referral_code = data.get('referral_code')

    if not username or not email or not phone or not password:
        return jsonify({'error': 'Username, email, phone and password required'}), 400

    if User.query.filter((User.username == username) | (User.email == email) | (User.phone == phone)).first():
        return jsonify({'error': 'Username, Email or Phone already exists'}), 400

    hashed_pw = generate_password_hash(password)
    otp = generate_otp()
    otp_expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)

    # Generate Referral Code for new user
    new_ref_code = User.generate_referral_code()
    while User.query.filter_by(referral_code=new_ref_code).first():
        new_ref_code = User.generate_referral_code()

    # Handle Input Referral
    referrer_id = None
    if referral_code:
        referrer = User.query.filter_by(referral_code=referral_code.upper()).first()
        if referrer:
            referrer_id = referrer.id

    # Create unverified user
    user = User(
        username=username, 
        email=email,
        phone=phone,
        password_hash=hashed_pw,
        is_verified=False,
        otp_code=otp,
        otp_expires_at=otp_expiry,
        otp_last_sent_at=datetime.datetime.utcnow(),
        referral_code=new_ref_code,
        referred_by_id=referrer_id
    )
    
    db.session.add(user)
    db.session.commit()

    # Send OTP SMS
    send_sms(phone, f"Lakeview Haus Verification Code: {otp}")

    # Email Logic Removed as per request

    return jsonify({'message': 'User registered. Please check phone for OTP.', 'user_id': user.id}), 201

@bp.route('/verify-otp', methods=['POST'])
def verify_otp():
    data = request.get_json()
    phone = data.get('phone') # Use phone for verification
    otp = data.get('otp')

    if not phone or not otp:
        return jsonify({'error': 'Phone and OTP required'}), 400

    user = User.query.filter_by(phone=phone).first()

    if not user:
        return jsonify({'error': 'User not found'}), 404

    if user.is_verified:
        return jsonify({'message': 'User already verified'}), 200

    if user.otp_code != otp:
        return jsonify({'error': 'Invalid OTP'}), 400

    if datetime.datetime.utcnow() > user.otp_expires_at:
        return jsonify({'error': 'OTP Expired'}), 400

    # Verification successful
    user.is_verified = True
    user.otp_code = None # Clear OTP
    
    # Process Referral Rewards if applicable
    if user.referred_by_id:
        try:
            process_referral_rewards(user)
        except Exception as e:
            print(f"Error processing referral rewards: {e}")
            # Don't fail verification

    db.session.commit()

    # Log them in automatically
    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify({
        'message': 'Verification successful',
        'access_token': access_token,
        'refresh_token': refresh_token
    }), 200

@bp.route('/resend-otp', methods=['POST'])
@limiter.limit("5 per minute")
def resend_otp():
    data = request.get_json()
    phone = data.get('phone')

    if not phone:
        return jsonify({'error': 'Phone required'}), 400

    user = User.query.filter_by(phone=phone).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    if user.is_verified:
        return jsonify({'message': 'User already verified'}), 200

    # 1. Check for Daily Reset
    now = datetime.datetime.utcnow()
    if user.otp_last_sent_at and user.otp_last_sent_at.date() < now.date():
        user.otp_resend_count = 0
    
    # 2. Determine Wait Time based on Count
    # Tier 1: Attempts 1-3 (Count 0-2) -> 1 minute
    # Tier 2: Attempts 4-6 (Count 3-5) -> 10 minutes
    # Tier 3: Attempts 7-8 (Count 6-7) -> 30 minutes
    # Tier 4: Attempt 9+ (Count >= 8) -> Blocked
    
    count = user.otp_resend_count or 0
    
    if count < 3:
        required_wait = 60 # 1 minute
    elif count < 6:
        required_wait = 600 # 10 minutes
    elif count < 8:
        required_wait = 1800 # 30 minutes
    else:
        return jsonify({
            'error': 'Daily SMS limit reached. Please try again tomorrow.',
             'daily_limit': True
        }), 429
        
    # 3. Check Cooldown
    if user.otp_last_sent_at:
        elapsed = (now - user.otp_last_sent_at).total_seconds()
        if elapsed < required_wait:
            wait_time = int(required_wait - elapsed)
            return jsonify({
                'error': f'Please wait {wait_time} seconds before resending',
                'wait_seconds': wait_time
            }), 429

    # 4. Generate and Send
    otp = generate_otp()
    user.otp_code = otp
    user.otp_expires_at = now + datetime.timedelta(minutes=10)
    user.otp_last_sent_at = now
    
    # Increment count ONLY on successful resend intent
    user.otp_resend_count = count + 1
    
    db.session.commit()
    
    send_sms(user.phone, f"Lakeview Haus Verification Code: {otp}")
    
    return jsonify({
        'message': 'OTP resent successfully',
        'new_count': user.otp_resend_count
    }), 200


@bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    identifier = data.get('identifier') or data.get('email') # Support both
    password = data.get('password')

    if not identifier or not password:
        return jsonify({'error': 'Identifier and password required'}), 400

    # Check against all 3 fields
    user = User.query.filter(
        (User.email == identifier) | 
        (User.username == identifier) | 
        (User.phone == identifier)
    ).first()
    
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    if not user.is_verified:
        return jsonify({
            'error': 'Account not verified. Please verify your phone/email.',
            'phone': user.phone,
            'email': user.email
        }), 403

    ensure_referral_code(user)

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify({
        'message': 'Login successful',
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': {
            'id': user.id,
            'username': user.username,
            'points': user.points_balance or 0.0,
            'points_balance': user.points_balance or 0.0,
            'points_lifetime': user.points_lifetime or 0.0,
            'rank': user.rank,
            'referral_code': user.referral_code,
            'type': 'member'
        }
    }), 200

# --- MERCHANT/BRANCH AUTH ---
@bp.route('/merchant/login', methods=['POST'])
def merchant_login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    branch = Branch.query.filter_by(username=username).first()

    if not branch or not check_password_hash(branch.password_hash, password):
        return jsonify({'error': 'Invalid branch credentials'}), 401

    # Token Identity encapsulates both Merchant and Branch ID
    # Format: m_{merchant_id}_b_{branch_id}
    identity = f"m_{branch.merchant_id}_b_{branch.id}"
    
    access_token = create_access_token(identity=identity)
    refresh_token = create_refresh_token(identity=identity)

    return jsonify({
        'message': 'Branch Login successful',
        'access_token': access_token,
        'refresh_token': refresh_token,
        'branch': {
            'id': branch.id,
            'name': branch.name,
            'username': branch.username,
            'is_main': branch.is_main,
            'merchant_id': branch.merchant_id,
            'merchant_name': branch.merchant.name,
            'logo_url': branch.logo_url,
            'location': branch.location
        }
    }), 200


@bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    current_user = get_jwt_identity()
    new_access_token = create_access_token(identity=current_user)
    return jsonify(access_token=new_access_token), 200

@bp.route('/referral-info', methods=['GET'])
def referral_info():
    merchant = Merchant.query.first()
    if not merchant:
        return jsonify({})

    def get_simple_info(rid):
        if not rid: return None
        r = Reward.query.get(rid)
        if r and r.is_active:
            return {
                'title': r.title,
                'reward_type': r.reward_type,
                'discount_value': r.discount_value,
                'image_url': r.image_url
            }
        return None

    return jsonify({
        'referrer_reward': get_simple_info(merchant.referral_referrer_reward_id),
        'referee_reward': get_simple_info(merchant.referral_referee_reward_id),
        'referrer_points': merchant.referral_referrer_points,
        'referee_points': merchant.referral_referee_points
    })

@bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    current_identity = get_jwt_identity()

    if current_identity.startswith('m_'):
        # Format: m_{merchant_id}_b_{branch_id}
        parts = current_identity.split('_')
        b_id = parts[3] # m, mid, b, bid

        branch = Branch.query.get(b_id)
        if branch:
            resp = {
                'id': branch.id,
                'name': branch.name,
                'username': branch.username,
                'is_main': branch.is_main,
                'merchant_id': branch.merchant_id,
                'merchant_name': branch.merchant.name,
                'logo_url': branch.logo_url,
                'location': branch.location,
                'type': 'branch'
            }
            if branch.is_main:
                resp['referral_config'] = {
                    'referral_referrer_reward_id': branch.merchant.referral_referrer_reward_id,
                    'referral_referee_reward_id': branch.merchant.referral_referee_reward_id,
                    'referral_referrer_points': branch.merchant.referral_referrer_points,
                    'referral_referee_points': branch.merchant.referral_referee_points
                }
            return jsonify(resp)
    else:
        user = User.query.get(current_identity)
        if user:
            ensure_referral_code(user)
            
            # Get Orders Count
            orders_count = Transaction.query.filter_by(member_id=user.id).count()
            
            return jsonify({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'profile_pic_url': user.profile_pic_url,
                'points': user.points_balance or 0.0,
                'points_balance': user.points_balance or 0.0,
                'points_lifetime': user.points_lifetime or 0.0,
                'rank': user.rank,
                'referral_code': user.referral_code,
                'referred_by_id': user.referred_by_id,
                'orders_count': orders_count,
                'type': 'member'
            })

    return jsonify({'error': 'User not found'}), 404

@bp.route('/generate-qr-token', methods=['POST'])
@jwt_required()
def generate_qr_token():
    """Generate a secure, short-lived JWT token for QR code display"""
    current_identity = get_jwt_identity()

    # Only regular users (not branches) should generate QR codes for scanning
    if current_identity.startswith('m_'):
        return jsonify({'error': 'Only members can generate QR codes'}), 403

    user = User.query.get(current_identity)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Create a short-lived token (5 minutes) specifically for QR code scanning
    # Add custom claims to identify this as a QR token
    qr_token = create_access_token(
        identity=str(user.id),
        expires_delta=datetime.timedelta(minutes=5),
        additional_claims={'type': 'qr_scan', 'username': user.username}
    )

    return jsonify({
        'qr_token': qr_token,
        'expires_in': 300  # 5 minutes in seconds
    }), 200

@bp.route('/referral', methods=['POST'])
@jwt_required()
def set_referral():
    """Allow user to enter referral code after registration"""
    current_identity = get_jwt_identity()
    if current_identity.startswith('m_'):
        return jsonify({'error': 'Merchants cannot use referral codes'}), 403
        
    user = User.query.get(current_identity)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if user.referred_by_id:
        return jsonify({'error': 'You have already used a referral code'}), 400

    data = request.get_json()
    code = data.get('referral_code')
    
    if not code:
        return jsonify({'error': 'Referral code required'}), 400

    # Cannot refer self
    if code.upper() == user.referral_code:
        return jsonify({'error': 'Cannot refer yourself'}), 400

    referrer = User.query.filter_by(referral_code=code.upper()).first()
    if not referrer:
        return jsonify({'error': 'Invalid referral code'}), 400

    # Link
    user.referred_by_id = referrer.id
    
    # Grant rewards immediately since user is already verified (implied by having account/token)
    try:
        process_referral_rewards(user)
    except Exception as e:
        print(f"Error processing rewards: {e}")
        return jsonify({'error': 'Referral applied but reward processing failed'}), 500

    db.session.commit()
    
    return jsonify({'message': 'Referral code applied successfully'}), 200

@bp.route('/profile', methods=['POST'])
@jwt_required()
def update_profile():
    current_identity = get_jwt_identity()
    if current_identity.startswith('m_'):
        return jsonify({'error': 'Merchants cannot use this endpoint'}), 403
        
    user = User.query.get(current_identity)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json()
    new_username = data.get('username')
    new_pic_url = data.get('profile_pic_url')
    
    # Validation
    if new_username and new_username != user.username:
        # Check duplicate
        if User.query.filter_by(username=new_username).first():
            return jsonify({'error': 'Username already taken'}), 400
        user.username = new_username
        
    if new_pic_url is not None:
        user.profile_pic_url = new_pic_url
        
    db.session.commit()
    
    return jsonify({
        'message': 'Profile updated successfully',
        'user': {
            'username': user.username,
            'profile_pic_url': user.profile_pic_url
        }
    }), 200
