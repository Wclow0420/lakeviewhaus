from flask import Blueprint, request, jsonify
from app import db
from app.models.merchant import Branch
from app.models.menu import MenuCategory, Product, ProductOptionGroup, ProductOption, Collection, CollectionItem
from flask_jwt_extended import jwt_required, get_jwt_identity

bp = Blueprint('menu', __name__, url_prefix='/menu')

def get_current_branch():
    identity = get_jwt_identity()
    if not identity: return None
    # Handle both string "m_X_b_Y" and integer user IDs (though this route usually for merchants)
    if isinstance(identity, str) and identity.startswith('m_'):
        try:
            parts = identity.split('_')
            branch_id = parts[3]
            return Branch.query.get(branch_id)
        except:
            return None
    return None

# Helper to resolve target branch
def resolve_branch(current_branch):
    target_id = request.args.get('target_branch_id')
    if target_id and current_branch.is_main:
        return int(target_id)
    return current_branch.id

# --- CATEGORIES ---

@bp.route('/categories', methods=['GET'])
@jwt_required()
def get_categories():
    current_branch = get_current_branch()
    if not current_branch: return jsonify({'error': 'Unauthorized'}), 401
    
    target_id = request.args.get('target_branch_id')
    
    if current_branch.is_main and target_id == 'ALL':
        categories = MenuCategory.query.order_by(MenuCategory.branch_id, MenuCategory.sort_order).all()
    else:
        target_branch_id = resolve_branch(current_branch)
        categories = MenuCategory.query.filter_by(branch_id=target_branch_id).order_by(MenuCategory.sort_order).all()

    return jsonify([c.to_dict() for c in categories]), 200

@bp.route('/categories', methods=['POST'])
@jwt_required()
def create_category():
    current_branch = get_current_branch()
    if not current_branch: return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    name = data.get('name')
    if not name: return jsonify({'error': 'Name is required'}), 400

    target_id = current_branch.id
    if 'branch_id' in data and current_branch.is_main:
        target_id = data['branch_id']

    new_cat = MenuCategory(
        branch_id=target_id,
        name=name,
        image_url=data.get('image_url'),
        sort_order=data.get('sort_order', 0)
    )
    db.session.add(new_cat)
    db.session.commit()
    return jsonify(new_cat.to_dict()), 201

@bp.route('/categories/<int:id>', methods=['PUT', 'DELETE'])
@jwt_required()
def manage_category(id):
    current_branch = get_current_branch()
    if not current_branch: return jsonify({'error': 'Unauthorized'}), 401

    category = MenuCategory.query.get(id)
    if not category or category.branch_id != current_branch.id:
        return jsonify({'error': 'Category not found or access denied'}), 404

    if request.method == 'DELETE':
        # Check if category has products
        if category.products and len(category.products) > 0:
            return jsonify({'error': 'Cannot delete category with products'}), 400
        db.session.delete(category)
        db.session.commit()
        return jsonify({'message': 'Deleted'}), 200

    # PUT - Update category
    data = request.get_json()
    if 'name' in data: category.name = data['name']
    if 'image_url' in data: category.image_url = data['image_url']
    if 'sort_order' in data: category.sort_order = data['sort_order']

    db.session.commit()
    return jsonify(category.to_dict()), 200

# --- OPTION GROUPS (LIBRARY) ---

@bp.route('/option-groups', methods=['GET'])
@jwt_required()
def get_option_groups():
    current_branch = get_current_branch()
    if not current_branch: return jsonify({'error': 'Unauthorized'}), 401
    
    target_branch_id = resolve_branch(current_branch)
    groups = ProductOptionGroup.query.filter_by(branch_id=target_branch_id).all()
    return jsonify([g.to_dict() for g in groups]), 200

# --- PRODUCTS ---

@bp.route('/products', methods=['GET'])
@jwt_required()
def get_products():
    current_branch = get_current_branch()
    if not current_branch: return jsonify({'error': 'Unauthorized'}), 401

    target_id = request.args.get('target_branch_id')
    query = Product.query

    if current_branch.is_main and target_id == 'ALL':
        # Fetch all products from all branches
        pass 
    else:
        target_branch_id = resolve_branch(current_branch)
        query = query.filter_by(branch_id=target_branch_id)
    
    category_id = request.args.get('category_id')

    if category_id:
        query = query.filter_by(category_id=category_id)

    # Sort: Active products first (True=1, False=0, so desc() puts True first), then by name
    products = query.order_by(Product.is_active.desc(), Product.name).all()
    return jsonify([p.to_dict() for p in products]), 200

@bp.route('/products', methods=['POST'])
@jwt_required()
def create_product():
    current_branch = get_current_branch()
    if not current_branch: return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    
    if not all(k in data for k in ('name', 'price', 'category_id')):
        return jsonify({'error': 'Missing required fields'}), 400

    target_branch_id = data.get('branch_id', current_branch.id) if current_branch.is_main else current_branch.id

    new_product = Product(
        branch_id=target_branch_id,
        category_id=data['category_id'],
        name=data['name'],
        description=data.get('description', ''),
        price=float(data['price']),
        image_url=data.get('image_url'),
        is_active=True,
        is_recommended=data.get('is_recommended', False),
        is_new=data.get('is_new', False)
    )
    db.session.add(new_product)
    db.session.flush()

    if 'options' in data:
        for grp in data['options']:
            # Reuse existing if ID provided
            if 'id' in grp:
                existing = ProductOptionGroup.query.get(grp['id'])
                if existing and existing.branch_id == target_branch_id:
                     new_product.option_groups.append(existing)
            else:
                # Create New Group in Library
                new_group = ProductOptionGroup(
                    branch_id=target_branch_id,
                    name=grp['name'],
                    min_selection=grp.get('min', 0),
                    max_selection=grp.get('max', 1)
                )
                db.session.add(new_group)
                db.session.flush()

                if 'items' in grp:
                    for item in grp['items']:
                        new_opt = ProductOption(
                            group_id=new_group.id,
                            name=item['name'],
                            price_adjustment=item.get('price', 0.0)
                        )
                        db.session.add(new_opt)
                
                new_product.option_groups.append(new_group)

    db.session.commit()
    return jsonify(new_product.to_dict()), 201

