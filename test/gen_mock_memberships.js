var fs = require('fs');
var csv = require('fast-csv');
var pg = require('./database');

const db = new pg.Database();

fs.createReadStream('./test/fake_groups.csv')
  .pipe(csv())
  .on('data', (data) => {
    db.new(data[0]);
  })
