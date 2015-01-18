angular.module('rapidchat', ['btford.socket-io', 'ngStorage', 'ngSanitize'])
.run(function($localStorage, $rootScope, User) {

  openpgp.initWorker('./build/openpgp.worker.js')
})
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
.factory('Socket', function Socket(socketFactory, $window) {
  var sock = io.connect($window.location.pathname.substr(1))
  return socketFactory({prefix: '', ioSocket: sock})
})
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
