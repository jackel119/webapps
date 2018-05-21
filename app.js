var express           =     require('express');
var socket            =     require('socket.io');
var passport          =     require('passport');
var util              =     require('util');
var FacebookStrategy  =     require('passport-facebook').Strategy;
var session           =     require('express-session');
var cookieParser      =     require('cookie-parser');
var bodyParser        =     require('body-parser');
var config            =     require('./config/config');
var mysql             =     require('mysql');
var app               =     express();

var server = app.listen(2605, () => {
  console.log("Listening to requests on port 2605");
});

app.use(express.static('public'));

var io = socket(server);

io.on('connection', (socket) => {
  console.log('Made socket connection with socket:', socket.id);
});
