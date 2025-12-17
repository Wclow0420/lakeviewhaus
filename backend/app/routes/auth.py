from flask import Blueprint, request, jsonify
from app import db, mail
from app.models.user import User
from app.models.merchant import Merchant
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from flask_mail import Message
import random
import datetime

bp = Blueprint('auth', __name__, url_prefix='/auth')

def generate_otp():
    return str(random.randint(100000, 999999))

# --- MEMBER AUTH ---
@bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not username or not email or not password:
        return jsonify({'error': 'Username, email and password required'}), 400

    if User.query.filter((User.username == username) | (User.email == email)).first():
        return jsonify({'error': 'Username or Email already exists'}), 400

    hashed_pw = generate_password_hash(password)
    otp = generate_otp()
    otp_expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)

    # Create unverified user
    user = User(
        username=username, 
        email=email,
        password_hash=hashed_pw,
        is_verified=False,
        otp_code=otp,
        otp_expires_at=otp_expiry
    )
    
    db.session.add(user)
    db.session.commit()

    # Send OTP Email
    try:
        msg = Message("Your OTP Code - Lakeview Haus",
                      sender="noreply@lakeviewhaus.com",
                      recipients=[email])
        msg.body = f"Your Verification Code is: {otp}"
        mail.send(msg)
    except Exception as e:
        print(f"Error sending email: {e}")
        # In production, might want to rollback or handle this better
        # db.session.delete(user); db.session.commit(); return error

    return jsonify({'message': 'User registered. Please check email for OTP.', 'user_id': user.id}), 201

@bp.route('/verify-otp', methods=['POST'])
def verify_otp():
    data = request.get_json()
    email = data.get('email')
    otp = data.get('otp')

    user = User.query.filter_by(email=email).first()

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
    db.session.commit()

    # Log them in automatically? Or ask to login.
    # Let's return tokens to auto-login.
    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify({
        'message': 'Verification successful',
        'access_token': access_token,
        'refresh_token': refresh_token
    }), 200

@bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email') # Login with Email
    password = data.get('password')

    user = User.query.filter_by(email=email).first()
    
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    if not user.is_verified:
         return jsonify({'error': 'Account not verified. Please verify your email.'}), 403

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify({
        'message': 'Login successful',
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': {
            'id': user.id,
            'username': user.username,
            'points': user.current_points,
            'rank': user.rank
        }
    }), 200

# --- MERCHANT AUTH ---
@bp.route('/merchant/login', methods=['POST'])
def merchant_login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    merchant = Merchant.query.filter_by(email=email).first()

    if not merchant or not check_password_hash(merchant.password_hash, password):
        return jsonify({'error': 'Invalid merchant credentials'}), 401

    access_token = create_access_token(identity=f"m_{merchant.id}")
    refresh_token = create_refresh_token(identity=f"m_{merchant.id}")

    return jsonify({
        'message': 'Merchant Login successful',
        'access_token': access_token,
        'refresh_token': refresh_token,
        'merchant': {
            'id': merchant.id,
            'name': merchant.name
        }
    }), 200

@bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    current_user = get_jwt_identity()
    new_access_token = create_access_token(identity=current_user)
    return jsonify(access_token=new_access_token), 200

@bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    current_identity = get_jwt_identity()
    
    if current_identity.startswith('m_'):
        m_id = current_identity.split('_')[1]
        merchant = Merchant.query.get(m_id)
        if merchant:
            return jsonify({'id': merchant.id, 'name': merchant.name, 'type': 'merchant'})
    else:
        user = User.query.get(int(current_identity))
        if user:
            return jsonify({'id': user.id, 'username': user.username, 'email': user.email, 'points': user.current_points, 'rank': user.rank, 'type': 'member'})
            
    return jsonify({'error': 'User not found'}), 404
