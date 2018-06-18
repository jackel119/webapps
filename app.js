var fs                =  require('fs');
var express           =  require('express');
var socket            =  require('socket.io');
var passport          =  require('passport');
var util              =  require('util');
var FacebookStrategy  =  require('passport-facebook').Strategy;
var session           =  require('express-session');
var cookieParser      =  require('cookie-parser');
var bodyParser        =  require('body-parser');
var pg                =  require('./database');
var app               =  express();
var GEX               =  require('greenlock-express');
var https             =  require('https');
var http              =  require('http');

// Database Setup
const db = new pg.Database('webapp-testing');

//-------------------------------------
//--------EXPRESS SERVER---------------
//-------------------------------------

app.enable('trust proxy');
// Enforce HTTPS
app.use(function(req, res, next) {
  if (req.secure){
    return next();
  }
  res.redirect("https://" + req.headers.host + req.url);
});
app.use(express.static('public'));

// HTTP Server Redirect to HTTPS

var httpServer = http.createServer(app).listen(80);

function ensureSecure(req, res, next){
  if(req.secure){
    // OK, continue
    return next();
  }
  // handle port numbers if you need non defaults
  // res.redirect('https://' + req.host + req.url); // express 3.x
  res.redirect('https://' + req.hostname + req.url); // express 4.x
}

// HTTPS Server
var server = https.createServer({
  key : fs.readFileSync('/etc/letsencrypt/live/jackpordi.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/jackpordi.com/fullchain.pem')
}, app).listen(443, () => {
  console.log("Listening to requests on port 443");
});


//-------------------------------------
//--------WEBSOCKET STUFF--------------
//-------------------------------------

var io = socket(server);

// Client sockets that have been authorized 
// authorizedClients[socket.id] = {uid: uid, email: email}
var authorizedClients = {};

// Map of users to sockets, works with BOTH uid and emails
// uuid -> Sets of Socket IDs
// email -> Sets of Socket IDs
var userToSockets = {};

// Users that need to be informed of new transactions
// uuid -> {event, data};
var usersToBeInformed = {};

