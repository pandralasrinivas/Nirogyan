const express = require('express');
const app = express();
const nodemailer = require('nodemailer');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose(); 
require('dotenv').config();
// Initialize the database connection
const db = new sqlite3.Database("database.db", (err) => {
  if (err) {
    console.error("Failed to connect to the database:", err.message);
  }
});

// Middleware

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://reactjs-test-12.s3-website.ap-south-1.amazonaws.com"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);
app.use(express.json()); // Add this middleware to parse JSON requests

// Doctor Model
const DOCTORS = [
  {
    name: 'Dr.Sunitha',
    specialty: 'General Practice',
    avatar: 'https://www.shutterstock.com/image-photo/head-shot-woman-wearing-white-600nw-1529466836.jpg',
    rating: 4.8,
    experience: '10+',
    hospital: 'Sunitha General Care'
  },
  {
    name: 'Dr.Ramaya',
    specialty: 'Pediatrics',
    avatar: 'https://static.vecteezy.com/system/resources/thumbnails/048/638/758/small/female-doctor-in-a-with-a-gray-background-free-photo.jpg',
    rating: 4.9,
    experience: '8+',
    hospital: "Children's Medical Center"
  },
  {
    name: 'Dr.Vinay Kumar',
    specialty: 'General Surgery',
    avatar: 'https://media.istockphoto.com/id/1311511363/photo/headshot-portrait-of-smiling-male-doctor-with-tablet.jpg?s=612x612&w=0&k=20&c=w5TecWtlA_ZHRpfGh20II-nq5AvnhpFu6BfOfMHuLMA=',
    rating: 4.5,
    experience: '8+',
    hospital: 'Yodha'
  },
  {
    name: 'Dr.Yashwanth',
    specialty: 'Dermatology',
    avatar: 'https://img.freepik.com/free-photo/doctor-offering-medical-teleconsultation_23-2149329007.jpg',
    rating: 4.6,
    experience: '8+',
    hospital: 'Skin Care Specialists'
  },
  {
    name: 'Dr.Shivaji',
    specialty: 'Neurology',
    avatar: 'https://static.vecteezy.com/system/resources/thumbnails/048/628/084/small/doctor-in-casual-attire-with-background-free-photo.jpg',
    rating: 4.5,
    experience: '8+',
    hospital: 'Shivaji Hospital'
  },
  {
    name: 'Dr.Suresh Varma',
    specialty: 'Obstetrics & Gynecology',
    avatar: 'https://static.vecteezy.com/system/resources/thumbnails/059/946/764/small/portrait-of-friendly-european-doctor-in-workwear-with-stethoscope-on-neck-posing-in-clinic-interior-looking-and-smiling-at-camera-photo.jpg',
    rating: 4.9,
    experience: '8+',
    hospital: 'SV Hospital'
  }
];



// Function to initialize tables
function initTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS doctor_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      specialty TEXT,
      avatar TEXT,
      rating REAL,
      experience TEXT,
      hospital TEXT,
      date TEXT,
      time_slot TEXT,
      status TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Error creating doctor_availability table:', err.message);
    } else {
      const currentDate = new Date().toISOString().split('T')[0];
      ensureDayData(currentDate, () => {});
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_name TEXT,
      email TEXT,
      phone TEXT,
      date TEXT,
      time TEXT,
      doctor TEXT,
      specialist TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Error creating patients table:', err.message);
    }
  });
}

// Initialize tables and seed data
initTables();

const TIME_SLOTS = [
  '9am-10am', '10am-11am', '11am-12pm', '12pm-1pm',
  '2pm-3pm', '4pm-5pm', '5pm-6pm', '6pm-8pm', '8pm-9pm'
];

