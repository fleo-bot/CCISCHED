"""
WSGI entry point for production deployment.
This file is used by Gunicorn to run the Flask application.

Usage:
    gunicorn --config gunicorn.conf.py wsgi:app
"""

from app import create_app

# Create the Flask application instance
app = create_app()

if __name__ == "__main__":
    # This runs only when executed directly (not via Gunicorn)
    app.run()
