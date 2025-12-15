from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_mail import Mail, Message
import os
from dotenv import load_dotenv

load_dotenv()

db = SQLAlchemy()
migrate = Migrate()
mail = None

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

    # Import models explicitly so Alembic sees them and they are registered with SQLAlchemy
    from app.models.user import User
    from app.models.check_in import DailyCheckIn
    from app.models.merchant import Merchant, Branch
    from app.models.transaction import Transaction
    from app.models.reward import Reward, UserVoucher

    # Register Blueprints
    from app.routes import auth
    app.register_blueprint(auth.bp)

    @app.route('/')
    def hello():
        return "Lakeview Haus API is running!"

    return app
