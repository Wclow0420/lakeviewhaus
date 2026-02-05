from app import create_app, db
from app.models.merchant import Merchant, Branch
from werkzeug.security import generate_password_hash

app = create_app()

with app.app_context():
    # Check if merchant already exists
    existing = Merchant.query.filter_by(name='Lakeview Haus').first()
    if existing:
        print("Merchant 'Lakeview Haus' already exists.")
        
        # Check if main branch exists
        branch = Branch.query.filter_by(username='lakeview_main').first()
        if not branch:
             branch = Branch(
                merchant_id=existing.id,
                name='Main Branch',
                username='lakeview_main',
                password_hash=generate_password_hash('admin123'),
                is_main=True,
                location='HQ'
            )
             db.session.add(branch)
             db.session.commit()
             print("Created 'lakeview_main' branch for existing merchant.")
        else:
            print("Branch 'lakeview_main' already exists.")

    else:
        # Create Merchant
        merchant = Merchant(name='Lakeview Haus')
        db.session.add(merchant)
        db.session.commit()
        print(f"Created Merchant: {merchant.name}")

        # Create Main Branch
        branch = Branch(
            merchant_id=merchant.id,
            name='Main Branch',
            username='lakeview_main', # Login ID
            password_hash=generate_password_hash('admin123'), # Password
            is_main=True,
            location='HQ'
        )
        db.session.add(branch)
        db.session.commit()
        print(f"Created Branch: {branch.name} (Username: {branch.username})")
        print(f"Merchant ID: {merchant.id}")
        print(f"Branch ID: {branch.id}")
