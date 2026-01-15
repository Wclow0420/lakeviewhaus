from flask import Blueprint, request, jsonify
from app import db
from app.models.merchant import Branch
from app.models.transaction import Transaction
from app.models.reward import UserReward, Reward
from app.models.user import User
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, and_, desc
from datetime import datetime, timedelta

bp = Blueprint('merchant', __name__, url_prefix='/merchant')

def get_current_branch():
    identity = get_jwt_identity()
    # Identity format: "m_{merchant_id}_b_{branch_id}"
    if not identity or not identity.startswith('m_'):
        return None
    
    try:
        parts = identity.split('_')
        branch_id = parts[3]
        return Branch.query.get(branch_id)
    except:
        return None

@bp.route('/branches', methods=['GET'])
@jwt_required()
def get_branches():
    current_branch = get_current_branch()
    if not current_branch:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if not current_branch.is_main:
         return jsonify({'error': 'Permission denied. Only Main Branch can manage branches.'}), 403

    branches = Branch.query.filter_by(merchant_id=current_branch.merchant_id).all()
    
    return jsonify([{
        'id': b.id,
        'name': b.name,
        'username': b.username,
        'location': b.location,
        'is_main': b.is_main,
        'is_active': b.is_active,
        'points_multiplier': b.points_multiplier or 1.0,
        'created_at': b.created_at.isoformat()
    } for b in branches]), 200

@bp.route('/branches', methods=['POST'])
@jwt_required()
def create_branch():
    current_branch = get_current_branch()
    if not current_branch or not current_branch.is_main:
        return jsonify({'error': 'Permission denied'}), 403

    data = request.get_json()
    name = data.get('name')
    username = data.get('username')
    password = data.get('password')
    location = data.get('location')

    if not all([name, username, password]):
        return jsonify({'error': 'Missing required fields'}), 400

    if Branch.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 400

    new_branch = Branch(
        merchant_id=current_branch.merchant_id,
        name=name,
        username=username,
        password_hash=generate_password_hash(password),
        location=location,
        is_main=False, # Created branches are sub-branches default
        is_active=True
    )

    db.session.add(new_branch)
    db.session.commit()

    return jsonify({'message': 'Branch created successfully', 'id': new_branch.id}), 201

@bp.route('/branches/<int:branch_id>', methods=['PUT'])
@jwt_required()
def update_branch(branch_id):
    current_branch = get_current_branch()
    if not current_branch or not current_branch.is_main:
        return jsonify({'error': 'Permission denied'}), 403

    target_branch = Branch.query.get(branch_id)
    if not target_branch:
        return jsonify({'error': 'Branch not found'}), 404
        
    if target_branch.merchant_id != current_branch.merchant_id:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()
    
    if 'name' in data: target_branch.name = data['name']
    if 'username' in data: 
        # Check uniqueness if changed
        if data['username'] != target_branch.username:
             if Branch.query.filter_by(username=data['username']).first():
                 return jsonify({'error': 'Username already exists'}), 400
             target_branch.username = data['username']

    if 'location' in data: target_branch.location = data['location']

    if 'points_multiplier' in data:
        try:
            multiplier = float(data['points_multiplier'])
            if multiplier < 0:
                return jsonify({'error': 'Multiplier must be positive'}), 400
            target_branch.points_multiplier = multiplier
        except ValueError:
            return jsonify({'error': 'Invalid multiplier value'}), 400

    if 'password' in data and data['password']:
        target_branch.password_hash = generate_password_hash(data['password'])

    if 'is_active' in data:
        # Prevent deactivating self
        if target_branch.id == current_branch.id and not data['is_active']:
             return jsonify({'error': 'Cannot deactivate your own session'}), 400
        target_branch.is_active = bool(data['is_active'])

    db.session.commit()

    return jsonify({'message': 'Branch updated successfully'}), 200

@bp.route('/branches/<int:branch_id>', methods=['DELETE'])
@jwt_required()
def delete_branch(branch_id):
    current_branch = get_current_branch()
    if not current_branch or not current_branch.is_main:
        return jsonify({'error': 'Permission denied'}), 403

    target_branch = Branch.query.get(branch_id)
    if not target_branch:
        return jsonify({'error': 'Branch not found'}), 404
        
    if target_branch.merchant_id != current_branch.merchant_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if target_branch.id == current_branch.id:
        return jsonify({'error': 'Cannot delete your own session'}), 400
        
    if target_branch.is_main:
         return jsonify({'error': 'Cannot delete Main Branch'}), 400

    db.session.delete(target_branch)
    db.session.commit()

    return jsonify({'message': 'Branch deleted successfully'}), 200

