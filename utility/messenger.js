const axios = require('axios').default;

const FacebookMessage = require('../models/FacebookMessage');
const InstagramMessage = require('../models/InstagramMessage');

const messages = {};
const botUserId = 'n4GqJVqxndhPFWh34b0WjADhjvM2';

messages.create = async ({
  mediaUrl, mediaName, to, body,
}) => new Promise((resolve, reject) => {
  const To = `${to.split('+')[1]}@c.us`;

  console.log('==============>', mediaName, mediaUrl, to, body);

  axios.post('http://localhost:3600/sendmessage',
    {
      to: To,
      body,
      mediaUrl,
      mediaName,
    })
    .then((_resp) => {
      resolve();
    })
    .catch((e) => {
      console.log(e);
      reject();
    });
});

messages.isLoggedIn = async () => new Promise((resolve, reject) => {
  axios.get('http://localhost:3600/check')
    .then((resp) => {
      resolve(resp.data.result);
    })
    .catch((e) => {
      console.log(e);
      reject();
    });
});

messages.getQrCode = async () => new Promise((resolve, reject) => {
  axios.get('http://localhost:3600/qrcode')
    .then((resp) => {
      resolve(resp.data.result);
    })
    .catch((e) => {
      console.log(e);
      reject();
    });
});

messages.list = async (waId) => new Promise((resolve, reject) => {
  axios.get(`http://localhost:3600/getmessages/${waId}`,
    {})
    .then((resp) => {
      resolve(resp.data.messages);
    })
    .catch((e) => {
      console.log(e);
      reject();
    });
});

const sendTextMessageFb = (token, to, text, cb) => {
  axios.post(`https://graph.facebook.com/${process.env.FB_APIVERSION}/me/messages?access_token=${token}`, {
    messaging_type: 'RESPONSE',
    recipient: {
      id: to,
    },
    message: {
      text,
    },
  }).then((_response) => cb(null)).catch((err) => cb(err.response ? err.response.data : err));
};

const sendMediaMessageFb = (token, to, type, url, cb) => {
  axios.post(`https://graph.facebook.com/${process.env.FB_APIVERSION}/me/messages?access_token=${token}`, {
    messaging_type: 'RESPONSE',
    recipient: {
      id: to,
    },
    message: {
      attachment: {
        type,
        payload: {
          url,
        },
      },
    },
  }).then((_response) => cb(null))
    .catch((err) => cb(err.response ? err.response.data : err));
};

const sendButtonMessageFb = (token, to, text, buttons, cb) => {
  axios.post(`https://graph.facebook.com/${process.env.FB_APIVERSION}/me/messages?access_token=${token}`, {
    messaging_type: 'RESPONSE',
    recipient: {
      id: to,
    },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text,
          buttons,
        },
      },
    },
  }).then((_response) => cb(null)).catch((err) => cb(err.response ? err.response.data : err));
};

const sendQuickReplyMessageFb = (token, to, text, quickReplies, cb) => {
  axios.post(`https://graph.facebook.com/${process.env.FB_APIVERSION}/me/messages?access_token=${token}`, {
    messaging_type: 'RESPONSE',
    recipient: {
      id: to,
    },
    message: {
      text,
      quick_replies: quickReplies,
    },
  }).then((_response) => cb(null)).catch((err) => cb(err.response ? err.response.data : err));
};

const sendButtonAndQuickReplyMessageFb = (token, to, text, buttons, quickReplies, cb) => {
  axios.post(`https://graph.facebook.com/${process.env.FB_APIVERSION}/me/messages?access_token=${token}`, {
    messaging_type: 'RESPONSE',
    recipient: {
      id: to,
    },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text,
          buttons,
        },
      },
      quick_replies: quickReplies,
    },
  }).then((_response) => cb(null)).catch((err) => cb(err.response ? err.response.data : err));
};

