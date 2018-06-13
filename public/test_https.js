var io = require('socket.io-client');
var socket = io.connect("https://www.jackpordi.com:443", {secure:true, reconnect:true, rejectUnauthorized: false});

// Only do stuff after the socket successfully connects
socket.on('connect', () => {
  //After the socket is connected, do the following:
  // #1
  console.log('made connection! Now asking to authenticate');
  result = {};

  // #2 Request to authenticate with the backend by sending username/password
  socket.emit('authentication', {
    username: '1@test.com',
    password: 'david'
  });

  // #3 Server responds back with an 'authResult' event
  socket.on('authResult', res => {
    // console.log(res);
    // We have authenticated, so therefore ask for transactions
    console.log('Authentication Success!');
    console.log('Requesting Transactions now!');
    socket.emit('requestTXs2');
  });

  // #4 When we receive transactions, print them
  socket.on('allTransactions', res => {
    console.log('Received Transactions!');
    result.txs = res;
    var list = [];
    for (var tx of res) {
      // console.log(tx);
      list.push(tx.to_user);
    }
    // console.log(list);
    console.log('Now getting users of groups!');
    socket.emit('getUsersByUID2', list);
  });

  socket.on('users', res => {
    console.log(res);
    result.userMap = res;
    // console.log(result);
    socket.emit('getGroups');
  });

  socket.on('groupUsers', res => {
    // console.log(res);
  });

  // If, for any reason, the server tells us we are unauthenticated,
  // then login again
  socket.on('unauthenticatedRequest', () => {
    // Handle it, maybe login again
  });
});

