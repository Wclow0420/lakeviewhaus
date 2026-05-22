from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import case, func
from app import db
from app.models.order import Order
from app.models.user import User
from app.models.merchant import Branch
from app.models.menu import Product, ProductOption
from app.models.reward import UserReward
from app.services.billplz_service import BillplzService
from datetime import datetime, timedelta
import os

bp = Blueprint('order', __name__, url_prefix='/order')


def _emit_order_update(order):
    """Best-effort socket broadcast — never let this raise into the route."""
    try:
        from app.services.socket_service import SocketService
        SocketService.emit_order_update(order)
    except Exception as e:
        print(f"[order] socket emit failed: {e}")


def _refund_voucher(order):
    """Return the voucher to active state if this order consumed one. Idempotent."""
    if not order.voucher_code:
        return
    voucher = UserReward.query.filter_by(
        redemption_code=order.voucher_code,
        user_id=order.user_id,
    ).first()
    if voucher and voucher.status == 'used':
        voucher.status = 'active'
        voucher.used_at = None


def _cancel_order(order, payment_status='failed'):
    """Mark an order cancelled and refund its voucher. Caller is responsible for committing."""
    if order.status == 'cancelled':
        return False
    order.status = 'cancelled'
    order.payment_status = payment_status
    order.updated_at = datetime.utcnow()
    _refund_voucher(order)
    return True


def _finalize_paid_order(order):
    """Transition order to paid and award loyalty points exactly once. Caller commits."""
    if order.payment_status == 'paid':
        return False
    order.payment_status = 'paid'
    if order.status == 'pending':
        order.status = 'confirmed'
    order.updated_at = datetime.utcnow()
    if order.points_earned and order.points_earned > 0 and order.user:
        order.user.add_points(order.points_earned)
    return True


def _expire_if_stale(order):
    """Cancel order if payment hasn't completed within Order.PAYMENT_TIMEOUT_MINUTES."""
    if order.payment_status != 'pending' or order.status == 'cancelled':
        return False
    age = datetime.utcnow() - order.created_at
    if age > timedelta(minutes=Order.PAYMENT_TIMEOUT_MINUTES):
        _cancel_order(order)
        db.session.commit()
        _emit_order_update(order)
        return True
    return False


# ============================================================================
# CUSTOMER ENDPOINTS
# ============================================================================

