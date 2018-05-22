var fs = require('fs');
var csv = require('fast-csv');
var pg = require('../database');

const db = new pg.Database();

fs.createReadStream('./MOCK_DATA.csv')
  .pipe(csv())
  .on('data', (data) => {
    db.newUser(data[0], data[1], data[2]);
  })


// obj.fromPath('./test/MOCK_DATA.csv').toarray( (data) => {
//   for (var i = 0; i < data.length; i++) {
//     db.newUser(data[index][0], data[index][1], data[index][2]);
//   }
// });


