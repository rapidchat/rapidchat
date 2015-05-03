angular.module('rapidchat', ['btford.socket-io', 'ngStorage', 'ngSanitize'])
.constant('rcconfig', {
  debug: true
})
.run(function($localStorage, $rootScope, User, $log, rcconfig) {
  
  // https://github.com/openpgpjs/openpgpjs#dependencies
  openpgp.config.useWebCrypto = false
  openpgp.config.keyserver = 'keyserver.rapidchat.net'

  var worker_path = './bower_components/openpgp/dist/'
  worker_path += rcconfig.debug === true ? 'openpgp.worker.js' : 'openpgp.worker.min.js'

  openpgp.initWorker(worker_path)
})
.config(function($logProvider, rcconfig) {
  $logProvider.debugEnabled(rcconfig.debug)
})