@bp.route('/branches/<int:branch_id>/status', methods=['PUT'])
@jwt_required()
def toggle_branch_status(branch_id):
    current_branch = get_current_branch()
    if not current_branch or not current_branch.is_main:
        return jsonify({'error': 'Permission denied'}), 403

    target_branch = Branch.query.get(branch_id)
    if not target_branch:
        return jsonify({'error': 'Branch not found'}), 404
        
    if target_branch.merchant_id != current_branch.merchant_id:
        return jsonify({'error': 'Unauthorized'}), 403

    if target_branch.id == current_branch.id:
         return jsonify({'error': 'Cannot deactivate your own session'}), 400

    data = request.get_json()
    is_active = data.get('is_active')
    
    if is_active is None:
        return jsonify({'error': 'Missing is_active status'}), 400

    target_branch.is_active = bool(is_active)
    db.session.commit()

    return jsonify({'message': 'Branch status updated', 'is_active': target_branch.is_active}), 200
    return jsonify({'message': 'Branch status updated', 'is_active': target_branch.is_active}), 200

@bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    current_branch = get_current_branch()
    if not current_branch:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    
    if 'name' in data: current_branch.name = data['name']
    if 'location' in data: current_branch.location = data['location']
    
    if 'username' in data and data['username'] != current_branch.username:
        if Branch.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 400
        current_branch.username = data['username']

    if 'logo_url' in data: current_branch.logo_url = data['logo_url']

    # Referral Config (Main Branch Only)
    if current_branch.is_main:
        if 'referral_referrer_reward_id' in data:
            current_branch.merchant.referral_referrer_reward_id = data['referral_referrer_reward_id']
        if 'referral_referee_reward_id' in data:
            current_branch.merchant.referral_referee_reward_id = data['referral_referee_reward_id']
        
        if 'referral_referrer_points' in data:
            current_branch.merchant.referral_referrer_points = int(data['referral_referrer_points'])
        if 'referral_referee_points' in data:
            current_branch.merchant.referral_referee_points = int(data['referral_referee_points'])

    db.session.commit()
    return jsonify({'message': 'Profile updated successfully', 
                    'user': {
                        'id': current_branch.id,
                        'name': current_branch.name,
                        'username': current_branch.username,
                        'is_main': current_branch.is_main,
                        'logo_url': current_branch.logo_url
                    }}), 200

@bp.route('/password', methods=['PUT'])
@jwt_required()
def update_password():
    current_branch = get_current_branch()
    if not current_branch:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    old_password = data.get('old_password')
    new_password = data.get('new_password')

    if not old_password or not new_password:
        return jsonify({'error': 'Both old and new passwords are required'}), 400

    if not check_password_hash(current_branch.password_hash, old_password):
        return jsonify({'error': 'Incorrect current password'}), 400

    current_branch.password_hash = generate_password_hash(new_password)
    db.session.commit()

    return jsonify({'message': 'Password updated successfully'}), 200

