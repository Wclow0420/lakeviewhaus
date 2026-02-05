from app import create_app, db
import os
from sqlalchemy import text

app = create_app()

with app.app_context():
    db_url = app.config['SQLALCHEMY_DATABASE_URI']
    print(f"--- DEBUGGING DATABASE CONNECTION ---")
    print(f"Configured DATABASE_URL: {db_url}")
    
    try:
        # Check Merchants Table
        print("\n--- QUERYING MERCHANTS TABLE ---")
        result = db.session.execute(text("SELECT id, name FROM merchants"))
        rows = result.fetchall()
        
        if not rows:
            print("No merchants found in this database.")
        else:
            for row in rows:
                print(f"Merchant ID: {row[0]} (Type: {type(row[0])}), Name: {row[1]}")
                
    except Exception as e:
        print(f"Error querying database: {e}")
