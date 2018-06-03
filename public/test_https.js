var io = require('socket.io-client');
var socket = io.connect("https://www.jackpordi.com:443", {secure:true, reconnect:true, rejectUnauthorized: false});

// Only do stuff after the socket successfully connects
socket.on('connect', () => {
  //After the socket is connected, do the following:
  // #1
  console.log('made connection! Now asking to authenticate');

  // #2 Request to authenticate with the backend by sending username/password
  socket.emit('authentication', {
    username: 'jackel119@gmail.com',
    password: 'david'
  });

  // #3 Server responds back with an 'authResult' event
  socket.on('authResult', res => {
    console.log(res);
    // We have authenticated, so therefore ask for transactions
    socket.emit('requestTXs');
  });

  // #4 When we receive transactions, print them
  socket.on('allTransactions', res => {
    console.log(res);
  });

  // If, for any reason, the server tells us we are unauthenticated,
  // then login again
  socket.on('unauthenticatedRequest', () => {
    socket.emit('authentication', {
      username: 'jackel119@gmail.com',
      password: 'david'
    });
  });
});

