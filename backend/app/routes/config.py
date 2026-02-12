from flask import Blueprint, jsonify
from app.models.config import AppConfig
from app import db

config_bp = Blueprint('config', __name__)

DEFAULTS = {
    'min_version_ios': '1.0.0',
    'min_version_android': '1.0.0',
    'store_url_ios': 'https://apps.apple.com/app/id123456789', # Replace with real ID
    'store_url_android': 'https://play.google.com/store/apps/details?id=com.lakeviewhaus.biz',
    'maintenance_mode': 'false' 
}

@config_bp.route('/version', methods=['GET'])
def get_version_config():
    """
    Get app version configuration. 
    If keys don't exist in DB, returns defaults (and optionally seeds them).
    """
    configs = AppConfig.query.all()
    config_dict = {c.key: c.value for c in configs}
    
    # Merge with defaults, ensuring all keys are present
    final_config = {}
    for key, default_val in DEFAULTS.items():
        if key in config_dict:
            final_config[key] = config_dict[key]
        else:
            # Auto-seed to DB so admin can edit it later
            final_config[key] = default_val
            new_conf = AppConfig(key=key, value=default_val, description=f"Auto-seeded {key}")
            db.session.add(new_conf)
            
    # Commit any new seeds
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"Error seeding config: {e}")

    return jsonify(final_config), 200
