import { initializeApp } from "firebase/app";
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCz0272UmYeSxZkrs38_9r-EvFg9lQPYB8",
  authDomain: "pocket-planner-98ae3.firebaseapp.com",
  databaseURL: 'https://pocket-planner-98ae3-default-rtdb.firebaseio.com/',
  projectId: "pocket-planner-98ae3",
  storageBucket: "pocket-planner-98ae3.appspot.com",
  messagingSenderId: "274751775505",
  appId: "1:274751775505:web:11643df1f711e7f062e2b0",
  measurementId: "G-47YWPGBL15"
};

const app = initializeApp(firebaseConfig);

const database = getDatabase(app);

export { database };
export default app;