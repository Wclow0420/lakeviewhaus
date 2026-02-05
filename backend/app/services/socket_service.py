from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_jwt_extended import decode_token
from flask import request

socketio = SocketIO(cors_allowed_origins="*")

class SocketService:
    @staticmethod
    def emit_to_user(user_id, event, data):
        """Emit data to a specific user's room"""
        socketio.emit(event, data, room=user_id)

    @staticmethod
    def emit_to_all(event, data):
        """Emit data to all connected clients"""
        socketio.emit(event, data)

    @staticmethod
    def emit_to_merchant(merchant_id, event, data):
        """Emit data to a merchant's room (e.g. for order updates)"""
        room = f"merchant_{merchant_id}"
        socketio.emit(event, data, room=room)


# Socket Events
@socketio.on('connect')
def handle_connect():
    # Attempt to authenticate via query param token
    token = request.args.get('token')
    
    if not token:
        # Allow anonymous connection? Or reject.
        # For now, let's allow but they won't be joined to private rooms.
        print("Anonymous client connected")
        return

    try:
        # Decode token manually since @jwt_required doesn't work easily with standard connect
        decoded = decode_token(token)
        user_identity = decoded['sub']
        
        # User ID is the identity (or merchant ID "m_...")
        join_room(user_identity)
        print(f"Client connected and joined room: {user_identity}")
        
        # If it's a merchant employee, maybe join a merchant room too?
        # Identity for branches is "m_{mid}_b_{bid}" or similar.
        if isinstance(user_identity, str) and user_identity.startswith('m_'):
            parts = user_identity.split('_')
            if len(parts) >= 2:
                merchant_id = parts[1]
                merchant_room = f"merchant_{merchant_id}"
                join_room(merchant_room)
                print(f"Client joined merchant room: {merchant_room}")

    except Exception as e:
        print(f"Connection auth failed: {e}")
        # We generally don't disconnect, just don't join privileged rooms
        pass

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('join')
def on_join(data):
    """Allow manual room joining if needed"""
    room = data['room']
    join_room(room)
    print(f"Client joined room: {room}")

@socketio.on('leave')
def on_leave(data):
    room = data['room']
    leave_room(room)
    print(f"Client left room: {room}")
