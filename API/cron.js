const admin = require('firebase-admin');
const CryptoJS = require('crypto-js');

if (!admin.apps.length) {
  const serviceAccount = require('../serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://myonlybd-default-rtdb.europe-west1.firebasedatabase.app"
  });
}

const db = admin.database();
const SECRET_KEY = "MY_VIP_SECRET_KEY_2026";

function calculateResult(periodId) {
  const hash = CryptoJS.HmacSHA256(periodId, SECRET_KEY).toString();
  const subHash = hash.substring(0, 8);
  const numValue = parseInt(subHash, 16);
  return numValue % 10;
}

module.exports = async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    const endedPeriod = `${year}${month}${day}${hours}${minutes}`;
    
    const resultNum = calculateResult(endedPeriod);
    const winOutcome = resultNum >= 5 ? 'BIG' : 'SMALL';

    await db.ref(`history/${endedPeriod}`).set({ 
      num: resultNum, 
      outcome: winOutcome, 
      timestamp: Date.now() 
    });

    const betsSnapshot = await db.ref(`bets/${endedPeriod}`).once('value');
    const bets = betsSnapshot.val();

    if (bets) {
      for (const phone in bets) {
        if (bets[phone].choice === winOutcome) {
          await db.ref(`users/${phone}/balance`).transaction((bal) => (bal || 0) + (bets[phone].amount * 2));
        }
      }
    }

    return res.status(200).json({ success: true, period: endedPeriod, result: resultNum, outcome: winOutcome });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
