import * as admin from 'firebase-admin'

// Initialize Firebase Admin SDK (shared utility for API routes)
let firebaseAdmin: admin.app.App | null = null

export const getFirebaseAdmin = (): admin.app.App | null => {
  try {
    // Check if Firebase Admin is already initialized
    if (admin.apps.length === 0) {
      // Get Firebase service account credentials from environment
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      
      if (serviceAccount) {
        // Parse JSON string if provided as environment variable
        const credentials = typeof serviceAccount === 'string' 
          ? JSON.parse(serviceAccount) 
          : serviceAccount
        
        firebaseAdmin = admin.initializeApp({
          credential: admin.credential.cert(credentials),
        })
        console.log('✅ Firebase Admin SDK initialized successfully')
      } else {
        // Alternative: Use individual environment variables
        const projectId = process.env.FIREBASE_PROJECT_ID
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
        
        if (projectId && privateKey && clientEmail) {
          firebaseAdmin = admin.initializeApp({
            credential: admin.credential.cert({
              projectId,
              privateKey,
              clientEmail,
            }),
          })
          console.log('✅ Firebase Admin SDK initialized with individual credentials')
        } else {
          console.warn('⚠️ Firebase credentials not found. FCM notifications will not work.')
        }
      }
    } else {
      firebaseAdmin = admin.app()
    }
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin SDK:', error)
  }
  
  return firebaseAdmin
}
