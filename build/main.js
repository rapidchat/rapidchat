angular.module('rapidchat', ['btford.socket-io', 'ngStorage', 'ngSanitize'])
.run(["$localStorage", "$rootScope", "User", function($localStorage, $rootScope, User) {

  openpgp.initWorker('./build/openpgp.worker.js')
}])
.factory('db', function db() {
  var db = new Dexie('Rapidchat')

  db.version(1).stores({
    users: '++id,uid,userId,keyId',
    messages: '++id,from,message,time,channel'
  })

  // db.delete().then(function() {
  //   console.log('tdb del');
  // }).catch(function() {
  //   console.log(arguments); 
  // })

  db.open()

  db.on('blocked', function () {
      console.error("Db blocked!")  
      debugger; // Make sure you get notified if database is blocked!
      // In production code, you may notify user via GUI to shut down 
      // other tabs or browsers that may keep the database blocked.
      // But better is to make sure that situation never occur
      // (by always closing a db before leaving the local db var 
      //  to garbage collection)
  })

  return db;
})
.factory('Socket', ["socketFactory", "$window", function Socket(socketFactory, $window) {
  var sock = io.connect($window.location.pathname.substr(1))
  return socketFactory({prefix: '', ioSocket: sock})
}])
.service('Keyring', function Keyring() {
  var Keyring = new openpgp.Keyring() 

  Keyring.addPublicKey = function addPublicKey(key) {
    var keyId = key.primaryKey.getKeyId().toHex()

    var exists = this.getKeysForId(keyId);

    if(!exists) {
      this.publicKeys.push(key) 
      this.store();
    } else {
      console.log('Key was in the ring'); 
    }
  
  }

  return Keyring
})

angular.module('rapidchat')
.factory('Channel', ["$localStorage", "Socket", "Message", "db", "$timeout", "$log", function channelFactory($localStorage, Socket, Message, db, $timeout, $log) {
  
  function Channel(user, $scope) {
    this.channel = null
    this.user = user 
    this.users = []
    this.messages = []
    this.$scope = $scope

    return this
  }

  /**
   * Join channel
   * @param string channel the channel to join
   * @return this
   */
  Channel.prototype.join = function join(channel) {

    var self = this

    this.channel = channel

    $localStorage.channel = channel

    this.loadMessages()
    .then(function() {
      Socket.emit('join', {
        channel: channel,
        uid: self.user.uid,
        publicKey: self.user.publicKey.armor()
      })
    })
    
    return this
  }

  /**
   * Load channel messages from db
   * @return void
   */
  Channel.prototype.loadMessages = function loadMessages() {
    var self = this

    this.messages = []

    return db.messages.where('channel').equals(this.channel)
    .each(function(message) {
      if(message) {
        self.addMessage(message)
      }
    })
    .then(function() {
      return Promise.resolve()
    })
    .catch(function(error) {
      $log.error("Error while loading messages", error)
      return Promise.reject(error)
    })
  }

  Channel.prototype.scrollToBottom = function scrollToBottom() {
    var el = document.getElementById('messages-container') 

    el.scrollTop = el.scrollHeight
  }

  Channel.prototype.clearMessages = function clearMessages() {
    var self = this

    db.messages.where('channel').equals(this.channel).delete()
    .then(function(num) {
      self.messages = []
      self.reset()
    })
    .catch(function() {
      $log.error("Error while deleting messages")
    })
  }

  /**
   * Digest scope and scroll
   * @return void
   */
  Channel.prototype.reset = function reset() {
    var self = this
    //sometimes events aren't populated, crypting a message with GPG is taking long enough
    //so that digests has been done with nothing in the messages, errors on the other way
    //are beein applied fast
    $timeout(function() {
      if (self.$scope.$root.$$phase != '$apply' && self.$scope.$root.$$phase != '$digest') {
          self.$scope.$apply();
      }

      self.scrollToBottom()
    })

  }

  /**
   * Add message to channel
   * @param Message msg
   * @return this
   */
  Channel.prototype.addMessage = function(msg) {

    var self = this

    this.messages.push({
      from: msg.from,
      time: msg.time,
      message: msg.message 
    })

    this.reset()

    return this
  }

  /**
   * Return current channel
   * @return string
   */
  Channel.prototype.current = function current() {
    return this.channel
  }

  /**
   * Update users in the channel
   * @param array users
   * @return this
   */
  Channel.prototype.people = function people(users) {
    this.users = users 
    return this
  }

  /**
   * Return current channel users
   * @return array
   */
  Channel.prototype.online = function online() {
    return this.users 
  }

  return Channel
}])


