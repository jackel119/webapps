var fs                =  require('fs');
var express           =  require('express');
var socket            =  require('socket.io');
var passport          =  require('passport');
var util              =  require('util');
var FacebookStrategy  =  require('passport-facebook').Strategy;
var session           =  require('express-session');
var cookieParser      =  require('cookie-parser');
var bodyParser        =  require('body-parser');
var config            =  require('./config/config');
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
// authorizedClients[socket.id] = uid
var authorizedClients = {};

// Map of users to sockets
// uuid -> Sets of Socket IDs
var userToSockets = {};

// Users that need to be informed of new transactions
// uuid -> {event, data};
var usersToBeInformed = {};

io.on('connection', (socket) => {

  var current_user = () => {
    return authorizedClients[socket.id];
  };
  console.log('Made socket connection with socket:', socket.id);

  socket.on('disconnect', (reason) => {
    console.log('Socket', socket.id, 'has disconnected');
    if (authorizedClients[socket.id] != undefined) {
      userToSockets[current_user()].delete(socket.id);
      delete authorizedClients[socket.id];
    }
  });

  // Informs User of a certain event
  // If user is not active, then 'remmebers' such so that user is informed
  // after next login
  var informUser = (uuid, event, data) => {
    console.log('User', uuid, 'needs to be informed, checking status');
    var socketIDs = userToSockets[uuid];
    if (socketIDs != undefined) { // User is connected
      console.log('User', uuid, 'is connected to sockets', socketIDs);
      // If user is connected, notify them
      for (var sid of socketIDs) {
        console.log('Emitting data to socket ', sid);
        io.to(sid).emit(event, data);
      }
    } else {
      console.log('User', uuid, 'is not connected to any sockets');
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
    if (usersToBeInformed[current_user()] != undefined) {
      for (var events of usersToBeInformed[current_user()]) {
        socket.emit(events.event, events.data);
      }
      delete usersToBeInformed[current_user()];
    }
  };

  // Basic username-password Authentication
  socket.on('authentication', (credentials) => {
    console.log(socket.id, 'has authenticated as', credentials.username);
    db.verifyLogin(credentials.username, credentials.password).then( res => {
        // Emit result of authentication, either true with uid, or false
        socket.emit('authResult', res);
        if (res.result) {
          // If true, add socket to authorized list
          authorizedClients[socket.id] = res.data.uid;
          // Add to user to sockets map
          if (userToSockets[res.data.uid] == undefined) {
            userToSockets[res.data.uid] = new Set().add(socket.id);
          } else {
            userToSockets[res.data.uid].add(socket.id);
          }
          catchUpUser();
        }
    });
  });

  // Sends transactions to users, of the form
  // { to: [transactions to that user] , from: [transactions from]}
  socket.on('requestTXs', () => {
    var uid = authorizedClients[socket.id];
    if (uid != undefined) { // Check user is authenticated
      console.log('User', uid, 'has asked for all transactions, sending');
      db.txsWith(uid)
        .then(res => socket.emit('allTransactions', res.rows));
    } else {
      // If unauthenticated, then tell the client so
      console.log('Unauthenticated request from user', uid);
      socket.emit('unauthenticatedRequest');
    }
  });

  // Client wants user details (names), gives UIDs as a list.
  // We want to return a map (JS Object) of those UIDs to users.
  socket.on('getUsersByUID', uidList => {
    var uid = authorizedClients[socket.id];
    if (uid != undefined) { // Check use is authenticated
      db.getUsersByUID(uidList).then( res => {
        socket.emit('users', res);
      });
    } else {
      // If unauthenticated, then tell the client so
      socket.emit('unauthenticatedRequest');
    }
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
  socket.on('createTX', transaction => {
    console.log("Receiving new transaction from", socket.id);
    console.log(transaction);
    var uid = authorizedClients[socket.id];
    if (uid != undefined) {
      if (transaction.to == uid || transaction.from == uid) {
        // Socket user is indeed sender/receiver of transaction
        db.newTX(transaction.to, transaction.from, transaction.amount,
          transaction.currency, transaction.text, transaction.groupID)
          .then(transaction => {
              // Emit new transactions to both users
              informUser(transaction.to,   'newTransaction', transaction);
              informUser(transaction.from, 'newTransaction', transaction);
          })
          .then(res => socket.emit(res)); // Emit new TXID
      } else {
        // Socket user is NOT sender/receiver of transaction
        socket.emit('invalidCreation', {
          message: 'You can only create transactions to and from yourself!'
        });
      }
    } else {
      // If unauthenticated, then tell the client so
      socket.emit('unauthenticatedRequest');
    }
  });

  // Get groups for a user
  socket.on('getGroups', () => {
   db.belongsToGroups(current_user())
      .then(res => {
        socket.emit('groups', res);
      });
  });

  // Test events, TODO: Remove later
  socket.on('test-packet', (data) => {
    console.log(data.message);
  });

  socket.on('hello-message', (data) => {
    console.log(data.message);
  });

});

//-------------------------------------
//--------AUTHENTICATION STUFF---------
//-------------------------------------

// Set passport to use FacebookStrategy
passport.use(
  new FacebookStrategy({
    clientID: config.facebook_api_key,
    clientSecret: config.facebook_api_secret,
    callbackURL: 'http://www.jackpordi.co.uk:2605/auth/facebook/callback',
    profileFields: ['id', 'emails', 'name']
  },
  (accessToken, refreshToken, profile, done) => {
    console.log(accessToken);
    console.log(profile._json);
    db.fb_login(profile._json);
    done(null, profile);
  }

));

// Use passport
app.use(passport.initialize());

// Direct User to login with facebook
app.get('/login/fb', passport.authenticate('facebook', {scope : ['email']}));

app.get(
  '/auth/facebook/callback',
  passport.authenticate('facebook', { session: false }),
  (req, res) => {
    res.send('AUTH WAS GOOD!');
  }
);
