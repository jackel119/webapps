const { Client, Pool}      = require('pg');
const uuid                 = require('uuid/v1');
const sha256               = require('js-sha256');


var database = function(db_name) {

  this.client  =  new Pool({
    database: db_name
  });
  this.db_name = db_name;
  this.client.connect();

  // Creates a new user
  // SAFE (but currently does not return whether a new user has been created)
  this.newUser = (firstName, lastName, email, pw = null, fb_id = null) => {
    var newUID = uuid(); 
    console.log(pw);
    var pw_hash = sha256(pw);
    return this.client.query("INSERT INTO USER_ACCOUNT \n \
    VALUES ( $1, $2, $3, $4, $5, $6, $7, $8)\;", [newUID, firstName, lastName, email, 0, pw_hash, 0, fb_id]).catch(() => {});
  };

  // Created a new group with group name
  // TODO: Add constraint that a user cannot be in two groups of the same name
  this.newGroup = (groupName) => {
    var newUID = uuid(); 
    var dateCreated = new Date().toISOString().slice(0, 19).replace('T', ' ');
    return this.client.query("INSERT INTO USER_GROUP \n \
      VALUES ( $1, $2, $3 )\;", [newUID, groupName, dateCreated]);
  };

  // Adds USER with uid to GROUP with gid
  // SAFE: Doesn't add user if already in group, but doesn't return whether
  //       that is the case.
  this.groupAddMember = (uid, gid) => {
    // Check if user is already in group or not
    // if user not in group, then add to group
    this.checkGroupMembership(uid, gid).then(res => {
      if (res) {
        console.log('Adding user into group');
        this.client.query("INSERT INTO GROUP_MEMBERSHIP \n \
        VALUES ($1, $2)\;", [gid, uid]);
      } else {
        console.log('User already in group');
      }
    });
  };

  // A PROMISE that returns true if USER with uid is NOT in group with GID
  this.checkGroupMembership = (uid, gid) => {
    return this.client.query("SELECT * FROM GROUP_MEMBERSHIP \n \
      WHERE UID = $1 \n \
      AND GID = $2\;", [uid, gid]).then(result => result.rowCount === 0);
  };

  // Creates a new transaction
  // SAFE: Never fails
  this.newTX = (to, from, howMuch, currency, description, groupID) => {
    var newTXID = uuid(); 
    var dateCreated = new Date().toISOString().slice(0, 19).replace('T', ' ');
    return this.client.query("INSERT INTO TRANSACTION \n \
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)\;", [newTXID, to, from, currency, howMuch, dateCreated, description, 0, groupID]).then(() =>  {
        return {
          txid: newTXID,
          from_user : from,
          to_user: to,
          currency: currency,
          amount: howMuch,
          time: dateCreated,
          description: description,
          status: 0,
          gid: groupID
        };
      });
  };


  // Gets user by email, returns a PROMISE
  // NOT SAFE, can return 0 rows if email not in db
  this.getUserByEmail = (email) => {
    return this.client.query("SELECT * FROM USER_ACCOUNT \n \
      WHERE EMAIL = $1 \;", [email]);
  };
  
  // Gets UID by email, returns a PROMISE
  // NOT SAFE, can return 0 rows if email not in db
  this.getUserByEmail = (email) => {
    return this.client.query("SELECT (UID) FROM USER_ACCOUNT \n \
      WHERE EMAIL = $1 \;", [email]).then( res => res.rows[0] );
  };

  // All the groups a user account belongs to
  // Query from uid
  // Returns a PROMISE
  this.belongsToGroups = (uid) => {
    return this.client.query("SELECT USER_GROUP.GID, GNAME, CREATED FROM GROUP_MEMBERSHIP \n \
      JOIN USER_ACCOUNT ON GROUP_MEMBERSHIP.UID = USER_ACCOUNT.UID JOIN USER_GROUP ON GROUP_MEMBERSHIP.GID = USER_GROUP.GID \n \
      WHERE USER_ACCOUNT.UID = $1\;", [uid]).then(res => res.rows);
  };

  // All the groups a user account belongs to
  // Query from email
  // Returns a PROMISE
  this.belongsToGroupsByEmail = (email) => {
    return this.client.query("SELECT USER_GROUP.GID, GNAME, CREATED FROM GROUP_MEMBERSHIP \n \
      JOIN USER_ACCOUNT ON GROUP_MEMBERSHIP.UID = USER_ACCOUNT.UID JOIN USER_GROUP ON GROUP_MEMBERSHIP.GID = USER_GROUP.GID \n \
      WHERE USER_ACCOUNT.EMAIL = $1\;", [email]).then(res => res.rows);
  };

  // Returns all users that belongs to a specific group
  // Returns a promise
  this.getUserInGroup = (gid) => {
    return this.client.query("SELECT USER_ACCOUNT.* FROM GROUP_MEMBERSHIP \n \
      JOIN USER_ACCOUNT ON GROUP_MEMBERSHIP.UID = USER_ACCOUNT.UID JOIN USER_GROUP ON GROUP_MEMBERSHIP.GID = USER_GROUP.GID \n \
      WHERE GROUP_MEMBERSHIP.GID = $1\;", [gid]);
  };

  this.getOtherUsersInGroups = (uid) => {
    return this.client.query("SELECT * FROM USER_ACCOUNT JOIN GROUP_MEMBERSHIP ON USER_ACCOUNT.UID = GROUP_MEMBERSHIP.UID WHERE GID IN (SELECT GID FROM GROUP_MEMBERSHIP WHERE UID = $1);", [uid]);

  };

  // Returns the sum of the net positives
  // Returns a promise
  this.moneyIn = (uid1, uid2) => {
    return this.client.query("SELECT SUM(AMOUNT) \n \
      FROM TRANSACTION \n \
      WHERE FROM_USER = uid1 AND TO_USER = uid2\;", [uid1, uid2]);
  };

  // Returns the sum of the net negatives
  // Returns a promise
  this.moneyOut = (uid1, uid2) => {
    return this.client.query("SELECT SUM(AMOUNT) \n \
      FROM TRANSACTION \n \
      WHERE FROM_USER = uid2 AND TO_USER = uid1\;", [uid1, uid2]);
  };

  // All transactions to a user
  // Returns a PROMISE
  this.txsTo = (uid) => {
    return this.client.query("SELECT * FROM TRANSACTION WHERE TO_USER = $1;", [uid]);
  };

  // All transactions from a user
  // Returns a PROMISE
  this.txsFrom = (uid) => {
    return this.client.query("SELECT * FROM TRANSACTION WHERE FROM_USER = $1;", [uid]);
  };

  this.txsWith = (uid) => {
    return this.client.query("SELECT * FROM TRANSACTION WHERE \n \
      FROM_USER = $1 OR TO_USER = $1;", [uid]);
  };

  // All group transactions
  // Returns a PROMISE
  this.groupTXs = (gid) => {
    return this.client.query("SELECT * FROM TRANSACTION WHERE GID = $1", [gid]);
  };

  // Returns all groups registered, in rows
  // Returns a PROMISE
  this.allGroups = () => {
    return this.client.query("SELECT * FROM USER_GROUP").then(res => res.rows);
  };

  // Facebook Login
  this.fb_login = (data) => {
    return this.getUserByEmail(data.email).then(res => {
      if (res.rowCount === 1) { // There is a user with that email
        if (res.rows[0].fb_id === null) { // Associate user with fb_id
          this.associateFB_email(data.email, data.id);
        } else if (res.rows[0].fb_id != data.id) { 
          // Check that db's fb_id and actual fb_id are equivalent
          return Promise.reject(new Error('Different fb_id associated with email!'));
        }
      } else { // ^ there isn't, so create a user
        return this.newUser(data.first_name, data.last_name, data.email, data.id);
      }
    });
  };

  // Associates FB ID with a user
  this.associateFB_email = (email, id) => {
     return this.client.query("UPDATE USER_ACCOUNT \n \
      SET FB_ID = $1 \n \
      WHERE EMAIL = $2", [id, email]);
  };

  // Verifies whether a user is in the database with that password or not
  // Returns an object of the format :
  // { result: bool, user_id : string (if exists)}
  this.verifyLogin = (email, password) => {
    var pw_hash = sha256(password);
    return this.client.query("SELECT * FROM USER_ACCOUNT WHERE \n \
      EMAIL = $1 AND PASSWORD_HASH = $2;", [email, pw_hash]).then(res => {
        if (res.rowCount == 0) {
          return { result: false};
        } else {
          return {result: true, data: res.rows[0]};
        }
      });
  };

  this.getUsersByUID = (uidList) => {
    return this.client.query('SELECT * FROM USER_ACCOUNT WHERE \n \
      UID = ANY($1)', [uidList]).then(res => userListToMap(res.rows));
  };

  this.userListToMap = (list) => {
    var map = {};
    for (var user of list) {
      map[user.uid] = user;
      delete user.uid;
    }
    return map;
  };


};

module.exports = {
  Database : database
};

//db.newUser("Iulia", "Ivana", "imi17@gmail.com");
// var db = new database('webapp-testing');
// db.verifyLogin('jackel119@gmail.com', 'david').then(res => console.log(res));
// db.newUser("Jack", "Pordi", "jackel119@gmail.com");
// pw_hash = sha256('david');
// db.client.query('UPDATE USER_ACCOUNT SET PASSWORD_HASH = $1 WHERE EMAIL = $2;',
// db.belongsToGroupsByEmail('jackel119@gmail.com').then(res => console.log(res));
  //[pw_hash, 'jackel119@gmail.com']);
//db.newUser("Dylan", "Ma", "mazicong@gmail.com");
//db.newGroup("Peng you men");
