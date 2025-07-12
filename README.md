# Python-Flask-Full-Stack-App-for-Google-Drive-Uploads
This application provides a user interface for selecting images and directly uploading them to Google Drive, leveraging client-side Google API libraries. 


How to Use the Full-Stack App (Locally):

Start the Flask backend: Open a terminal, navigate to your Flask project directory, and run python app.py.

Start the React frontend: Open another terminal, navigate to your React project directory, and run your development server (e.g., npm start).

Open the React app in your browser (usually http://localhost:3000).

Authorize with Google Drive: Click the "Authorize with Google Drive" button. This will redirect you to your Flask backend's /authorize endpoint, which in turn redirects you to Google's consent screen.

Grant Permissions: Follow the prompts on Google's consent screen to grant your backend application permission to access your Google Drive.

Redirect back: After granting permissions, Google will redirect you back to your Flask backend's /oauth2callback endpoint, which then redirects you back to your React frontend.

Upload Images: Once authorized, you can select images and click "Upload to Drive". The files will be sent to your Flask backend, which then uploads them to Google Drive.