@bp.route('/products/<int:id>', methods=['PUT', 'DELETE'])
@jwt_required()
def manage_product(id):
    current_branch = get_current_branch()
    if not current_branch: return jsonify({'error': 'Unauthorized'}), 401

    product = Product.query.get(id)
    if not product or product.branch_id != current_branch.id:
        return jsonify({'error': 'Product not found or access denied'}), 404

    if request.method == 'DELETE':
        db.session.delete(product)
        db.session.commit()
        return jsonify({'message': 'Deleted'}), 200

    # PUT
    data = request.get_json()
    if 'name' in data: product.name = data['name']
    if 'price' in data: product.price = float(data['price'])
    if 'description' in data: product.description = data['description']
    if 'image_url' in data: product.image_url = data['image_url']
    if 'category_id' in data: product.category_id = data['category_id']
    if 'is_active' in data: product.is_active = bool(data['is_active'])
    if 'is_recommended' in data: product.is_recommended = bool(data['is_recommended'])
    if 'is_new' in data: product.is_new = bool(data['is_new'])
    
    if 'options' in data:
        # Clear current links
        product.option_groups = []
        
        for grp in data['options']:
            if 'id' in grp:
                # UPDATE existing shared group
                existing = ProductOptionGroup.query.get(grp['id'])
                if existing and existing.branch_id == current_branch.id:
                    # Update Definition ("Edit once all got it")
                    existing.name = grp['name']
                    existing.min_selection = grp.get('min', existing.min_selection)
                    existing.max_selection = grp.get('max', existing.max_selection)
                    
                    # Replace Items
                    for opt in existing.options:
                        db.session.delete(opt)
                    
                    if 'items' in grp:
                        for item in grp['items']:
                            new_opt = ProductOption(
                                group_id=existing.id,
                                name=item['name'],
                                price_adjustment=item.get('price', 0.0)
                            )
                            db.session.add(new_opt)
                    
                    product.option_groups.append(existing)
            else:
                # Create New Group (Add to library)
                new_group = ProductOptionGroup(
                    branch_id=current_branch.id,
                    name=grp['name'],
                    min_selection=grp.get('min', 0),
                    max_selection=grp.get('max', 1)
                )
                db.session.add(new_group)
                db.session.flush()

                if 'items' in grp:
                    for item in grp['items']:
                        new_opt = ProductOption(
                            group_id=new_group.id,
                            name=item['name'],
                            price_adjustment=item.get('price', 0.0)
                        )
                        db.session.add(new_opt)
                
                product.option_groups.append(new_group)
    
    db.session.commit()
    return jsonify(product.to_dict()), 200

# --- COLLECTIONS ---

@bp.route('/collections', methods=['GET'])
@jwt_required()
def get_collections():
    current_branch = get_current_branch()
    if not current_branch: return jsonify({'error': 'Unauthorized'}), 401
    
    target_id = request.args.get('target_branch_id')
    
    if current_branch.is_main and target_id == 'ALL':
        collections = Collection.query.filter_by(merchant_id=current_branch.merchant_id).all()
    else:
        target_branch_id = resolve_branch(current_branch)
        collections = Collection.query.filter(
            ((Collection.branch_id == target_branch_id) | (Collection.branch_id == None)),
            Collection.merchant_id == current_branch.merchant_id
        ).all()

    return jsonify([c.to_dict() for c in collections]), 200

@bp.route('/collections', methods=['POST'])
@jwt_required()
def create_collection():
    current_branch = get_current_branch()
    if not current_branch: return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    name = data.get('name')
    
    # Determine Branch ID
    branch_id = current_branch.id
    if current_branch.is_main:
        if data.get('is_global'):
            branch_id = None
        elif 'branch_id' in data:
            branch_id = data['branch_id']
    
    new_col = Collection(
        merchant_id=current_branch.merchant_id,
        branch_id=branch_id,
        name=name,
        type=data.get('type', 'list')
    )
    if 'description' in data: new_col.description = data['description']

    db.session.add(new_col)
    db.session.flush()

    if 'product_ids' in data:
        for idx, pid in enumerate(data['product_ids']):
             item = CollectionItem(collection_id=new_col.id, product_id=pid, sort_order=idx)
             db.session.add(item)
    
    db.session.commit()
    return jsonify(new_col.to_dict()), 201

# Collection UPDATE (Missing from previous file, might as well add simple one)
@bp.route('/collections/<int:id>', methods=['PUT'])
@jwt_required()
def update_collection(id):
    current_branch = get_current_branch()
    if not current_branch: return jsonify({'error': 'Unauthorized'}), 401

    collection = Collection.query.get(id)
    # Check access (ownership or global if main)
    if not collection: return jsonify({'error': 'Not found'}), 404
    # Simplistic access check
    if collection.branch_id and collection.branch_id != current_branch.id:
         return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    if 'name' in data: collection.name = data['name']
    if 'description' in data: collection.description = data['description'] # if model has description
    
    if 'product_ids' in data:
        # Replace items
        CollectionItem.query.filter_by(collection_id=id).delete()
        for idx, pid in enumerate(data['product_ids']):
             item = CollectionItem(collection_id=collection.id, product_id=pid, sort_order=idx)
             db.session.add(item)

    db.session.commit()
    return jsonify(collection.to_dict()), 200
