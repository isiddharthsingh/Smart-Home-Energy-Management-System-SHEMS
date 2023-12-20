const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
const saltRounds = 10;

app.use(session({
  secret: 'mysecretisverysecret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // set to true if your website is on HTTPS
}));


app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });


const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: 'root',
  port: 5433,
});

function checkAuthenticated(req, res, next) {
    console.log('Session ID:', req.session.userId);
    console.log(req.session)
    if (req.session.userId) {
      return next();
    }
  
    res.redirect('/login');
}
  
function checkNotAuthenticated(req, res, next) {
    if (req.session.userId) {
      return res.redirect('/dashboard');
    }
    next(); // Proceed if not authenticated
}

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/login', (req, res) => {
  if (req.session.userId) {
      return res.redirect('/dashboard');
  }
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
      const result = await pool.query('SELECT * FROM Customer WHERE username = $1', [username]);
      const user = result.rows[0];

      if (user) {
          const match = await bcrypt.compare(password, user.password);

          if (match) {
              req.session.userId = user.customerid;
              // Save session and then redirect
              req.session.save(err => {
                  if(err) {
                      console.error('Session save error:', err);
                      return res.status(500).send('An internal error occurred');
                  }
                  console.log('session saved');
                  res.redirect('/dashboard'); // Redirect to dashboard after successful login
              });
          } else {
              // Incorrect password
              console.log('Incorrect password');
              res.redirect('/login'); // Redirect back to login with an error message
          }
      } else {
          // User not found
          console.log('User not found');
          res.redirect('/login'); // Redirect back to login with an error message
      }
  } catch (error) {
      console.error(error);
      res.status(500).send('An error occurred');
  }
});


app.get('/register', checkNotAuthenticated, (req, res) => {
  res.render('register');
});


app.post('/register', checkNotAuthenticated, async (req, res) => {
  const { firstname, lastname, streetaddress, aptnumber, city, state, zipcode, username, password } = req.body;

  try {
      // Check if the username already exists
      const existingUserResult = await pool.query('SELECT * FROM Customer WHERE username = $1', [username]);
      if (existingUserResult.rows.length > 0) {
          // Username already exists
          return res.render('register', { errorMessage: 'Username already exists, please choose a different one.' });
      }

      // Username does not exist, proceed with registration
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const result = await pool.query(
          'INSERT INTO Customer (FirstName, LastName, StreetAddress, AptNumber, City, State, ZipCode, username, password) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
          [firstname, lastname, streetaddress, aptnumber, city, state, zipcode, username, hashedPassword]
      );

      const user = result.rows[0];
      req.session.userId = user.customerid;
      req.session.save(err => {
          if(err) {
              console.log(err);
          } else {
              console.log('session saved');
          }
      });

      res.redirect('/dashboard');
  } catch (error) {
      console.error(error);
      res.status(500).send('An error occurred');
  }
});


  
app.get('/service-locations', checkAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM ServiceLocation WHERE CustomerID = $1', [req.session.userId]);
        res.render('service-locations', { serviceLocations: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred in getting service locations');
    }
});

app.post('/service-locations', async (req, res) => {
  const { streetaddress, aptnumber, city, state, zipcode, unitnumber, startdate, squarefootage, bedrooms, occupants } = req.body;

  try {
      // Handle empty integer fields
      const unitnumberValue = unitnumber ? parseInt(unitnumber) : null;
      const squarefootageValue = squarefootage ? parseInt(squarefootage) : null;
      const bedroomsValue = bedrooms ? parseInt(bedrooms) : null;
      const occupantsValue = occupants ? parseInt(occupants) : null;

      await pool.query(
          'INSERT INTO ServiceLocation (CustomerID, StreetAddress, AptNumber, City, State, ZipCode, UnitNumber, StartDate, SquareFootage, Bedrooms, Occupants) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
          [req.session.userId, streetaddress, aptnumber, city, state, zipcode, unitnumberValue, startdate, squarefootageValue, bedroomsValue, occupantsValue]
      );
    res.redirect('/service-locations');
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred in posting service locations');
  }
});