@bp.route('/stats', methods=['GET'])
@jwt_required()
def get_merchant_stats():
    current_branch = get_current_branch()
    if not current_branch:
        return jsonify({'error': 'Unauthorized'}), 401

    # Determine scope
    target_branch_id = None
    if current_branch.is_main:
        # Main branch can filter by specific branch or view all (None)
        req_branch_id = request.args.get('branch_id')
        if req_branch_id and req_branch_id != 'all':
            try:
                target_branch_id = int(req_branch_id)
            except:
                pass 
    else:
        # Regular branch is locked to self
        target_branch_id = current_branch.id

    # 1. Summary Stats (Totals)
    # Total Points Issued
    points_query = db.session.query(func.sum(Transaction.points_earned))
    if target_branch_id:
        points_query = points_query.filter(Transaction.branch_id == target_branch_id)
    total_points = points_query.scalar() or 0

    # Total Redemptions
    redemption_query = db.session.query(func.count(UserReward.id)).filter(UserReward.status == 'used')
    if target_branch_id:
        redemption_query = redemption_query.filter(UserReward.used_by_branch_id == target_branch_id)
    total_redemptions = redemption_query.scalar() or 0

    # Today's Activity
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_points_query = db.session.query(func.sum(Transaction.points_earned)).filter(Transaction.timestamp >= today_start)
    if target_branch_id:
        today_points_query = today_points_query.filter(Transaction.branch_id == target_branch_id)
    today_points = today_points_query.scalar() or 0

    # 2. Chart Data (Last 7 Days Points)
    seven_days_ago = today_start - timedelta(days=6)
    
    chart_query = db.session.query(
        func.date(Transaction.timestamp).label('date'),
        func.sum(Transaction.points_earned).label('points')
    ).filter(Transaction.timestamp >= seven_days_ago)
    
    if target_branch_id:
        chart_query = chart_query.filter(Transaction.branch_id == target_branch_id)
        
    chart_data_raw = chart_query.group_by(func.date(Transaction.timestamp)).all()
    
    # Process chart data to ensure all days have values
    chart_map = {str(r.date): r.points for r in chart_data_raw}
    chart_result = []
    
    labels = []
    data_points = []
    
    for i in range(7):
        d = seven_days_ago + timedelta(days=i)
        d_str = d.strftime('%Y-%m-%d')
        label = d.strftime('%d/%m') # dd/mm
        
        val = chart_map.get(d_str, 0)
        chart_result.append({'date': d_str, 'points': val})
        labels.append(label)
        data_points.append(val)

    return jsonify({
        'summary': {
            'total_points_issued': round(total_points, 2),
            'total_redemptions': total_redemptions,
            'today_points_issued': round(today_points, 2)
        },
        'chart': {
            'labels': labels,
            'data': data_points
        }
    }), 200


@bp.route('/stats/details', methods=['GET'])
@jwt_required()
def get_stat_details():
    current_branch = get_current_branch()
    if not current_branch:
        return jsonify({'error': 'Unauthorized'}), 401

    stat_type = request.args.get('type') # 'redemptions' or 'points'
    period = request.args.get('period', 'all') # 'today', 'all'
    
    # Determine scope
    target_branch_id = None
    if current_branch.is_main:
        req_branch_id = request.args.get('branch_id')
        if req_branch_id and req_branch_id != 'all':
            try: target_branch_id = int(req_branch_id)
            except: pass 
    else:
        target_branch_id = current_branch.id

    results = []

    if stat_type == 'redemptions':
        query = db.session.query(UserReward)\
            .join(Reward)\
            .join(User)\
            .outerjoin(Branch, UserReward.used_by_branch_id == Branch.id)\
            .filter(UserReward.status == 'used')

        if target_branch_id:
            query = query.filter(UserReward.used_by_branch_id == target_branch_id)
        
        if period == 'today':
            today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            query = query.filter(UserReward.used_at >= today_start)

        # Fetch last 100
        items = query.order_by(desc(UserReward.used_at)).limit(100).all()

        for item in items:
            results.append({
                'id': item.id,
                'title': item.reward.title,
                'type': item.reward.reward_type,
                'discount_value': item.reward.discount_value,
                'branch_name': item.used_at_branch.name if getattr(item, 'used_at_branch', None) else (Branch.query.get(item.used_by_branch_id).name if item.used_by_branch_id else 'Unknown'),
                # Note: `used_at_branch` might not be set in relationship, used `used_by_branch_id` manual lookup fallback 
                'user_name': item.user.username,
                'timestamp': item.used_at.isoformat() if item.used_at else None
            })

    elif stat_type == 'points':
        query = db.session.query(Transaction)\
            .join(User)\
            .join(Branch)\
            .order_by(desc(Transaction.timestamp))

        if target_branch_id:
            query = query.filter(Transaction.branch_id == target_branch_id)
            
        if period == 'today':
            today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            query = query.filter(Transaction.timestamp >= today_start)
            
        # Fetch last 100
        items = query.limit(100).all()

        for item in items:
            results.append({
                'id': item.id,
                'amount': item.amount_spent,
                'points': item.points_earned,
                'branch_name': item.branch.name, # Transaction has branch relationship usually
                'user_name': item.member.username,
                'timestamp': item.timestamp.isoformat()
            })

    return jsonify(results), 200
