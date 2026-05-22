from app import db
from datetime import datetime

class Payment(db.Model):
    """
    Model for tracking Billplz payment transactions.
    """
    __tablename__ = 'payments'

    id = db.Column(db.Integer, primary_key=True)

    # User information
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    email = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    mobile = db.Column(db.String(20), nullable=True)

    # Payment details
    amount = db.Column(db.Integer, nullable=False)  # Amount in cents
    description = db.Column(db.Text, nullable=True)

    # Billplz data
    billplz_bill_id = db.Column(db.String(100), unique=True, nullable=False, index=True)
    billplz_url = db.Column(db.Text, nullable=True)  # Payment URL

    # Status tracking
    status = db.Column(
        db.String(20),
        nullable=False,
        default='pending',
        index=True
    )  # pending, paid, failed, cancelled

    paid_at = db.Column(db.DateTime, nullable=True)
    paid_amount = db.Column(db.Integer, nullable=True)  # Actual paid amount in cents

    # Transaction references
    transaction_id = db.Column(db.String(100), nullable=True)  # Your internal transaction ID
    reference_1_label = db.Column(db.String(100), nullable=True)
    reference_1 = db.Column(db.String(100), nullable=True)

    # Webhook data
    transaction_status = db.Column(db.String(50), nullable=True)  # From Billplz webhook
    paid_by = db.Column(db.String(50), nullable=True)  # Payment method (e.g., 'fpx', 'ewallet')

    # Metadata
    payment_metadata = db.Column(db.JSON, nullable=True)  # Additional data (e.g., order details, items)

    # Environment
    environment = db.Column(db.String(20), default='sandbox')  # sandbox or production

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationship
    user = db.relationship('User', backref='payments', lazy=True)

    def __repr__(self):
        return f'<Payment {self.billplz_bill_id} - {self.status}>'

    def to_dict(self):
        """Convert payment object to dictionary"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'email': self.email,
            'name': self.name,
            'mobile': self.mobile,
            'amount': self.amount,
            'amount_rm': self.amount / 100,  # Convert cents to RM
            'description': self.description,
            'billplz_bill_id': self.billplz_bill_id,
            'billplz_url': self.billplz_url,
            'status': self.status,
            'paid_at': self.paid_at.isoformat() if self.paid_at else None,
            'paid_amount': self.paid_amount,
            'paid_amount_rm': self.paid_amount / 100 if self.paid_amount else None,
            'transaction_id': self.transaction_id,
            'reference_1_label': self.reference_1_label,
            'reference_1': self.reference_1,
            'transaction_status': self.transaction_status,
            'paid_by': self.paid_by,
            'metadata': self.payment_metadata,
            'environment': self.environment,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
