import os
import requests
import hashlib
import hmac
from typing import Dict, Optional, Tuple

class BillplzService:
    """
    Service class for Billplz payment gateway integration.
    Supports both sandbox and production environments.
    """

    SANDBOX_URL = "https://www.billplz-sandbox.com/api/v3"
    PRODUCTION_URL = "https://www.billplz.com/api/v3"

    def __init__(self):
        self.env = os.getenv('BILLPLZ_ENV', 'sandbox')
        self.is_sandbox = self.env == 'sandbox'

        # Load appropriate credentials based on environment
        if self.is_sandbox:
            self.api_key = os.getenv('BILLPLZ_SANDBOX_API_KEY')
            self.collection_id = os.getenv('BILLPLZ_SANDBOX_COLLECTION_ID')
            self.x_signature = os.getenv('BILLPLZ_SANDBOX_X_SIGNATURE')
            self.base_url = self.SANDBOX_URL
        else:
            self.api_key = os.getenv('BILLPLZ_PRODUCTION_API_KEY')
            self.collection_id = os.getenv('BILLPLZ_PRODUCTION_COLLECTION_ID')
            self.x_signature = os.getenv('BILLPLZ_PRODUCTION_X_SIGNATURE')
            self.base_url = self.PRODUCTION_URL

        # Validate configuration
        if not all([self.api_key, self.collection_id, self.x_signature]):
            raise ValueError(f"Missing Billplz configuration for {self.env} environment")

    def create_bill(
        self,
        email: str,
        name: str,
        amount: int,  # Amount in cents (e.g., 1000 = RM 10.00)
        description: str,
        callback_url: str,
        redirect_url: str,
        reference_1_label: Optional[str] = None,
        reference_1: Optional[str] = None,
        mobile: Optional[str] = None
    ) -> Tuple[bool, Optional[Dict], Optional[str]]:
        """
        Create a bill in Billplz.

        Args:
            email: Customer email
            name: Customer name
            amount: Amount in cents (e.g., 1000 = RM 10.00)
            description: Bill description
            callback_url: Webhook URL for payment notifications
            redirect_url: URL to redirect after payment
            reference_1_label: Label for reference field (optional)
            reference_1: Reference value (e.g., order ID, transaction ID)
            mobile: Customer mobile number (optional)

        Returns:
            Tuple of (success: bool, bill_data: Dict, error_message: str)
        """
        endpoint = f"{self.base_url}/bills"

        data = {
            'collection_id': self.collection_id,
            'email': email,
            'name': name,
            'amount': amount,
            'description': description,
            'callback_url': callback_url,
            'redirect_url': redirect_url
        }

        # Add optional fields
        if reference_1_label and reference_1:
            data['reference_1_label'] = reference_1_label
            data['reference_1'] = reference_1

        if mobile:
            data['mobile'] = mobile

        try:
            response = requests.post(
                endpoint,
                auth=(self.api_key, ''),
                data=data,
                timeout=30
            )

            if response.status_code == 200:
                bill_data = response.json()
                return True, bill_data, None
            else:
                error_msg = f"Billplz API error: {response.status_code} - {response.text}"
                return False, None, error_msg

        except requests.RequestException as e:
            error_msg = f"Request failed: {str(e)}"
            return False, None, error_msg

    def get_bill(self, bill_id: str) -> Tuple[bool, Optional[Dict], Optional[str]]:
        """
        Get bill details from Billplz.

        Args:
            bill_id: The Billplz bill ID

        Returns:
            Tuple of (success: bool, bill_data: Dict, error_message: str)
        """
        endpoint = f"{self.base_url}/bills/{bill_id}"

        try:
            response = requests.get(
                endpoint,
                auth=(self.api_key, ''),
                timeout=30
            )

            if response.status_code == 200:
                bill_data = response.json()
                return True, bill_data, None
            else:
                error_msg = f"Billplz API error: {response.status_code} - {response.text}"
                return False, None, error_msg

        except requests.RequestException as e:
            error_msg = f"Request failed: {str(e)}"
            return False, None, error_msg

    def delete_bill(self, bill_id: str) -> Tuple[bool, Optional[str]]:
        """
        Delete/cancel a bill in Billplz.

        Args:
            bill_id: The Billplz bill ID

        Returns:
            Tuple of (success: bool, error_message: str)
        """
        endpoint = f"{self.base_url}/bills/{bill_id}"

        try:
            response = requests.delete(
                endpoint,
                auth=(self.api_key, ''),
                timeout=30
            )

            if response.status_code == 200:
                return True, None
            else:
                error_msg = f"Billplz API error: {response.status_code} - {response.text}"
                return False, error_msg

        except requests.RequestException as e:
            error_msg = f"Request failed: {str(e)}"
            return False, error_msg

    def verify_signature(self, data: Dict) -> bool:
        """
        Verify the X-Signature from Billplz webhook callback.

        Per Billplz docs: HMAC-SHA256 of a `|`-joined, alphabetically sorted
        "{key}{value}" source string, using the X-Signature key as the HMAC secret.

        Dev-only bypass: set BILLPLZ_SKIP_SIGNATURE=true in the environment to
        accept unverified webhooks. MUST NOT be enabled in production — it makes
        the webhook endpoint trustable by anyone on the internet.
        """
        if os.getenv('BILLPLZ_SKIP_SIGNATURE') == 'true':
            print('[Webhook] BILLPLZ_SKIP_SIGNATURE=true — signature check bypassed (dev only)')
            return True

        if 'x_signature' not in data:
            return False

        received_signature = data['x_signature']
        signature_items = [f"{k}{data[k]}" for k in sorted(data.keys()) if k != 'x_signature']
        source_string = '|'.join(signature_items)

        calculated_signature = hmac.new(
            self.x_signature.encode('utf-8'),
            source_string.encode('utf-8'),
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(calculated_signature, received_signature)

    def get_environment(self) -> str:
        """Get current environment (sandbox or production)"""
        return self.env

    def is_sandbox_mode(self) -> bool:
        """Check if running in sandbox mode"""
        return self.is_sandbox
