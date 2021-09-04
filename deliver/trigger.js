$(function () {
  $('.pw117-actionbutton').on('click', () => {
    let tel = $('.pw117-phonenumber').val();
    let chatId = $('.pw117-phonenumber').attr('data-pw117');

    if (!tel || !chatId || tel === '' || chatId === '') return;

    $.ajax({
      //url: `http://34.70.63.74:8080/survey/run/${chatId}/${tel}`,
      url: `http://localhost:8080/survey/run/${chatId}/${tel}`,
      type: 'POST',
    });
  });
});