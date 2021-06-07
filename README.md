# deluge-client

---
A typescript wrapper for the Deluge Web JSON-RPC API using Async / Await

### installing
###### npm install deluge-client

### basic usage
###### import DelugeClient from 'deluge-client';

or

###### const DelugeClient = require('deluge-client');

const host = '/url/to/deluge_daemon';

const password = 'password for deluge_daemon';

const folder = 'folder where downloaded files should be saved to';

###### const deluge = new DelugeClient(host, password, folder);
###### await deluge.add('url to torrent magnet || torrent file url');

###advanced features 
for private indexes you can provide your own cookies to be used for the torrent download by adding the cookie object in the constructor

const cookie = {
'private-indexer.torrent': "my private cookie for indexer",
'private-two-indexer.torrent': "my second private cookie for indexer",
}

###### const deluge = new DelugeClient(host, password, folder, cookies)

### available methods
getHosts, connect, add and getRecords
 