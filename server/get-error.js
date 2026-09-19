const mongoose = require('mongoose');
const User = require('./models/User.model');
require('dotenv').config();

async function run() {
  try {
    // Connect to the same DB as check-db.js
    await mongoose.connect('mongodb://localhost:27017/cfes_portal');
    
    // Find the faculty user
    const user = await User.findOne({ role: 'faculty' });
    if (!user) {
      console.log('No faculty user found');
      process.exit(1);
    }

    // Generate JWT token
    const token = user.getSignedJwtToken();

    // Use fetch to call the endpoint
    const res = await fetch('http://localhost:5000/api/obe/69fc7bd8dd35a98a24284e91/export/excel', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const text = await res.text();
      console.log('ENDPOINT ERROR:', text);
      
      // Let's also read the error_log.txt if it exists
      try {
        const log = require('fs').readFileSync('d:\\cfes-portal\\server\\error_log.txt', 'utf8');
        console.log('ERROR LOG TXT:', log);
      } catch(e) {}
    } else {
      console.log('ENDPOINT SUCCESS! Status:', res.status);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

run();
