const { Client }      = require('pg');
const uuid            = require('uuid/v1');


var database = function(db_name) {

  this.client  =  new Client({
    database: db_name
  });
  this.db_name = db_name;
  this.client.connect();

  // Creates a new user
  // SAFE (but currently does not return whether a new user has been created)
  this.newUser = (firstName, lastName, email, fb_id = null) => {
    var newUID = uuid(); 
    return this.client.query("INSERT INTO USER_ACCOUNT \n \
    VALUES ( $1, $2, $3, $4, $5, $6, $7, $8)\;", [newUID, firstName, lastName, email, 0, null, 0, fb_id]).catch(() => {});
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
  // TODO: Needs to return txid.
  this.newTX = (to, from, howMuch, currency, description, groupID) => {
    var newUID = uuid(); 
    var dateCreated = new Date().toISOString().slice(0, 19).replace('T', ' ');
    this.client.query("INSERT INTO TRANSACTION \n \
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)\;", [newUID, to, from, currency, howMuch, dateCreated, description, 0, groupID]).then( () =>  newUID );
  };


  // Gets user by email, returns a PROMISE
  // NOT SAFE, can return 0 rows if email not in db
  this.getUserByEmail = (email) => {
    return this.client.query("SELECT * FROM USER_ACCOUNT \n \
      WHERE EMAIL = $1 \;", [email]);
  };
  
  // All the groups a user account belongs to
  // Query from uid
  // Returns a PROMISE
  this.belongsToGroups = (uid) => {
    return this.client.query("SELECT USER_GROUP.GID, GNAME, CREATED FROM GROUP_MEMBERSHIP \n \
      JOIN USER_ACCOUNT ON GROUP_MEMBERSHIP.UID = USER_ACCOUNT.UID JOIN USER_GROUP ON GROUP_MEMBERSHIP.GID = USER_GROUP.GID \n \
      WHERE USER_ACCOUNT.UID = $1\;", [uid]);
  };

  // All the groups a user account belongs to
  // Query from email
  // Returns a PROMISE
  this.belongsToGroups = (email) => {
    return this.client.query("SELECT USER_GROUP.GID, GNAME, CREATED FROM GROUP_MEMBERSHIP \n \
      JOIN USER_ACCOUNT ON GROUP_MEMBERSHIP.UID = USER_ACCOUNT.UID JOIN USER_GROUP ON GROUP_MEMBERSHIP.GID = USER_GROUP.GID \n \
      WHERE USER_ACCOUNT.EMAIL = $1\;", [email]);
  };

  // Returns all users that belongs to a specific group
  // Returns a promise
  this.getUserInGroup = (gid) => {
    return this.client.query("SELECT USER_ACCOUNT.* FROM GROUP_MEMBERSHIP \n \
      JOIN USER_ACCOUNT ON GROUP_MEMBERSHIP.UID = USER_ACCOUNT.UID JOIN USER_GROUP ON GROUP_MEMBERSHIP.GID = USER_GROUP.GID \n \
      WHERE GROUP_MEMBERSHIP.GID = $1\;", [gid]);
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

  this.associateFB_email = (email, id) => {
     return this.client.query("UPDATE USER_ACCOUNT \n \
      SET FB_ID = $1 \n \
      WHERE EMAIL = $2", [id, email]);
  };


};

module.exports = {
  Database : database
};

// var db = new database('webapp-testing');
//db.newUser("Iulia", "Ivana", "imi17@gmail.com");
// db.newUser("Jack", "Pordi", "jackel119@gmail.com");
//db.newUser("Dylan", "Ma", "mazicong@gmail.com");
//db.newGroup("Peng you men");
//db.groupAddMember("33807240-5dc0-11e8-b06f-c346f6c59a8a", "e3ccbd70-5dc0-11e8-a74e-176fbf353fa6");
//db.checkGroupMembership("33807240-5dc0-11e8-b06f-c346f6c59a8a", "e3ccbd70-5dc0-11e8-a74e-176fbf353fa6").then(res => console.log(res));

 //db.newTX("8cfaf520-5dde-11e8-b215-990e38a9bed4", "bb2dbd61-5dde-11e8-be4c-d133297a838f", 20, 0, "test tx", null);

// db.getUserByEmail("mazicong@gmail.com").then(res => db.txsTo(res.rows[0].uid).then(res => console.log(res)));
//db.getUserByEmail("mazicong@gmail.com").then(res => console.log(res.rows[0].uid));


// db.getUserByEmail('jackel119@gmail.com').then(res => console.log(res));
//db.belongsToGroups("15d1dfe0-5dc0-11e8-bf39-c14e2075b722").then(res => console.log(res));
