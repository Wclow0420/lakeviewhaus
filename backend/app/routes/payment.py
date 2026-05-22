from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.payment import Payment
from app.models.user import User
from app.services.billplz_service import BillplzService
from datetime import datetime
import os

bp = Blueprint('payment', __name__, url_prefix='/payment')

def get_base_url():
    """Get the base URL for callbacks"""
    # You can set this in environment or use a default
    return os.getenv('API_BASE_URL', 'http://192.168.100.251:5002')


@bp.route('/create-bill', methods=['POST'])
@jwt_required()
def create_bill():
    """
    Create a new Billplz bill for payment.

    Expected JSON payload:
    {
        "amount": 1000,  // Amount in cents (e.g., 1000 = RM 10.00)
        "description": "Order payment",
        "mobile": "+60123456789",  // Optional
        "metadata": {  // Optional additional data
            "order_id": "ORD123",
            "items": [...]
        },
        "reference_1_label": "Order ID",  // Optional
        "reference_1": "ORD123"  // Optional
    }
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json()

        # Validate required fields
        amount = data.get('amount')
        description = data.get('description')

        if not amount or not description:
            return jsonify({'error': 'Amount and description are required'}), 400

        if not isinstance(amount, int) or amount <= 0:
            return jsonify({'error': 'Amount must be a positive integer in cents'}), 400

        # Initialize Billplz service
        billplz = BillplzService()

        # Prepare callback and redirect URLs
        base_url = get_base_url()
        callback_url = f"{base_url}/payment/webhook"

        # You can customize redirect URL based on frontend deep linking
        app_scheme = os.getenv('APP_SCHEME', 'lakeviewhaus://')
        redirect_url = f"{app_scheme}payment/result"

        # Create bill in Billplz
        success, bill_data, error = billplz.create_bill(
            email=user.email,
            name=user.name or user.email,
            amount=amount,
            description=description,
            callback_url=callback_url,
            redirect_url=redirect_url,
            reference_1_label=data.get('reference_1_label'),
            reference_1=data.get('reference_1'),
            mobile=data.get('mobile') or user.phone_number
        )

        if not success:
            return jsonify({'error': f'Failed to create bill: {error}'}), 500

        # Save payment record to database
        payment = Payment(
            user_id=user.id,
            email=user.email,
            name=user.name or user.email,
            mobile=data.get('mobile') or user.phone_number,
            amount=amount,
            description=description,
            billplz_bill_id=bill_data['id'],
            billplz_url=bill_data['url'],
            status='pending',
            reference_1_label=data.get('reference_1_label'),
            reference_1=data.get('reference_1'),
            payment_metadata=data.get('metadata'),
            environment=billplz.get_environment()
        )

        db.session.add(payment)
        db.session.commit()

        return jsonify({
            'success': True,
            'payment': payment.to_dict(),
            'bill_url': bill_data['url'],
            'bill_id': bill_data['id']
        }), 201

    except ValueError as ve:
        # Billplz configuration error
        return jsonify({'error': str(ve)}), 500
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Server error: {str(e)}'}), 500


@bp.route('/webhook', methods=['POST'])
def webhook():
    """
    Webhook endpoint for Billplz payment notifications.
    Billplz will POST to this endpoint when payment status changes.
    """
    try:
        # Get form data from Billplz
        data = request.form.to_dict()

        # Log webhook data for debugging
        print(f"[Webhook] Received data: {data}")

        # Initialize Billplz service
        billplz = BillplzService()

        # Verify X-Signature
        if not billplz.verify_signature(data):
            print("[Webhook] Invalid signature")
            return jsonify({'error': 'Invalid signature'}), 401

        # Extract payment data
        bill_id = data.get('id')
        paid = data.get('paid') == 'true'
        paid_amount = int(data.get('amount', 0))
        transaction_status = data.get('transaction_status')
        paid_by = data.get('paid_by')

        print(f"[Webhook] Bill ID: {bill_id}, Paid: {paid}, Amount: {paid_amount}")

        # Find payment record
        payment = Payment.query.filter_by(billplz_bill_id=bill_id).first()

        if payment:
            # Update payment status
            if paid:
                payment.status = 'paid'
                payment.paid_at = datetime.utcnow()
                payment.paid_amount = paid_amount
            else:
                payment.status = 'failed'

            payment.transaction_status = transaction_status
            payment.paid_by = paid_by
            payment.updated_at = datetime.utcnow()

            db.session.commit()
            print(f"[Webhook] Updated Payment record: {payment.id}")

            # Link payment to order if order_id exists in reference_1
            if paid and payment.reference_1:
                try:
                    from app.models.order import Order
                    from app.routes.order import _finalize_paid_order, _emit_order_update
                    order = Order.query.filter_by(order_number=payment.reference_1).first()
                    if order:
                        order.payment_id = payment.id
                        _finalize_paid_order(order)
                        db.session.commit()
                        _emit_order_update(order)
                        print(f"[Webhook] Finalized paid Order: {order.order_number}")
                except Exception as order_error:
                    print(f"[Webhook] Error updating order from payment: {str(order_error)}")
            elif not paid and payment.reference_1:
                try:
                    from app.models.order import Order
                    from app.routes.order import _emit_order_update
                    linked = Order.query.filter_by(order_number=payment.reference_1).first()
                    if linked and linked.payment_status == 'pending':
                        linked.payment_status = 'failed'
                        linked.updated_at = datetime.utcnow()
                        db.session.commit()
                        _emit_order_update(linked)
                        print(f"[Webhook] Marked Order as failed from Payment: {linked.order_number}")
                except Exception as order_error:
                    print(f"[Webhook] Error marking order as failed: {str(order_error)}")
        else:
            # No Payment record found - check if this is an order payment
            # Orders store the Billplz bill_id directly in payment_id field
            print(f"[Webhook] No Payment record found, checking Orders...")
            from app.models.order import Order
            order = Order.query.filter_by(payment_id=bill_id).first()

            if order:
                print(f"[Webhook] Found Order by payment_id: {order.order_number}")
                if paid:
                    from app.routes.order import _finalize_paid_order
                    _finalize_paid_order(order)
                else:
                    order.payment_status = 'failed'
                    order.updated_at = datetime.utcnow()

                db.session.commit()
                from app.routes.order import _emit_order_update
                _emit_order_update(order)
                print(f"[Webhook] Updated Order: {order.order_number}, payment_status: {order.payment_status}")
            else:
                print(f"[Webhook] No Payment or Order found for bill_id: {bill_id}")
                # Still return 200 to acknowledge receipt
                return jsonify({'success': True, 'message': 'No matching record found'}), 200

        return jsonify({'success': True}), 200

    except Exception as e:
        db.session.rollback()
        print(f"[Webhook] Error: {str(e)}")
        return jsonify({'error': f'Webhook processing failed: {str(e)}'}), 500


@bp.route('/status/<bill_id>', methods=['GET'])
@jwt_required()
def get_payment_status(bill_id):
    """
    Get payment status by Billplz bill ID.
    """
    try:
        user_id = get_jwt_identity()

        # Find payment record
        payment = Payment.query.filter_by(billplz_bill_id=bill_id).first()

        if not payment:
            return jsonify({'error': 'Payment not found'}), 404

        # Verify user owns this payment
        if payment.user_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        return jsonify({
            'success': True,
            'payment': payment.to_dict()
        }), 200

    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500


@bp.route('/history', methods=['GET'])
@jwt_required()
def get_payment_history():
    """
    Get payment history for the current user.
    """
    try:
        user_id = get_jwt_identity()

        # Query parameters for pagination
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')  # Optional filter by status

        # Build query
        query = Payment.query.filter_by(user_id=user_id)

        if status:
            query = query.filter_by(status=status)

        # Paginate results
        pagination = query.order_by(Payment.created_at.desc()).paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )

        return jsonify({
            'success': True,
            'payments': [p.to_dict() for p in pagination.items],
            'total': pagination.total,
            'page': pagination.page,
            'per_page': pagination.per_page,
            'total_pages': pagination.pages
        }), 200

    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500


@bp.route('/cancel/<bill_id>', methods=['DELETE'])
@jwt_required()
def cancel_payment(bill_id):
    """
    Cancel a pending payment.
    """
    try:
        user_id = get_jwt_identity()

        # Find payment record
        payment = Payment.query.filter_by(billplz_bill_id=bill_id).first()

        if not payment:
            return jsonify({'error': 'Payment not found'}), 404

        # Verify user owns this payment
        if payment.user_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Only allow cancelling pending payments
        if payment.status != 'pending':
            return jsonify({'error': 'Can only cancel pending payments'}), 400

        # Delete bill from Billplz
        billplz = BillplzService()
        success, error = billplz.delete_bill(bill_id)

        if not success:
            return jsonify({'error': f'Failed to cancel bill: {error}'}), 500

        # Update payment status
        payment.status = 'cancelled'
        payment.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Payment cancelled successfully'
        }), 200

    except ValueError as ve:
        return jsonify({'error': str(ve)}), 500
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Server error: {str(e)}'}), 500


@bp.route('/config', methods=['GET'])
def get_config():
    """
    Get payment configuration (for frontend).
    Returns environment info (sandbox/production) but not sensitive keys.
    """
    try:
        billplz = BillplzService()

        return jsonify({
            'success': True,
            'environment': billplz.get_environment(),
            'is_sandbox': billplz.is_sandbox_mode()
        }), 200

    except ValueError as ve:
        return jsonify({'error': str(ve)}), 500
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500
