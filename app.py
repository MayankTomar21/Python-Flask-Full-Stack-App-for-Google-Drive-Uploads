# app.py (Flask Backend)
from flask import Flask, request, redirect, url_for, session, jsonify
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
import os
import json

app = Flask(__name__)
app.secret_key = os.urandom(24) # Used for session management

# Path to your downloaded credentials.json file
CLIENT_SECRETS_FILE = 'credentials.json'

# This scope allows creating and managing files created by the app
SCOPES = ['https://www.googleapis.com/auth/drive.file']

# Create a Flow instance from the client secrets file
# The redirect URI must match what you configured in Google Cloud Console
flow = Flow.from_client_secrets_file(
    CLIENT_SECRETS_FILE,
    scopes=SCOPES,
    redirect_uri='http://localhost:5000/oauth2callback' # IMPORTANT: Match this with your Google Cloud Console setting
)

@app.route('/')
def index():
    return "Welcome to the Google Drive Uploader Backend. Use the frontend to interact."

@app.route('/authorize')
def authorize():
    # Generate the authorization URL
    authorization_url, state = flow.authorization_url(
        access_type='offline', # Request a refresh token for long-term access
        include_granted_scopes='true'
    )
    session['state'] = state # Store state for security
    return redirect(authorization_url)

@app.route('/oauth2callback')
def oauth2callback():
    # Handle the redirect from Google's authorization server
    state = session['state']
    flow.fetch_token(authorization_response=request.url)

    credentials = flow.credentials
    session['credentials'] = {
        'token': credentials.token,
        'refresh_token': credentials.refresh_token,
        'token_uri': credentials.token_uri,
        'client_id': credentials.client_id,
        'client_secret': credentials.client_secret,
        'scopes': credentials.scopes
    }
    # Redirect back to the frontend, indicating success
    # In a real app, you might pass a token or status back to the frontend
    # For simplicity, we'll just redirect to a success page or the main app URL
    return redirect('http://localhost:3000?auth_success=true') # Redirect to your React app's URL

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'credentials' not in session:
        return jsonify({'error': 'Not authenticated. Please authorize first.'}), 401

    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file:
        try:
            creds_data = session['credentials']
            creds = Credentials(**creds_data)

            # Refresh token if expired
            if not creds.valid:
                if creds.refresh_token:
                    creds.refresh(Request())
                    session['credentials'] = { # Update session with new token
                        'token': creds.token,
                        'refresh_token': creds.refresh_token,
                        'token_uri': creds.token_uri,
                        'client_id': creds.client_id,
                        'client_secret': creds.client_secret,
                        'scopes': creds.scopes
                    }
                else:
                    return jsonify({'error': 'Credentials expired and no refresh token available. Please re-authorize.'}), 401

            service = build('drive', 'v3', credentials=creds)

            file_metadata = {'name': file.filename}
            media = MediaFileUpload(file.stream, mimetype=file.mimetype, resumable=True)

            uploaded_file = service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, name'
            ).execute()

            return jsonify({
                'message': f'File "{uploaded_file.get("name")}" uploaded successfully!',
                'file_id': uploaded_file.get('id')
            }), 200

        except Exception as e:
            print(f"Error during upload: {e}")
            return jsonify({'error': f'Failed to upload file: {str(e)}'}), 500
    return jsonify({'error': 'An unexpected error occurred.'}), 500

if __name__ == '__main__':
    # For development, enable CORS
    from flask_cors import CORS
    CORS(app) # This will allow your React app to make requests to this Flask app
    app.run(port=5000, debug=True)
