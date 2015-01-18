angular.module('rapidchat')
.service('Keyring', function Keyring($log) {
  var Keyring = new openpgp.Keyring() 

  Keyring.addPublicKey = function addPublicKey(key) {
    var keyId = key.primaryKey.getKeyId().toHex()

    var exists = this.getKeysForId(keyId)

    if(!exists) {
      this.publicKeys.push(key) 
      this.store()
    } else {
      $log.debug('Key was in the ring')
    }
  
  }

  return Keyring
})
