from app import create_app, db
from sqlalchemy import text

app = create_app()

with app.app_context():
    try:
        print("Dropping all tables with CASCADE...")
        # Since db.drop_all() is failing due to dependencies, let's just force drop using raw SQL
        conn = db.engine.connect()
        trans = conn.begin()
        
        # Postgres specific drop cascade
        conn.execute(text("DROP SCHEMA public CASCADE;"))
        conn.execute(text("CREATE SCHEMA public;"))
        
        trans.commit()
        conn.close()
        
        print("Schema reset successfully.")
    except Exception as e:
        print(f"Error resetting database: {e}")
