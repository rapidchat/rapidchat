angular.module('rapidchat', ['btford.socket-io', 'ngStorage', 'ngSanitize'])
.run(function($localStorage, $rootScope, User, $log) {
  //put this somewhere + logProvider
  var debug = false

  var worker_path = './bower_components/openpgp/dist/'
  worker_path += debug ? 'openpgp.worker.js' : 'openpgp.worker.min.js'
  
  openpgp.config.useWebCrypto = false
  openpgp.config.keyserver = 'keyserver.rapidchat.net'

  openpgp.initWorker(worker_path)
})
.config(function($logProvider) {
  $logProvider.debugEnabled(false)
})
.factory('db', function db() {
  var db = new Dexie('Rapidchat')

  db.version(1).stores({
    users: '++id,uid,userId,keyId',
    messages: '++id,from,message,time,channel'
  })

  //@todo see messages/channel
  //this comes handy to start a new project put it somewhere else
  // db.delete().then(function() {
  //   console.log('tdb del')
  // }).catch(function() {
  //   console.log(arguments) 
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

  return db
})
.factory('Socket', function Socket(socketFactory, $window) {
  var sock = io.connect($window.location.pathname.substr(1))
  return socketFactory({prefix: '', ioSocket: sock})
})
