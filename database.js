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
  this.newUser = (firstName, lastName, email ) => {
    var newUID = uuid(); 
    this.client.query("INSERT INTO USER_ACCOUNT \n \
    VALUES ( $1, $2, $3, $4, $5, $6, $7)\;", [newUID, firstName, lastName, email, 0, null, 0]).catch(() => {});
  };

  // Created a new group with group name
  // TODO: Add constraint that a user cannot be in two groups of the same name
  this.newGroup = (groupName) => {
    var newUID = uuid(); 
    var dateCreated = new Date().toISOString().slice(0, 19).replace('T', ' ');
    this.client.query("INSERT INTO USER_GROUP \n \
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
  // Returns a PROMISE
  this.belongsToGroups = (uid) => {
    return this.client.query("SELECT USER_GROUP.GID, GNAME, CREATED FROM GROUP_MEMBERSHIP \n \
      JOIN USER_ACCOUNT ON GROUP_MEMBERSHIP.UID = USER_ACCOUNT.UID JOIN USER_GROUP ON GROUP_MEMBERSHIP.GID = USER_GROUP.GID \n \
      WHERE USER_ACCOUNT.UID = $1\;", [uid]);
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

  this.allGroups = () => {
    this.client.query("SELECT * FROM USER_GROUP").then(res => console.log(res.rows));
  };

};

module.exports = {
  Database : database
};

// var db = new database();
//db.newUser("Iulia", "Ivana", "imi17@gmail.com");
//db.newUser("Jack", "Pordi", "jackel119@gmail.com");
//db.newUser("Dylan", "Ma", "mazicong@gmail.com");
//db.newGroup("Peng you men");
//db.groupAddMember("33807240-5dc0-11e8-b06f-c346f6c59a8a", "e3ccbd70-5dc0-11e8-a74e-176fbf353fa6");
//db.checkGroupMembership("33807240-5dc0-11e8-b06f-c346f6c59a8a", "e3ccbd70-5dc0-11e8-a74e-176fbf353fa6").then(res => console.log(res));

 //db.newTX("8cfaf520-5dde-11e8-b215-990e38a9bed4", "bb2dbd61-5dde-11e8-be4c-d133297a838f", 20, 0, "test tx", null);

// db.getUserByEmail("mazicong@gmail.com").then(res => db.txsTo(res.rows[0].uid).then(res => console.log(res)));
//db.getUserByEmail("mazicong@gmail.com").then(res => console.log(res.rows[0].uid));


// db.getUserByEmail('jackel119@gmail.com').then(res => console.log(res));
//db.belongsToGroups("15d1dfe0-5dc0-11e8-bf39-c14e2075b722").then(res => console.log(res));
