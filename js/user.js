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
    user: null,
    private: null,
    public: null,
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
      .then(function saveUser(keys) {

        self.private = keys.key
        self.public = self.private.toPublic()

        self.user = {
          userId: userId,
          dateAdded: Date.now(),
          primaryKeyId: self.private.primaryKey.getKeyId().toHex()
        }
        
        $localStorage.userId = self.user.userId

        //add user to database
        return db.users.add(self.user)
      })
      .then(function savePrivate() {
        return Keyring.store('private')(self.private, self.user.userId)
      })
      .then(function savePublic() {
        return Keyring.store('public')(self.public, self.user.userId)
      })
      .then(function saveAssociationUserKey() {
        return db.userKeys.add({keyId: self.user.primaryKeyId, userId: self.user.userId}) 
      })
      .then(function() {
        //those are javascrip objects
        self.user.publicKey = self.public
        self.user.privateKey = self.private
        self.user.uid = self.user.userId + '-' + self.user.primaryKeyId

        defer.resolve(self.user)
      })
      .catch(function(error) {
        $log.error("Error while creating user", error)
        defer.reject(error)
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

      db.users.where('userId')
      .equals(userId).first()
      .then(function(user) {

        if(user) {
          //use session id instead?
          if(!$localStorage.userId) {
            $localStorage.userId = userId 
          }

          self.user = user
          return Keyring.getKeysById(user.primaryKeyId)
          .then(function(keys) {
            self.user.publicKey = keys.public
            self.user.privateKey = keys.private
            self.user.uid = self.user.userId + '-' + self.user.primaryKeyId

            return defer.resolve(self.user)
          })
        } 

        //no user create it
        return self.create(userId)
        .then(defer.resolve)
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
