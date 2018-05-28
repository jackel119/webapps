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

const db = new pg.Database('webapp-testing');

var server = app.listen(2605, () => {
  console.log("Listening to requests on port 2605");
});

app.use(express.static('public'));

// Set passport to use FacebookStrategy
passport.use(
  new FacebookStrategy({
    clientID: config.facebook_api_key,
    clientSecret: config.facebook_api_secret,
    callbackURL: 'http://localhost:2605/auth/facebook/callback',
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

var io = socket(server);

io.on('connection', (socket) => {
  console.log('Made socket connection with socket:', socket.id);

  socket.on('query', (query) => {
    console.log("Data UID:", query.uid);
    db.client.query("SELECT * FROM \"USER\" WHERE UID = $1\;", [query.uid], (err, res) => {
      console.log(res);
      socket.emit('message', {
        message: res.rows[0].first_name
      });
    });
  });

  socket.on('test-packet', (data) => {
    console.log(data.message);
  });

});