// GPG4Browsers - An OpenPGP implementation in javascript
// Copyright (C) 2011 Recurity Labs GmbH
// 
// This library is free software; you can redistribute it and/or
// modify it under the terms of the GNU Lesser General Public
// License as published by the Free Software Foundation; either
// version 3.0 of the License, or (at your option) any later version.
// 
// This library is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// Lesser General Public License for more details.
// 
// You should have received a copy of the GNU Lesser General Public
// License along with this library; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA

/**
 * The class that deals with storage of the keyring. Currently the only option is to use HTML5 local storage.
 * @requires config
 * @module keyring/localstore
 * @param {String} prefix prefix for itemnames in localstore
 */
// module.exports = LocalStore;
//
// var config = require('../config'),
//   keyModule = require('../key.js'),
//   util = require('../util.js');
//
// function LocalStore(prefix) {
//   prefix = prefix || 'openpgp-';
//   this.publicKeysItem = prefix + this.publicKeysItem;
//   this.privateKeysItem = prefix + this.privateKeysItem;
//   if (typeof window != 'undefined' && window.localStorage) {
//     this.storage = window.localStorage;
//   } else {
//     this.storage = new (require('node-localstorage').LocalStorage)(config.node_store);
//   }
// }
//
// /*
//  * Declare the localstore itemnames
//  */
// LocalStore.prototype.publicKeysItem = 'public-keys';
// LocalStore.prototype.privateKeysItem = 'private-keys';
//
// /**
//  * Load the public keys from HTML5 local storage.
//  * @return {Array<module:key~Key>} array of keys retrieved from localstore
//  */
// LocalStore.prototype.loadPublic = function () {
//   return loadKeys(this.storage, this.publicKeysItem);
// };
//
// /**
//  * Load the private keys from HTML5 local storage.
//  * @return {Array<module:key~Key>} array of keys retrieved from localstore
//  */
// LocalStore.prototype.loadPrivate = function () {
//   return loadKeys(this.storage, this.privateKeysItem);
// };
//
// function loadKeys(storage, itemname) {
//   var armoredKeys = JSON.parse(storage.getItem(itemname));
//   var keys = [];
//   if (armoredKeys !== null && armoredKeys.length !== 0) {
//     var key;
//     for (var i = 0; i < armoredKeys.length; i++) {
//       key = keyModule.readArmored(armoredKeys[i]);
//       if (!key.err) {
//         keys.push(key.keys[0]);
//       } else {
//         util.print_debug("Error reading armored key from keyring index: " + i);
//       }
//     }
//   }
//   return keys;
// }
//
// /**
//  * Saves the current state of the public keys to HTML5 local storage.
//  * The key array gets stringified using JSON
//  * @param {Array<module:key~Key>} keys array of keys to save in localstore
//  */
// LocalStore.prototype.storePublic = function (keys) {
//   storeKeys(this.storage, this.publicKeysItem, keys);
// };
//
// /**
//  * Saves the current state of the private keys to HTML5 local storage.
//  * The key array gets stringified using JSON
//  * @param {Array<module:key~Key>} keys array of keys to save in localstore
//  */
// LocalStore.prototype.storePrivate = function (keys) {
//   storeKeys(this.storage, this.privateKeysItem, keys);
// };
//
// function storeKeys(storage, itemname, keys) {
//   var armoredKeys = [];
//   for (var i = 0; i < keys.length; i++) {
//     armoredKeys.push(keys[i].armor());
//   }
//   storage.setItem(itemname, JSON.stringify(armoredKeys));
// }