app.post('/service-locations/:id/delete', async (req, res) => {
  try {
    await pool.query('DELETE FROM ServiceLocation WHERE LocationID = $1 AND CustomerID = $2', [req.params.id, req.session.userId]);
    res.redirect('/service-locations');
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred in deleting service locations');
  }
});

app.get('/service-locations/:id/edit', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM ServiceLocation WHERE LocationID = $1 AND CustomerID = $2', [req.params.id, req.session.userId]);
      res.render('edit-service-locations', { location: result.rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).send('An error occurred in updating service location');
    }
  });
  
app.post('/service-locations/:id/edit', async (req, res) => {
    const { streetaddress, aptnumber, city, state, zipcode, unitnumber, startdate, squarefootage, bedrooms, occupants } = req.body;

    try {
        await pool.query(
        'UPDATE ServiceLocation SET StreetAddress = $1, AptNumber = $2, City = $3, State = $4, ZipCode = $5, UnitNumber = $6, StartDate = $7, SquareFootage = $8, Bedrooms = $9, Occupants = $10 WHERE LocationID = $11 AND CustomerID = $12',
        [streetaddress, aptnumber, city, state, zipcode, unitnumber, startdate, squarefootage, bedrooms, occupants, req.params.id, req.session.userId]
        );
        res.redirect('/service-locations');
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred in updating service location');
    }
});


app.get('/dashboard', checkAuthenticated, async (req, res) => {
  try {
    // Fetch user data
    const userResult = await pool.query('SELECT * FROM Customer WHERE CustomerID = $1', [req.session.userId]);
    const user = userResult.rows[0];

    // Fetch energy consumption data
    const energyData = await pool.query(`
      SELECT e.*
      FROM Event e
      JOIN Device d ON e.DeviceID = d.DeviceID
      JOIN ServiceLocation sl ON d.LocationID = sl.LocationID
      WHERE sl.CustomerID = $1 AND e.Label = 'energy use'
    `, [req.session.userId]);

    // Fetch energyDataPerDevice data
    const energyDataPerDevice = await pool.query(`
      SELECT d.DeviceID, SUM(e.Value) as TotalEnergy
      FROM Event e
      JOIN Device d ON e.DeviceID = d.DeviceID
      JOIN ServiceLocation sl ON d.LocationID = sl.LocationID
      WHERE sl.CustomerID = $1
      GROUP BY d.DeviceID
    `, [req.session.userId]);

    // Render the dashboard with the user's username and energy data
    res.render('dashboard', { username: user.username, energyData: energyData.rows, energyDataPerDevice: energyDataPerDevice.rows });
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred');
  }
});

