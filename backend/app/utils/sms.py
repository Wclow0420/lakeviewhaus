import os
import requests

# Toggle this for real SMS vs Dev Mode
SMS_PROVIDER = os.environ.get('SMS_PROVIDER', 'MOCK') # Options: MOCK, TWILIO, ISMS

def send_sms(phone_number, message):
    """
    Sends SMS to the given phone number.
    Handles MCMC compliance for Malaysia (RM 0.00 header).
    """
    
    # 1. MCMC Compliance: Add RM 0.00 header
    # Note: Some gateways add this automatically, others require it in body.
    # We add it to be safe for local gateways.
    compliance_message = f"RM0.00 {message}"

    if SMS_PROVIDER == 'MOCK':
        print(f"\n[SMS MOCK] To: {phone_number}")
        print(f"[SMS MOCK] Body: {compliance_message}\n")
        return True

    elif SMS_PROVIDER == 'ISMS':
        # iSMS (Malaysia) Implementation based on docs
        username = os.environ.get('ISMS_USERNAME')
        password = os.environ.get('ISMS_PASSWORD')
        sender_id = os.environ.get('ISMS_SENDER_ID', 'IOTPSMS') # Default sender ID, change in env
        
        if not username or not password:
            print("iSMS credentials missing")
            return False
            
        url = "https://ww3.isms.com.my/isms_send_all_id.php"
        
        params = {
            'un': username,
            'pwd': password,
            'dstno': phone_number,
            'msg': compliance_message,
            'type': 1, # ASCII
            'sendid': sender_id,
            'agreedterm': 'YES'
        }
        
        try:
            # iSMS Documentation says GET request
            response = requests.get(url, params=params)
            
            # Check response body for Success code (2000 = SUCCESS)
            if response.text.startswith('2000'):
                return True
            else:
                print(f"iSMS Error Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"iSMS Send Failed: {e}")
            return False

    elif SMS_PROVIDER == 'TWILIO':
        # Twilio Implementation
        try:
            from twilio.rest import Client
            account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
            auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
            from_number = os.environ.get('TWILIO_FROM_NUMBER')
            
            if not account_sid or not auth_token:
                print("Twilio credentials missing")
                return False

            client = Client(account_sid, auth_token)
            client.messages.create(
                body=compliance_message,
                from_=from_number,
                to=phone_number
            )
            return True
        except Exception as e:
            print(f"Twilio Send Failed: {e}")
            return False

    return False
