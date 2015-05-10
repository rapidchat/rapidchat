angular.module('rapidchat')
.factory('db', function db(rcconfig, $localStorage) {
  var db = new Dexie('Rapidchat')

  db.version(1).stores({
    users: '++id,userId,primaryKeyId,dateAdded',
    publicKeys: 'id,key,dateAdded',
    privateKeys: 'id,key,dateAdded',
    userKeys: '++id,keyId,userId',
    channelKeys: '++id,keyId,channel',
    messages: '++id,from,message,time,channel'
  })

  db.open().then(function() {
    console.log('db open');
    if(rcconfig.debug) {
      //@todo see messages/channel
      //this comes handy to start a new project put it somewhere else
      // db.delete().then(function() {
      //   console.log('tdb del')
      //   delete $localStorage.userId
      // }).catch(function() {
      //   console.log(arguments) 
      // })
    }
  })

  db.on('blocked', function () {
      throw new Error("Db blocked!")  
  })

  return db
})
