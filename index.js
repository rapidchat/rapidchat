var http = require('http')
var https = require('https')
var express = require('express');
var app = express();
var ssdb = require('ssdb')
var crypto = require('crypto')
var debug = require('debug')('rapidchat')

//replace native promise
global.Promise = require('bluebird').Promise

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html')
})

app.use(express.static(__dirname))

var server = http.createServer(app).listen(3123)

//@todod
// https.createServer({
//   key: fs.readFileSync('./ssl/server.key'),
//   cert: fs.readFileSync('./ssl/server.crt')
// }, app).listen(3124)

//@todo clusterize
var pool = ssdb.createPool({promisify: true})
//@todo kick users + ip from channel
var ssdb_client = pool.acquire()
var io = require('socket.io')(server)

function handleError(prefix) {
  return function print(error) {
    console.error(prefix + error.name)
    console.error(error.message)
    console.error(error.stack) 
  }
}

/**
 * Called when user leaves a channel
 * @emit left to channel with users
 * @param object socket
 * @return Promise
 */
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

/**
 * Get users for a chan
 * @param string channel
 * @return Promise
 */
var updateUsers = function updateUsers(channel) {
    return ssdb_client.hgetall(channel)
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
    .catch(handleError('updateUsers'))
}

/**
 * Called when user joins channel
 * @param object user
 * @param object socket
 */
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

      debug("Exchange ping from %s broadcast to %s", socket.id, socket.channel)
      socket.broadcast.to(socket.channel).emit('exchange ping', socket.id, user.publicKey, socket.channel)
    })
    .catch(handleError('join'))
}

// var hasLock = function hasLock(channel) {
//   return hget('lock', channel)
//   .then(function(v) {
//     if(v) {
//       return Promise.resolve(true)  
//     }
//
//     return Promise.resolve(false)
//   })
// }
//
// var lockChannel = function lockChannel(channel, password) {
//   var shasum = crypto.createHash('sha1')
//   shasum.update(password)
//
//   return ssdb_client.hset('lock', channel, password)
// }

io.on('connection', function(socket) {

  socket.on('join', function(user) {

    if(!user.channel || !user.uid)
      return;

    debug('%s wants to join %s', user.uid, user.channel)

    if(socket.channel && socket.channel !== user.channel) {
      //@todo multiple channels ?
      return leaveChannel(socket).then(function() {
        return joinChannel(user, socket)
      })
    } else {
      return joinChannel(user, socket) 
    }
  })

  socket.on('exchange pong', function(to, key, channel) {
    debug("Exchange pong from ", socket.id, "to =>", to, 'on', channel)
    socket.broadcast.to(to).emit('exchange pong', key, channel)
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