messages.createFb = async ({
  mediaUrl, mediaMimeType, buttons, quickReplies, to, recipientToken, body,
}) => new Promise((resolve, reject) => {
  console.log('==============>', mediaUrl, mediaMimeType, to, recipientToken, body);

  if (mediaUrl && mediaMimeType) {
    if (buttons && buttons.length) {
      if (quickReplies && quickReplies.length) {
        sendMediaMessageFb(recipientToken, to, mediaMimeType, mediaUrl, (err) => {
          if (err) { console.log(err); }
          sendButtonAndQuickReplyMessageFb(
            recipientToken, to, body, buttons, quickReplies,
            (err2) => {
              if (err2) {
                console.log(err2);
                reject();
              } else {
                resolve();
              }
            },
          );
        });
      } else {
        sendMediaMessageFb(recipientToken, to, mediaMimeType, mediaUrl, (err) => {
          if (err) { console.log(err); }
          sendButtonMessageFb(recipientToken, to, body, buttons, (err2) => {
            if (err2) {
              console.log(err2);
              reject();
            } else {
              resolve();
            }
          });
        });
      }
    } else if (quickReplies && quickReplies.length) {
      sendMediaMessageFb(recipientToken, to, mediaMimeType, mediaUrl, (err) => {
        if (err) { console.log(err); }
        sendQuickReplyMessageFb(recipientToken, to, body, quickReplies, (err2) => {
          if (err2) {
            console.log(err2);
            reject();
          } else {
            resolve();
          }
        });
      });
    } else {
      sendMediaMessageFb(recipientToken, to, mediaMimeType, mediaUrl, (err) => {
        if (err) { console.log(err); }
        sendTextMessageFb(recipientToken, to, body, (err2) => {
          if (err2) {
            console.log(err2);
            reject();
          } else {
            resolve();
          }
        });
      });
    }
  } else if (buttons && buttons.length) {
    if (quickReplies && quickReplies.length) {
      sendButtonAndQuickReplyMessageFb(recipientToken, to, body, buttons, quickReplies, (err) => {
        if (err) {
          console.log(err);
          reject();
        } else {
          resolve();
        }
      });
    } else {
      sendButtonMessageFb(recipientToken, to, body, buttons, (err) => {
        if (err) {
          console.log(err);
          reject();
        } else {
          resolve();
        }
      });
    }
  } else if (quickReplies && quickReplies.length) {
    sendQuickReplyMessageFb(recipientToken, to, body, quickReplies, (err) => {
      if (err) {
        console.log(err);
        reject();
      } else {
        resolve();
      }
    });
  } else {
    sendTextMessageFb(recipientToken, to, body, (err) => {
      if (err) {
        console.log(err);
        reject();
      } else {
        resolve();
      }
    });
  }
});

messages.listFb = async (senderId) => new Promise((resolve, reject) => {
  FacebookMessage.find({ senderId }, (err, foundMessages) => {
    if (err || !foundMessages) {
      console.log(err ? err.message : err);
      reject();
    } else {
      resolve(foundMessages);
    }
  });
});

messages.createW = async ({
  body, _to, _name, room, ref,
}) => new Promise((resolve, reject) => {
  ref.child(room).push({
    message: body,
    name: 'support',
    timestamp: Date.now(),
    type: 'default',
    userId: botUserId,
    '.priority': Date.now(),
  }, (err) => {
    if (err) {
      console.log(err);
      reject();
    } else {
      resolve();
    }
  });
});

messages.listW = async (room, ref) => new Promise((resolve, reject) => {
  ref.child(room).on('value', (snapshot) => {
    resolve(snapshot.toJSON());
  }, (errorObject) => {
    console.log(`The read failed: ${errorObject.name}`);
    reject();
  });
});

const sendTextMessageIg = (token, to, text, cb) => {
  axios.post(`https://graph.facebook.com/${process.env.IG_APIVERSION}/me/messages?access_token=${token}`, {
    messaging_type: 'RESPONSE',
    recipient: {
      id: to,
    },
    message: {
      text,
    },
  }).then((_response) => cb(null)).catch((err) => cb(err.response ? err.response.data : err));
};

const sendMediaMessageIg = (token, to, type, url, cb) => {
  axios.post(`https://graph.facebook.com/${process.env.IG_APIVERSION}/me/messages?access_token=${token}`, {
    messaging_type: 'RESPONSE',
    recipient: {
      id: to,
    },
    message: {
      attachment: {
        type,
        payload: {
          url,
        },
      },
    },
  }).then((_response) => cb(null))
    .catch((err) => cb(err.response ? err.response.data : err));
};

const sendGenericTemplateMessageIg = (token, to, genericTemplates, cb) => {
  axios.post(`https://graph.facebook.com/${process.env.IG_APIVERSION}/me/messages?access_token=${token}`, {
    messaging_type: 'RESPONSE',
    recipient: {
      id: to,
    },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: genericTemplates,
        },
      },
    },
  }).then((_response) => cb(null)).catch((err) => cb(err.response ? err.response.data : err));
};

