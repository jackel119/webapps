var socket = io.connect("http://localhost:2605");

var gid = document.getElementById('gid');
    button = document.getElementById('request');


button.addEventListener('click', function() {
  socket.emit("query", {
    uid: gid.value,
  });
});

socket.on('message', (data) => {
  gid.value = data.message;
});