angular.module('rapidchat')
.controller('MainCtrl', ["$scope", "User", "Socket", "$localStorage", "$log", "Keyring", "Message", "Channel", "$rootScope", function mainController($scope, User, Socket, $localStorage, $log, Keyring, Message, Channel, $rootScope) {

  var textbox = document.getElementById('textbox');
  $scope.messages = []
  $scope.channel = {}

  //user exists in localStorage log in automagically
  if($localStorage.userId) {
    User.login($localStorage.userId).then(function(user) {
      $scope.user = user 
      $scope.channel = new Channel(user, $scope)

      $log.debug('User logged in', $scope.user);

      //If we saved a channel too, join it
      if($localStorage.channel) {
        $scope.channel.join($localStorage.channel)
      }

    })
  }

  $scope.theme = $localStorage.theme ? $localStorage.theme : 'tomorrow'
  $scope.white = $localStorage.white ? $localStorage.white : false
  $scope.oldTheme = $scope.theme
  
  $scope.changeTheme = function () {

    var newTheme = document.getElementById('theme-'+$scope.theme)
    var oldTheme = document.getElementById('theme-'+$scope.oldTheme)

    if(oldTheme)
      oldTheme.disabled = true
    
    if(newTheme) 
      newTheme.disabled = false

    $scope.oldTheme = $scope.theme
    $localStorage.theme = $scope.theme
  }
  
  //init theme
  var t = document.getElementById('theme-'+$scope.theme)

  if(t)
    t.disabled = false

  $scope.blackOrWhite = function() {

    var corresp = [
      { 'white': 'base07-background', 'black': 'base00-background' },
      { 'white': 'base02', 'black': 'base05' },
    ]

    var blackOrWhite = $scope.white == true ? 'white' : 'black'
    var notBlackOrWhite = $scope.white == true ? 'black' : 'white'

    var b = document.getElementsByTagName('body')[0]

    for(var i in corresp) {
      b.classList.add(corresp[i][blackOrWhite])
      b.classList.remove(corresp[i][notBlackOrWhite])
    }

    $localStorage.white = $scope.white
  }

  $scope.blackOrWhite()
  /**
   * Manual login function
   */
  $scope.login = function(user) {
    User.login(user.userId).then(function(user) {
      $scope.user = user
      $scope.channel = new Channel(user, $scope)
    })
  }

  /**
   * Manual channel join function
   */
  $scope.join = function(channel) {
    if(!$scope.user) {
      throw new Error("User does not exist")
    }

    $scope.channel.join(channel)
  }

  /**
   * Join/leave channel events
   */
  Socket.on('joined', function(users) {
    $scope.channel.people(users)
  })

  Socket.on('left', function(item) {
    $scope.channel.people(item.users)
  })

  textbox.onkeypress = function(e) {
    if(e.keyCode == 13 && !e.shiftKey) {
      $scope.message(e.currentTarget.value)
    } 
  }

  /**
   * Sends a message
   */
  $scope.message = function(msg) {
    if(!msg || !msg.length) {
      return; 
    }

    var m = new Message(msg, $scope.channel)  
    if(m) { m.encode() }
  }

  /**
   * Received a message
   */
  Socket.on('message', function(from, pgpMessage, time) {
    var m = new Message(pgpMessage, $scope.channel, time, from)
    m.decode()
  })

  /**
   * Public key Exchange
   * ping: user received a key request, he sends pong back
   * pong: user received the ping response
   */
  Socket.on('exchange ping', function(sid, armor) {
    var key = openpgp.key.readArmored(armor).keys[0]
    Keyring.addPublicKey(key)
    Socket.emit('exchange pong', sid, $scope.user.publicKey.armor())
  })

  Socket.on('exchange pong', function(armor) {
    var key = openpgp.key.readArmored(armor).keys[0]
    Keyring.addPublicKey(key)
  })

  $scope.userClick = function(user) {

    if(textbox) {
      textbox.value = textbox.value + user
    }
  }

  $scope.logout = function() {
    delete $localStorage.userId;
  }

}])

.directive('userlist', function userList() {

  return {
    restrict: 'E', 
    scope: {
      users: '='
    },
    templateUrl: 'html/user-list.html',
    link: function linkUserlist(scope, element, attrs, controller) {
      scope.userClick = scope.$parent.userClick;
    }
  }
})
.filter('prettyUser', ["$sce", function($sce) {

  return function(user, me) {
    var u = user.split('-')
    var color = "base0B"

    if(user == me) {
      color = "base0E"
    }

    return $sce.trustAsHtml('<span class="'+color+'" ng-click="userClick('+user+')">'+u[0]+': </span>')
  }
}])