@bp.route('/create', methods=['POST'])
@jwt_required()
def create_order():
    """
    Create a new order for a customer.

    Expected JSON body:
    {
        "branch_id": "string",
        "order_type": "dine_in" | "pickup",
        "table_number": "string" (required if dine_in),
        "items": [
            {
                "product_id": "string",
                "quantity": int,
                "selected_options": [
                    {
                        "group_id": "string",
                        "group_name": "string",
                        "option_id": "string",
                        "option_name": "string",
                        "price_adjustment": float
                    }
                ],
                "special_instructions": "string" (optional)
            }
        ],
        "notes": "string" (optional)
    }
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json()

        # Validate required fields
        branch_id = data.get('branch_id')
        order_type = data.get('order_type')
        items = data.get('items', [])

        if not all([branch_id, order_type, items]):
            return jsonify({'error': 'Missing required fields: branch_id, order_type, items'}), 400

        if order_type not in ['dine_in', 'pickup']:
            return jsonify({'error': 'Invalid order_type. Must be "dine_in" or "pickup"'}), 400

        # Validate table number for dine-in
        table_number = data.get('table_number')
        if order_type == 'dine_in' and not table_number:
            return jsonify({'error': 'Table number required for dine-in orders'}), 400

        # Validate branch exists
        branch = Branch.query.get(branch_id)
        if not branch:
            return jsonify({'error': 'Branch not found'}), 404

        # Validate and calculate order total
        try:
            validated_items, subtotal = validate_and_calculate_order(items, branch_id)
        except ValidationError as e:
            return jsonify({'error': str(e)}), 400

        # Handle voucher/discount
        voucher_code = data.get('voucher_code')
        voucher_discount = 0.0
        voucher = None

        if voucher_code:
            # Validate voucher
            voucher = UserReward.query.filter_by(
                redemption_code=voucher_code,
                user_id=user.id
            ).first()

            if not voucher:
                return jsonify({'error': 'Invalid voucher code'}), 400

            if voucher.status != 'active':
                return jsonify({'error': 'Voucher already used or expired'}), 400

            # Check expiry
            if voucher.expires_at and voucher.expires_at < datetime.utcnow():
                voucher.status = 'expired'
                db.session.commit()
                return jsonify({'error': 'Voucher has expired'}), 400

            reward = voucher.reward

            # Validate branch restriction
            if reward.branch_id and str(reward.branch_id) != str(branch_id):
                branch_name = reward.branch.name if reward.branch else 'specific branch'
                return jsonify({'error': f'This voucher is only valid at {branch_name}'}), 400

            # Determine scope and compute discount.
            # Product / category scope → discount applies to exactly 1 unit
            #   of the highest-priced eligible item in cart.
            # Order / custom scope → discount applies across whole cart;
            #   free_item under order scope frees 1 unit of the highest-
            #   priced cart item.
            # This MUST stay in sync with `voucherCalc` in `context/CartContext.tsx`.
            scope = reward.target_scope or 'custom'

            if scope in ('product', 'category'):
                eligible_unit_prices = []
                if scope == 'product' and reward.target_id:
                    for item in validated_items:
                        if str(item['product_id']) != str(reward.target_id):
                            continue
                        unit_price = item['item_total'] / item['quantity']
                        eligible_unit_prices.extend([unit_price] * item['quantity'])
                    if not eligible_unit_prices:
                        target_product = Product.query.get(reward.target_id)
                        product_name = target_product.name if target_product else 'required item'
                        return jsonify({'error': f'This voucher requires {product_name} in your cart'}), 400

                elif scope == 'category' and reward.target_id:
                    from app.models.menu import MenuCategory
                    for item in validated_items:
                        product = Product.query.get(item['product_id'])
                        if not product or str(product.category_id) != str(reward.target_id):
                            continue
                        unit_price = item['item_total'] / item['quantity']
                        eligible_unit_prices.extend([unit_price] * item['quantity'])
                    if not eligible_unit_prices:
                        target_category = MenuCategory.query.get(reward.target_id)
                        category_name = target_category.name if target_category else 'specific category'
                        return jsonify({'error': f'This voucher requires items from {category_name} in your cart'}), 400

                target_unit_price = max(eligible_unit_prices)
                if reward.reward_type == 'discount_percentage':
                    voucher_discount = target_unit_price * (reward.discount_value / 100)
                elif reward.reward_type == 'discount_fixed':
                    voucher_discount = min(reward.discount_value, target_unit_price)
                elif reward.reward_type == 'free_item':
                    voucher_discount = target_unit_price
                else:
                    voucher_discount = 0
            else:
                # 'order' or 'custom' scope
                applicable_total = subtotal
                if reward.reward_type == 'discount_percentage':
                    voucher_discount = min(applicable_total * (reward.discount_value / 100), applicable_total)
                elif reward.reward_type == 'discount_fixed':
                    voucher_discount = min(reward.discount_value, applicable_total)
                elif reward.reward_type == 'free_item':
                    all_unit_prices = []
                    for item in validated_items:
                        unit_price = item['item_total'] / item['quantity']
                        all_unit_prices.extend([unit_price] * item['quantity'])
                    voucher_discount = max(all_unit_prices) if all_unit_prices else 0
                else:
                    voucher_discount = 0

            voucher_discount = round(voucher_discount, 2)

        # Calculate final total after discount
        total = max(subtotal - voucher_discount, 0)

        # Generate order number
        order_number = Order.generate_order_number()

        # Calculate points earned (1 RM = 1 point, based on final total after discount)
        points_earned = int(total)

        # Create order
        order = Order(
            user_id=user.id,
            branch_id=branch_id,
            order_number=order_number,
            order_type=order_type,
            table_number=table_number if order_type == 'dine_in' else None,
            items=validated_items,
            subtotal=subtotal,
            total=total,
            points_earned=points_earned,
            voucher_code=voucher_code,
            voucher_discount=voucher_discount,
            status='pending',
            payment_status='pending',
            notes=data.get('notes')
        )

        db.session.add(order)

        # Points are awarded only after payment succeeds — see _finalize_paid_order
        # Voucher is reserved (marked 'used') now to prevent double-spend on concurrent orders;
        # it's refunded if the order is cancelled or expires (see _cancel_order).
        if voucher:
            voucher.status = 'used'
            voucher.used_at = datetime.utcnow()

        # Free orders (voucher covers full amount) skip the Billplz payment step entirely —
        # auto-finalize so the order goes straight to 'paid' / 'confirmed'.
        is_free_order = total == 0
        if is_free_order:
            db.session.flush()  # Ensure order.id is populated before finalize
            _finalize_paid_order(order)

        db.session.commit()
        _emit_order_update(order)  # Notify merchant dashboards a new order arrived

        response_data = {
            'success': True,
            'order': order.to_dict(include_branch=True),
        }

        if is_free_order:
            response_data['message'] = 'Order placed successfully! Your voucher covers the full amount.'
        else:
            response_data['message'] = f'Order placed successfully! You earned {points_earned} points.'
            if voucher_discount > 0:
                response_data['message'] += f' You saved RM {voucher_discount:.2f} with your voucher!'

        return jsonify(response_data), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create order: {str(e)}'}), 500


@bp.route('/history', methods=['GET'])
@jwt_required()
def get_order_history():
    """
    Get order history for current user.

    Query parameters:
    - page: int (default 1)
    - per_page: int (default 10)
    - status: string (optional filter by status)
    """
    try:
        user_id = get_jwt_identity()

        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        status_filter = request.args.get('status')

        # Build query
        query = Order.query.filter_by(user_id=user_id)

        if status_filter and status_filter != 'all':
            query = query.filter_by(status=status_filter)

        # Order: pending (awaiting payment) first, then paid/active, then cancelled.
        # Within each bucket, newest first.
        status_priority = case(
            (Order.status == 'pending', 0),
            (Order.status == 'cancelled', 2),
            else_=1,
        )
        pagination = query.order_by(status_priority, Order.created_at.desc()).paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )

        orders = [order.to_dict(include_branch=True) for order in pagination.items]

        return jsonify({
            'success': True,
            'orders': orders,
            'total': pagination.total,
            'page': pagination.page,
            'per_page': pagination.per_page,
            'total_pages': pagination.pages
        }), 200

    except Exception as e:
        return jsonify({'error': f'Failed to fetch order history: {str(e)}'}), 500


@bp.route('/<order_id>', methods=['GET'])
@jwt_required()
def get_order_details(order_id):
    """
    Get details of a specific order.
    Accessible by order owner or merchant of the branch.
    """
    try:
        user_id = get_jwt_identity()

        order = Order.query.get(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404

        # Owner check uses raw user_id (UUID for User; for Branch JWTs the order
        # is never owned by a branch identity so this returns False).
        is_owner = order.user_id == user_id

        # Merchant check uses the get_current_branch() helper since branch JWTs
        # have a different identity format than User UUIDs.
        is_merchant = False
        if not is_owner and isinstance(user_id, str) and user_id.startswith('m_'):
            from app.routes.merchant import get_current_branch
            current_branch = get_current_branch()
            is_merchant = current_branch is not None and order.branch_id == current_branch.id

        if not (is_owner or is_merchant):
            return jsonify({'error': 'Unauthorized to view this order'}), 403

        if is_owner:
            _expire_if_stale(order)

        return jsonify({
            'success': True,
            'order': order.to_dict(include_user=is_merchant, include_branch=is_owner)
        }), 200

    except Exception as e:
        return jsonify({'error': f'Failed to fetch order: {str(e)}'}), 500


@bp.route('/<order_id>/payment', methods=['POST'])
@jwt_required()
def create_order_payment(order_id):
    """
    Create Billplz payment for an order.
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        order = Order.query.get(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404

        # Verify ownership
        if order.user_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Check if order already paid (includes free orders auto-finalized at creation)
        if order.payment_status == 'paid':
            return jsonify({'error': 'Order already paid'}), 400

        # Defensive: should never hit this since free orders are already marked paid,
        # but guard against a 0-amount Billplz bill just in case.
        if order.total == 0:
            return jsonify({'error': 'Order total is 0 — no payment required'}), 400

        # Initialize Billplz service
        billplz = BillplzService()

        # Prepare URLs
        base_url = os.getenv('API_BASE_URL', 'http://192.168.100.251:5002')
        callback_url = f"{base_url}/payment/webhook"
        app_scheme = os.getenv('APP_SCHEME', 'lakeviewhaus://')
        redirect_url = f"{app_scheme}order-result/{order_id}"

        # Convert RM to cents
        amount_cents = int(order.total * 100)

        # Create Billplz bill
        success, bill_data, error = billplz.create_bill(
            email=user.email,
            name=user.username or user.email,
            amount=amount_cents,
            description=f"Order {order.order_number}",
            callback_url=callback_url,
            redirect_url=redirect_url,
            reference_1_label="Order Number",
            reference_1=order.order_number,
            mobile=user.phone
        )

        if not success:
            return jsonify({'error': f'Failed to create payment: {error}'}), 500

        # Update order with payment ID
        # Note: We'll create the Payment record when webhook is received
        order.payment_id = bill_data['id']
        db.session.commit()

        return jsonify({
            'success': True,
            'payment_url': bill_data['url'],
            'bill_id': bill_data['id'],
            'amount': order.total
        }), 200

    except ValueError as ve:
        return jsonify({'error': str(ve)}), 500
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create payment: {str(e)}'}), 500


@bp.route('/<order_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_order(order_id):
    """
    Cancel an order.
    Only allowed for pending or confirmed orders.
    """
    try:
        user_id = get_jwt_identity()

        order = Order.query.get(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404

        # Verify ownership
        if order.user_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Check if order can be cancelled
        if order.status not in ['pending', 'confirmed']:
            return jsonify({'error': f'Cannot cancel order with status: {order.status}'}), 400

        # Cancel and refund voucher (if any). Preserve payment_status if already paid.
        preserved_payment_status = 'paid' if order.payment_status == 'paid' else 'failed'
        _cancel_order(order, payment_status=preserved_payment_status)
        db.session.commit()
        _emit_order_update(order)

        return jsonify({
            'success': True,
            'message': 'Order cancelled successfully',
            'order': order.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to cancel order: {str(e)}'}), 500


@bp.route('/<order_id>/verify-payment', methods=['POST'])
@jwt_required()
def verify_order_payment(order_id):
    """
    Verify payment status directly with Billplz API.
    Use this when webhook doesn't work (e.g., local development).
    """
    try:
        user_id = get_jwt_identity()

        order = Order.query.get(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404

        # Verify ownership
        if order.user_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Auto-cancel if order has exceeded payment timeout
        if _expire_if_stale(order):
            return jsonify({
                'success': True,
                'order': order.to_dict(include_branch=True),
                'message': 'Order expired — payment timeout exceeded',
                'payment_confirmed': False,
            }), 200

        # No Billplz bill yet — return current order state so frontend can still poll
        if not order.payment_id:
            return jsonify({
                'success': True,
                'order': order.to_dict(include_branch=True),
                'message': 'No payment initiated yet',
                'payment_confirmed': False,
            }), 200

        # Already paid
        if order.payment_status == 'paid':
            return jsonify({
                'success': True,
                'order': order.to_dict(include_branch=True),
                'message': 'Payment already confirmed'
            }), 200

        # Query Billplz for bill status
        billplz = BillplzService()
        success, bill_data, error = billplz.get_bill(order.payment_id)

        if not success:
            return jsonify({'error': f'Failed to verify payment: {error}'}), 500

        print(f"[Verify Payment] Billplz response: {bill_data}")

        # Check if bill is paid
        is_paid = bill_data.get('paid', False)

        if is_paid:
            _finalize_paid_order(order)
            db.session.commit()
            _emit_order_update(order)

            return jsonify({
                'success': True,
                'order': order.to_dict(include_branch=True),
                'message': 'Payment verified successfully',
                'payment_confirmed': True
            }), 200
        else:
            bill_state = bill_data.get('state')
            if bill_state == 'deleted' and order.payment_status == 'pending':
                order.payment_status = 'failed'
                order.updated_at = datetime.utcnow()
                db.session.commit()
                _emit_order_update(order)

            return jsonify({
                'success': True,
                'order': order.to_dict(include_branch=True),
                'message': 'Payment not yet received',
                'payment_confirmed': False
            }), 200

    except ValueError as ve:
        return jsonify({'error': str(ve)}), 500
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to verify payment: {str(e)}'}), 500


# ============================================================================
# MERCHANT ENDPOINTS
# ============================================================================

@bp.route('/merchant/list', methods=['GET'])
@jwt_required()
def get_merchant_orders():
    """
    Get orders for merchant's branch.

    Query parameters:
    - branch_id: string (optional, for merchants with multiple branches)
    - status: string (optional filter)
    - date: 'today' | 'week' | 'all' (default 'today')
    - page: int (default 1)
    - per_page: int (default 20)
    """
    try:
        # Branch JWTs use identity format `m_{merchant_id}_b_{branch_id}` and
        # don't resolve via User.query — use the helper from merchant.py.
        from app.routes.merchant import get_current_branch
        current_branch = get_current_branch()
        if not current_branch:
            return jsonify({'error': 'Unauthorized. Merchant access only.'}), 403

        # Optional branch_id override (e.g. main branch viewing another branch's orders)
        requested_branch_id = request.args.get('branch_id')
        if requested_branch_id:
            # For now only allow merchants to view their own branch
            if requested_branch_id != str(current_branch.id):
                return jsonify({'error': 'Unauthorized to access this branch'}), 403
            branch_id = requested_branch_id
        else:
            branch_id = current_branch.id

        # Get filter parameters
        status_filter = request.args.get('status')
        date_filter = request.args.get('date', 'today')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)

        # Build query
        query = Order.query.filter_by(branch_id=branch_id)

        # Filter by status
        if status_filter and status_filter != 'all':
            query = query.filter_by(status=status_filter)

        # Filter by date
        if date_filter == 'today':
            today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            query = query.filter(Order.created_at >= today_start)
        elif date_filter == 'week':
            week_start = datetime.now() - timedelta(days=7)
            query = query.filter(Order.created_at >= week_start)

        # Paginate
        pagination = query.order_by(Order.created_at.desc()).paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )

        orders = [order.to_dict(include_user=True) for order in pagination.items]

        return jsonify({
            'success': True,
            'orders': orders,
            'total': pagination.total,
            'page': pagination.page,
            'per_page': pagination.per_page,
            'total_pages': pagination.pages
        }), 200

    except Exception as e:
        return jsonify({'error': f'Failed to fetch orders: {str(e)}'}), 500


@bp.route('/merchant/counts', methods=['GET'])
@jwt_required()
def get_merchant_order_counts():
    """
    Aggregate counts grouped by status for the merchant's branch.
    Drives the merchant dashboard's badge counts in a single round-trip.

    Query parameters:
    - date: 'today' | 'week' | 'all' (default 'today')

    Returns:
    {
        success: True,
        counts: {
            pending: <int>,       # status='pending' AND payment_status='pending' (unpaid bucket)
            confirmed: <int>,
            preparing: <int>,
            ready: <int>,
            completed: <int>,
            cancelled: <int>
        }
    }
    """
    try:
        from app.routes.merchant import get_current_branch
        current_branch = get_current_branch()
        if not current_branch:
            return jsonify({'error': 'Unauthorized. Merchant access only.'}), 403

        date_filter = request.args.get('date', 'today')
        query = Order.query.filter(Order.branch_id == current_branch.id)

        if date_filter == 'today':
            today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            query = query.filter(Order.created_at >= today_start)
        elif date_filter == 'week':
            week_start = datetime.now() - timedelta(days=7)
            query = query.filter(Order.created_at >= week_start)

        # Group by status — single SQL aggregate
        rows = query.with_entities(
            Order.status,
            func.count(Order.id),
        ).group_by(Order.status).all()

        counts = {
            'pending': 0, 'confirmed': 0, 'preparing': 0,
            'ready': 0, 'completed': 0, 'cancelled': 0,
        }
        for status, count in rows:
            if status in counts:
                counts[status] = count

        return jsonify({'success': True, 'counts': counts}), 200

    except Exception as e:
        return jsonify({'error': f'Failed to fetch counts: {str(e)}'}), 500


@bp.route('/<order_id>/status', methods=['PUT'])
@jwt_required()
def update_order_status(order_id):
    """
    Update order status (merchant only).

    Expected JSON body:
    {
        "status": "confirmed" | "preparing" | "ready" | "completed"
    }
    """
    try:
        from app.routes.merchant import get_current_branch
        current_branch = get_current_branch()
        if not current_branch:
            return jsonify({'error': 'Unauthorized. Merchant access only.'}), 403

        order = Order.query.get(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404

        # Verify merchant owns the branch
        if order.branch_id != current_branch.id:
            return jsonify({'error': 'Unauthorized to update this order'}), 403

        data = request.get_json()
        new_status = data.get('status')

        if not new_status:
            return jsonify({'error': 'Status field required'}), 400

        # Validate status transition
        if not order.can_transition_to(new_status):
            return jsonify({
                'error': f'Cannot transition from "{order.status}" to "{new_status}"'
            }), 400

        # Update status
        order.status = new_status
        order.updated_at = datetime.utcnow()
        db.session.commit()
        _emit_order_update(order)

        return jsonify({
            'success': True,
            'message': f'Order status updated to {new_status}',
            'order': order.to_dict(include_user=True)
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update order status: {str(e)}'}), 500


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

class ValidationError(Exception):
    """Custom exception for validation errors"""
    pass


def validate_and_calculate_order(items, branch_id):
    """
    Validate order items and calculate total price.
    CRITICAL: Never trust client-sent prices. Always recalculate on server.

    Args:
        items: List of cart items with product_id, quantity, selected_options
        branch_id: Branch ID to validate products belong to correct branch

    Returns:
        Tuple of (validated_items, total_price)

    Raises:
        ValidationError: If validation fails
    """
    if not items or len(items) == 0:
        raise ValidationError("Order must contain at least one item")

    if len(items) > 20:
        raise ValidationError("Maximum 20 items per order")

    total = 0.0
    validated_items = []

    for item in items:
        product_id = item.get('product_id')
        quantity = item.get('quantity', 1)
        selected_options = item.get('selected_options', [])

        # Validate quantity
        if not isinstance(quantity, int) or quantity < 1 or quantity > 10:
            raise ValidationError(f"Invalid quantity for product {product_id}. Must be between 1 and 10.")

        # Fetch and validate product
        product = Product.query.filter_by(
            id=product_id,
            branch_id=branch_id,
            is_active=True
        ).first()

        if not product:
            raise ValidationError(f"Product {product_id} not available")

        # Start with base price
        item_price = product.price

        # Validate and add option prices
        validated_options = []
        for opt in selected_options:
            option_id = opt.get('option_id')
            option = ProductOption.query.get(option_id)

            if not option:
                raise ValidationError(f"Invalid option {option_id}")

            # Add price adjustment
            item_price += option.price_adjustment

            validated_options.append({
                'group_id': opt.get('group_id'),
                'group_name': opt.get('group_name'),
                'option_id': option.id,
                'option_name': option.name,
                'price_adjustment': option.price_adjustment
            })

        # Calculate item total
        item_total = round(item_price * quantity, 2)
        total += item_total

        # Build validated item
        validated_items.append({
            'product_id': product.id,
            'product_name': product.name,
            'product_image': product.image_url,
            'base_price': product.price,
            'quantity': quantity,
            'selected_options': validated_options,
            'special_instructions': item.get('special_instructions'),
            'item_total': item_total
        })

    return validated_items, round(total, 2)
