const mocha  = require('mocha');
const assert = require('assert');
const fs     = require('fs');
const csv    = require('fast-csv');
const pg     = require('../database');
const uuid   = require('uuid/v1');
const util   = require('util');

// Test Environment
describe('Generates randomized groups from fake data and simulates TXs', () => {
  const db = new pg.Database('webapp-testing');

  // BEFORE
  before((done) => {
    var newUserStream = () => {
      var promises = [];
      fs.createReadStream('./test/fake_users.csv')
        .pipe(csv())
        .on('data', (data) => {
          promises.push(db.newUser(data[0], data[1], data[2], data[3]));
        })
        .on('finish', (result) => {
          console.log('Added all mock users');
        });
      return Promise.all(promises);
    };

    var newGroupStream = () => {
      var promises = [];
      fs.createReadStream('./test/fake_groups.csv')
        .pipe(csv())
        .on('data', (data) => {
          db.newGroup(data[0]);
        })
        .on('end',(result) => {
          console.log('Added all mock groups');
        });
      return Promise.all(promises);
    };

    // Generate random group memberships
    var genGroupMembers = () => {
        
      // Helper function that inserts a random user into a random group
      var genGroupMember = () => {
        db.client.query('INSERT INTO GROUP_MEMBERSHIP \n \
          VALUES ((SELECT GID FROM USER_GROUP ORDER BY RANDOM() \n \
          LIMIT 1), (SELECT UID FROM USER_ACCOUNT ORDER BY RANDOM()\n \
          LIMIT 1) )').catch((e) => {});
      }

      var l = Array.from(Array(4000), (_,x) => x);
      var ret = l.map(genGroupMember);
      // console.log('returned promises:', ret);
      return ret;
    }
  
    // Generate random user 2 user transactions
    var genTXs = () => {

      // Gets random transaction names as an array
      var tx_names = fs.readFileSync('./test/tx_names.csv', 'utf-8')
                      .split('\n');

      // Generates a single random transaction
      var genSingleTX = () => {
        var amount  = (Math.random() * 30).toFixed(2);
        var newTXID = uuid();
        var time    = new Date().toISOString().slice(0, 19)
                            .replace('T', ' ');
        var description = tx_names[Math.floor(Math.random() * 1000)];
        return db.client.query('INSERT INTO TRANSACTION VALUES \n \
          ($1, (SELECT UID FROM USER_ACCOUNT ORDER BY RANDOM() LIMIT 1), \n \
          (SELECT UID FROM USER_ACCOUNT ORDER BY RANDOM() LIMIT 1), \n \
           $2, $3, $4, $5, 0, NULL);', 
          [newTXID, 0, amount, time, description]);
      };

      var l = Array.from(Array(10000), (_,x) => x);
      var ret = l.map(genSingleTX);
      return ret;

    };

    var genFriends = () => {
      var genFrenship = () => {
        return db.client.query('INSERT INTO FRIEND VALUES \n \
          ((SELECT UID FROM USER_ACCOUNT ORDER BY RANDOM() LIMIT 1), \n \
          (SELECT UID FROM USER_ACCOUNT ORDER BY RANDOM() LIMIT 1), TRUE);')
      };
      var l = Array.from(Array(5000), (_,x) => x);
      return l.map(genFrenship)
    };

    Promise.all([
        db.client.query("DELETE FROM TRANSACTION"),
        db.client.query("UPDATE USER_ACCOUNT SET NET = 0;"),
        db.client.query("DELETE FROM GROUP_MEMBERSHIP"),
        db.client.query("DELETE FROM FRIEND")])
        // db.client.query("DELETE FROM USER_GROUP")])
      .then(() => { 
     //    Promise.all([
     //      newUserStream(), newGroupStream()
     //    ])
     //  })
     //  .then(() => {
        return Promise.all(genGroupMembers());
      })
      .then(() => {
        return Promise.all(genFriends());
      })
      .then(() => {
        return Promise.all(genTXs()).then(() => console.log('Gen\'d TXs'));
      })
      .then(() => done());
  }); 

  it('Selects random user account', async () => {
    return db.client.query('SELECT * FROM USER_ACCOUNT \n \
      ORDER BY RANDOM() LIMIT 1;'); //.then(res => assert(res.rowCount == 1));

  });

  it('Selects random groups', () => {
    return db.client.query('SELECT * FROM USER_GROUP \n \
      ORDER BY RANDOM() LIMIT 1;') // .then(res => console.log(res)); //assert(res.rowCount == 1));
  });

  it('Finds Groups', () => {
    return db.belongsToGroupsByEmail('jackel119@gmail.com')
    .then(res => console.log(res));
  });

  it('Finds other users in shared groups', () => {
    return db.client.query('SELECT * FROM USER_ACCOUNT \n \
      ORDER BY RANDOM() LIMIT 1;')
      // .then(res => {
      //   // console.log(res);
      //   console.log(res.rows[0].email);
      //   return db.getUserByEmail(res.rows[0].email)
      // })
      // .then(res => {
      //   console.log(res); 
      //   return db.getOtherUsersInGroups(res.uid);
      // }).then(res => console.log(res));
  });

  it('Tests Finding Users in a group', () => {
    return db.client.query('SELECT GID FROM USER_GROUP \n \
      ORDER BY RANDOM() LIMIT 1').then(res => res.rows[0].gid)
      .then(res => db.getUsersInGroup(res))
      .then(res => console.log(res));
  }); 
  
  it('Gets all groups that a user is in, \
  as well as their members', () => {
    return db.client.query('SELECT UID FROM USER_ACCOUNT \
      ORDER BY RANDOM() LIMIT 1')
    .then(res => res.rows[0].uid)
    .then(res => db.allGroupsAndUsers(res))
    .then(res => console.log(util.inspect(res, false, null)));
  })
});
