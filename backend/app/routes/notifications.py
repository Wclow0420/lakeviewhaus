from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.notification import Notification
from app.services.notification_service import NotificationService
from app import db

bp = Blueprint('notifications', __name__, url_prefix='/notifications')

@bp.route('', methods=['GET'])
@jwt_required()
def get_notifications():
    user_id = get_jwt_identity()
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    pagination = Notification.query.filter_by(user_id=user_id)\
        .order_by(Notification.created_at.desc())\
        .paginate(page=page, per_page=per_page, error_out=False)
        
    unread_count = NotificationService.get_unread_count(user_id)
    
    return jsonify({
        'notifications': [n.to_dict() for n in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'page': page,
        'unread_count': unread_count
    }), 200

@bp.route('/unread-count', methods=['GET'])
@jwt_required()
def get_unread_count():
    user_id = get_jwt_identity()
    count = NotificationService.get_unread_count(user_id)
    return jsonify({'count': count}), 200

@bp.route('/<string:id>/read', methods=['POST'])
@jwt_required()
def mark_read(id):
    user_id = get_jwt_identity()
    success = NotificationService.mark_as_read(id, user_id)
    if success:
        return jsonify({'message': 'Marked as read'}), 200
    return jsonify({'error': 'Notification not found or already read'}), 404

@bp.route('/read-all', methods=['POST'])
@jwt_required()
def mark_all_read():
    user_id = get_jwt_identity()
    NotificationService.mark_all_as_read(user_id)
    return jsonify({'message': 'All notifications marked as read'}), 200
