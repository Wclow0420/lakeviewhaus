from app import db
from datetime import datetime

class AppConfig(db.Model):
    __tablename__ = 'app_config'

    key = db.Column(db.String(50), primary_key=True)
    value = db.Column(db.String(255), nullable=False)
    description = db.Column(db.String(255))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<AppConfig {self.key}={self.value}>'