app.get('/devices', checkAuthenticated, async (req, res) => {
    try {
      const deviceResult = await pool.query(`
        SELECT d.DeviceID, dm.DeviceType, dm.Manufacturer, dm.ModelNumber, sl.StreetAddress, sl.City, sl.State, sl.ZipCode
        FROM Device d
        JOIN DeviceModel dm ON d.ModelNumber = dm.ModelNumber
        JOIN ServiceLocation sl ON d.LocationID = sl.LocationID
        WHERE sl.CustomerID = $1
      `, [req.session.userId]);
  
      const deviceModelsResult = await pool.query('SELECT * FROM DeviceModel');
      const serviceLocationsResult = await pool.query('SELECT * FROM ServiceLocation WHERE CustomerID = $1', [req.session.userId]);
  
      res.render('devices', {
        devices: deviceResult.rows,
        deviceModels: deviceModelsResult.rows,
        serviceLocations: serviceLocationsResult.rows
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('An error occurred in getting devices');
    }
});

app.post('/devices', async (req, res) => {
    const { modelnumber, locationid } = req.body;
  
    try {
      await pool.query(
        'INSERT INTO Device (LocationID, ModelNumber) VALUES ($1, $2)',
        [locationid, modelnumber]
      );
      res.redirect('/devices');
    } catch (error) {
      console.error(error);
      res.status(500).send('An error occurred in adding device');
    }
  });
  
app.post('/devices/:id/delete', async (req, res) => {
    try {
      await pool.query('DELETE FROM Device WHERE DeviceID = $1', [req.params.id]);
      res.redirect('/devices');
    } catch (error) {
      console.error(error);
      alert('An error occurred in deleting device becuase it is still in getting used');
    }
});

app.get('/device-models', checkAuthenticated, async (req, res) => {
    res.redirect('/devices');
  });

app.post('/device-models', async (req, res) => {
    const { modelNumber, deviceType, manufacturer } = req.body;
  
    try {
      await pool.query(
        'INSERT INTO DeviceModel (ModelNumber, DeviceType, Manufacturer) VALUES ($1, $2, $3)',
        [modelNumber, deviceType, manufacturer]
      );
      res.redirect('/devices');
    } catch (error) {
      console.error(error);
      res.status(500).send('An error occurred in adding new device model');
    }
});

app.get('/energy-consumption', checkAuthenticated, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT * FROM Customer WHERE CustomerID = $1', [req.session.userId]);
    const user = userResult.rows[0];

    const energyData = await pool.query(`
      SELECT e.*
      FROM Event e
      JOIN Device d ON e.DeviceID = d.DeviceID
      JOIN ServiceLocation sl ON d.LocationID = sl.LocationID
      WHERE sl.CustomerID = $1 AND e.Label = 'energy use'
    `, [req.session.userId]);

    const energyDataPerDevice = await pool.query(`
      SELECT d.DeviceID, SUM(e.Value) as TotalEnergy
      FROM Event e
      JOIN Device d ON e.DeviceID = d.DeviceID
      JOIN ServiceLocation sl ON d.LocationID = sl.LocationID
      WHERE sl.CustomerID = $1 AND e.Label = 'energy use'
      GROUP BY d.DeviceID
      `, [req.session.userId]);
      
    const energyPrices = await pool.query(`
      SELECT *
      FROM EnergyPrice
      WHERE ZipCode = $1
    `, [user.zipcode]);

    const comparisonWithSimilarLocations = await pool.query(`
      SELECT AVG(e.Value) as AverageEnergy
      FROM Event e
      JOIN Device d ON e.DeviceID = d.DeviceID
      JOIN ServiceLocation sl ON d.LocationID = sl.LocationID
      WHERE sl.SquareFootage = $1 AND sl.Occupants = $2 AND e.Label = 'energy use'
    `, [user.squarefootage, user.occupants]);

    const peakNonPeakHours = await pool.query(`
      SELECT e.Timestamp, e.Value
      FROM Event e
      JOIN Device d ON e.DeviceID = d.DeviceID
      JOIN ServiceLocation sl ON d.LocationID = sl.LocationID
      WHERE sl.CustomerID = $1 AND e.Label = 'energy use' AND EXTRACT(HOUR FROM e.Timestamp) BETWEEN 8 AND 20
    `, [req.session.userId]);

    const costAnalysis = await pool.query(`
      SELECT e.Timestamp, e.Value, ep.Price
      FROM Event e
      JOIN Device d ON e.DeviceID = d.DeviceID
      JOIN ServiceLocation sl ON d.LocationID = sl.LocationID
      JOIN EnergyPrice ep ON sl.ZipCode = ep.ZipCode
      WHERE sl.CustomerID = $1 AND e.Label = 'energy use'
    `, [req.session.userId]);

    res.render('energy-consumption', { 
      energyData: energyData.rows, 
      energyDataPerDevice: energyDataPerDevice.rows, 
      energyPrices: energyPrices.rows,
      comparisonWithSimilarLocations: comparisonWithSimilarLocations.rows,
      peakNonPeakHours: peakNonPeakHours.rows,
      costAnalysis: costAnalysis.rows
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred');
  }
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
      if(err) {
        return console.log(err);
      }
      res.redirect('/'); // can redirect to any page
    });
  });

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});