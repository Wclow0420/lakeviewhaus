from flask import Blueprint, request, jsonify
from app import db
from app.models.transaction import Transaction
from app.models.user import User
from app.models.merchant import Branch
from flask_jwt_extended import jwt_required, get_jwt_identity, decode_token
from app.routes.merchant import get_current_branch
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
import json

bp = Blueprint('transaction', __name__, url_prefix='/transaction')

@bp.route('/validate-qr', methods=['POST'])
@jwt_required()
def validate_qr():
    """Validate a QR token and return user information (username only)"""
    current_branch = get_current_branch()
    if not current_branch:
        return jsonify({'error': 'Unauthorized. Only branches can validate QR codes.'}), 403

    data = request.get_json()
    qr_token = data.get('qr_token')

    if not qr_token:
        return jsonify({'error': 'Missing QR token'}), 400

    try:
        # Decode and validate the JWT token
        decoded = decode_token(qr_token)

        # Verify it's a QR scan token
        if decoded.get('type') != 'qr_scan':
            return jsonify({'error': 'Invalid QR code. Please use a valid Lakeview Haus member QR code.'}), 400

        user_id = decoded.get('sub')  # 'sub' is the standard JWT claim for subject (user identity)
        username = decoded.get('username')

        if not user_id:
            return jsonify({'error': 'Invalid QR code format'}), 400

        # Verify user exists
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Return only username and validation status (NEVER expose user ID to frontend)
        return jsonify({
            'valid': True,
            'username': user.username,
            'rank': user.rank,
            'qr_token': qr_token  # Pass back for transaction processing
        }), 200

    except ExpiredSignatureError:
        return jsonify({'error': 'QR code has expired. Please refresh the code.'}), 400
    except InvalidTokenError:
        return jsonify({'error': 'Invalid QR code. Please use a valid Lakeview Haus member QR code.'}), 400
    except Exception as e:
        print(f"QR Validation Error: {e}")
        return jsonify({'error': 'Failed to validate QR code'}), 500

@bp.route('/award', methods=['POST'])
@jwt_required()
def award_points():
    current_branch = get_current_branch()
    if not current_branch:
        return jsonify({'error': 'Unauthorized. Only branches can award points.'}), 403

    data = request.get_json()
    qr_token = data.get('qr_token')
    amount = data.get('amount')

    if not qr_token or amount is None:
        return jsonify({'error': 'Missing QR token or amount'}), 400

    print(f"DEBUG: Processing Transaction. Amount: {amount}")

    try:
        amount = round(float(amount), 2)
        if amount <= 0:
            return jsonify({'error': 'Amount must be positive'}), 400
    except ValueError:
        return jsonify({'error': 'Invalid amount format'}), 400

    # Validate and decode the QR token
    try:
        decoded = decode_token(qr_token)

        # Verify it's a QR scan token
        if decoded.get('type') != 'qr_scan':
            return jsonify({'error': 'Invalid QR code. Please scan a valid member QR code.'}), 400

        user_id = decoded.get('sub')

        if not user_id:
            return jsonify({'error': 'Invalid QR code format'}), 400

        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
    except ExpiredSignatureError:
        return jsonify({'error': 'QR code has expired. Please ask customer to refresh their code.'}), 400
    except InvalidTokenError:
        return jsonify({'error': 'Invalid QR code. Only Lakeview Haus member QR codes are accepted.'}), 400
    except Exception as e:
        print(f"QR Token Error: {e}")
        return jsonify({'error': 'Failed to validate QR code'}), 500

    # Calculate Points (1:1 Ratio with Branch Multiplier)
    base_points = amount
    branch_multiplier = current_branch.points_multiplier or 1.0
    points_earned = round(base_points * branch_multiplier, 2)

    # Create Transaction
    tx = Transaction(
        branch_id=current_branch.id,
        member_id=user.id,
        amount_spent=amount,
        points_earned=points_earned,
        transaction_type='purchase'
    )

    # Update User Points (Balance & Lifetime)
    user.add_points(points_earned)

    db.session.add(tx)
    db.session.commit()

    # Real-time Notification
    from app.services.notification_service import NotificationService
    NotificationService.send_notification(
        user_id=user.id,
        title='Points Received! 🎉',
        body=f'You earned {round(points_earned, 2)} points at {current_branch.name}!',
        type='transaction',
        data={
            'points_earned': round(points_earned, 2),
            'new_balance': round(user.points_balance, 2),
            'branch_name': current_branch.name,
            'transaction_id': tx.id
        }
    )

    return jsonify({
        'message': 'Points awarded successfully',
        'points_earned': round(points_earned, 2),
        'new_balance': round(user.points_balance or 0.0, 2),
        'points_balance': round(user.points_balance or 0.0, 2),
        'points_lifetime': round(user.points_lifetime or 0.0, 2),
        'user_name': user.username
    }), 200

@bp.route('/history', methods=['GET'])
@jwt_required()
def transaction_history():
    current_identity = get_jwt_identity()
    # Check if user is a member (not a merchant/branch)
    if current_identity.startswith('m_'):
        return jsonify({'error': 'Only members can view transaction history'}), 403

    user_id = current_identity
    
    # Check query params for limit/page if needed, but for now just fetching all or limit 50
    transactions = Transaction.query.filter_by(member_id=user_id).order_by(Transaction.timestamp.desc()).limit(50).all()
    
    results = []
    for tx in transactions:
        results.append({
            'id': tx.id,
            'amount_spent': tx.amount_spent or 0.00,
            'points_earned': tx.points_earned,
            'transaction_type': tx.transaction_type,
            'date': tx.timestamp.isoformat(),
            'branch_name': tx.branch.name if tx.branch else 'Unknown Branch'
        })
        
    return jsonify(results), 200
