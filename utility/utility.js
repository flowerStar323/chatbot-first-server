// We're going to discuss with this BOT
const nodemailer = require('nodemailer');
const inlineCss = require('nodemailer-juice');
const twilio = require('./messenger');

const Path = require('../models/Path');
const EPath = require('../models/EPath');
const Combination = require('../models/Combination');
const Node = require('../models/Node');
const QuestionTypes = require('../models/QuestionTypes');
const Answer = require('../models/Answer');
const Survey = require('../models/Survey');
const OptinStates = require('../models/OptinStates');
const Participant = require('../models/Participant');
const Message = require('../models/Message');

//  const userIdx = '5fdce90b72b8b020b07ef768';
const botUserId = 'n4GqJVqxndhPFWh34b0WjADhjvM2';

const MAX_QUICKREPLIES_PER_MESSAGE = 13;

const sleep = async (time) => new Promise((resolve, _reject) => setTimeout(() => resolve(), time));

const runSurvey = async (survey) => {
  // Check if any survey is already running if running reject request
  // Check if survey is terminated; update survey to terminated and reject request

  const participants = await Participant.find({ survey: survey.id });

  for (let i = 0; i < participants.length; i += 1) {
    conductSurvey(twilio, survey, participants[i]).then(null);
  }

  console.log('starting survey');
};

const conductSurvey = async (client, survey, participant) => {
  // Get the participant path and continue from there
  console.log(survey.id, participant);
  try {
    let firstTime = false;
    let path = await Path.findOne({
      participant: participant.id,
      survey: survey.id,
      terminated: false,
      optinState: { $ne: OptinStates.NO },
    });
    if (!path) {
      path = new Path(participant.id, survey.id);
      path = await path.save();
      firstTime = true;
    }
    const combination = firstTime
      ? [] : await Combination.findOne({ path: path.id }).sort({ createdAt: -1 }).exec();

    console.log('comb taken', firstTime, combination);

    // Send Option message
    if (firstTime && survey.optIn && path.optinState === OptinStates.PENDING) {
      let question = survey.optinQuestion;
      question += `\n 1 - ${survey.optinYesText} \n 2 - ${survey.optinNoText}`;
      await twilio.messages.create({
        to: `whatsapp:${participant.phoneNumber}`,
        body: question,
      });
      return;
    }

    const nextNode = await getNextNode(
      firstTime || !combination, survey, combination,
    );

    console.log('next node found', nextNode);

    if (nextNode && nextNode.endActionType != null) {
      if (nextNode.endActionType === 0) {
        // Send Message
        console.log('Send End Message');
        await twilio.messages.create({
          to: `whatsapp:${participant.phoneNumber}`,
          body: nextNode.endActionData,
        });
      } else if (nextNode.endActionType === 1) {
        // Send Email
        console.log('Send Email', nextNode);
        sendEmail(nextNode.emailData, nextNode.subjectData, nextNode.contentData).then(null);
      } else if (nextNode.endActionType === 2) {
        // Notify Agent
        console.log('Notify Agent');
      }
    } else if (nextNode) {
      if (nextNode.mediaUrl) {
        await askQuestionFile(client, nextNode, participant, survey);
      } else {
        await askQuestion(client, nextNode, participant, survey);
      }
      if (nextNode.questionType === QuestionTypes.MESSAGE) {
        //  We create the combination, save it and call conduct survey again
        const newCombination = new Combination(
          path.id, nextNode.id, null, null,
        );
        await newCombination.save();
        await conductSurvey(client, survey, participant);
      }
    } else {
      await Path.findByIdAndUpdate(path.id, { $set: { terminated: true } },
        { useFindAndModify: false });
      //  await client.sendMessage(formatParticipant(participant), survey.endMessage);
      //  await displayResult(path);
    }
  } catch (error) {
    console.log(error);
  }
};

const conductSurveyW = async (socket, botId, {
  name, email, participantId,
}) => {
  // Get the participant path and continue from there
  const survey = await Survey.findById(botId);
  if (!survey) return;

  let participant = await Participant.findOne({ participantId });
  if (!participant) {
    participant = await Participant.create({
      type: 'website',
      participantId,
      email,
      firstName: name,
      survey: survey.id,
    });
  }

  try {
    let firstTime = false;
    let path = await Path.findOne({
      participant: participant.id,
      survey: survey.id,
      terminated: false,
      optinState: { $ne: OptinStates.NO },
    });
    if (!path) {
      path = new Path(participant.id, survey.id);
      path = await path.save();
      firstTime = true;
    }
    const combination = firstTime
      ? [] : await Combination.findOne({ path: path.id }).sort({ createdAt: -1 }).exec();

    // Send Option message (Should never occur (website chatbot))
    if (firstTime && survey.optIn && path.optinState === OptinStates.PENDING) {
      let question = survey.optinQuestion;
      question += `\n 1 - ${survey.optinYesText} \n 2 - ${survey.optinNoText}`;
      await twilio.messages.create({
        to: `whatsapp:${participant.phoneNumber}`,
        body: question,
      });
      return;
    }

    const nextNode = await getNextNode(
      firstTime || !combination, survey, combination,
    );

    if (nextNode && nextNode.endActionType != null) {
      if (nextNode.endActionType === 0) {
        // Send Message
        console.log('Send End Message');
        socket.emit(`bot-message-${participant.participantId}`, { message: nextNode.endActionData });
      } else if (nextNode.endActionType === 1) {
        // Send Email
        console.log('Send Email', nextNode);
        sendEmail(nextNode.emailData, nextNode.subjectData, nextNode.contentData).then(null);
      } else if (nextNode.endActionType === 2) {
        // Notify Agent
        console.log('Notify Agent');
      }
    } else if (nextNode) {
      if (nextNode.mediaUrl) {
        await askQuestionFileW(socket, nextNode, participant, survey);
      } else {
        await askQuestionW(socket, nextNode, participant, survey);
      }
      if (nextNode.questionType === QuestionTypes.MESSAGE) {
        //  We create the combination, save it and call conduct survey again
        const newCombination = new Combination(
          path.id, nextNode.id, null, null,
        );
        await newCombination.save();
        await conductSurveyW(socket, survey, participant);
      }
    } else {
      await Path.findByIdAndUpdate(path.id, { $set: { terminated: true } },
        { useFindAndModify: false });
      //  await client.sendMessage(formatParticipant(participant), survey.endMessage);
      //  await displayResult(path);
    }
  } catch (error) {
    console.log(error);
  }
};

