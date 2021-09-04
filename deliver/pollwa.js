var pollwa;
function generateRandomId() {
  const chars = "azertyuiopqsdfghjklmwxcvbn0123456789AZERTYUIOPQSDFGHJKLMWXCVBN";
  const idLength = 32;
  let id = '';
  for (let i = 0; i < idLength; i += 1) {
    let r = parseInt(Math.random() * 1000, 10) % chars.length;
    id += chars[r];
  }
  return id;
}

$(function () {
  //$('head').append('<link rel="stylesheet" type="text/css" href="http://34.70.63.74:8080/deliver/pollwa.css?hc=XXXHCXXX&bc=XXXBCXXX&ccc=XXXCCCXXX">');
  $('head').append('<link rel="stylesheet" type="text/css" href="http://localhost:8080/deliver/pollwa.css?hc=XXXHCXXX&bc=XXXBCXXX&ccc=XXXCCCXXX">');
  $('head').append('<link rel="preconnect" type="text/css" href="https://fonts.gstatic.com">');
  $('head').append('<link rel="stylesheet" type="text/css" href="https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300&display=swap">');
  $('head').append('<link rel="stylesheet" type="text/css" href="https://stackpath.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css">');

  pollwa = (chatElt, chatId) => {
    $(`${chatElt}`).append(`
      <div>
        <div id="pw117-chat-window" class="dpw117-hidden">
          <div id="pw117-chat-header">
            <span>Chat with us</span>
            <span class="pw117-close-icon pw117-toggle-chat-window">x</span>
          </div>
          <div id="pw117-start-chat">
            <input type="text" id="pw117-name" placeholder="* First name">
            <br /><br />
            <input type="email" id="pw117-email" placeholder="* Email">
            <br /><br />
            <button id="pw117-start-chat-button">Start Chat</button>
          </div>
          <div id="pw117-chat-messages" class="pw117-hidden-hard">
          </div>
          <div id="pw117-message-inputs">
            <input type="text" id="pw117-message-input"
              placeholder="Type and press [enter].." />
          </div>
        </div>
        <div id="pw117-chat-square">
          <p id="pw117-chat-icon-wrapper" class="pw117-toggle-chat-window">
            <i class="fa fa-commenting fa-3x" id="pw117-chat-icon"
              aria-hidden="true"></i>
          </p>
        </div>
      </div>
    `);


    //const socket = io("http://34.70.63.74:8080/");
    const socket = io("http://localhost:8080/");

    // Display Hide chat window
    $('.pw117-toggle-chat-window').click(() => {
      $('#pw117-chat-window').toggleClass('pw117-hidden');
    });
  
    $('#pw117-start-chat-button').click(() => {
      startChat();
    });
  
    function startChat() {
      const name = $("#pw117-name").val();
      const email = $("#pw117-email").val();
      if (name == '') {
        $("#pw117-email").removeClass('pw117-input-error');
        $("#pw117-name").addClass('pw117-input-error');
        return;
      }
      if (email == '') {
        $("#pw117-name").removeClass('pw117-input-error');
        $("#pw117-email").addClass('pw117-input-error');
        return;
      }
      // Check email
      let emailReg = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/
  
      if (!emailReg.test(email)) {
        $("#pw117-name").removeClass('pw117-input-error');
        $("#pw117-email").addClass('pw117-input-error');
        return;
      }
  
      // generate randomid or get from localstorage
      let participantId = localStorage.getItem('pw117-userid');
      if (!participantId || participantId === '') {
        participantId = generateRandomId();
        //localStorage.setItem('pw117-userid', participantId);
      }
  
      // Emit discussion start event
      const botId = chatId;
      const dataToEmit = { name, email, botId, participantId };
  
      setTimeout(()=>socket.emit('start-website-chat', dataToEmit), 1500);
  
      $("#pw117-chat-messages").removeClass('pw117-hidden-hard');
      $("#pw117-start-chat").addClass('pw117-hidden-hard');
  
      socket.on(`bot-message-${participantId}`, (data) => {
        // add message
        $(`
          <div class="pw117-message pw117-bot-message">
            ${data.message}
          </div>
        `).hide().appendTo("#pw117-chat-messages").fadeIn(1000);
  
        if (data.file) {
          $(`
          <div class="pw117-message pw117-bot-message pw117-message-file">
            <i class="fa fa-file" aria-hidden="true"></i>&nbsp; <a target="_blank" class="pw117-file-link" href="${data.file.url}">${data.file.name}</a>
          </div>
        `).hide().appendTo("#pw117-chat-messages").fadeIn(1000);
        }
  
        // add button if there are
        if (data.buttons) {
          for (let i = 0; i < data.buttons.length; i += 1) {
  
            setTimeout(()=>{
              $(`
                <div class="pw117-message-button">
                  ${i + 1}-${data.buttons[i]}
                </div>
              `).hide().appendTo("#pw117-chat-messages").fadeIn(1000);
            }, 500 + i*500);
  
          }
        }
        $('#pw117-chat-messages').scrollTop($('#pw117-chat-messages')[0].scrollHeight);
      });
  
      $('#pw117-message-input').on('keypress', function (e) {
        if (e.which === 13) {
  
          const message = $(this).val();
          if (!message || message.trim() === '') return;
  
          //Disable textbox to prevent multiple submit
          $(this).attr("disabled", "disabled");
  
          const dataToEmit = { botId, participantId, message };
  
          socket.emit("user-sent-message", dataToEmit);
  
          $(`
            <div class="pw117-message pw117-user-message">
            ${message.trim()}
            </div>
          `).hide().appendTo("#pw117-chat-messages").fadeIn(1000);
  
          //Enable the textbox again if needed.
          $(this).val("");
          $(this).removeAttr("disabled");
        }
        $('#pw117-chat-messages').scrollTop($('#pw117-chat-messages')[0].scrollHeight);
      });
  
      $("#pw117-chat-messages").on('click', '.pw117-message-button', function (e) {
        let messagePos = $(this).text();
        messagePos = parseInt(messagePos.split('-')[0], 10);
  
        if (isNaN(messagePos) || messagePos <= 0) {
          return;
        }
  
        $("#pw117-message-input").val(messagePos);
  
        let ev = jQuery.Event("keypress");
        ev.which = 13;
        ev.keyCode = 13;
        $("#pw117-message-input").trigger(ev);
      });
  
      $("#pw117-message-input").val(`Name: ${name}<br/>Email: ${email}`);
      let ev0 = jQuery.Event("keypress");
      ev0.which = 13;
      ev0.keyCode = 13;
      //Display user info
      $("#pw117-message-input").trigger(ev0);
  
    }



  }
});