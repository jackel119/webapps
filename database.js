const { Client }      = require('pg');
const uuid            = require('uuid/v1');


var database = function() {

  this.client          =  new Client('webapp');
  this.name = "webapp database";
  this.client.connect();

  // Creates a new user
  this.newUser = (firstName, lastName, email ) => {
    var newUID = uuid(); 
    this.client.query("INSERT INTO \"USER\" \n \
    VALUES ( $1, $2, $3, $4, $5, $6, $7)\;", [newUID, firstName, lastName, email, 0, null, 0]);
  };

  // Created a new group with group name
  this.newGroup = (groupName) => {
    var newUID = uuid(); 
    var dateCreated = new Date().toISOString().slice(0, 19).replace('T', ' ');
    this.client.query("INSERT INTO \"GROUP\" \n \
      VALUES ( $1, $2, $3 )\;", [newUID, groupName, dateCreated]);
  };

  // Adds USER with uid to GROUP with gid
  this.groupAddMember = (uid, gid) => {
    // Check if user is already in group or not
    // if user not in group, then add to group
    this.checkGroupMembership(uid, gid).then(res => {
      if (res) {
        console.log('Adding user into group');
        this.client.query("INSERT INTO \"GROUP_MEMBERSHIP\" \n \
        VALUES ($1, $2)\;", [gid, uid]);
      } else {
        console.log('User already in group');
      }
    });
  };

  // A PROMISE that returns true if USER with uid is NOT in group with GID
  this.checkGroupMembership = (uid, gid) => {
    return this.client.query("SELECT * FROM \"GROUP_MEMBERSHIP\" \n \
      WHERE UID = $1 \n \
      AND GID = $2\;", [uid, gid]).then(result => result.rowCount === 0);
  };

  // Creates a new transaction
  this.newTX = (to, from, howMuch, currency, description, groupID) => {
    var newUID = uuid(); 
    var dateCreated = new Date().toISOString().slice(0, 19).replace('T', ' ');
    this.client.query("INSERT INTO \"TRANSACTION\" \n \
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)\;", [newUID, to, from, currency, howMuch, dateCreated, description, 0, groupID]);
  };


  // Gets user by email, returns a PROMISE
  // NOT SAFE, can return 0 rows if email not in db
  this.getUserByEmail = (email) => {
    return this.client.query("SELECT * FROM \"USER\" \n \
      WHERE EMAIL = $1 \;", [email]);
  }

  

};

module.exports = {
  Database : database
};

var db = new database();
//db.newUser("Iulia", "Ivana", "imi17@gmail.com");
// db.newGroup("Peng you men");
//db.groupAddMember("33807240-5dc0-11e8-b06f-c346f6c59a8a", "e3ccbd70-5dc0-11e8-a74e-176fbf353fa6");
//db.checkGroupMembership("33807240-5dc0-11e8-b06f-c346f6c59a8a", "e3ccbd70-5dc0-11e8-a74e-176fbf353fa6").then(res => console.log(res));

// db.newTX("15d1dfe0-5dc0-11e8-bf39-c14e2075b722", "5ca7db60-5dd2-11e8-9144-9bb5fcee806a", 20, 0, "test tx", null);

db.getUserByEmail('jackel119@gmail.com').then(res => console.log(res));