const getNextNode = async (isFirst, survey, combination) => {
  if (isFirst) {
    try {
      const firstNode = await Node.findOne({ survey: survey.id }).sort({ tag: 1 });
      return firstNode;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  try {
    const currentNode = await Node.findById(combination.node);

    switch (currentNode.questionType) {
      case QuestionTypes.MESSAGE:
      case QuestionTypes.TEXTANWSER: {
        try {
          if ([0, 1, 2].includes(currentNode.endActionType)) {
            return {
              endActionType: currentNode.endActionType,
              endActionData: currentNode.endActionData,
              emailData: currentNode.emailData,
              subjectData: currentNode.subjectData,
              contentData: currentNode.contentData,
            };
          }
          const nextNode = await Node.findById(currentNode.nextNode);
          return nextNode;
        } catch (error) {
          console.log(error);
          return false;
        }
      }

      case QuestionTypes.MULTIPLECHOICE: {
        try {
          const answer = await Answer.findById(combination.answer);

          if ([0, 1, 2].includes(answer.endActionType)) {
            return {
              endActionType: answer.endActionType,
              endActionData: answer.endActionData,
              emailData: answer.emailData,
              subjectData: answer.subjectData,
              contentData: answer.contentData,
            };
          }

          const nextNode = await Node.findById(answer.nextNode);
          //  console.log(answer.text, currentNode.question, nextNode.question);
          return nextNode;
        } catch (error) {
          console.log(error);
          return false;
        }
      }

      default: {
        console.log('Invalid Question Type');
        return false;
      }
    }
  } catch (error) {
    console.log(error);
    return false;
  }
};

const askQuestion = async (client, node, participant, survey) => {
  try {
    const formatedQuestion = await formatQuestion(node, participant, survey);

    if (formatedQuestion) {
      await client.messages.create({
        to: `whatsapp:${participant.phoneNumber}`,
        body: formatedQuestion,
        mediaName: node.mediaName,
        mediaUrl: node.mediaUrl,
      });
    }
  } catch (error) {
    console.log(error);
  }
};

const askQuestionFb = async (client, node, participant, survey, senderId, recipient) => {
  try {
    const formatedQuestion = await formatQuestionFb(
      node, participant, survey, senderId, recipient,
    );

    if (formatedQuestion) {
      const buttons = node.buttons.map((b) => ({
        type: b.buttonType,
        title: b.title,
        payload: b.payload,
        url: b.url,
      }));

      await client.messages.createFb({
        to: senderId,
        body: formatedQuestion,
        recipientToken: recipient.accessToken,
        buttons,
      });
    }
  } catch (error) {
    console.log(error);
  }
};

const askQuestionIg = async (client, node, participant, survey, senderId, recipient) => {
  try {
    const formatedQuestion = await formatQuestionIg(
      node, participant, survey, senderId, recipient,
    );

    if (formatedQuestion) {
      const buttons = node.buttons.map((b) => ({
        type: b.buttonType,
        title: b.title,
        payload: b.payload,
        url: b.url,
      }));

      await client.messages.createIg({
        to: senderId,
        body: formatedQuestion,
        recipientToken: recipient.accessToken,
        buttons,
      });
    }
  } catch (error) {
    console.log(error);
  }
};

const askQuestionW = async (socket, node, participant, survey) => {
  try {
    const formatedQuestion = await formatQuestion(node, participant, survey, true);

    const parts = formatedQuestion.split('\n');
    let message = '';
    const buttons = [];

    for (let i = 0; i < parts.length; i += 1) {
      const ns = parts[i].split('-');
      if (ns.length === 1) {
        if (i === 0) {
          message += ns[0];
        } else {
          message += `\n${ns[0]}`;
        }
      } else {
        const n = parseInt(ns[0], 10);
        if (n === 0 || Number.isNaN(n)) {
          message += `\n${ns[0]}`;
        } else {
          buttons.push(
            ns.slice(1).join('-'),
          );
        }
      }
    }

    socket.emit(`bot-message-${participant.participantId}`, { message, buttons });
    Message.create({
      participantId: participant.participantId,
      content: `${message}\n${buttons.map((b) => b.split('-')[1]).join('\n')}`,
      fromMe: true,
    }).then(null);
  } catch (error) {
    console.log(error);
  }
};

const askQuestionFile = async (client, node, participant, survey) => {
  try {
    const formatedQuestion = await formatQuestion(node, participant, survey);

    if (formatedQuestion) {
      await client.messages.create({
        mediaUrl: [node.mediaUrl],
        mediaName: node.mediaName,
        to: `whatsapp:${participant.phoneNumber}`,
        body: formatedQuestion,
      });
    }
  } catch (error) {
    console.log(error);
  }
};

const askQuestionFileFb = async (client, node, participant, survey, senderId, recipient) => {
  console.log(recipient);
  try {
    const formatedQuestion = await formatQuestionFb(
      node, participant, survey, senderId, recipient,
    );

    if (formatedQuestion) {
      const buttons = node.buttons.map((b) => ({
        type: b.buttonType,
        title: b.title,
        payload: b.payload,
        url: b.url,
      }));

      await client.messages.createFb({
        mediaUrl: node.mediaUrl,
        mediaName: node.mediaName,
        mediaMimeType: node.mediaMimeType,
        to: senderId,
        body: formatedQuestion,
        recipientToken: recipient.accessToken,
        buttons,
      });
    }
  } catch (error) {
    console.log(error);
  }
};

const askQuestionFileIg = async (client, node, participant, survey, senderId, recipient) => {
  console.log(recipient);
  try {
    const formatedQuestion = await formatQuestionIg(
      node, participant, survey, senderId, recipient,
    );

    if (formatedQuestion) {
      const buttons = node.buttons.map((b) => ({
        type: b.buttonType,
        title: b.title,
        payload: b.payload,
        url: b.url,
      }));

      await client.messages.createFb({
        mediaUrl: node.mediaUrl,
        mediaName: node.mediaName,
        mediaMimeType: node.mediaMimeType,
        to: senderId,
        body: formatedQuestion,
        recipientToken: recipient.accessToken,
        buttons,
      });
    }
  } catch (error) {
    console.log(error);
  }
};

const askQuestionFileW = async (socket, node, participant, survey) => {
  try {
    const formatedQuestion = await formatQuestion(node, participant, survey, true);

    const parts = formatedQuestion.split('\n');
    let message = '';
    const buttons = [];

    for (let i = 0; i < parts.length; i += 1) {
      const ns = parts[i].split('-');
      if (ns.length === 1) {
        if (i === 0) {
          message += ns[0];
        } else {
          message += `\n${ns[0]}`;
        }
      } else {
        const n = parseInt(ns[0], 10);
        if (n === 0 || Number.isNaN(n)) {
          message += `\n${ns[0]}`;
        } else {
          buttons.push(
            ns.slice(1).join('-'),
          );
        }
      }
    }

    socket.emit(`bot-message-${participant.participantId}`, { message, buttons, file: { name: node.mediaName, url: node.mediaUrl } });
  } catch (error) {
    console.log(error);
  }
};

const formatQuestion = async (node, participant, survey, isWeb = false) => {
  const {
    firstName,
    lastName,
    email,
    phoneNumber,
    participantId,
  } = participant;

  let questionString = node.question;
  if (firstName) questionString = questionString.replace(/@FIRSTNAME/g, firstName);
  if (lastName) questionString = questionString.replace(/@LASTNAME/g, lastName);
  if (email) questionString = questionString.replace(/@EMAIL/g, email);
  if (phoneNumber) questionString = questionString.replace(/@PHONE/g, phoneNumber);

  if (phoneNumber || participantId) {
    const reg = new RegExp(/@[A-Z]{1,}/gm);
    const res = questionString.match(reg);
    console.log(res);
    if (res) {
      const vnodesp = [];
      const vcombs = [];
      for (let i = 0; i < res.length; i += 1) {
        vnodesp.push(
          Node.findOne({ survey: survey.id, variableName: res[i].replace(/@/g, ''), questionType: 1 }),
        );
      }
      vnodesp.push(
        Path.findOne({ participant: participant.id }),
      );

      const vnodes = await Promise.all(vnodesp);
      console.log(vnodes);
      if (vnodes[vnodes.length - 1]) {
        console.log('yes');
        for (let i = 0; i < vnodes.length - 1; i += 1) {
          if (vnodes[i]) {
            console.log('ok node', vnodes[vnodes.length - 1].id, vnodes[i].id);
            vcombs.push(
              Combination.findOne({ path: vnodes[vnodes.length - 1].id, node: vnodes[i].id }),
            );
          } else {
            console.log('nulll');
            vcombs.push(
              null,
            );
          }
        }

        const combs = await Promise.all(vcombs);
        console.log(combs);
        for (let i = 0; i < combs.length; i += 1) {
          if (combs[i]) {
            questionString = questionString.replace(res[i], combs[i].answerText);
          }
        }
      }
    }
  }

  switch (node.questionType) {
    case QuestionTypes.MESSAGE:
    case QuestionTypes.TEXTANWSER: {
      return questionString.concat('\n');
    }
    case QuestionTypes.MULTIPLECHOICE: {
      const answers = await Answer.find({ node: node.id });

      const hasMedia = answers.filter((a) => a.mediaName).length > 0;

      console.log('xxxxxxxxxxxxxxxxxxxxxxhasùedia', hasMedia);

      if (!hasMedia || isWeb) {
        for (let i = 0; i < answers.length; i += 1) {
          questionString += `\n${i + 1} - ${answers[i].text}`;
        }
        return questionString.concat('\n');
      }

      await twilio.messages.create({
        mediaUrl: [node.mediaUrl],
        mediaName: node.mediaName,
        to: `whatsapp:${participant.phoneNumber}`,
        body: questionString,
      });

      console.log('++++++++++++++++++++++++', answers.length, answers);

      await sleep(500);

      for (let i = 0; i < answers.length; i += 1) {
        await twilio.messages.create({
          mediaUrl: [answers[i].mediaUrl],
          mediaName: answers[i].mediaName,
          to: `whatsapp:${participant.phoneNumber}`,
          body: `${i + 1}- ${answers[i].text}`,
        }).then((e) => console.log(e));
        await sleep(200);
      }

      return false;
    }
    default:
      throw new Error('Invalid Question Type');
  }
};

const formatQuestionFb = async (node, participant, survey, senderId, recipient) => {
  console.log('fb here');
  const {
    firstName,
    lastName,
    email,
    phoneNumber,
    participantId,
    pageId,
  } = participant;

  let questionString = node.question;
  if (firstName) questionString = questionString.replace(/@FIRSTNAME/g, firstName);
  if (lastName) questionString = questionString.replace(/@LASTNAME/g, lastName);
  if (email) questionString = questionString.replace(/@EMAIL/g, email);
  if (phoneNumber) questionString = questionString.replace(/@PHONE/g, phoneNumber);

  if (phoneNumber || participantId || pageId) {
    const reg = new RegExp(/@[A-Z]{1,}/gm);
    const res = questionString.match(reg);
    console.log(res);
    if (res) {
      const vnodesp = [];
      const vcombs = [];
      for (let i = 0; i < res.length; i += 1) {
        vnodesp.push(
          Node.findOne({ survey: survey.id, variableName: res[i].replace(/@/g, ''), questionType: 1 }),
        );
      }
      vnodesp.push(
        Path.findOne({ participant: participant.id }),
      );

      const vnodes = await Promise.all(vnodesp);
      console.log(vnodes);
      if (vnodes[vnodes.length - 1]) {
        console.log('yes');
        for (let i = 0; i < vnodes.length - 1; i += 1) {
          if (vnodes[i]) {
            console.log('ok node', vnodes[vnodes.length - 1].id, vnodes[i].id);
            vcombs.push(
              Combination.findOne({ path: vnodes[vnodes.length - 1].id, node: vnodes[i].id }),
            );
          } else {
            console.log('nulll');
            vcombs.push(
              null,
            );
          }
        }

        const combs = await Promise.all(vcombs);
        console.log(combs);
        for (let i = 0; i < combs.length; i += 1) {
          if (combs[i]) {
            questionString = questionString.replace(res[i], combs[i].answerText);
          }
        }
      }
    }
  }

  switch (node.questionType) {
    case QuestionTypes.MESSAGE:
    case QuestionTypes.TEXTANWSER: {
      return questionString.concat('\n');
    }
    case QuestionTypes.MULTIPLECHOICE: {
      const answers = await Answer.find({ node: node.id });

      const hasMedia = answers.filter((a) => a.mediaName).length > 0;

      const quickReplies = [];

      if (!hasMedia || hasMedia) {
        for (let i = 0; i < answers.length && i < MAX_QUICKREPLIES_PER_MESSAGE; i += 1) {
          quickReplies.push({
            content_type: 'text',
            payload: i + 1,
            title: answers[i].text,
          });
        }

        const buttons = node.buttons.map((b) => ({
          type: b.buttonType,
          title: b.title,
          payload: b.payload,
          url: b.url,
        }));

        console.log({ buttons });

        await twilio.messages.createFb({
          to: senderId,
          body: questionString,
          recipientToken: recipient.accessToken,
          quickReplies,
          mediaUrl: node.mediaUrl,
          mediaName: node.mediaName,
          mediaMimeType: node.mediaMimeType,
          buttons,
        });

        return false;
      }
      break;
    }
    default:
      throw new Error('Invalid Question Type');
  }
};

const formatQuestionIg = async (node, participant, survey, senderId, recipient) => {
  console.log('fb here');
  const {
    firstName,
    lastName,
    email,
    phoneNumber,
    accountId,
  } = participant;

  let questionString = node.question;
  if (firstName) questionString = questionString.replace(/@FIRSTNAME/g, firstName);
  if (lastName) questionString = questionString.replace(/@LASTNAME/g, lastName);
  if (email) questionString = questionString.replace(/@EMAIL/g, email);
  if (phoneNumber) questionString = questionString.replace(/@PHONE/g, phoneNumber);

  if (phoneNumber || accountId) {
    const reg = new RegExp(/@[A-Z]{1,}/gm);
    const res = questionString.match(reg);
    console.log(res);
    if (res) {
      const vnodesp = [];
      const vcombs = [];
      for (let i = 0; i < res.length; i += 1) {
        vnodesp.push(
          Node.findOne({ survey: survey.id, variableName: res[i].replace(/@/g, ''), questionType: 1 }),
        );
      }
      vnodesp.push(
        Path.findOne({ participant: participant.id }),
      );

      const vnodes = await Promise.all(vnodesp);
      console.log(vnodes);
      if (vnodes[vnodes.length - 1]) {
        console.log('yes');
        for (let i = 0; i < vnodes.length - 1; i += 1) {
          if (vnodes[i]) {
            console.log('ok node', vnodes[vnodes.length - 1].id, vnodes[i].id);
            vcombs.push(
              Combination.findOne({ path: vnodes[vnodes.length - 1].id, node: vnodes[i].id }),
            );
          } else {
            console.log('nulll');
            vcombs.push(
              null,
            );
          }
        }

        const combs = await Promise.all(vcombs);
        console.log(combs);
        for (let i = 0; i < combs.length; i += 1) {
          if (combs[i]) {
            questionString = questionString.replace(res[i], combs[i].answerText);
          }
        }
      }
    }
  }

  switch (node.questionType) {
    case QuestionTypes.MESSAGE:
    case QuestionTypes.TEXTANWSER: {
      return questionString.concat('\n');
    }
    case QuestionTypes.MULTIPLECHOICE: {
      const answers = await Answer.find({ node: node.id });

      const hasMedia = answers.filter((a) => a.mediaName).length > 0;

      const quickReplies = [];

      if (!hasMedia || hasMedia) {
        for (let i = 0; i < answers.length && i < MAX_QUICKREPLIES_PER_MESSAGE; i += 1) {
          quickReplies.push({
            content_type: 'text',
            payload: i + 1,
            title: answers[i].text,
          });
        }

        const buttons = node.buttons.map((b) => ({
          type: b.buttonType,
          title: b.title,
          payload: b.payload,
          url: b.url,
        }));

        console.log({ buttons });

        await twilio.messages.createFb({
          to: senderId,
          body: questionString,
          recipientToken: recipient.accessToken,
          quickReplies,
          mediaUrl: node.mediaUrl,
          mediaName: node.mediaName,
          mediaMimeType: node.mediaMimeType,
          buttons,
        });

        return false;
      }
      break;
    }
    default:
      throw new Error('Invalid Question Type');
  }
};

const processMessages = async (message) => {
  const client = twilio;
  try {
    if (!message.Body || message.Body === '') return;
    console.log('user sent a message');

    const survey = await Survey.findOne({ terminated: false, ready: true });
    if (!survey) return;

    console.log('found survey');

    const online = await this.canContinue(survey);

    if (!online) {
      await client.messages.create({
        to: message.From,
        body: survey.offlineMessage,
      });
      return;
    }

    const participant = await Participant.findOne({ survey: survey.id, phoneNumber: `+${message.WaId}` });
    if (!participant) return;

    console.log('found participant');

    const path = await Path.findOne({
      survey: survey.id,
      participant: participant.id,
      terminated: false,
      optinState: { $ne: OptinStates.NO },
    });
    if (!path) return;

    console.log('found path');

    const combination = await Combination
      .findOne({ path: path.id }).sort({ createdAt: -1 }).exec();

    if (!combination && survey.optIn && path.optinState === OptinStates.PENDING) {
      console.log('pending path');
      const answer = parseInt(message.Body, 10);
      console.log(answer);
      if (Number.isNaN(answer)) {
        await client.messages.create({
          to: message.From,
          body: 'Invalid Answer.',
        });
        return;
      }
      if (answer === 1) {
        await Path.findByIdAndUpdate(path.id, { $set: { optinState: OptinStates.YES } },
          { useFindAndModify: false });
        await conductSurvey(client, survey, participant);
        return;
        //  await Path.findByIdAndUpdate(path.id, { $set: { optinState: OptinStates.YES } });
      } if (answer === 2) {
        await Path.findByIdAndUpdate(path.id, { $set: { optinState: OptinStates.NO } },
          { useFindAndModify: false });
        //  await message.reply('It\'s understood!');
        return;
      }
      await client.messages.create({
        to: message.From,
        body: 'Invalid Answer.',
      });
      return;
    }

    const currentNode = await getNextNode(!combination, survey, combination);

    if (!currentNode) return;

    console.log('found current node');

    let userAnswer = message.Body;

    if (currentNode.endActionType != null) {
      if (currentNode.endActionType === 0) {
        // Send Message
        console.log('Send Message');
        await twilio.messages.create({
          to: `whatsapp:${participant.phoneNumber}`,
          body: currentNode.endActionData,
        });
      } else if (currentNode.endActionType === 1) {
        // Send Email
        console.log('Send Email', currentNode);
        sendEmail(
          currentNode.emailData,
          currentNode.subjectData,
          currentNode.contentData,
        ).then(null);
      } else if (currentNode.endActionType === 2) {
        // Notify Agent
        console.log('Notify Agent');
      }
    } else if (currentNode.questionType === QuestionTypes.MULTIPLECHOICE) {
      userAnswer = parseInt(userAnswer, 10) - 1;
      if (Number.isNaN(userAnswer)) {
        await client.messages.create({
          to: message.From,
          body: 'Invalid Answer.',
        });
        return;
      }
      const answers = await Answer.find({ node: currentNode.id }).sort({ createdAt: 1 }).exec();
      if (userAnswer < 0 || userAnswer >= answers.length) {
        await client.messages.create({
          to: message.From,
          body: 'Invalid Answer.',
        });
        return;
      }
      const newCombination = new Combination(
        path.id, currentNode.id, answers[userAnswer].id,
      );

      await newCombination.save();
      await conductSurvey(client, survey, participant);
    } else if (currentNode.questionType === QuestionTypes.TEXTANWSER) {
      const newCombination = new Combination(
        path.id, currentNode.id, null, userAnswer,
      );

      await newCombination.save();
      await conductSurvey(client, survey, participant);
    }
    // else if (currentNode.questionType === QuestionTypes.MESSAGE) {
    //   await conductSurvey(client, survey, originalParticipant(message.from));
    // }
  } catch (error) {
    console.log(error);
  }
};

const processMessagesW = async (botId, participantId, message, socket) => {
  const client = twilio;
  try {
    if (!message || message === '') return;
    console.log('user sent a message');

    const survey = await Survey.findById(botId);
    if (!survey) return;

    console.log('found survey');

    // const online = await this.canContinue(survey);

    // if (!online) {
    //   await client.messages.create({
    //     to: message.From,
    //     body: survey.offlineMessage,
    //   });
    //   return;
    // }

    const participant = await Participant.findOne({ survey: survey.id, participantId });
    if (!participant) return;

    console.log('found participant');

    const path = await Path.findOne({
      survey: survey.id,
      participant: participant.id,
      terminated: false,
      optinState: { $ne: OptinStates.NO },
    });
    if (!path) return;

    console.log('found path');

    const combination = await Combination
      .findOne({ path: path.id }).sort({ createdAt: -1 }).exec();

    // Should never occur (website chatbot)
    if (!combination && survey.optIn && path.optinState === OptinStates.PENDING) {
      console.log('pending path');
      const answer = parseInt(message.Body, 10);
      console.log(answer);
      if (Number.isNaN(answer)) {
        await client.messages.create({
          to: message.From,
          body: 'Invalid Answer.',
        });
        return;
      }
      if (answer === 1) {
        await Path.findByIdAndUpdate(path.id, { $set: { optinState: OptinStates.YES } },
          { useFindAndModify: false });
        await conductSurvey(client, survey, participant);
        return;
        //  await Path.findByIdAndUpdate(path.id, { $set: { optinState: OptinStates.YES } });
      } if (answer === 2) {
        await Path.findByIdAndUpdate(path.id, { $set: { optinState: OptinStates.NO } },
          { useFindAndModify: false });
        //  await message.reply('It\'s understood!');
        return;
      }
      await client.messages.create({
        to: message.From,
        body: 'Invalid Answer.',
      });
      return;
    }

    const currentNode = await getNextNode(!combination, survey, combination);

    if (!currentNode) return;

    console.log('found current node');

    let userAnswer = message;

    if (currentNode.endActionType != null) {
      if (currentNode.endActionType === 0) {
        // Send Message
        console.log('Send Message');
        socket.emit(`bot-message-${participant.participantId}`, { message: currentNode.endActionData });
      } else if (currentNode.endActionType === 1) {
        // Send Email
        console.log('Send Email', currentNode);
        sendEmail(
          currentNode.emailData,
          currentNode.subjectData,
          currentNode.contentData,
        ).then(null);
      } else if (currentNode.endActionType === 2) {
        // Notify Agent
        console.log('Notify Agent');
      }
    } else if (currentNode.questionType === QuestionTypes.MULTIPLECHOICE) {
      userAnswer = parseInt(userAnswer, 10) - 1;
      if (Number.isNaN(userAnswer)) {
        socket.emit(`bot-message-${participant.participantId}`, { message: 'Invalid Answer.' });
        return;
      }
      const answers = await Answer.find({ node: currentNode.id }).sort({ createdAt: 1 }).exec();
      if (userAnswer < 0 || userAnswer >= answers.length) {
        socket.emit(`bot-message-${participant.participantId}`, { message: 'Invalid Answer.' });
        return;
      }
      const newCombination = new Combination(
        path.id, currentNode.id, answers[userAnswer].id,
      );

      await newCombination.save();
      await conductSurveyW(socket, survey, participant);
    } else if (currentNode.questionType === QuestionTypes.TEXTANWSER) {
      const newCombination = new Combination(
        path.id, currentNode.id, null, userAnswer,
      );

      await newCombination.save();
      await conductSurveyW(socket, survey, participant);
    }
    // else if (currentNode.questionType === QuestionTypes.MESSAGE) {
    //   await conductSurvey(client, survey, originalParticipant(message.from));
    // }
  } catch (error) {
    console.log(error);
  }
};

// Emulation

const askQuestionE = async (socket, node, clientId, isFile) => {
  try {
    const formatedQuestion = isFile ? `File ${node.mediaName} sent` : await formatQuestion(node, {});
    socket.emit(`${clientId}.message`, formatedQuestion);
  } catch (error) {
    console.log(error);
  }
};

const getNextNodeE = async (isFirst, survey, epath) => {
  if (isFirst) {
    try {
      const firstNode = await Node.findOne({ survey: survey.id }).sort({ tag: 1 });
      return firstNode;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  try {
    const currentNode = await Node.findById(epath.currentNode);

    switch (currentNode.questionType) {
      case QuestionTypes.MESSAGE:
      case QuestionTypes.TEXTANWSER: {
        try {
          if ([0, 1, 2].includes(currentNode.endActionType)) {
            return {
              endActionType: currentNode.endActionType,
              endActionData: currentNode.endActionData,
            };
          }
          const nextNode = await Node.findById(currentNode.nextNode);
          return nextNode;
        } catch (error) {
          console.log(error);
          return false;
        }
      }

      case QuestionTypes.MULTIPLECHOICE: {
        try {
          const answer = await Answer.findById(epath.answer);

          if ([0, 1, 2].includes(answer.endActionType)) {
            return {
              endActionType: answer.endActionType,
              endActionData: answer.endActionData,
            };
          }

          const nextNode = await Node.findById(answer.nextNode);
          //  console.log(answer.text, currentNode.question, nextNode.question);
          return nextNode;
        } catch (error) {
          console.log(error);
          return false;
        }
      }

      default: {
        console.log('Invalid Question Type');
        return false;
      }
    }
  } catch (error) {
    console.log(error);
    return false;
  }
};

const conductSurveyE = async (socket, survey, clientId) => {
  // Get the participant path and continue from there
  try {
    if (typeof survey === 'string') {
      survey = await Survey.findById(survey);
    }

    let firstTime = false;
    let epath = await EPath.findOne({ clientId, survey: survey.id });
    if (!epath) {
      epath = new EPath(clientId, survey.id);
      epath = await epath.save();
      firstTime = true;
    }

    const nextNode = await getNextNodeE(
      firstTime || epath.currentNode === null, survey, epath,
    );

    console.log('next', nextNode);

    if (nextNode && nextNode.endActionType != null) {
      if (nextNode.endActionType === 0) {
        // Send Message
        console.log('Send End Message');
        socket.emit(`${clientId}.message`, nextNode.endActionData);
      } else if (nextNode.endActionType === 1) {
        // Send Email
        console.log('Send Email');
        socket.emit(`${clientId}.message`, `Email sent to ${nextNode.endActionData}`);
      } else if (nextNode.endActionType === 2) {
        // Notify Agent
        console.log('Notify Agent');
        socket.emit(`${clientId}.message`, `Agent ${nextNode.endActionData} notified`);
      }
    } else if (nextNode) {
      if (nextNode.mediaName) {
        await askQuestionE(socket, nextNode, clientId, true);
      }
      await askQuestionE(socket, nextNode, clientId, false);
      if (firstTime) {
        socket.on(`${clientId}.message`, (data) => {
          console.log('message from client');
          processMessagesE(data, clientId, socket, survey.id);
        });
      }
      if (nextNode.questionType === QuestionTypes.MESSAGE) {
        //  We create the combination, save it and call conduct survey again
        await EPath.findByIdAndUpdate(epath.id, { $set: { currentNode: nextNode.id } },
          { useFindAndModify: false });

        await conductSurveyE(socket, survey, clientId);
      }
    } else {
      await EPath.findByIdAndDelete(epath.id);
    }
  } catch (error) {
    console.log(error);
  }
};

const processMessagesE = async (message, clientId, socket, surveyId) => {
  try {
    if (!message || message === '') return;

    const survey = await Survey.findById(surveyId);
    if (!survey) return;

    const epath = await EPath.findOne({
      survey: survey.id,
      clientId,
      terminated: false,
    });
    if (!epath) return;

    const currentNode = await getNextNodeE(
      epath.currentNode === null, survey, epath,
    );

    console.log('cur', currentNode);

    if (!currentNode) return;

    let userAnswer = message;
    if (currentNode && currentNode.endActionType != null) {
      if (currentNode.endActionType === 0) {
        // Send Message
        console.log('Send End Message');
        socket.emit(`${clientId}.message`, currentNode.endActionData);
      } else if (currentNode.endActionType === 1) {
        // Send Email
        console.log('Send Email');
        socket.emit(`${clientId}.message`, `Email sent to ${currentNode.endActionData}`);
      } else if (currentNode.endActionType === 2) {
        // Notify Agent
        console.log('Notify Agent');
        socket.emit(`${clientId}.message`, `Agent ${currentNode.endActionData} notified`);
      }
    } else if (currentNode.questionType === QuestionTypes.MULTIPLECHOICE) {
      userAnswer = parseInt(userAnswer, 10) - 1;
      if (Number.isNaN(userAnswer)) {
        socket.emit(`${clientId}.message`, 'Invalid Answer');
        return;
      }
      const answers = await Answer.find({ node: currentNode.id }).sort({ createdAt: 1 }).exec();
      if (userAnswer < 0 || userAnswer >= answers.length) {
        socket.emit(`${clientId}.message`, 'Invalid Answer');
        return;
      }

      await EPath.findByIdAndUpdate(epath.id,
        { $set: { currentNode: currentNode.id, answer: answers[userAnswer].id } },
        { useFindAndModify: false });

      await conductSurveyE(socket, survey, clientId);
    } else if (currentNode.questionType === QuestionTypes.TEXTANWSER) {
      await EPath.findByIdAndUpdate(epath.id,
        { $set: { currentNode: currentNode.id, answerText: userAnswer } },
        { useFindAndModify: false });

      await conductSurveyE(socket, survey, clientId);
    }
    // else if (currentNode.questionType === QuestionTypes.MESSAGE) {
    //   await conductSurvey(client, survey, originalParticipant(message.from));
    // }
  } catch (error) {
    console.log(error);
  }
};

const updateSurveys = async () => {
  try {
    const surveys = await Survey.find({ terminated: false, ready: true, type: 'broadcast' });

    for (let i = 0; i < surveys.length; i += 1) {
      try {
        const paths = await Path.find({ survey: surveys[i].id });
        const participants = (
          await Participant.find({ survey: surveys[i].id })).map((px) => px.id.toString());

        if (paths.length === 0 && participants.length !== 0) {
          // eslint-disable-next-line no-continue
          continue;
        }

        if (
          paths.filter((p) => participants.includes(p.participant.toString())).length
          === paths.filter((p) => participants.includes(p.participant.toString()))
            .filter((p) => p.terminated).length
        ) {
          await Survey.findByIdAndUpdate(
            surveys[i].id, { $set: { terminated: true } }, { useFindAndModify: false },
          );
        }
      } catch (error) {
        console.log(error);
      }
    }
  } catch (error) {
    console.log(error);
  }

  await updateSurveys();
};

const sendEmail = async (receiver, subject, content) => {
  // console.log(message);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTPHOST,
    port: process.env.SMTPPORT,
    secure: false,
    auth: {
      user: process.env.SMTPUSERNAME,
      pass: process.env.SMTPPASSWORD,
    },
  });

  transporter.use('compile', inlineCss());

  transporter.sendMail({
    from: `'PollWA' <${process.env.SMTPUSERNAME}>`,
    to: receiver,
    subject,
    html: content,
  }).then(() => console.log(`..Email sent to ${receiver}`));
};

const launcher = async () => {
  Survey.find({
    ready: false,
    terminated: false,
    scheduled: true,
    scheduledTime: { $lte: new Date() },
  })
    .then((sx) => {
      console.log(sx.length);
      for (let i = 0; i < sx.length; i += 1) {
        Survey.findOne({ ready: true, terminated: false, type: { $in: ['broadcast', 'trigger'] } })
          .then((doc) => {
            if (!doc) {
              Survey.findByIdAndUpdate(
                sx[i].id,
                { $set: { ready: true } },
                { new: true, useFindAndModify: false },
              )
                .then((docr) => {
                  runSurvey(docr).then(null);
                })
                .catch((e) => {
                  console.log(e);
                });
            }
          })
          .catch((e) => {
            console.log(e);
          });
      }
    })
    .catch((e) => {
      console.log(e);
    });

  //  await launcher();
};

const canContinue = async (survey) => new Promise((resolve, _reject) => {
  if (!survey.offline) resolve(true);
  if (survey.offlineType === 'none') resolve(true);
  if (survey.offlineType === 'hours') {
    const start = survey.offlineFrom.split(':')[0] * 60 + +survey.offlineFrom.split(':')[1];
    const end = survey.offlineTo.split(':')[0] * 60 + +survey.offlineTo.split(':')[1];
    const date = new Date();
    const now = date.getHours() * 60 + date.getMinutes();
    if (start <= now && now <= end) {
      resolve(false);
    } else {
      resolve(true);
    }
  }
  if (survey.offlineType === 'dates') {
    const start = new Date(survey.offlineFrom).getTime();
    const end = new Date(survey.offlineTo).getTime();
    const now = new Date().getTime();
    if (start <= now && now <= end) {
      resolve(false);
    } else {
      resolve(true);
    }
  }
  resolve(true);
});

const processMessagesFb = async (message) => {
  const client = twilio;
  try {
    if (!message.text
      || !message.senderId
      || !message.recipient || !message.recipient.pageId || !message.recipient.accessToken) return;
    console.log('user sent a message', message);

    const survey = await Survey.findOne({
      terminated: false,
      ready: true,
      type: 'facebook',
      facebookPageId: message.recipient.pageId,
    });

    console.log(survey);

    if (!survey) return;

    console.log('found survey');

    const online = await this.canContinue(survey);

    if (!online) {
      await client.messages.createFb({
        to: message.senderId,
        recipientToken: message.recipient.accessToken,
        body: survey.offlineMessage,
      });
      return;
    }

    const participant = await Participant
      .findOne({ survey: survey.id, pageId: message.recipient.pageId });
    if (!participant) {
      const newParticipant = await Participant.create({
        survey: survey.id,
        pageId: message.recipient.pageId,
        type: 'facebook',
      });
      conductSurveyFb(client, survey, newParticipant, message.senderId, message.recipient);
      return;
    }

    console.log('found participant');

    const path = await Path.findOne({
      survey: survey.id,
      participant: participant.id,
      terminated: false,
      optinState: { $ne: OptinStates.NO },
    });
    if (!path) return;

    console.log('found path');

    const combination = await Combination.findOne({ path: path.id }).sort({ createdAt: -1 }).exec();

    if (!combination && survey.optIn && path.optinState === OptinStates.PENDING) {
      console.log('pending path');
      const answer = parseInt(message.text, 10);
      console.log(answer);
      if (Number.isNaN(answer)) {
        await client.messages.createFb({
          to: message.senderId,
          recipientToken: message.recipient.accessToken,
          body: 'Invalid Answer.',
        });
        return;
      }
      if (answer === 1) {
        await Path.findByIdAndUpdate(path.id, { $set: { optinState: OptinStates.YES } },
          { useFindAndModify: false });
        await conductSurveyFb(client, survey, participant, message.senderId, message.recipient);
        return;
        //  await Path.findByIdAndUpdate(path.id, { $set: { optinState: OptinStates.YES } });
      } if (answer === 2) {
        await Path.findByIdAndUpdate(path.id, { $set: { optinState: OptinStates.NO } },
          { useFindAndModify: false });
        //  await message.reply('It\'s understood!');
        return;
      }
      await client.messages.createFb({
        to: message.senderId,
        recipientToken: message.recipient.accessToken,
        body: 'Invalid Answer.',
      });
      return;
    }

    const currentNode = await getNextNode(!combination, survey, combination);

    if (!currentNode) return;

    console.log('found current node');

    let userAnswer = message.text;

    if (currentNode.endActionType != null) {
      if (currentNode.endActionType === 0) {
        // Send Message
        console.log('Send Message');
        await twilio.messages.createFb({
          to: message.senderId,
          recipientToken: message.recipient.accessToken,
          body: currentNode.endActionData,
        });
      } else if (currentNode.endActionType === 1) {
        // Send Email
        console.log('Send Email', currentNode);
        sendEmail(
          currentNode.emailData,
          currentNode.subjectData,
          currentNode.contentData,
        ).then(null);
      } else if (currentNode.endActionType === 2) {
        // Notify Agent
        console.log('Notify Agent');
      }
    } else if (currentNode.questionType === QuestionTypes.MULTIPLECHOICE) {
      userAnswer = parseInt(userAnswer, 10) - 1;
      if (Number.isNaN(userAnswer)) {
        await client.messages.createFb({
          to: message.senderId,
          recipientToken: message.recipient.accessToken,
          body: 'Invalid Answer.',
        });
        return;
      }
      const answers = await Answer.find({ node: currentNode.id }).sort({ createdAt: 1 }).exec();
      if (userAnswer < 0 || userAnswer >= answers.length) {
        await client.messages.createFb({
          to: message.senderId,
          recipientToken: message.recipient.accessToken,
          body: 'Invalid Answer.',
        });
        return;
      }
      const newCombination = new Combination(
        path.id, currentNode.id, answers[userAnswer].id,
      );

      await newCombination.save();
      await conductSurveyFb(client, survey, participant, message.senderId, message.recipient);
    } else if (currentNode.questionType === QuestionTypes.TEXTANWSER) {
      const newCombination = new Combination(
        path.id, currentNode.id, null, userAnswer,
      );

      await newCombination.save();
      await conductSurveyFb(client, survey, participant, message.senderId, message.recipient);
    }
    // else if (currentNode.questionType === QuestionTypes.MESSAGE) {
    //   await conductSurvey(client, survey, originalParticipant(message.from));
    // }
  } catch (error) {
    console.log(error);
  }
};

const conductSurveyFb = async (client, survey, participant, senderId, recipient) => {
  // Get the participant path and continue from there
  console.log(survey.id, participant, recipient, 'hoho');
  try {
    let firstTime = false;
    let path = await Path.findOne({
      participant: participant.id,
      survey: survey.id,
      terminated: false,
      optinState: { $ne: OptinStates.NO },
    });
    if (!path) {
      path = new Path(participant.id, survey.id);
      path = await path.save();
      firstTime = true;
    }
    const combination = firstTime
      ? [] : await Combination.findOne({ path: path.id }).sort({ createdAt: -1 }).exec();

    console.log('comb taken', firstTime, combination);

    // Send Option message
    if (firstTime && survey.optIn && path.optinState === OptinStates.PENDING) {
      const question = survey.optinQuestion;
      await twilio.messages.createFb({
        to: senderId,
        body: question,
        recipientToken: recipient.accessToken,
        quickReplies: [
          {
            content_type: 'text',
            payload: 1,
            title: survey.optinYesText,
          },
          {
            content_type: 'text',
            payload: 2,
            title: survey.optinNoText,
          },
        ],
      });
      return;
    }

    const nextNode = await getNextNode(
      firstTime || !combination, survey, combination,
    );

    console.log('next node found', nextNode);

    if (nextNode && nextNode.endActionType != null) {
      if (nextNode.endActionType === 0) {
        // Send Message
        console.log('Send End Message');
        await twilio.messages.createFb({
          to: senderId,
          body: nextNode.endActionData,
          recipientToken: recipient.accessToken,
        });
      } else if (nextNode.endActionType === 1) {
        // Send Email
        console.log('Send Email', nextNode);
        sendEmail(nextNode.emailData, nextNode.subjectData, nextNode.contentData).then(null);
      } else if (nextNode.endActionType === 2) {
        // Notify Agent
        console.log('Notify Agent');
      }
    } else if (nextNode) {
      if (nextNode.mediaUrl) {
        await askQuestionFileFb(client, nextNode, participant, survey, senderId, recipient);
      } else {
        await askQuestionFb(client, nextNode, participant, survey, senderId, recipient);
      }
      if (nextNode.questionType === QuestionTypes.MESSAGE) {
        //  We create the combination, save it and call conduct survey again
        const newCombination = new Combination(
          path.id, nextNode.id, null, null,
        );
        await newCombination.save();
        await conductSurveyFb(client, survey, participant, senderId, recipient);
      }
    } else {
      await Path.findByIdAndUpdate(path.id, { $set: { terminated: true } },
        { useFindAndModify: false });
      //  await client.sendMessage(formatParticipant(participant), survey.endMessage);
      //  await displayResult(path);
    }
  } catch (error) {
    console.log(error);
  }
};

const conductSurveyW2 = async (client, room, surveyId, message, ref) => {
  // Get the participant path and continue from there
  const survey = await Survey.findById(surveyId);
  if (!survey || message.userId === botUserId) return;

  let participant = await Participant.findOne({ room, participantId: message.userId });

  if (!participant) {
    participant = await Participant.create({
      type: 'website',
      participantId: message.userId,
      room,
      survey: survey.id,
      ref,
    });
  }

  try {
    let firstTime = false;
    let path = await Path.findOne({
      participant: participant.id,
      survey: survey.id,
      terminated: false,
      optinState: { $ne: OptinStates.NO },
    });
    if (!path) {
      path = new Path(participant.id, survey.id);
      path = await path.save();
      firstTime = true;
    }
    const combination = firstTime
      ? [] : await Combination.findOne({ path: path.id }).sort({ createdAt: -1 }).exec();

    // Send Option message (Should never occur (website chatbot))
    if (firstTime && survey.optIn && path.optinState === OptinStates.PENDING) {
      let question = survey.optinQuestion;
      question += `\n 1 - ${survey.optinYesText} \n 2 - ${survey.optinNoText}`;
      await twilio.messages.createW({
        to: message.userId,
        body: question,
        name: message.name,
        room,
        ref,
      });
      return;
    }

    const nextNode = await getNextNode(
      firstTime || !combination, survey, combination,
    );

    if (nextNode && nextNode.endActionType != null) {
      if (nextNode.endActionType === 0) {
        // Send Message
        console.log('Send End Message');
        await twilio.messages.createW({
          to: message.userId,
          body: nextNode.endActionData,
          name: message.name,
          room,
          ref,
        });
      } else if (nextNode.endActionType === 1) {
        // Send Email
        console.log('Send Email', nextNode);
        sendEmail(nextNode.emailData, nextNode.subjectData, nextNode.contentData).then(null);
      } else if (nextNode.endActionType === 2) {
        // Notify Agent
        console.log('Notify Agent');
      }
    } else if (nextNode) {
      if (nextNode.mediaUrl) {
        await askQuestionFileW2(client, nextNode, participant, survey, room, message, ref);
      } else {
        await askQuestionW2(client, nextNode, participant, survey, room, message, ref);
      }
      if (nextNode.questionType === QuestionTypes.MESSAGE) {
        //  We create the combination, save it and call conduct survey again
        const newCombination = new Combination(
          path.id, nextNode.id, null, null,
        );
        await newCombination.save();
        await conductSurveyW2(client, room, surveyId, message, ref);
      }
    } else {
      await Path.findByIdAndUpdate(path.id, { $set: { terminated: true } },
        { useFindAndModify: false });
      //  await client.sendMessage(formatParticipant(participant), survey.endMessage);
      //  await displayResult(path);
    }
  } catch (error) {
    console.log(error);
  }
};

const askQuestionW2 = async (client, node, participant, survey, room, message, ref) => {
  try {
    const formatedQuestion = await formatQuestionW2(
      node, participant, survey, room, message, ref,
    );

    if (formatedQuestion) {
      // const buttons = node.buttons.map((b) => ({
      //   type: b.buttonType,
      //   title: b.title,
      //   payload: b.payload,
      // }));

      await client.messages.createW({
        to: message.userId,
        body: formatedQuestion,
        name: message.name,
        room,
        ref,
      });
    }
  } catch (error) {
    console.log(error);
  }
};

const askQuestionFileW2 = async (client, node, participant, survey, room, message, ref) => {
  try {
    const formatedQuestion = await formatQuestionW2(
      node, participant, survey, room, message, ref,
    );

    if (formatedQuestion) {
      // const buttons = node.buttons.map((b) => ({
      //   type: b.buttonType,
      //   title: b.title,
      //   payload: b.payload,
      // }));

      await client.messages.createW({
        to: message.userId,
        body: formatedQuestion,
        name: message.name,
        room,
        ref,
        mediaUrl: node.mediaUrl,
        mediaName: node.mediaName,
        mediaMimeType: node.mediaMimeType,
      });
    }
  } catch (error) {
    console.log(error);
  }
};

const formatQuestionW2 = async (node, participant, survey, _room, _message) => {
  const {
    firstName,
    lastName,
    email,
    phoneNumber,
    participantId,
  } = participant;

  let questionString = node.question;
  if (firstName) questionString = questionString.replace(/@FIRSTNAME/g, firstName);
  if (lastName) questionString = questionString.replace(/@LASTNAME/g, lastName);
  if (email) questionString = questionString.replace(/@EMAIL/g, email);
  if (phoneNumber) questionString = questionString.replace(/@PHONE/g, phoneNumber);

  if (phoneNumber || participantId) {
    const reg = new RegExp(/@[A-Z]{1,}/gm);
    const res = questionString.match(reg);
    console.log(res);
    if (res) {
      const vnodesp = [];
      const vcombs = [];
      for (let i = 0; i < res.length; i += 1) {
        vnodesp.push(
          Node.findOne({ survey: survey.id, variableName: res[i].replace(/@/g, ''), questionType: 1 }),
        );
      }
      vnodesp.push(
        Path.findOne({ participant: participant.id }),
      );

      const vnodes = await Promise.all(vnodesp);
      console.log(vnodes);
      if (vnodes[vnodes.length - 1]) {
        console.log('yes');
        for (let i = 0; i < vnodes.length - 1; i += 1) {
          if (vnodes[i]) {
            console.log('ok node', vnodes[vnodes.length - 1].id, vnodes[i].id);
            vcombs.push(
              Combination.findOne({ path: vnodes[vnodes.length - 1].id, node: vnodes[i].id }),
            );
          } else {
            console.log('nulll');
            vcombs.push(
              null,
            );
          }
        }

        const combs = await Promise.all(vcombs);
        console.log(combs);
        for (let i = 0; i < combs.length; i += 1) {
          if (combs[i]) {
            questionString = questionString.replace(res[i], combs[i].answerText);
          }
        }
      }
    }
  }

  switch (node.questionType) {
    case QuestionTypes.MESSAGE:
    case QuestionTypes.TEXTANWSER: {
      return questionString.concat('\n');
    }
    case QuestionTypes.MULTIPLECHOICE: {
      const answers = await Answer.find({ node: node.id });

      const hasMedia = answers.filter((a) => a.mediaName).length > 0;

      console.log('xxxxxxxxxxxxxxxxxxxxxxhasùedia', hasMedia);

      if (!hasMedia || hasMedia) {
        for (let i = 0; i < answers.length; i += 1) {
          questionString += `\n${i + 1} - ${answers[i].text}`;
        }
        return questionString.concat('\n');
      }

      return false;
    }
    default:
      throw new Error('Invalid Question Type');
  }
};

const processMessagesW2 = async (client, room, surveyId, message, ref) => {
  try {
    if (!message.message || message.message === '' || !room || room === '' || message.userId === botUserId) return;
    console.log('user sent a message', message);

    const survey = await Survey.findById(surveyId);
    if (!survey) return;

    console.log('found survey');

    const online = await this.canContinue(survey);

    if (!online) {
      await client.messages.createW({
        to: message.userId,
        body: survey.offlineMessage,
        name: message.name,
        room,
        ref,
      });
      return;
    }

    const participant = await Participant.findOne({
      survey: survey.id, participantId: message.userId,
    });
    if (!participant) return;

    console.log('found participant');

    const path = await Path.findOne({
      survey: survey.id,
      participant: participant.id,
      terminated: false,
      optinState: { $ne: OptinStates.NO },
    });
    if (!path) return;

    console.log('found path');

    const combination = await Combination
      .findOne({ path: path.id }).sort({ createdAt: -1 }).exec();

    // Should never occur (website chatbot)
    if (!combination && survey.optIn && path.optinState === OptinStates.PENDING) {
      console.log('pending path');
      const answer = parseInt(message.message, 10);
      console.log(answer);
      if (Number.isNaN(answer)) {
        await client.messages.createW({
          to: message.userId,
          body: 'Invalid Answer.',
          name: message.name,
          room,
          ref,
        });
        return;
      }
      if (answer === 1) {
        await Path.findByIdAndUpdate(path.id, { $set: { optinState: OptinStates.YES } },
          { useFindAndModify: false });
        await conductSurveyW2(client, room, surveyId, message, ref);
        return;
        //  await Path.findByIdAndUpdate(path.id, { $set: { optinState: OptinStates.YES } });
      } if (answer === 2) {
        await Path.findByIdAndUpdate(path.id, { $set: { optinState: OptinStates.NO } },
          { useFindAndModify: false });
        //  await message.reply('It\'s understood!');
        return;
      }
      await client.messages.createW({
        to: message.userId,
        body: 'Invalid Answer.',
        name: message.name,
        room,
        ref,
      });
      return;
    }

    const currentNode = await getNextNode(!combination, survey, combination);

    if (!currentNode) return;

    console.log('found current node');

    let userAnswer = message.message;

    if (currentNode.endActionType != null) {
      if (currentNode.endActionType === 0) {
        // Send Message
        console.log('Send Message');
        await client.messages.createW({
          to: message.userId,
          body: currentNode.endActionData,
          name: message.name,
          room,
          ref,
        });
      } else if (currentNode.endActionType === 1) {
        // Send Email
        console.log('Send Email', currentNode);
        sendEmail(
          currentNode.emailData,
          currentNode.subjectData,
          currentNode.contentData,
        ).then(null);
      } else if (currentNode.endActionType === 2) {
        // Notify Agent
        console.log('Notify Agent');
      }
    } else if (currentNode.questionType === QuestionTypes.MULTIPLECHOICE) {
      userAnswer = parseInt(userAnswer, 10) - 1;
      if (Number.isNaN(userAnswer)) {
        await client.messages.createW({
          to: message.userId,
          body: 'Invalid Answer.',
          name: message.name,
          room,
          ref,
        });
        return;
      }
      const answers = await Answer.find({ node: currentNode.id }).sort({ createdAt: 1 }).exec();
      if (userAnswer < 0 || userAnswer >= answers.length) {
        await client.messages.createW({
          to: message.userId,
          body: 'Invalid Answer.',
          name: message.name,
          room,
          ref,
        });
        return;
      }
      const newCombination = new Combination(
        path.id, currentNode.id, answers[userAnswer].id,
      );

      await newCombination.save();
      await conductSurveyW2(client, room, surveyId, message, ref);
    } else if (currentNode.questionType === QuestionTypes.TEXTANWSER) {
      const newCombination = new Combination(
        path.id, currentNode.id, null, userAnswer,
      );

      await newCombination.save();
      await conductSurveyW2(client, room, surveyId, message, ref);
    }
    // else if (currentNode.questionType === QuestionTypes.MESSAGE) {
    //   await conductSurvey(client, survey, originalParticipant(message.from));
    // }
  } catch (error) {
    console.log(error);
  }
};

const getSurveyByRoom = async (room, ref) => new Promise((resolve, reject) => {
  ref.on('value', (_snapshot) => {
    //  const { surveyId } = snapshot.val()[room];
    ref.off('value');
    resolve(/*  surveyId */ '60e2171c99bad859102f480a');
  }, (errorObject) => {
    console.log(`The read failed: ${errorObject.name}`);
    reject();
  });
});

const processMessagesIg = async (message) => {
  const client = twilio;
  try {
    if (!message.text
      || !message.senderId
      || !message.recipient
      || !message.recipient.accountId || !message.recipient.accessToken) return;
    console.log('user sent a message');

    const survey = await Survey.findOne({
      terminated: false,
      ready: true,
      type: 'instagram',
      accountId: message.recipient.accountId,
    });

    if (!survey) return;

    console.log('found survey');

    const online = await this.canContinue(survey);

    if (!online) {
      await client.messages.createIg({
        to: message.senderId,
        recipientToken: message.recipient.accessToken,
        body: survey.offlineMessage,
      });
      return;
    }

    const participant = await Participant
      .findOne({ survey: survey.id, accountId: message.recipient.accountId });
    if (!participant) {
      const newParticipant = await Participant.create({
        survey: survey.id,
        accountId: message.recipient.accountId,
        type: 'instagram',
      });
      conductSurveyIg(client, survey, newParticipant, message.senderId, message.recipient);
      return;
    }

    console.log('found participant');

    const path = await Path.findOne({
      survey: survey.id,
      participant: participant.id,
      terminated: false,
      optinState: { $ne: OptinStates.NO },
    });
    if (!path) return;

    console.log('found path');

    const combination = await Combination.findOne({ path: path.id }).sort({ createdAt: -1 }).exec();

    if (!combination && survey.optIn && path.optinState === OptinStates.PENDING) {
      console.log('pending path');
      const answer = parseInt(message.text, 10);
      console.log(answer);
      if (Number.isNaN(answer)) {
        await client.messages.createIg({
          to: message.senderId,
          recipientToken: message.recipient.accessToken,
          body: 'Invalid Answer.',
        });
        return;
      }
      if (answer === 1) {
        await Path.findByIdAndUpdate(path.id, { $set: { optinState: OptinStates.YES } },
          { useFindAndModify: false });
        await conductSurveyIg(client, survey, participant, message.senderId, message.recipient);
        return;
        //  await Path.findByIdAndUpdate(path.id, { $set: { optinState: OptinStates.YES } });
      } if (answer === 2) {
        await Path.findByIdAndUpdate(path.id, { $set: { optinState: OptinStates.NO } },
          { useFindAndModify: false });
        //  await message.reply('It\'s understood!');
        return;
      }
      await client.messages.createIg({
        to: message.senderId,
        recipientToken: message.recipient.accessToken,
        body: 'Invalid Answer.',
      });
      return;
    }

    const currentNode = await getNextNode(!combination, survey, combination);

    if (!currentNode) return;

    console.log('found current node');

    let userAnswer = message.text;

    if (currentNode.endActionType != null) {
      if (currentNode.endActionType === 0) {
        // Send Message
        console.log('Send Message');
        await twilio.messages.createIg({
          to: message.senderId,
          recipientToken: message.recipient.accessToken,
          body: currentNode.endActionData,
        });
      } else if (currentNode.endActionType === 1) {
        // Send Email
        console.log('Send Email', currentNode);
        sendEmail(
          currentNode.emailData,
          currentNode.subjectData,
          currentNode.contentData,
        ).then(null);
      } else if (currentNode.endActionType === 2) {
        // Notify Agent
        console.log('Notify Agent');
      }
    } else if (currentNode.questionType === QuestionTypes.MULTIPLECHOICE) {
      userAnswer = parseInt(userAnswer, 10) - 1;
      if (Number.isNaN(userAnswer)) {
        await client.messages.createIg({
          to: message.senderId,
          recipientToken: message.recipient.accessToken,
          body: 'Invalid Answer.',
        });
        return;
      }
      const answers = await Answer.find({ node: currentNode.id }).sort({ createdAt: 1 }).exec();
      if (userAnswer < 0 || userAnswer >= answers.length) {
        await client.messages.createIg({
          to: message.senderId,
          recipientToken: message.recipient.accessToken,
          body: 'Invalid Answer.',
        });
        return;
      }
      const newCombination = new Combination(
        path.id, currentNode.id, answers[userAnswer].id,
      );

      await newCombination.save();
      await conductSurveyIg(client, survey, participant, message.senderId, message.recipient);
    } else if (currentNode.questionType === QuestionTypes.TEXTANWSER) {
      const newCombination = new Combination(
        path.id, currentNode.id, null, userAnswer,
      );

      await newCombination.save();
      await conductSurveyIg(client, survey, participant, message.senderId, message.recipient);
    }
    // else if (currentNode.questionType === QuestionTypes.MESSAGE) {
    //   await conductSurvey(client, survey, originalParticipant(message.from));
    // }
  } catch (error) {
    console.log(error);
  }
};

const conductSurveyIg = async (client, survey, participant, senderId, recipient) => {
  // Get the participant path and continue from there
  console.log(survey.id, participant, recipient, 'hoho');
  try {
    let firstTime = false;
    let path = await Path.findOne({
      participant: participant.id,
      survey: survey.id,
      terminated: false,
      optinState: { $ne: OptinStates.NO },
    });
    if (!path) {
      path = new Path(participant.id, survey.id);
      path = await path.save();
      firstTime = true;
    }
    const combination = firstTime
      ? [] : await Combination.findOne({ path: path.id }).sort({ createdAt: -1 }).exec();

    console.log('comb taken', firstTime, combination);

    // Send Option message
    if (firstTime && survey.optIn && path.optinState === OptinStates.PENDING) {
      const question = survey.optinQuestion;
      await twilio.messages.createIg({
        to: senderId,
        body: question,
        recipientToken: recipient.accessToken,
        quickReplies: [
          {
            content_type: 'text',
            payload: 1,
            title: survey.optinYesText,
          },
          {
            content_type: 'text',
            payload: 2,
            title: survey.optinNoText,
          },
        ],
      });
      return;
    }

    const nextNode = await getNextNode(
      firstTime || !combination, survey, combination,
    );

    console.log('next node found', nextNode);

    if (nextNode && nextNode.endActionType != null) {
      if (nextNode.endActionType === 0) {
        // Send Message
        console.log('Send End Message');
        await twilio.messages.createIg({
          to: senderId,
          body: nextNode.endActionData,
          recipientToken: recipient.accessToken,
        });
      } else if (nextNode.endActionType === 1) {
        // Send Email
        console.log('Send Email', nextNode);
        sendEmail(nextNode.emailData, nextNode.subjectData, nextNode.contentData).then(null);
      } else if (nextNode.endActionType === 2) {
        // Notify Agent
        console.log('Notify Agent');
      }
    } else if (nextNode) {
      if (nextNode.mediaUrl) {
        await askQuestionFileIg(client, nextNode, participant, survey, senderId, recipient);
      } else {
        await askQuestionIg(client, nextNode, participant, survey, senderId, recipient);
      }
      if (nextNode.questionType === QuestionTypes.MESSAGE) {
        //  We create the combination, save it and call conduct survey again
        const newCombination = new Combination(
          path.id, nextNode.id, null, null,
        );
        await newCombination.save();
        await conductSurveyIg(client, survey, participant, senderId, recipient);
      }
    } else {
      await Path.findByIdAndUpdate(path.id, { $set: { terminated: true } },
        { useFindAndModify: false });
      //  await client.sendMessage(formatParticipant(participant), survey.endMessage);
      //  await displayResult(path);
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports.runSurvey = runSurvey;
module.exports.conductSurveyE = conductSurveyE;
module.exports.updateSurveys = updateSurveys;
module.exports.processMessages = processMessages;
module.exports.conductSurvey = conductSurvey;
module.exports.launcher = launcher;
module.exports.canContinue = canContinue;
module.exports.conductSurveyW = conductSurveyW;
module.exports.processMessagesW = processMessagesW;
module.exports.processMessagesFb = processMessagesFb;
module.exports.conductSurveyW2 = conductSurveyW2;
module.exports.processMessagesW2 = processMessagesW2;
module.exports.getSurveyByRoom = getSurveyByRoom;
module.exports.processMessagesIg = processMessagesIg;
module.exports.conductSurveyIg = conductSurveyIg;