angular.module('rapidchat')
.factory('Message', ["$log", "Socket", "Keyring", "db", "Smileys", function messageFactory($log, Socket, Keyring, db, Smileys) {

  /**
   * @module Message
   * Stores and process message 
   * @param string msg 
   * @param Channel the current channel
   * @param Date time the posted time or current time
   * @param string from the user sending, or current user if empty
   */
  function Message(msg, channel, time, from) {

    this.commands = ['msg', 'roll']
    this.channel = channel
    this.time = time || Date.now()

    var err = this.preprocessor(msg, from);

    if(err instanceof Error) {
      this.print(err)
      return false
    }

    return this 
  }

  /**
   * Pre-process messages to search for commands
   * ie /msg to message
   * @param string msg the original text
   * @param string from the sender, if none assume current user
   * @return this
   */
  Message.prototype.preprocessor = function preProcessor(msg, from) {
  
    if(from) {
      this.message = msg 
      this.from = from
      return this
    }

    if(msg.substr(0, 1) == '/') {
      msg = msg.split(' ')

      var cmd = msg.splice(0, 2)
      this.argument = cmd[1]
      this.command = cmd[0].substr(1)

      this.message = msg.join(' ')
      
      if(this.commands.indexOf(this.command) === -1) {
        return new Error(this.command + " is not a command")
      }
    } else {
      this.message = msg
    }

    //current user
    this.from = this.channel.user.uid

    return this
  }

  /**
   * Encode, save and print a message
   * @return void
   */
  Message.prototype.encode = function encode() {
    var self = this;

    var to = null

    // /msg to, test if to is an existing user
    if(this.command == 'msg') {
      to = this.channel.users[this.argument]
      if(!to) {
        this.print(new Error("User "+this.argument+" does not exist"))
        return false
      }

      this.message = '(*Whispers to '+this.argument+'*) ' + this.message;
    } else if(this.command == 'roll') {
      var num 

      if(this.argument == 'hack') {
        num = 6 
      } else {
        //@todo 1d1, 4d2 etc.
        var max = 6, min = 1
        num = Math.floor(Math.random() * (max - min + 1) + min) 
      }

      this.message = '(*Roll 1d6*) ' + num;
    }

    openpgp.encryptMessage(Keyring.publicKeys.keys, this.message)
    .then(function(pgpMessage) {
      //emit message from, pgpmessage, time, to
      Socket.emit('message', self.channel.user.userId, pgpMessage, self.time, to)
      self.print()
      self.save()
    })
    .catch(function(error) {
      $log.error('Error while encoding message', err); 
    })

    return this
  }

  /**
   * Decode, save and print the decoded message
   * @return void
   */
  Message.prototype.decode = function decode() {
    var self = this
    var privateKey = Keyring.privateKeys.getForId(this.channel.user.keyId)
    var pgpMessage = openpgp.message.readArmored(this.message)

    openpgp.decryptMessage(privateKey, pgpMessage).then(function(plaintext) {
      self.message = plaintext
      self.print()
      self.save()
      // console.log("received msg: " + plaintext)
    }).catch(function(error) {
      $log.error('Error while decoding message', err); 
    })
  }

  /**
   * Save message to indexDB
   * @return void
   */
  Message.prototype.save = function save() {
    db.messages.add({
      from: this.from,
      message: this.message,
      time: this.time,
      channel: this.channel.current()
    }).then(function() {
      // $log.info('Saved user message')
    })
    .catch(function(error) {
      $log.error('Error while saving message', err) 
    })
  }

  /**
   * Format message
   * @param mixed msg
   * @todo markdown
   * @return string
   */
  Message.prototype.format = function format(msg) {
    
    msg = marked(msg)

    if(msg instanceof Error) {
      msg = "<span class='base08'>"+msg.message+"</span>"
    }

    for(var i in Smileys) {
      msg = msg.replace(i, '<img src="'+Smileys[i]+'">') 
    }

    return msg
  }

  /**
   * Print message
   * @param mixed msg If msg is not provided, this.message will be used, msg can be
   * an Error instance
   * @return this
   */
  Message.prototype.print = function print(msg) {

    if(!msg) {
      msg = this.message 
    } 

    this.message = this.format(msg)

    this.channel.addMessage(this)

    var textbox = document.getElementById('textbox')
    textbox.value = ''

    return this
  }

  return Message
}])

