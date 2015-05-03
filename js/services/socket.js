angular.module('rapidchat')
.factory('Socket', function Socket(socketFactory, $window) {
  var sock = io.connect($window.location.pathname.substr(1))
  return socketFactory({prefix: '', ioSocket: sock})
})
