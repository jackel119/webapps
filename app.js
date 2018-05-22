var express           =  require('express');
var socket            =  require('socket.io');
var passport          =  require('passport');
var util              =  require('util');
var FacebookStrategy  =  require('passport-facebook').Strategy;
var session           =  require('express-session');
var cookieParser      =  require('cookie-parser');
var bodyParser        =  require('body-parser');
var config            =  require('./config/config');
var app               =  express();
var pg                =  require('./database');

const db = new pg.Database();
console.log(db.name);

var server = app.listen(2605, () => {
  console.log("Listening to requests on port 2605");
});

app.use(express.static('public'));

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
