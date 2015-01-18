angular.module('rapidchat')
.factory('User', function User(db, Keyring, $localStorage, $q, $log) {

  /**
   * Populates user public key
   * @param object user must have keys
   * @throws TypeError if user has no keys
   * @return object 
   */
  function getUserPublicKey(user) {

    if(!user.keys) {
      throw new TypeError("Keys are required")
    }

    for(var i in user.keys) {
      //from opengpg api
      if(user.keys[i].isPublic()) {
        user.publicKey = user.keys[i]
      }
    }

    return user
  }

  /**
   * User Factory
   */
  var userFactory = {
    /**
     * Creates a user
     * @param string userId the user id usually username
     * @todo passphrase?
     * @return $q
     */
    create: function(userId) {

      var defer = $q.defer()

      //generate keys
      return openpgp.generateKeyPair({
        numBits: 1024, 
        userId: userId, 
        passphrase: ''
      })
      .catch(function(error) {
        $log.error("Error while generating key pair", error)
        defer.reject(error)
      })
      .then(function(keys) {
        var keyId = keys.key.primaryKey.getKeyId().toHex()
        Keyring.privateKeys.push(keys.key)
        Keyring.publicKeys.push(keys.key.toPublic())
        //stores in localstorage
        //@todo dbize LocalStore (see opengpg)
        Keyring.store()

        var user = {
          userId: userId, 
          keyId: keyId, 
          uid: userId + '-' + keyId, 
          keys: keys
        }

        //add user to database
        return db.users.add(user)
      })
      .catch(function(error) {
        $log.error("Error while creating user", error)
        defer.reject(error)
      })
      .then(function(user) {
          getUserPublicKey(user)
          $localStorage.userId = userId
          defer.resolve(user)
      })

    },
    /**
     * Login user and set keys
     * @param string userId
     */
    login: function login(userId) {
      var defer = $q.defer()
      var self = this

      db.users.where('userId').equals(userId).first()
      .then(function(user) {

        if(!user) {
          //no user create it
          self.create(userId)
          .then(defer.resolve)

        } else {

          var keys = Keyring.getKeysForId(user.keyId)
          user.keys = keys
          getUserPublicKey(user)

          //use session id instead?
          if(!$localStorage.userId) {
            $localStorage.userId = userId 
          }

          defer.resolve(user)
        }
      })
      .catch(function(error) {
        $log.error("Error while getting user for userId", userId, error)
        defer.reject(error) 
      })

      return defer.promise
    },
    //@todo implement user deletion, keys etc.
    logout: function logout(userId) {
      // return db.users.where('userId').equals().delete()
    }

  }

  return userFactory

})
