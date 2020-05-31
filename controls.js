var TIMER = 0;

function startTimer() {
  var seconds = 0,
    minutes = 0,
    hours = 0;

  function timerTick() {
    seconds++;
    if (seconds >= 60) {
      seconds = 0;
      minutes++;
      if (minutes >= 60) {
        minutes = 0;
        hours++;
      }
    }

    $('#timer').html((hours ? (hours > 9 ? hours : "0" + hours) : "00") + ":" + (minutes ? (minutes > 9 ? minutes : "0" + minutes) : "00") + ":" + (seconds > 9 ? seconds : "0" + seconds));
  }

  clearInterval(TIMER);
  TIMER = setInterval(timerTick, 1000);
}

function stopTimer() {
  clearInterval(TIMER);
  $('#timer').html('');
}

var is_has_audio = true;

function toggleMute() {
  is_has_audio = !is_has_audio;
  mediaStream.getAudioTracks()[0].enabled = is_has_audio;
  $('#toggleMuteBtn').html(is_has_audio ? 'Mute' : 'Unmute');
}

var is_hangup = false;

function hangup() {
  pc.close();
  stopTimer();
  $('#mainApp').hide();
  $('#hangupMsg').show();
  pc = null;
  is_hangup = true;
  sendMessage({
    'hangup': 1
  });
}

// theme utils

function isCurrentThemeDark() {
  var dark = window.localStorage.getItem('dark');
  return !!dark;
}

function toggleTheme() {
  if (!isCurrentThemeDark()) {
    setDarkTheme(true);
    window.localStorage.setItem('dark', 'true');
  } else {
    setDarkTheme(false);
    window.localStorage.removeItem('dark');
  }
}

function setDarkTheme(isDark) {
  if (isDark) {
    $('body').addClass('dark');
    $('#toggleThemeBtn').text('Light theme');
  } else {
    $('body').removeClass('dark');
    $('#toggleThemeBtn').text('Dark theme');
  }
}

$(document).ready(function () {
  setDarkTheme(isCurrentThemeDark());
});
