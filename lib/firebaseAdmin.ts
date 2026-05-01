import admin from "firebase-admin"

let db: admin.database.Database

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT

  if (!raw) {
    console.error("❌ FIREBASE_SERVICE_ACCOUNT is missing")
  } else {
    try {
      const serviceAccount = JSON.parse(raw)

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DB_URL,
      })

      console.log("✅ Firebase initialized")
    } catch (err) {
      console.error("❌ Firebase JSON parse error:", err)
    }
  }
}

db = admin.database()

export { db }