import os
import uuid
from flask import Blueprint, request, jsonify, send_from_directory, current_app
from werkzeug.utils import secure_filename

bp = Blueprint('upload', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@bp.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        # Generate unique name to prevent overwrite
        unique_filename = f"{uuid.uuid4().hex}_{filename}"
        
        upload_folder = os.path.join(current_app.root_path, '../uploads')
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder)
            
        file.save(os.path.join(upload_folder, unique_filename))
        
        # Return relative URL
        # The frontend will prepend the current API_URL
        file_url = f"/uploads/{unique_filename}"
        return jsonify({'url': file_url}), 200

    return jsonify({'error': 'File type not allowed'}), 400

@bp.route('/uploads/<filename>')
def uploaded_file(filename):
    upload_folder = os.path.join(current_app.root_path, '../uploads')
    return send_from_directory(upload_folder, filename)
