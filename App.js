import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Ensure these are globally available from the Canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// URL of your Flask backend server
const BACKEND_URL = 'http://localhost:5000'; // IMPORTANT: Change this if your backend is hosted elsewhere

const App = () => {
  const [firebaseApp, setFirebaseApp] = useState(null);
  const [auth, setAuth] = useState(null);
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);

  const [isBackendAuthorized, setIsBackendAuthorized] = useState(false);
  const [files, setFiles] = useState([]);
  // FIX: Correctly initialize uploadStatus using useState
  const [uploadStatus, setUploadStatus] = useState({});
  const [message, setMessage] = useState('');

  // 1. Initialize Firebase
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const authInstance = getAuth(app);
      const firestoreInstance = getFirestore(app);

      setFirebaseApp(app);
      setAuth(authInstance);
      setDb(firestoreInstance);

      // Listen for Firebase auth state changes
      const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
        if (user) {
          setUserId(user.uid);
          console.log("Firebase user signed in:", user.uid);
        } else {
          console.log("Firebase user not signed in, attempting anonymous sign-in or using initial token...");
          try {
            if (initialAuthToken) {
              await signInWithCustomToken(authInstance, initialAuthToken);
            } else {
              await signInAnonymously(authInstance);
            }
          } catch (error) {
            console.error("Firebase anonymous/custom token sign-in failed:", error);
            setMessage(`Firebase sign-in failed: ${error.message}`);
          }
        }
        setIsFirebaseReady(true); // Firebase auth state is checked
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Failed to initialize Firebase:", error);
      setMessage(`Firebase initialization failed: ${error.message}`);
    }
  }, []);

  // Check for authorization success from backend redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth_success') === 'true') {
      setIsBackendAuthorized(true);
      setMessage('Successfully authorized with Google Drive via backend!');
      // Clean up the URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    // In a real app, you'd also check if a session token exists or make an API call
    // to the backend to verify authentication status. For this example, we assume
    // if auth_success=true, the backend has valid credentials.
  }, []);

  const handleAuthClick = () => {
    // Redirect to the backend's authorization endpoint
    window.location.href = `${BACKEND_URL}/authorize`;
  };

  const handleFileChange = (event) => {
    setFiles(Array.from(event.target.files));
    setUploadStatus({}); // Reset upload status for new files
    setMessage('');
  };

  const handleUpload = async () => {
    if (!isBackendAuthorized) {
      setMessage('Please authorize with Google Drive first.');
      return;
    }
    if (files.length === 0) {
      setMessage('Please select files to upload.');
      return;
    }

    setMessage('Starting upload...');
    const newUploadStatus = {};

    for (const file of files) {
      newUploadStatus[file.name] = { status: 'Uploading...', progress: 0 };
      setUploadStatus({ ...newUploadStatus });

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch(`${BACKEND_URL}/upload`, {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (response.ok) {
          newUploadStatus[file.name] = { status: 'Uploaded!', progress: 100, id: result.file_id };
          setMessage(`Successfully uploaded ${file.name}`);
        } else {
          newUploadStatus[file.name] = { status: `Failed: ${result.error || 'Unknown error'}`, progress: 0 };
          setMessage(`Failed to upload ${file.name}: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Upload error:', error);
        newUploadStatus[file.name] = { status: `Error: ${error.message || 'Network error'}`, progress: 0 };
        setMessage(`Error uploading ${file.name}: ${error.message || 'Network error'}`);
      }
      setUploadStatus({ ...newUploadStatus });
    }
    setMessage('All selected files processed.');
  };

  // Note: There's no explicit backend sign-out in this simple example.
  // To truly "sign out" from the backend's perspective, you'd need an endpoint
  // to clear its session/stored credentials, and then revoke the token.
  // For now, re-authorizing will overwrite existing credentials.
  const handleSignoutClick = () => {
    setIsBackendAuthorized(false);
    setMessage('Disconnected from Google Drive (frontend only). You may need to clear browser cookies or re-authorize if you want to connect to a different Google account.');
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-blue-200 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md text-center border border-gray-200">
        <h1 className="text-3xl font-extrabold text-gray-800 mb-6">
          <span className="text-purple-600">Drive</span> Image Uploader
        </h1>

        {!isFirebaseReady && (
          <p className="text-sm text-gray-600 mb-4">Initializing Firebase...</p>
        )}
        {isFirebaseReady && userId && (
          <p className="text-xs text-gray-500 mb-4">
            Firebase User ID: <span className="font-mono text-purple-700 break-all">{userId}</span>
          </p>
        )}

        {message && (
          <div className={`p-3 rounded-lg mb-4 text-sm ${message.includes('Error') || message.includes('Failed') || message.includes('Please replace') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </div>
        )}

        {isBackendAuthorized ? (
          <>
            <p className="text-lg text-green-600 font-semibold mb-4">
              Connected to Google Drive!
            </p>
            <div className="mb-6">
              <label htmlFor="file-upload" className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition duration-300 ease-in-out transform hover:scale-105">
                Select Images
              </label>
              <input
                id="file-upload"
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {files.length > 0 && (
                <div className="mt-4 text-left border border-gray-300 rounded-lg p-3 bg-gray-50 max-h-40 overflow-y-auto">
                  <p className="font-medium text-gray-700 mb-2">Selected Files ({files.length}):</p>
                  <ul className="list-disc list-inside text-gray-600 text-sm">
                    {files.map((file, index) => (
                      <li key={index} className="truncate">{file.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {files.length > 0 && (
              <button
                onClick={handleUpload}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75 mb-4"
              >
                Upload to Drive
              </button>
            )}

            <div className="mt-6 text-left">
              {Object.keys(uploadStatus).length > 0 && (
                <p className="font-medium text-gray-700 mb-2">Upload Progress:</p>
              )}
              {Object.entries(uploadStatus).map(([fileName, statusInfo]) => (
                <div key={fileName} className="flex items-center justify-between text-sm mb-2 p-2 bg-gray-100 rounded-lg">
                  <span className="font-medium text-gray-800 truncate mr-2">{fileName}</span>
                  <span className={`font-semibold ${statusInfo.status.includes('Uploaded') ? 'text-green-600' : statusInfo.status.includes('Failed') || statusInfo.status.includes('Error') ? 'text-red-600' : 'text-blue-600'}`}>
                    {statusInfo.status}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={handleSignoutClick}
              className="mt-6 w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-full transition duration-300 ease-in-out"
            >
              Disconnect from Google Drive
            </button>
          </>
        ) : (
          <button
            onClick={handleAuthClick}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75"
          >
            Authorize with Google Drive
          </button>
        )}
      </div>
    </div>
  );
};

export default App;
