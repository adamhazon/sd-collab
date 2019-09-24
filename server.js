const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const Data = require('./data');

//ProseMirror
const {Step} = require('prosemirror-transform')
const {schema} = require('prosemirror-schema-basic');

const port = process.env.PORT || 4000;
const index = require('./routes/index');

const app = express();

app.use(cors());

// Serve static files from the React frontend app
app.use(express.static(path.join(__dirname, 'client/build')))
// Anything that doesn't match the above, send back index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname + '/client/build/index.html'))
})

app.use(index);

const server = http.createServer(app);

const io = socketIo(server);

const dbRoute = 'mongodb+srv://adam:qwe123@prosemirrorcluster-gh8jx.mongodb.net/test?retryWrites=true&w=majority';

// connect to the database
mongoose.connect(dbRoute, { useNewUrlParser: true, useUnifiedTopology: true });
let db = mongoose.connection;

db.once('open', () => console.log('connected to the database'));

// checks if connection with the database is successful
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

class Authority {
  constructor(doc) {
    this.doc = doc;
    this.steps = [];
    this.stepClientIDs = [];
  }

  receiveSteps(version, steps, clientID) {
    if (version !== this.steps.length) return;

    // Apply and accumulate new steps
    steps.forEach(step => {
      this.doc = Step.fromJSON(schema, step).apply(this.doc).doc;
      this.steps.push(step);
      this.stepClientIDs.push(clientID);
    });

    io.emit('FromServer', this.stepsSince(version));
  }

  stepsSince(version) {
    return {
      authority: {
        doc: authority.doc,
        steps: authority.steps,
        stepClientIDs: authority.stepClientIDs
      },
      steps: this.steps.map(step => Step.fromJSON(schema, step)).slice(version),
      clientIDs: this.stepClientIDs.slice(version)
    }
  }
}

const doc = schema.node('doc', null, [schema.node('paragraph', null, [
  schema.text('This is a collaborative test document. Start editing to make it more interesting!')
])]);

const authority = new Authority(doc);

io.on('connection', socket => {
  console.log('New client connected');

  socket.emit('FromServer', authority.stepsSince(0));

  socket.on('disconnect', () => console.log('Client disconnected'));

  socket.on('FromClient', (data) => {
    const jsonData = JSON.parse(data);

    authority.receiveSteps(jsonData.version, jsonData.steps, jsonData.clientID);
  });
});

server.listen(port, () => console.log(`Listening on port ${port}`));
