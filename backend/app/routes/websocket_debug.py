from flask import Blueprint, jsonify, request
from app.services.socket_service import SocketService
from flask_jwt_extended import jwt_required, get_jwt_identity

bp = Blueprint('websocket_debug', __name__, url_prefix='/ws-debug')

@bp.route('/test-emit', methods=['POST'])
@jwt_required()
def test_emit():
    """Test emitting an event to the requesting user"""
    user_id = get_jwt_identity()
    data = request.json or {}
    message = data.get('message', 'Hello from WebSocket!')
    
    SocketService.emit_to_user(user_id, 'test_event', {'message': message})
    
    return jsonify({'status': 'sent', 'to': user_id, 'message': message}), 200

@bp.route('/broadcast', methods=['POST'])
def broadcast():
    """Test broadcasting to all"""
    data = request.json or {}
    message = data.get('message', 'Broadcast Message')
    
    SocketService.emit_to_all('broadcast_event', {'message': message})
    
    return jsonify({'status': 'broadcast_sent', 'message': message}), 200
