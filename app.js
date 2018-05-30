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
