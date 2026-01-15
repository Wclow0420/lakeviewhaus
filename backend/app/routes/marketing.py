from flask import Blueprint, request, jsonify
from app import db
from app.models.merchant import Branch
from app.models.marketing import HomeBanner, HomeTopPick
from app.models.menu import Product
from flask_jwt_extended import jwt_required, get_jwt_identity

bp = Blueprint('marketing', __name__, url_prefix='/marketing')

def get_current_branch():
    identity = get_jwt_identity()
    if not identity or not isinstance(identity, str) or not identity.startswith('m_'):
        return None
    try:
        parts = identity.split('_')
        branch_id = parts[3]
        return Branch.query.get(branch_id)
    except:
        return None

# --- BANNERS ---

@bp.route('/banners', methods=['GET'])
@jwt_required()
def get_banners():
    current_branch = get_current_branch()
    if not current_branch: return jsonify({'error': 'Unauthorized'}), 401
    
    # Fetch banners for this merchant
    banners = HomeBanner.query.filter_by(merchant_id=current_branch.merchant_id).order_by(HomeBanner.sort_order).all()
    return jsonify([b.to_dict() for b in banners]), 200

@bp.route('/banners', methods=['POST'])
@jwt_required()
def create_banner():
    current_branch = get_current_branch()
    if not current_branch or not current_branch.is_main:
        return jsonify({'error': 'Permission denied'}), 403

    data = request.get_json()
    if not data.get('image_url'):
        return jsonify({'error': 'Image URL required'}), 400

    new_banner = HomeBanner(
        merchant_id=current_branch.merchant_id,
        image_url=data['image_url'],
        title=data.get('title'),
        sort_order=data.get('sort_order', 0)
    )
    db.session.add(new_banner)
    db.session.commit()
    return jsonify(new_banner.to_dict()), 201

@bp.route('/banners/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_banner(id):
    current_branch = get_current_branch()
    if not current_branch or not current_branch.is_main:
        return jsonify({'error': 'Permission denied'}), 403

    banner = HomeBanner.query.get(id)
    if not banner or banner.merchant_id != current_branch.merchant_id:
        return jsonify({'error': 'Not found'}), 404

    db.session.delete(banner)
    db.session.commit()
    return jsonify({'message': 'Deleted'}), 200

# --- TOP PICKS ---

@bp.route('/top-picks', methods=['GET'])
@jwt_required()
def get_top_picks():
    current_branch = get_current_branch()
    if not current_branch: return jsonify({'error': 'Unauthorized'}), 401

    items = HomeTopPick.query.filter_by(merchant_id=current_branch.merchant_id).order_by(HomeTopPick.sort_order).all()
    return jsonify([item.to_dict() for item in items]), 200

@bp.route('/top-picks', methods=['POST'])
@jwt_required()
def add_top_pick():
    current_branch = get_current_branch()
    if not current_branch or not current_branch.is_main:
        return jsonify({'error': 'Permission denied'}), 403

    data = request.get_json()
    product_id = data.get('product_id')
    if not product_id:
        return jsonify({'error': 'Product ID required'}), 400

    # Verify product belongs to merchant (any branch)
    product = Product.query.get(product_id)
    # Check simple ownership via branch -> merchant link
    # We can do a join check or assumes product.branch.merchant_id check if we loaded branch
    # Let's trust product exists and check db relationship
    # Or just fetch branch of product
    target_branch = Branch.query.get(product.branch_id)
    if not target_branch or target_branch.merchant_id != current_branch.merchant_id:
        return jsonify({'error': 'Invalid product'}), 403

    # Check if already exists
    existing = HomeTopPick.query.filter_by(merchant_id=current_branch.merchant_id, product_id=product_id).first()
    if existing:
        return jsonify({'error': 'Product already in Top Picks'}), 400

    new_pick = HomeTopPick(
        merchant_id=current_branch.merchant_id,
        product_id=product_id,
        sort_order=data.get('sort_order', 0)
    )
    db.session.add(new_pick)
    db.session.commit()
    return jsonify(new_pick.to_dict()), 201

@bp.route('/top-picks/<int:id>', methods=['DELETE'])
@jwt_required()
def remove_top_pick(id):
    current_branch = get_current_branch()
    if not current_branch or not current_branch.is_main:
        return jsonify({'error': 'Permission denied'}), 403

    item = HomeTopPick.query.get(id)
    if not item or item.merchant_id != current_branch.merchant_id:
        return jsonify({'error': 'Not found'}), 404

    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': 'Removed'}), 200

@bp.route('/banners/reorder', methods=['POST'])
@jwt_required()
def reorder_banners():
    current_branch = get_current_branch()
    if not current_branch or not current_branch.is_main: return jsonify({'error': 'Permission denied'}), 403

    data = request.get_json()
    ids = data.get('ids', [])
    
    # Update all
    for index, id in enumerate(ids):
        item = HomeBanner.query.get(id)
        if item and item.merchant_id == current_branch.merchant_id:
            item.sort_order = index
    
    db.session.commit()
    return jsonify({'message': 'Updated'}), 200

@bp.route('/top-picks/reorder', methods=['POST'])
@jwt_required()
def reorder_top_picks():
    current_branch = get_current_branch()
    if not current_branch or not current_branch.is_main: return jsonify({'error': 'Permission denied'}), 403

    data = request.get_json()
    ids = data.get('ids', [])
    
    # Update all
    for index, id in enumerate(ids):
        item = HomeTopPick.query.get(id)
        if item and item.merchant_id == current_branch.merchant_id:
            item.sort_order = index
    
    db.session.commit()
    return jsonify({'message': 'Updated'}), 200
