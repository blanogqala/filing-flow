import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyDXH7hkhu5uwPdA63Nl4Jn1amQ2mLNbYXI",
  authDomain: "e-filling-e8857.firebaseapp.com",
  projectId: "e-filling-e8857",
  storageBucket: "e-filling-e8857.firebasestorage.app",
  messagingSenderId: "653174672197",
  appId: "1:653174672197:web:2e4b13804c723f84e20c2c",
  measurementId: "G-30LJ44S08H"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Initialize Analytics (optional)
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}
export { analytics };

export default app;