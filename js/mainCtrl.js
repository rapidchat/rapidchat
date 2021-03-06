angular.module('rapidchat')
.controller('MainCtrl', function mainController($scope, User, Socket, $localStorage, $log, Keyring, Message, Channel, $rootScope, $timeout) {

  var textbox = document.getElementById('textbox')
  $scope.messages = []
  $scope.channel = {}

  //user exists in localStorage log in automagically
  if($localStorage.userId) {
    User.login($localStorage.userId).then(function(user) {
      $scope.user = user 
      $scope.channel = new Channel(user, $scope)

      $log.debug('User logged in', $scope.user)

      //If we saved a channel too, join it
      if($localStorage.channel) {
        $scope.channel.join($localStorage.channel)
      }

      $scope.channel.reset()
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
      $scope.channel.reset()
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
    $scope.channel.joined = true
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
      return 
    }

    var m = new Message(msg, $scope.channel)  
    if(m) { 
      m.encode().then(function() {
        $timeout(function() {
          if ($scope.$root.$$phase != '$apply' && $scope.$root.$$phase != '$digest') {
              $scope.$apply()
          }

          textbox.value = ''
        })
      })
    }

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
  Socket.on('exchange ping', function(sid, armor, channel) {
    var key = openpgp.key.readArmored(armor).keys[0]
    Keyring.storeChannel(channel)(key)
    .then(function() {
      $log.debug('Exchange ping received, sending pong pubkey')
      Socket.emit('exchange pong', sid, $scope.user.publicKey.armor(), channel)
    })
  })

  Socket.on('exchange pong', function(armor, channel) {
    var key = openpgp.key.readArmored(armor).keys[0]
    $log.debug('Exchange pong store key on channel', channel)
    Keyring.storeChannel(channel)(key)
  })

  /** Click on user **/
  $scope.userClick = function(user) {
    if(textbox) {
      textbox.value = textbox.value + user
    }

    textbox.focus()
  }

  $scope.logout = function() {
    delete $localStorage.userId
  }

})

.directive('userlist', function userList() {

  return {
    restrict: 'E', 
    scope: {
      users: '='
    },
    templateUrl: 'html/user-list.html',
    link: function linkUserlist(scope, element, attrs, controller) {
      scope.userClick = scope.$parent.userClick
    }
  }
})
.filter('prettyUser', function($sce) {

  return function(user, me) {

    if(!user)
      return user;

    var color = "base0B"

    if(user == me) {
      color = "base0E"
    }

    return $sce.trustAsHtml('<span class="'+color+'">'+user+': </span>')
  }
})
