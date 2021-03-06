angular.module('rapidchat')
.factory('Message', function messageFactory($log, Socket, Keyring, db, Smileys) {


  /**
   * Escape regex caracters from a string
   * Source:
   * https://github.com/sindresorhus/escape-string-regexp/blob/master/index.js
   */
  var matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g

  var escapeRegexString = function escapeRegexString(str) {
    if (typeof str !== 'string') {
      throw new TypeError('Expected a string')
    }

    return str.replace(matchOperatorsRe,  '\\$&')
  }

  /**
   * @module Message
   * Stores and process message 
   * @param string msg 
   * @param Channel the current channel
   * @param Date time the posted time or current time
   * @param string from the user sending, or current user if empty
   */
  function Message(msg, channel, time, from) {

    this.commands = ['msg', 'roll', 'me', 'credit']
    this.channel = channel
    this.time = time || Date.now()

    var err = this.preprocessor(msg, from)

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
  
    //current user
    this.from = this.channel.user.uid

    if(from) {
      this.message = msg 
      this.from = from
      return this
    }

    msg = msg.trim()

    if(msg.substr(0, 1) == '/') {
      msg = msg.split(' ')

      var cmd = msg.splice(0, 2)
      this.argument = cmd[1]
      this.command = cmd[0].substr(1)

      this.message = msg.join(' ')
      
      if(this.commands.indexOf(this.command) === -1) {
        this.message = this.command + " is not a command, try one of: " + this.commands.join(", ")
        this.command = 'error'
      }
    } else {
      this.message = msg
    }

    return this
  }

  /**
   * Encode, save and print a message
   * @return void
   */
  Message.prototype.encode = function encode() {
    var self = this

    var to = null

    switch (this.command) {
      case 'error':
        this.print(new Error(this.message))
        return Promise.resolve()
        break;
      case 'credit':
        this.message = ""+
        "PGP: [openpgp.js](https://github.com/openpgpjs/openpgpjs) | Theme: [base16](https://github.com/chriskempson/base16-builder) & [knacss](www.knacss.com) <br>"+
        "[Github - rapidchat](https://github.com/rapidchat/rapidchat) "

        this.print()
        return Promise.resolve()
        break;
      case 'msg':
        // /msg to, test if to is an existing user
        to = this.channel.users[this.argument]
        if(!to) {
          this.print(new Error("User "+this.argument+" does not exist"))
          return Promise.resolve()
        }

        this.message = '(*Whispers to '+this.argument+'*) ' + this.message

        break;
      case 'roll':
        var num 

        if(this.argument == 'hack') {
          num = 6 
        } else {
          //@todo 1d1, 4d2 etc.
          var max = 6, min = 1
          num = Math.floor(Math.random() * (max - min + 1) + min) 
        }

        this.message = '(*Roll 1d6*) ' + num

        break;

      case 'me':
        this.message = '*' + [ this.channel.user.userId, this.argument, this.message ].join(' ') + '*'

        break;
      default:
    }

    return Keyring.getPublicKeysFromChannel(this.channel.channel)
    .then(function encrypt(publicKeys) {
      return openpgp.encryptMessage(publicKeys, self.message)
    })
    .then(function print(pgpMessage) {
      //emit message from, pgpmessage, time, to
      Socket.emit('message', self.channel.user.uid, pgpMessage, self.time, to)
      $log.debug("emitted msg: " + self.message)
      self.print()
      return self.save()
    })
    .catch(function(error) {
      $log.error('Error while encoding message', error) 
    })
  }

  /**
   * Decode, save and print the decoded message
   * @return void
   */
  Message.prototype.decode = function decode() {
    var self = this
    var privateKey = this.channel.user.privateKey
    var pgpMessage = openpgp.message.readArmored(this.message)

    openpgp.decryptMessage(privateKey, pgpMessage).then(function(plaintext) {
      self.message = plaintext
      self.print()
      return self.save()
      $log.debug("received msg: " + plaintext)
    }).catch(function(error) {
      $log.error('Error while decoding message', err) 
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
      $log.debug('Saved user message')
      return Promise.resolve()
    })
    .catch(function(error) {
      $log.error('Error while saving message', err) 
      return Promise.reject(error)
    })
  }

  /**
   * Format message
   * @param mixed msg
   * @todo markdown
   * @return string
   */
  Message.prototype.format = function format(msg) {
    
    if(msg instanceof Error) {
      msg = "<span class='base08'>"+msg.message+"</span>"
    }

    msg = marked(msg)

    for(var i in Smileys) {
      msg = msg.replace(new RegExp(escapeRegexString(i), 'ig'), '<img src="'+Smileys[i]+'">') 
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

    return this
  }

  return Message
})
