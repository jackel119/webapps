var io = require('socket.io-client');
var socket = io.connect("https://www.jackpordi.com:443", {secure:true, reconnect:true, rejectUnauthorized: false});

socket.on('connect', () => {
  console.log('made connection!');

  socket.emit('authentication', {
    username: 'jackel119@gmail.com',
    password: 'david'
  });

  socket.on('authResult', res => {
    console.log(res);
    socket.emit('requestTXs');
  });

  socket.on('allTransactions', res => {
    console.log(res);
  });
});