const sendQuickReplyMessageIg = (token, to, text, quickReplies, cb) => {
  axios.post(`https://graph.facebook.com/${process.env.IG_APIVERSION}/me/messages?access_token=${token}`, {
    messaging_type: 'RESPONSE',
    recipient: {
      id: to,
    },
    message: {
      text,
      quick_replies: quickReplies,
    },
  }).then((_response) => cb(null)).catch((err) => cb(err.response ? err.response.data : err));
};

const sendGenericTemplateAndQuickReplyMessageIg = (token, to, genericTemplates, quickReplies, cb) => {
  axios.post(`https://graph.facebook.com/${process.env.IG_APIVERSION}/me/messages?access_token=${token}`, {
    messaging_type: 'RESPONSE',
    recipient: {
      id: to,
    },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: genericTemplates,
        },
      },
      quick_replies: quickReplies,
    },
  }).then((_response) => cb(null)).catch((err) => cb(err.response ? err.response.data : err));
};

messages.createIg = async ({
  mediaUrl, mediaMimeType, genericTemplates, quickReplies, to, recipientToken, body,
}) => new Promise((resolve, reject) => {
  console.log('==============>', mediaUrl, mediaMimeType, to, recipientToken, body);

  if (mediaUrl && mediaMimeType) {
    if (genericTemplates && genericTemplates.length) {
      if (quickReplies && quickReplies.length) {
        sendMediaMessageIg(recipientToken, to, mediaMimeType, mediaUrl, (err) => {
          if (err) { console.log(err); }
          sendGenericTemplateAndQuickReplyMessageIg(
            recipientToken, to, genericTemplates, quickReplies,
            (err2) => {
              if (err2) {
                console.log(err2);
                reject();
              } else {
                resolve();
              }
            },
          );
        });
      } else {
        sendMediaMessageIg(recipientToken, to, mediaMimeType, mediaUrl, (err) => {
          if (err) { console.log(err); }
          sendGenericTemplateMessageIg(recipientToken, to, genericTemplates, (err2) => {
            if (err2) {
              console.log(err2);
              reject();
            } else {
              resolve();
            }
          });
        });
      }
    } else if (quickReplies && quickReplies.length) {
      sendMediaMessageIg(recipientToken, to, mediaMimeType, mediaUrl, (err) => {
        if (err) { console.log(err); }
        sendQuickReplyMessageIg(recipientToken, to, body, quickReplies, (err2) => {
          if (err2) {
            console.log(err2);
            reject();
          } else {
            resolve();
          }
        });
      });
    } else {
      sendMediaMessageIg(recipientToken, to, mediaMimeType, mediaUrl, (err) => {
        if (err) { console.log(err); }
        sendTextMessageIg(recipientToken, to, body, (err2) => {
          if (err2) {
            console.log(err2);
            reject();
          } else {
            resolve();
          }
        });
      });
    }
  } else if (genericTemplates && genericTemplates.length) {
    if (quickReplies && quickReplies.length) {
      sendGenericTemplateAndQuickReplyMessageIg(recipientToken, to, genericTemplates, quickReplies, (err) => {
        if (err) {
          console.log(err);
          reject();
        } else {
          resolve();
        }
      });
    } else {
      sendGenericTemplateMessageIg(recipientToken, to, genericTemplates, (err) => {
        if (err) {
          console.log(err);
          reject();
        } else {
          resolve();
        }
      });
    }
  } else if (quickReplies && quickReplies.length) {
    sendQuickReplyMessageIg(recipientToken, to, body, quickReplies, (err) => {
      if (err) {
        console.log(err);
        reject();
      } else {
        resolve();
      }
    });
  } else {
    sendTextMessageIg(recipientToken, to, body, (err) => {
      if (err) {
        console.log(err);
        reject();
      } else {
        resolve();
      }
    });
  }
});

messages.listIg = async (senderId) => new Promise((resolve, reject) => {
  InstagramMessage.find({ senderId }, (err, foundMessages) => {
    if (err || !foundMessages) {
      console.log(err ? err.message : err);
      reject();
    } else {
      resolve(foundMessages);
    }
  });
});

module.exports.messages = messages;