// Function to ensure day data
function ensureDayData(date, callback) {
  db.get(`SELECT COUNT(*) AS count FROM doctor_availability WHERE date = ?`, [date], (err, row) => {
    if (err) {
      console.error(`Error checking existing data for date ${date}:`, err.message);
      return callback();
    }

    if (row.count > 0) {
      return callback();
    }

    const stmt = db.prepare(`
      INSERT INTO doctor_availability
      (name, specialty, avatar, rating, experience, hospital, date, time_slot, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available')
    `);

    for (const doctor of DOCTORS) {
      for (const slot of TIME_SLOTS) {
        stmt.run(
          doctor.name, doctor.specialty, doctor.avatar, doctor.rating,
          doctor.experience, doctor.hospital, date, slot,
          (err) => {
            if (err) {
              console.error(`Error inserting data for doctor ${doctor.name} on ${date} at ${slot}:`, err.message);
            }
          }
        );
      }
    }

    stmt.finalize((err) => {
      if (err) {
        console.error('Error finalizing ensureDayData statement:', err.message);
      }
      callback();
    });
  });
}

// Patient Controller
app.post('/api/patients', (req, res) => {
  const { patient_name, email, date, time, doctor, specialist } = req.body;
  console.log('Received patient data:', req.body);

  // Validate required fields
  if (!patient_name || !email || !date || !time || !doctor || !specialist) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  db.run(
    `INSERT INTO patients (patient_name, email, date, time, doctor, specialist) VALUES (?, ?, ?, ?, ?, ?)`,
    [patient_name, email, date, time, doctor, specialist],
    function (err) {
      if (err) {
        console.error('Database error while inserting patient:', err.message);
        return res.status(500).json({ error: 'DB error' });
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL,
          pass: process.env.EMAIL_KEY
        }
      });

      const mailOptions = {
        from: `"Nirogyan Doctor's ${process.env.EMAIL}`,
        to: email,
        subject: 'Appointment Confirmation',
        text: `Hi ${patient_name},

Your appointment is all set! We’ve booked you in with one of our experienced specialists.
Here are the details:

👨‍⚕️ Doctor: ${doctor}
🏥 Specialist in: ${specialist}
📅 Date: ${date}
🕒 Time: ${time}

Have questions or need to change the time? No worries—just give us a call or drop us an email.

Thank you for choosing Nirogyan. We're here to make your healthcare experience smooth and stress-free. See you soon!

Take care,
Team Nirogyan
`
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Error sending email:', error.message);
          return res.status(500).json({ message: "Appointment booked, but email failed to send." });
        }
        res.status(200).json({ message: "Appointment booked successfully! Confirmation email sent." });
      });
    }
  );
});

// Schedule Controller
app.get('/api/schedule', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  ensureDayData(date, () => {
    db.all(`SELECT * FROM doctor_availability WHERE date = ?`, [date], (err, rows) => {
      if (err) {
        console.error('Database error while fetching schedule:', err.message);
        return res.status(500).json({ error: 'DB error' });
      }

      const grouped = {};
      for (const row of rows) {
        if (!grouped[row.name]) {
          grouped[row.name] = {
            name: row.name,
            specialty: row.specialty,
            avatar: row.avatar,
            rating: row.rating,
            experience: row.experience,
            hospital: row.hospital,
            availableToday: true,
            date,
            slots: {}
          };
        }
        // Ensure the correct status is reflected for each time slot
        grouped[row.name].slots[row.time_slot] = row.status; // Use the status directly from the database
      }
      res.json(Object.values(grouped));
    });
  });
});

app.put('/api/schedule', (req, res) => {
  const { name, date, time_slot, status } = req.body;
  if (!name || !date || !time_slot || !status) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  db.run(
    `UPDATE doctor_availability SET status = ? WHERE name = ? AND date = ? AND time_slot = ?`,
    [status, name, date, time_slot],
    function (err) {
      if (err) {
        console.error('Database error while updating schedule:', err.message);
        return res.status(500).json({ error: 'DB error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'No matching record found' });
      }
      res.json({ success: true });
    }
  );
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT);
