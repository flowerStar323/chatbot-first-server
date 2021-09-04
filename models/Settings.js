const { Schema, SchemaTypes, model } = require('mongoose');

const schema = new Schema({
  plans: [{
    name: SchemaTypes.String,
    agentsCount: SchemaTypes.Number,
    waBots: SchemaTypes.Number,
    triggerBots: SchemaTypes.Number,
    webBots: SchemaTypes.Number,
    price: SchemaTypes.Number,
  }],
}, { timestamps: true });

module.exports = model('Settings', schema);
