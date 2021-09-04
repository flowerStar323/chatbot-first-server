
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

let objectiveHistory = new Schema({
  No: {
    type: Number,
    required: true,
  },
  Teamname: {
    type: String,
    required: true
  },
  imageURL: {
    type: String,
    required: true
  }
});

module.exports = mongoose.model('teamnames', objectiveHistory);