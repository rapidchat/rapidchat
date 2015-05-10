# Rapidchat

PGP crypted client-only chat system - http://rapidchat.net

## How does it work?

1. When you login we're creating a public/private
2. When a user joins your channel, public keys are exchanged
3. When you send a message, it's pgp crypted with every pubkey in the channel
4. Message is sent through sockets and stored on your browser and other users browsers

## Requirements:

- nodejs
- ssdb

## Install:

``` 
npm install
bower install
gulp
ssdb-server ./ssdb.conf
node start index.js
```

## TODO: 

- SSL
- ~~Move keyring to indexdb~~
- Lock channel
Atm channel join/creation are the same
We can't automagically define a channel administrator
How could an admin be stored (store publickey?) ? 
- Improve ssdb security
- Add clear keys button (keyring and mine)
- keyring visibility (add you own keys, manage available keys)
- multiple channel
- recent channels
- alert title for new msgs
- message deletion? This should propagate deletion to make sure that every message has been deleted - not really possible to be 100% accurate if a user is not logged in anymore
- @todo in code
- @todo warn about security https://github.com/openpgpjs/openpgpjs#security-recommendations
- @todo save user recent channels

