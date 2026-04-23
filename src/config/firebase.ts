import admin from 'firebase-admin';

let firebaseApp: admin.app.App;

export const initializeFirebase = () => {
  if (!firebaseApp) {
    try {
      const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
        ? JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString())
        : undefined;

      if (!serviceAccountKey) {
        console.warn('⚠️  Firebase service account key not configured. FCM will be disabled.');
        return null;
      }

      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccountKey),
      });

      console.log('✅ Firebase initialized successfully');
      return firebaseApp;
    } catch (error) {
      console.error('❌ Firebase initialization error:', error);
      return null;
    }
  }
  return firebaseApp;
};

export const getFirebaseApp = (): admin.app.App | null => {
  return firebaseApp || null;
};

export const getMessaging = (): admin.messaging.Messaging | null => {
  if (!firebaseApp) return null;
  return admin.messaging(firebaseApp);
};
