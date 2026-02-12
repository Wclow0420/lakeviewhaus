from flask import Blueprint, request, jsonify, current_app
from app import limiter
import resend
import os

bp = Blueprint('contact', __name__, url_prefix='/api/contact')

@bp.route('/send', methods=['POST'])
@limiter.limit("5 per hour")  # Rate limit: 5 requests per hour per IP
def send_contact_email():
    try:
        data = request.get_json()
        
        # Honey Pot check (anti-spam)
        if data.get('honeypot'):
            # Silently fail for bots - pretend it worked
            return jsonify({'message': 'Message sent successfully!'}), 200

        name = data.get('name')
        email = data.get('email')
        message = data.get('message')

        # Basic Validation
        if not name or not email or not message:
            return jsonify({'error': 'All fields are required.'}), 400

        # Configure Resend
        resend.api_key = os.environ.get('RESEND_API_KEY')

        # Send Email
        params = {
            "from": "Lakeview Haus Contact <onboarding@resend.dev>", # Default Resend testing domain
            "to": ["justin.app.dev.1@gmail.com"], # Replace with actual admin email or env var
            "subject": f"New Contact Form Submission from {name}",
            "html": f"""
                <h3>New Message from Lakeview Haus Website</h3>
                <p><strong>Name:</strong> {name}</p>
                <p><strong>Email:</strong> {email}</p>
                <p><strong>Message:</strong></p>
                <blockquote style="background: #f9f9f9; padding: 10px; border-left: 5px solid #ddd;">
                    {message}
                </blockquote>
            """
        }

        email_response = resend.Emails.send(params)
        
        return jsonify({'message': 'Message sent successfully!', 'id': email_response.get('id')}), 200

    except Exception as e:
        current_app.logger.error(f"Error sending email: {str(e)}")
        return jsonify({'error': 'Failed to send message. Please try again later.'}), 500