angular.module('rapidchat')
.factory('Smileys', function() {

  var smileys = {
    ":)": "smileys/smile.png",
    "=)": "smileys/smile.png",
    ":|": "smileys/neutral.png",
    "=|": "smileys/neutral.png",
    ":(": "smileys/sad.png",
    "=(": "smileys/sad.png",
    ":D": "smileys/big_smile.png",
    "=D": "smileys/big_smile.png",
    ":O": "smileys/yikes.png",
    ";)": "smileys/wink.png",
    ":-/": "smileys/hmm.png",
    ":P": "smileys/tongue.png",
    ":p": "smileys/tongue.png",
    ":lol:": "smileys/lol.png",
    ":mad:": "smileys/mad.png",
    ":rolleyes:": "smileys/roll.png",
    ":cool:": "smileys/cool.png",
    ":noel:": "smileys/noel.gif",
    ":fuck:": "smileys/fuck.png",
    ":siffle:": "smileys/siffle.gif",
    ":cry:": "smileys/pleure.gif",
    ":blink:": "smileys/blink.gif",
    ":unsure:": "smileys/unsure.gif",
    ":ange:": "smileys/ange.gif",
    ":mdr:": "smileys/mdr.gif",
    ":bisous:": "smileys/bisous.gif",
    ":taper:": "smileys/taper.gif",
    ":canon:": "smileys/canon.gif",
    ":fouet:": "smileys/fouet.gif",
    ":huh:": "smileys/huh.gif",
    ":mrgreen:": "smileys/mrgreen.gif",
    ":oui:": "smileys/oui.gif",
    ":non:": "smileys/non.gif",
    ":ok:": "smileys/ok.gif",
    ":reflechi:": "smileys/reflechi.gif",
    ":demon:": "smileys/demon.gif",
    ":hap:": "smileys/hap.gif"
  }

  return smileys
})

angular.module('rapidchat')
.factory('User', ["db", "Keyring", "$localStorage", "$q", "$log", function User(db, Keyring, $localStorage, $q, $log) {

  /**
   * Populates user public key
   * @param object user must have keys
   * @throws TypeError if user has no keys
   * @return object 
   */
  function getUserPublicKey(user) {

    if(!user.keys) {
      throw new TypeError("Keys are required")
    }

    for(var i in user.keys) {
      //from opengpg api
      if(user.keys[i].isPublic()) {
        user.publicKey = user.keys[i]
      }
    }

    return user
  }

  /**
   * User Factory
   */
  var userFactory = {
    /**
     * Creates a user
     * @param string userId the user id usually username
     * @todo passphrase?
     * @return $q
     */
    create: function(userId) {

      var defer = $q.defer()

      //generate keys
      return openpgp.generateKeyPair({
        numBits: 1024, 
        userId: userId, 
        passphrase: ''
      })
      .catch(function(error) {
        $log.error("Error while generating key pair", error)
        defer.reject(error)
      })
      .then(function(keys) {
        var keyId = keys.key.primaryKey.getKeyId().toHex()
        Keyring.privateKeys.push(keys.key)
        Keyring.publicKeys.push(keys.key.toPublic())
        //stores in localstorage
        //@todo dbize LocalStore (see opengpg)
        Keyring.store()

        var user = {
          userId: userId, 
          keyId: keyId, 
          uid: userId + '-' + keyId, 
          keys: keys
        }

        //add user to database
        return db.users.add(user)
      })
      .catch(function(error) {
        $log.error("Error while creating user", error)
        defer.reject(error)
      })
      .then(function(user) {
          getUserPublicKey(user)
          $localStorage.userId = userId
          defer.resolve(user)
      })

    },
    /**
     * Login user and set keys
     * @param string userId
     */
    login: function login(userId) {
      var defer = $q.defer()
      var self = this

      db.users.where('userId').equals(userId).first()
      .then(function(user) {

        if(!user) {
          //no user create it
          self.create(userId)
          .then(defer.resolve)

        } else {

          var keys = Keyring.getKeysForId(user.keyId)
          user.keys = keys
          getUserPublicKey(user)

          //use session id instead?
          if(!$localStorage.userId) {
            $localStorage.userId = userId 
          }

          defer.resolve(user)
        }
      })
      .catch(function(error) {
        $log.error("Error while getting user for userId", userId, error)
        defer.reject(error) 
      })

      return defer.promise
    },
    //@todo implement user deletion, keys etc.
    logout: function logout(userId) {
      // return db.users.where('userId').equals().delete()
    }

  }

  return userFactory

}])
