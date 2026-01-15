from flask import Blueprint, request, jsonify
from app import db
from app.models.merchant import Branch
from app.models.menu import MenuCategory, Product
from app.models.marketing import HomeBanner, HomeTopPick

bp = Blueprint('customer', __name__, url_prefix='/customer')

# --- BRANCHES ---

@bp.route('/branches', methods=['GET'])
def get_public_branches():
    # Helper to just return all active branches for now
    branches = Branch.query.filter_by(is_active=True).all()
    
    return jsonify([{
        'id': b.id,
        'name': b.name,
        'location': b.location,
        'merchant_id': b.merchant_id,
        'is_main': b.is_main,
        'logo_url': b.logo_url
    } for b in branches]), 200

# --- MENU ---

@bp.route('/menu/categories', methods=['GET'])
def get_public_categories():
    branch_id = request.args.get('branch_id')
    if not branch_id:
        return jsonify({'error': 'branch_id required'}), 400
    
    cats = MenuCategory.query.filter_by(branch_id=branch_id).order_by(MenuCategory.sort_order).all()
    return jsonify([c.to_dict() for c in cats]), 200

@bp.route('/menu/products', methods=['GET'])
def get_public_products():
    branch_id = request.args.get('branch_id')
    if not branch_id:
        return jsonify({'error': 'branch_id required'}), 400

    query = Product.query.filter_by(branch_id=branch_id)
    
    category_id = request.args.get('category_id')
    if category_id:
        query = query.filter_by(category_id=category_id)
        
    products = query.order_by(Product.is_active.desc(), Product.name).all()
    return jsonify([p.to_dict() for p in products]), 200

# --- MARKETING ---

@bp.route('/marketing/banners', methods=['GET'])
def get_public_banners():
    # Only support single merchant for now, or require merchant_id param
    # Assuming single merchant system for now or fetch all active
    banners = HomeBanner.query.filter_by(is_active=True).order_by(HomeBanner.sort_order).all()
    return jsonify([{
        'id': b.id,
        'image_url': b.image_url,
        'title': b.title
    } for b in banners]), 200

@bp.route('/marketing/top-picks', methods=['GET'])
def get_public_top_picks():
    picks = HomeTopPick.query.order_by(HomeTopPick.sort_order).all()
    return jsonify([{
        'id': p.id,
        'product': p.product.to_dict() if p.product else None
    } for p in picks if p.product and p.product.is_active]), 200
