angular.module('rapidchat')
.factory('Keyring', function($log, db, $q) {

  function KeyRing(prefix) {

    if(typeof openpgp === 'undefined')
      throw new TypeError("Openpgp is not loaded")

    if(typeof Dexie === 'undefined')
      throw new TypeError("Dexie is not loaded")

    prefix = prefix || 'openpgp-'
  }

  //@todo pub keys / users from a channel
  KeyRing.prototype.getPublicKeysFromChannel = function(channel) {
    var ids = []
    var defer = $q.defer()

    db.channelKeys.where('channel').anyOf(channel)
    .each(function(uk) {
      ids.push(uk.keyId)
    })
    .then(function() {
      return db.publicKeys.where(':id').anyOf(ids).toArray()
    })
    .then(function(jsonKeys) {
      var keys = []

      for(var i in jsonKeys) {
        keys.push(openpgp.key.readArmored(jsonKeys[i].key).keys[0])
      }
    
      defer.resolve(keys)
    })
    .catch(function(error) {
      return defer.reject(error) 
    })

    return defer.promise
  }

  KeyRing.prototype.getKeysById = function(keyId) {
    var keys = {public: null, private: null}
    var defer = $q.defer()

    db.publicKeys.where(':id').equals(keyId).first()
    .then(function(publicKey) {
      keys.public = openpgp.key.readArmored(publicKey.key).keys[0]

      return db.privateKeys.where(':id').equals(keyId).first()
    })
    .then(function(privateKey) {
      keys.private = openpgp.key.readArmored(privateKey.key).keys[0]

      return defer.resolve(keys)
    })
    .catch(function(error) {
      return defer.reject(error) 
    })

    return defer.promise
  }
 
  KeyRing.prototype.store = function(type) {
    var self = this

    if(!~['public', 'private'].indexOf(type))
      throw new TypeError("Type can be one of public, private")

    return function(key, userId) {
      var keyId = key.primaryKey.getKeyId().toHex()
      return db[type+'Keys'].add({
        key: key.armor(),
        dateAdded: Date.now(),
        id: keyId
      }).then(function() {
        return db.userKeys.add({keyId: keyId, userId: userId}) 
      })
    } 
  }

  KeyRing.prototype.storeChannel = function(channel) {
    var self = this

    return function(key) {
      var keyId = key.primaryKey.getKeyId().toHex()
      return db.publicKeys.add({
        key: key.armor(),
        dateAdded: Date.now(),
        id: keyId
      }).then(function() {
        return db.channelKeys.add({keyId: keyId, channel: channel}) 
      })
    } 
  }

  return new KeyRing()
})
