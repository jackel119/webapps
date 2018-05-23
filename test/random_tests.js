const mocha = require('mocha');
const assert = require('assert');
const fs = require('fs');
const csv = require('fast-csv');
const pg = require('../database');



describe('Generates randomized groups from fake data and simulates TXs', () => {
  const db = new pg.Database('webapp-testing');
  before((done) => {

    db.client.query("DELETE FROM USER_ACCOUNT");
    db.client.query("DELETE FROM USER_GROUP");
    db.client.query("DELETE FROM GROUP_MEMBERSHIP");


    let newUserStream = new Promise((res, rej) => {
      fs.createReadStream('./test/fake_users.csv')
        .pipe(csv())
        .on('data', (data) => {
          db.newUser(data[0], data[1], data[2]);
        })
        .on('end', (result) => {
          console.log('Finished Adding Mock Users!');
          res();
          done();
        });
    })

    let newGroupStream = new Promise( (res, rej) => {
      fs.createReadStream('./test/fake_groups.csv')
        .pipe(csv())
        .on('data', (data) => {
          db.newGroup(data[0]);
        })
        .on('end',(result) => {
          //console.log('Added all mock groups');
          res();
        });
    });

    // console.log(newUserStream, newGroupStream);
    Promise.all([newUserStream, newGroupStream])
      .then(() => console.log(newUserStream, newGroupStream))


  }); 

  it('Selects random user account', () => {
    db.client.query('SELECT * FROM USER_ACCOUNT \n \
      ORDER BY RANDOM() LIMIT 1;').then(res => console.log(res.rows[0]));
    db.client.query('SELECT * FROM USER_ACCOUNT \n \
      ORDER BY RANDOM() LIMIT 1;').then(res => console.log(res.rows[0]));
    db.client.query('SELECT * FROM USER_ACCOUNT \n \
      ORDER BY RANDOM() LIMIT 1;').then(res => console.log(res.rows[0]));
    db.client.query('SELECT * FROM USER_ACCOUNT \n \
      ORDER BY RANDOM() LIMIT 1;').then(res => console.log(res.rows[0]));
    db.client.query('SELECT * FROM USER_ACCOUNT \n \
      ORDER BY RANDOM() LIMIT 1;').then(res => console.log(res.rows[0]));
  });

  it('Selects random groups', () => {
    db.client.query('SELECT * FROM USER_GROUP \n \
      ORDER BY RANDOM() LIMIT 1;').then(res => console.log('group name: ', res.rows[0].gname));
    db.client.query('SELECT * FROM USER_GROUP \n \
      ORDER BY RANDOM() LIMIT 1;').then(res => console.log('group name: ', res.rows[0].gname));
    db.client.query('SELECT * FROM USER_GROUP \n \
      ORDER BY RANDOM() LIMIT 1;').then(res => console.log('group name: ', res.rows[0].gname));
    db.client.query('SELECT * FROM USER_GROUP \n \
      ORDER BY RANDOM() LIMIT 1;').then(res => console.log('group name: ', res.rows[0].gname));
    db.client.query('SELECT * FROM USER_GROUP \n \
      ORDER BY RANDOM() LIMIT 1;').then(res => console.log('group name: ', res.rows[0].gname));
  });

  
});
