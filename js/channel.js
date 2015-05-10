angular.module('rapidchat')
.factory('Channel', function channelFactory($localStorage, Socket, Message, db, $timeout, $log) {
  
  function Channel(user, $scope) {
    this.channel = null
    this.user = user 
    this.users = []
    this.messages = []
    this.$scope = $scope
    this.joined = false

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

    $log.debug('Joining', channel)

    $localStorage.channel = channel

    this.loadMessages()
    .then(function() {
      Socket.emit('join', {
        channel: channel,
        uid: self.user.userId + '-' + self.user.primaryKeyId,
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
          self.$scope.$apply()
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
})
