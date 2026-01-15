from app import db
from datetime import datetime

class MenuCategory(db.Model):
    __tablename__ = 'menu_categories'

    id = db.Column(db.Integer, primary_key=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    sort_order = db.Column(db.Integer, default=0)
    image_url = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship
    products = db.relationship('Product', backref='category', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'branch_id': self.branch_id,
            'name': self.name,
            'image_url': self.image_url,
            'sort_order': self.sort_order
        }

class Product(db.Model):
    __tablename__ = 'products'

    id = db.Column(db.Integer, primary_key=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('menu_categories.id'), nullable=False)
    
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    price = db.Column(db.Float, nullable=False, default=0.0)
    image_url = db.Column(db.String(500), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    is_recommended = db.Column(db.Boolean, default=False)
    is_new = db.Column(db.Boolean, default=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    # Many-to-Many relationship with ProductOptionGroup
    option_groups = db.relationship('ProductOptionGroup', secondary='product_options_association', backref='products', lazy='subquery')
    
    def to_dict(self):
        return {
            'id': self.id,
            'branch_id': self.branch_id,
            'category_id': self.category_id,
            'name': self.name,
            'description': self.description,
            'price': self.price,
            'image_url': self.image_url,
            'is_active': self.is_active,
            'is_recommended': self.is_recommended,
            'is_new': self.is_new,
            'options': [g.to_dict() for g in self.option_groups]
        }

# Association Table for Many-to-Many
product_options_association = db.Table('product_options_association',
    db.Column('product_id', db.Integer, db.ForeignKey('products.id'), primary_key=True),
    db.Column('option_group_id', db.Integer, db.ForeignKey('product_option_groups.id'), primary_key=True)
)

class ProductOptionGroup(db.Model):
    __tablename__ = 'product_option_groups'

    id = db.Column(db.Integer, primary_key=True)
    # product_id removed, replaced by association
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False) # Owner of this option group template
    
    name = db.Column(db.String(100), nullable=False) # e.g. "Ice Level", "Toppings"
    min_selection = db.Column(db.Integer, default=1) # 1 = Mandatory, 0 = Optional
    max_selection = db.Column(db.Integer, default=1) # 1 = Single Choice (Radio), >1 = Checkbox

    options = db.relationship('ProductOption', backref='group', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'min_selection': self.min_selection,
            'max_selection': self.max_selection,
            'items': [o.to_dict() for o in self.options]
        }

class ProductOption(db.Model):
    __tablename__ = 'product_options'

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('product_option_groups.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False) # e.g. "Less Ice", "Extra Shot"
    price_adjustment = db.Column(db.Float, default=0.0) # e.g. +2.00

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'price_adjustment': self.price_adjustment
        }

class Collection(db.Model):
    __tablename__ = 'collections'

    id = db.Column(db.Integer, primary_key=True)
    merchant_id = db.Column(db.Integer, db.ForeignKey('merchants.id'), nullable=False)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=True) # Null = Global HQ Collection
    
    name = db.Column(db.String(200), nullable=False) # e.g. "Hot Deals"
    type = db.Column(db.String(50), default='list') # banner, list, carousel
    is_active = db.Column(db.Boolean, default=True)
    
    # Many-to-Many with products
    items = db.relationship('CollectionItem', backref='collection', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        sorted_items = sorted(self.items, key=lambda i: i.sort_order)
        return {
            'id': self.id,
            'merchant_id': self.merchant_id,
            'branch_id': self.branch_id,
            'name': self.name,
            'type': self.type,
            'is_global': self.branch_id is None,
            'items': [{'id': i.id, 'product_id': i.product_id, 'sort_order': i.sort_order} for i in sorted_items]
        }

class CollectionItem(db.Model):
    __tablename__ = 'collection_items'
    
    id = db.Column(db.Integer, primary_key=True)
    collection_id = db.Column(db.Integer, db.ForeignKey('collections.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    
    # We might want to sort items in a collection
    sort_order = db.Column(db.Integer, default=0)

    product = db.relationship('Product') # Fetch product details easily
