from app import create_app
from app.services.socket_service import socketio

app = create_app()

if __name__ == '__main__':
    # usage of socketio.run is required for websocket support
    socketio.run(app, host='0.0.0.0', port=5002)
