from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_mail import Mail, Message
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

load_dotenv()

db = SQLAlchemy()
migrate = Migrate()
mail = None
limiter = Limiter(key_func=get_remote_address, storage_uri="memory://")
scheduler = None


def _cancel_expired_orders(app):
    """Cancel any pending orders past their payment window. Runs every minute via scheduler."""
    from app.models.order import Order
    from app.routes.order import _cancel_order, _emit_order_update
    with app.app_context():
        cutoff = datetime.utcnow() - timedelta(minutes=Order.PAYMENT_TIMEOUT_MINUTES)
        stale = Order.query.filter(
            Order.payment_status == 'pending',
            Order.status != 'cancelled',
            Order.created_at < cutoff,
        ).all()
        for o in stale:
            _cancel_order(o)
        if stale:
            db.session.commit()
            for o in stale:
                _emit_order_update(o)
            print(f'[scheduler] cancelled {len(stale)} expired orders (vouchers refunded, sockets notified)')

def create_app():
    global mail
    app = Flask(__name__)
    
    # Configuration
    # Use environment variable or default to local docker port 5433
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'postgresql://lakeview:password@localhost:5433/lakeview_db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # JWT Configuration
    app.config['JWT_SECRET_KEY'] = 'super-secret-key-change-this' # Change this!
    jwt = JWTManager(app)

    # Email Configuration
    app.config['MAIL_SERVER'] = 'smtp.gmail.com' # Example, user will need to configure real SMTP
    app.config['MAIL_PORT'] = 587
    app.config['MAIL_USE_TLS'] = True
    app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME', 'example@gmail.com')
    app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD', 'your-password')
    
    mail = Mail(app)

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app)
    limiter.init_app(app)

    # Initialize SocketIO
    from app.services.socket_service import socketio
    socketio.init_app(app, cors_allowed_origins="*", async_mode='gevent')

    # Import models explicitly so Alembic sees them and they are registered with SQLAlchemy
    from app.models.user import User
    from app.models.check_in import DailyCheckIn
    from app.models.merchant import Merchant, Branch
    from app.models.transaction import Transaction
    from app.models.notification import Notification
    from app.models.reward import Reward, UserReward, UserVoucher
    from app.models.menu import MenuCategory, Product, ProductOptionGroup, ProductOption, Collection, CollectionItem
    from app.models.marketing import HomeBanner, HomeTopPick
    from app.models.lucky_draw import LuckyDraw
    from app.models.lucky_draw_prize import LuckyDrawPrize
    from app.models.lucky_draw_history import LuckyDrawHistory
    from app.models.config import AppConfig
    from app.models.payment import Payment
    from app.models.order import Order

    # Register Blueprints
    from app.routes import auth, gamification, merchant, menu, upload, rewards
    app.register_blueprint(auth.bp)
    app.register_blueprint(gamification.bp)
    app.register_blueprint(merchant.bp)
    app.register_blueprint(menu.bp)
    app.register_blueprint(upload.bp)
    app.register_blueprint(rewards.bp)
    
    from app.routes import transaction
    app.register_blueprint(transaction.bp)

    from app.routes import customer
    app.register_blueprint(customer.bp)

    from app.routes import marketing
    app.register_blueprint(marketing.bp)

    from app.routes import merchant_lucky_draw, user_lucky_draw
    app.register_blueprint(merchant_lucky_draw.bp)
    app.register_blueprint(user_lucky_draw.bp)

    from app.routes import websocket_debug
    app.register_blueprint(websocket_debug.bp)

    from app.routes import notifications
    app.register_blueprint(notifications.bp)

    from app.routes import contact
    app.register_blueprint(contact.bp)

    from app.routes import config
    app.register_blueprint(config.config_bp, url_prefix='/config')

    from app.routes import payment
    app.register_blueprint(payment.bp)

    from app.routes import order
    app.register_blueprint(order.bp)


    @app.route('/')
    def hello():
        return "Lakeview Haus API is running!"

    # Start background scheduler for auto-cancelling expired orders.
    # Guard against double-start under Flask's dev reloader.
    global scheduler
    should_start = os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not app.debug
    if should_start and scheduler is None:
        scheduler = BackgroundScheduler(daemon=True)
        scheduler.add_job(lambda: _cancel_expired_orders(app), 'interval', minutes=1)
        scheduler.start()

    return app
