var fs = require('fs');
var csv = require('fast-csv');
var pg = require('./database');

const db = new pg.Database();

fs.createReadStream('./test/MOCK_DATA.csv')
  .pipe(csv())
  .on('data', (data) => {
    db.newUser(data[0], data[1], data[2]);
  })

