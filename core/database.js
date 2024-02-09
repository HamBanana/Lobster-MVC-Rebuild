const nano = require('nano')('http://localhost:5984');
const db = nano.db.use('mydatabase');

console.log('Connected to CouchDB');

export const Test="Test"