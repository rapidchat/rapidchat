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
    create: function createUser(userId) {

      var defer = $q.defer()
      var self = this

      //generate keys
      openpgp.generateKeyPair({
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
      .then(function(id) {
        return db.users.get(id)
      })
      .catch(function(error) {
        $log.error("Error while retreiving user", error)
        defer.reject(error)
      })
      .then(function(user) {
          user = self.getKeys(user)
          $localStorage.userId = user.userId
          defer.resolve(user)
      })

      return defer.promise
    },
    /**
     * Login user and set keys
     * @param string userId
     */
    login: function loginUser(userId) {
      var defer = $q.defer()
      var self = this

      db.users.where('userId').equals(userId).first()
      .then(function(user) {

        if(!user) {
          //no user create it
          self.create(userId)
          .then(defer.resolve)

        } else {

          user = self.getKeys(user)

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
    /**
     * Get keys object for user - we need javascript functions to test isPublic()
     * @param object user user from indexed db
     */
    getKeys: function getUserKeys(user) {
      var keys = Keyring.getKeysForId(user.keyId)
      user.keys = keys
      getUserPublicKey(user)

      return user
    },
    //@todo implement user deletion, keys etc.
    logout: function logout(userId) {
      // return db.users.where('userId').equals().delete()
    }

  }

  return userFactory

})
