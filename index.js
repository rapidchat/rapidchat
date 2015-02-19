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

var server = app.listen(3123, function() {
  debug('Listening on ' + 3123)
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


function handleError(prefix) {
  return function print(error) {
    console.error(prefix + error.name)
    console.error(error.message)
    console.error(error.stack) 
  }
}

var leaveChannel = function leaveChannel(socket) {
  socket.leave(socket.channel)

  debug('User %s left channel %s', socket.uid, socket.channel)

  return ssdb_client.hdel(socket.channel, socket.uid).then(function() {
    return updateUsers(socket.channel)
  }).then(function(users) {
    debug('user left emit users %j', users)
    io.to(socket.channel).emit('left', {
      users: users
    })

    return new Promise.resolve()
  })
  .catch(handleError('leaveChannel'))
}

var joinChannel = function joinChannel(user, socket) {

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
    .catch(handleError('join'))
}

io.on('connection', function(socket) {

  socket.on('join', function(user) {

    if(!user.channel || !user.uid)
      return;

    if(socket.channel && socket.channel !== user.channel) {
      return leaveChannel(socket).then(function() {
        return joinChannel(user, socket)         
      })
    } else {
      return joinChannel(user, socket) 
    }
  })

  socket.on('exchange pong', function(to, key) {
    debug("Exchange pong from ", socket.id, "to =>", to)
    socket.broadcast.to(to).emit('exchange pong', key)
  })

  socket.on('message', function(from, pgpMessage, time, to) {
    socket.broadcast.to(to ? to : socket.channel).emit('message', from, pgpMessage, time)
  })

  socket.on('disconnect', function() {
    leaveChannel(socket)
  })
})

process.on('uncaughtException', function (err) {
    if(!err instanceof Error)
      err = new Error(err)

    console.error(err.name + ' - ' + err.message)
    console.error(err.stack)
    process.exit(1)
}) 
