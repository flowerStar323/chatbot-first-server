//  Text, Reference to next node
const mongoose = require('mongoose');

const { Model, Schema } = mongoose;

const schema = new Schema({
  email: {
    type: String,
    required: true,
  },
  qrCode: {
    type: String,
    default: null,
  },
  session: {
    type: String,
    default: null,
  },
  sessionState: {
    type: Number,
    default: 0,
    enum: [0, 1, 2, 3, 4, 5],
  },
  profilePic: {
    type: String,
    default: null,
  },
}, { timestamps: true });

class User extends Model {
  constructor(email) {
    super({ email });
  }
}

module.exports = mongoose.model(User, schema, 'users');
