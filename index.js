var express = require('express');
var app = express();
var ssdb = require('ssdb')
var debug = require('debug')('rapidchat')

//ssdb promise
global.Promise = require('bluebird').Promise

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html')
})

app.use(express.static(__dirname))

var server = app.listen(3000, function() {
  debug('Listening on ' + 3000)
})

//@todo kick users + ip from channel
var ssdb_client = ssdb.createClient().promisify()
var io = require('socket.io')(server)

function updateUsers(channel) {
    return ssdb_client.hgetall(channel)
    .catch(function(err) {
      console.error("Error hgetall channel", err)
    })
    .then(function(data) {
      //hgetall returns [user.uid, socketid, user.uid, socketid]
      //formating to key=>value
      var len = data.length
      var i = 0
      var users = {}, key

      for (; i < len; i++) {
        if(i == 0 || i%2 == 0) {
          key = data[i]
        } else {
          users[key] = data[i] 
        }
      }

      return Promise.resolve(users)
   })
}

io.on('connection', function(socket) {

  socket.on('join', function(user) {

    debug(user.uid + " joining " + user.channel)

    socket.uid = user.uid
    socket.channel = user.channel

    ssdb_client.hset(socket.channel, socket.uid, socket.id)
    .then(function() {
      return updateUsers(socket.channel)
    })
    .then(function(users) {
      socket.join(socket.channel)

      io.to(socket.channel).emit('joined', users)

      debug("Exchange ping from ", socket.id, "to => ", socket.channel)
      socket.broadcast.to(socket.channel).emit('exchange ping', socket.id, user.publicKey)
    })
  })

  socket.on('exchange pong', function(to, key) {
    debug("Exchange pong from ", socket.id, "to =>", to)
    socket.broadcast.to(to).emit('exchange pong', key)
  })

  socket.on('message', function(from, pgpMessage, time, to) {
    socket.broadcast.to(to ? to : socket.channel).emit('message', from, pgpMessage, time)
  })

  socket.on('disconnect', function() {

    //leave channel, implicit?
    socket.leave(socket.channel)

    ssdb_client.hdel(socket.channel, socket.uid).then(function() {
      return updateUsers(socket.channel)
    }).then(function(users) {
      debug('user left')
      io.to(socket.channel).emit('left', {
        users: users
      })
    })
  })

  socket.emit('chat message', 'Hello you')
})
