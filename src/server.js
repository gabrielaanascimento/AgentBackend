const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'J.A.R.V.I.S. Tasks API'
  });
});

app.use('/api', require('./routes/api'));

module.exports = app;
