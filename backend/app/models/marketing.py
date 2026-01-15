from app import db
from datetime import datetime

class HomeBanner(db.Model):
    __tablename__ = 'home_banners'

    id = db.Column(db.Integer, primary_key=True)
    merchant_id = db.Column(db.Integer, db.ForeignKey('merchants.id'), nullable=False)
    image_url = db.Column(db.String(500), nullable=False)
    title = db.Column(db.String(100), nullable=True)
    sort_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'image_url': self.image_url,
            'title': self.title,
            'sort_order': self.sort_order,
            'is_active': self.is_active
        }

class HomeTopPick(db.Model):
    __tablename__ = 'home_top_picks'

    id = db.Column(db.Integer, primary_key=True)
    merchant_id = db.Column(db.Integer, db.ForeignKey('merchants.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship
    product = db.relationship('Product')

    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'sort_order': self.sort_order,
            'product': self.product.to_dict() if self.product else None
        }