io.on('connection', (socket) => {


  //----------------------------------------------------------------
  //------------------------SECTION: UTILS--------------------------
  //----------------------------------------------------------------

  // Gets current user in the form {uid: uid, email:email}
  var current_user = () => {
    return authorizedClients[socket.id];
  };

  // Console.log but with timestamp!
  var logEvent = (...args) => {
    console.log(new Date().toLocaleString(), "::", ...args);
  };

  // Wrapper for socket.on that requires the socket
  // to have been authenticated/logged in already
  var authenticatedCall = (ioevent, callback) => {
    socket.on(ioevent, (data) => {
      var uid = current_user();
      // If socket has authenticated as a user, then proceed.
      if (uid != undefined) {
        callback(data);
      } else {
        // If unauthenticated, then deny request
        logEvent('Unauthenticated', ioevent, 'request from user', uid);
        socket.emit('unauthenticatedRequest');
      }
    });
  };

  // Informs User of a certain event
  // If user is not active, then 'remmebers' such so that user is informed
  // after next login
  var informUser = (uuid, event, data) => {
    logEvent('User', uuid, 'needs to be informed, checking status');
    var socketIDs = userToSockets[uuid];
    if (socketIDs != undefined) { // User is connected
      logEvent('User', uuid, 'is connected to sockets', socketIDs);
      // If user is connected, notify them
      for (var sid of socketIDs) {
        logEvent('Emitting data to socket ', sid);
        io.to(sid).emit(event, data);
      }
    } else {
      logEvent('User', uuid, 'is not connected to any sockets');
      var user_bucket = usersToBeInformed[uuid];
      if (user_bucket == undefined) { // User does not have a bucket, create one
        usersToBeInformed[uuid] = new Set().add({event: event, data:data}) ;
      } else { // User has a bucket, just add to it
        usersToBeInformed[uuid].add({event: event, data:data});
      }
    }
  };

  // Catches up a single socket
  // There are still edge cases around a user having multiple clients
  var catchUpUser = () => {
    if (usersToBeInformed[current_user().uid] != undefined) {
      for (var events of usersToBeInformed[current_user().uid]) {
        socket.emit(events.event, events.data);
      }
      delete usersToBeInformed[current_user().uid];
    }

  };

  //----------------------------------------------------------------
  //------------------------SECTION: CONNECTION---------------------
  //----------------------------------------------------------------

  // Disconnect Event, clears up socket/user maps
  socket.on('disconnect', (reason) => {
    logEvent('Socket', socket.id, 'has disconnected');
    if (authorizedClients[socket.id] != undefined) {
      userToSockets[current_user().uid].delete(socket.id);
      userToSockets[current_user().email].delete(socket.id);
      delete authorizedClients[socket.id];
    }
  });


  // Basic username-password Authentication
  socket.on('authentication', (credentials) => {
    logEvent(socket.id, 'has authenticated as', credentials.username);
    db.verifyLogin(credentials.username, credentials.password).then( res => {
        // Emit result of authentication, either true with uid, or false
        socket.emit('authResult', res);
        if (res.result) {
          // If true, add socket to authorized list
          authorizedClients[socket.id] = 
                  {uid: res.data.uid, email: res.data.email};
          // Add to user to sockets map
          if (userToSockets[res.data.uid] == undefined) {
            userToSockets[res.data.uid] = new Set().add(socket.id);
            userToSockets[res.data.email] = new Set().add(socket.id);
          } else {
            userToSockets[res.data.uid].add(socket.id);
            userToSockets[res.data.email].add(socket.id);
          }
          catchUpUser();
        }
    });
  });

  //----------------------------------------------------------------
  //----------------SECTION: TRANSACTIONS (DEPRECATED)--------------
  //--------------------------TODO: REMOVE--------------------------

  // Sends transactions to users, of the form
  // { to: [transactions to that user] , from: [transactions from]}
  authenticatedCall('requestTXs', () => {
    logEvent('User', current_user().email, 'has asked for all transactions, sending');
    db.txsWith(current_user().uid)
      .then(res => socket.emit('allTransactions', res.rows));
  });


  // Creating a new transaction.
  // transaction = {
  //   to : uid,
  //   from: uid,
  //   amount: number,
  //   currency: (0 for GBP),
  //   description: text,
  //   groupID: gid
  // }
  authenticatedCall('createTX', transaction => {
    logEvent("Receiving new transaction from", current_user().email);
    logEvent(transaction);
    if (transaction.to == current_user().uid || transaction.from == current_user().uid) {
      // Socket user is indeed sender/receiver of transaction
      db.newTX(transaction.to, transaction.from, transaction.amount,
        transaction.currency, transaction.description, transaction.groupID)
        .then(transaction => {
          // Emit new transactions to both users
          informUser(transaction.to_user,   'newTransaction', transaction);
          if (transaction.to_user != transaction.from_user) {
            informUser(transaction.from_user, 'newTransaction', transaction);
          }
        })
        .then(res => socket.emit(res)); // Emit new TXID
    } else {
      // Socket user is NOT sender/receiver of transaction
      logEvent('User', current_user().email, 'is not receiver/sender of transaction');
      socket.emit('invalidCreation', {
        message: 'You can only create transactions to and from yourself!'
      });
    }
  });


  //----------------------------------------------------------------
  //------------------------SECTION: BILLS--------------------------
  //----------------------------------------------------------------
  

  // Event for creating new Group Transaction
  // Bill type:
  // {
  //  groupID: null if not a group transaction
  //  users: [user1, user2, etc] list of emails of users involved
  //  description: 'some kind of bill description',
  //  items : [ // optional
  //            {
  //              itemname: 'apple',
  //              price:     1.5,
  //              split: [ 
  //                { 
  //                  user: {
  //                    email:
  //                    first_name:
  //                    last_name:
  //                  },
  //                  splitAmount : value
  //                },
  //                { 
  //                  user: email,
  //                  splitAmount : value
  //                }
  //              ]
  //            },
  //            {
  //              itemname: 'banana',
  //              price:     2,
  //              split: ........
  //            }
  //          ],
  //  split: [
  //           { 
  //             user: email,
  //             splitAmount : value
  //           },
  //           { 
  //             user: email,
  //             splitAmount : value
  //           }
  //         ]
  //  totalprice : 3.5,
  //  currency: 0,
  //  author: email of author,
  //  (potentially?) payee: user1_email,
  //  timestamp: time
  // }
  authenticatedCall('addBill', (bill) => {
    // 1.) Check group/users are valid? TODO
    // 2.) add bill to bill table (DONE)
    logEvent(current_user().email, 'has submitted a new bill: ',
      bill.description);
    db.processBill(bill).then( res => {
      for (userEmail of bill.users) {
        // inform that user
        var ret = ({
          bid: res.bid,
          bill: res.bill
        });
        db.getUIDByEmail(userEmail).then(uid => {
          informUser(uid, 'newBill', ret);
        });
      }
    });
  });

  // Gets all bills
  authenticatedCall('getBills', () => {
    logEvent(current_user().email, 'has requested their bills');
    db.getBills(current_user().uid).then(res => {
      socket.emit('allBills', res);
    });
  });

  // Returns
  // [
  //  {
  //    gid: gid,
  //    groupName: groupName,
  //    members: [
  //      {
  //        first_name: 'Jack',
  //        last_name: 'Pordi',
  //        email:      'jackel119@gmail.com'
  //      },
  //    ]
  //  }
  // ]
  
  //----------------------------------------------------------------
  //------------------------SECTION: FRIENDS AND USERS--------------
  //----------------------------------------------------------------
  
  // Client wants user details (names), gives UIDs as a list.
  // We want to return a map (JS Object) of those UIDs to users.
  authenticatedCall('getUsersByUID', uidList => {
    db.getUsersByUID(uidList).then( res => {
      socket.emit('users', res);
    });
  });

  // Client wants user details (names), gives UIDs as a list.
  // We want to return a map (JS Object) of those UIDs to users.
  authenticatedCall('getUserByUID', uid => {
    db.getUserByUID(uid).then( res => {
      socket.emit('user', res);
    });
  });

  // Get all groups of a current user, as well as their respective members
  authenticatedCall('getGroupsAndUsers', () => {
    db.allGroupsAndUsers(current_user().uid).then(res => {
      socket.emit('allGroupsAndUsers', res);
    })
  });
  
  // Get groups for a user
  authenticatedCall('getGroups', () => {
   db.belongsToGroups(current_user().uid)
      .then(res => {
        logEvent('Sending groups to user', current_user().email);
        socket.emit('groups', res);
      });
  });

  // Get members of a certain group
  authenticatedCall('getMembersOfGroup', (gid) => {
    db.getAllGroupMembers(gid).then( res => {
      socket.emit('groupMembers', ({
        gid: gid,
        members: res
      }));
    });
  });

  // Event for creating new group
  // {
  //  name: 'some name',
  //  members: list of UIDs, can be empty but NOT null
  // }
  authenticatedCall('createNewGroup', (data) => {
    db.newGroup(data.name).then(res => {
      db.groupAddMember(current_user().uid, res.gid).then(res2 => {
        socket.emit('groupCreationSuccess', res);
      });
    });
  });

  // Add a friend
  authenticatedCall('addFriend', (friend_email) => {
    logEvent('User', current_user().email, 'has added', friend_email,
      'as a friend');
    db.addFriend(current_user().uid, friend_email).then( () => {
      // Add friend
      socket.emit('newFriend', friend_email);
      db.getUIDByEmail(friend_email).then(uid => {
        informUser(uid, 'newFriend', current_user().email);
      });
    });
  });

  // Get all friends
  authenticatedCall('getFriends', (friend) => {
    // Return friends FIRST_NAME, LAST_NAME. EMAIL as a list
    db.getFriends(current_user().uid).then(res => {
      socket.emit('friends', res);
    });
  });
  

  //----------------------------------------------------------------
  //------------------------SECTION: USER SETTINGS------------------
  //----------------------------------------------------------------

  authenticatedCall('setPassword', password => {
    db.setPassword(current_user().uid, password).then(pw_hash => {
      socket.emit('setPasswordSuccess', pw_hash);
    })
  });


  //----------------------------------------------------------------
  //------------------------SECTION: MISC---------------------------
  //----------------------------------------------------------------
  
  // Log that a socket has connected
  logEvent('Made socket connection with socket:', socket.id);
});



//-------------------------------------
//--------Authentication stuff---------
//-------------------------------------

// Set passport to use FacebookStrategy
// passport.use(
//   new FacebookStrategy({
//     clientID: config.facebook_api_key,
//     clientSecret: config.facebook_api_secret,
//     callbackURL: 'http://www.jackpordi.co.uk:2605/auth/facebook/callback',
//     profileFields: ['id', 'emails', 'name']
//   },
//   (accessToken, refreshToken, profile, done) => {
//     logEvent(accessToken);
//     console.log(profile._json);
//     db.fb_login(profile._json);
//     done(null, profile);
//   }
// ));
// 
// // Use passport
// app.use(passport.initialize());
// 
// // Direct User to login with facebook
// app.get('/login/fb', passport.authenticate('facebook', {scope : ['email']}));
// 
// app.get(
//   '/auth/facebook/callback',
//   passport.authenticate('facebook', { session: false }),
//   (req, res) => {
//     res.send('AUTH WAS GOOD!');
//   }
// );

//-------------------------------------
//--------------SERVER UTILS-----------
//-------------------------------------

