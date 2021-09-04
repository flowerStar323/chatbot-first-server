require('dotenv').config();

const cors = require('cors');
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const fileUpload = require('express-fileupload');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');

const client = require('./utility/messenger');
const Message = require('./models/Message');
const serviceAccount = require('./service_account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://chat-crm-bot-default-rtdb.firebaseio.com',
});

const db = admin.database();
const ref = db.ref('lwm-chat/room-messages');
const ref2 = db.ref('lwm-chat/room-metadata');

const botUserId = 'n4GqJVqxndhPFWh34b0WjADhjvM2';

const connect = require('./db');
const {
  conductSurveyE,
  updateSurveys,
  launcher,
  conductSurveyW, processMessagesW, processMessagesW2, conductSurveyW2, getSurveyByRoom,
} = require('./utility/utility');

const app = express();
const httpServer = http.Server(app);
const io = socketIO(httpServer, {
  cors: {
    //  origin: 'http://34.70.63.74',
    origins: ['http://localhost:5500', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
  },
});

app.use((req, _res, next) => {
  req.io = io;
  next();
});

app.use('/media', express.static('media'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());

app.use('/upload', fileUpload({
  limits: { fileSize: 1 * 1024 * 1024, files: 1 },
  abortOnLimit: true,
  parseNested: true,
  safeFileNames: true,
  preserveExtension: 5,
  useTempFiles: true,
  tempFileDir: './files/',
}));
app.use('/uploadMedia', fileUpload({
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  abortOnLimit: true,
  parseNested: true,
  safeFileNames: true,
  preserveExtension: 5,
  useTempFiles: true,
  tempFileDir: './media/',
}));
app.use('/uploadMediaAlt', fileUpload({
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  abortOnLimit: true,
  parseNested: true,
  safeFileNames: true,
  preserveExtension: 5,
  useTempFiles: true,
  tempFileDir: './media/',
}));
app.use('/', require('./routes/routes'));


connect(async () => {
  const port = process.env.PORT || 8080;
  httpServer.listen(port, () => console.log(`Server listening on PORT ${port}..`));
  updateSurveys().then(() => { });

  setInterval(() => {
    launcher().then(() => { });
  }, 30 * 1000);

  const now = Date.now();

  ref.on('child_added', async (snapshot) => {
    const roomMessages = snapshot.toJSON();
    const keys = Object.keys(roomMessages);
    const newMessage = roomMessages[keys[keys.length - 1]];

    if (newMessage.timestamp < now || newMessage.userId === botUserId) return;

    console.log('new discussion');

    const surveyId = await getSurveyByRoom(snapshot.key, ref2.child(snapshot.key));

    await conductSurveyW2(client, snapshot.key, surveyId, newMessage, ref);
  }, (errorObject) => {
    console.log(`The read failed: ${errorObject.name}`);
  });

  ref.on('child_changed', async (snapshot) => {
    const roomMessages = snapshot.toJSON();
    const keys = Object.keys(roomMessages);


    if (roomMessages[keys[keys.length - 1]].userId === botUserId) return;

    //  console.log('new message', roomMessages[keys[keys.length - 1]]);

    const surveyId = await getSurveyByRoom(snapshot.key, ref2.child(snapshot.key));

    await processMessagesW2(
      client, snapshot.key, surveyId, roomMessages[keys[keys.length - 1]], ref,
    );
  }, (errorObject) => {
    console.log(`The read failed: ${errorObject.name}`);
  });
},
  () => {
    console.log('Database connection failed!');
  });
