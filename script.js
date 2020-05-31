navigator.getUserMedia = navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia;

const rand16Char = () => Math.floor(Math.random() * 0xFFFFFF).toString(16);
const randId = () => rand16Char() + '' + rand16Char();
const getMyId = () => {
  const savedId = localStorage.getItem('uid');
  const id = savedId ? savedId : randId();
  localStorage.setItem('uid', id);
  return id;
}

if (!getParameterByName('r')) {
  window.location.href += (window.location.href.indexOf('?') !== -1) ?
    ('&r=' + randId()) :
    ('?r=' + randId());
}

const roomHash = getParameterByName('r') || 'none';
const MYUID = getMyId();

$('#roomId').text(roomHash);
$('#curent_url').text(window.location.href);

const signalRef = firebase.database().ref('/rdemo/' + roomHash + '/signal');
const memberRef = firebase.database().ref('/rdemo/' + roomHash + '/member');
memberRef.child(MYUID).onDisconnect().remove();


// Room name needs to be prefixed with 'observable-'
const roomName = 'observable-' + roomHash;
const configuration = {
  iceTransportPolicy: 'all',
  iceCandidatePoolSize: 4,
  iceServers: [{
      urls: ['stun:stun.l.google.com:19302']
    },
    {
      urls: ['turn:numb.viagenie.ca'],
      credential: 'muazkh',
      username: 'webrtc@live.com'
    }
  ]
};
var room;
var pc;
var mediaStream;


function onSuccess() {};

function onError(error) {
  console.error(error);
};

var is_offerer = false;
var is_setup_done = false;

function setupApp() {
  if (is_setup_done) return;
  is_setup_done = true;
  memberRef.once('value').then(snap => {
    const members = snap.val() || {};
    console.log('MEMBERS', members);

    // check if we had a host
    const hostCount = (JSON.stringify(members).match(/host/g) || []).length;

    // If we are the second user to connect to the room we will be creating the offer
    var isOfferer = (hostCount > 0);

    is_offerer = isOfferer;
    memberRef.child(MYUID).set(isOfferer ? 'offerer' : 'host');
    setupWebRTC(isOfferer);
    setupMemberObserver();
  });
}


// startup

$(document).ready(function () {
  firebase.database().ref('.info/connected').on('value', function (snap) {
    if (snap.val() === true) {
      memberRef.child(MYUID).onDisconnect().remove();
      memberRef.child(MYUID).set('pending').then(setupApp);
    }
  });
  $('#askTurnOnMic').show();
  $('#debug').html('Version 1.0<br/>');
});




setInterval(() => {
  memberRef.child(MYUID).onDisconnect().remove();
}, 500);

// Send signaling data
function sendMessage(message) {
  console.log(message);
  const data = {
    message: JSON.stringify(message),
    uid: MYUID
  };
  const key = 'msg-' + Date.now();
  signalRef.child(key).set(data);
  signalRef.child(key).onDisconnect().remove();
  dlog(data.message);
}

function setupWebRTC(isOfferer) {
  navigator.mediaDevices.getUserMedia({
    audio: {
      sampleSize: 16
    },
    video: true
  }).then(stream => {
    $('#askTurnOnMic').hide();
    $('#mainApp').show();
    pc = new RTCPeerConnection(configuration);
    document.getElementById('localVideo').srcObject = stream;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    mediaStream = stream;
    startWebRTC(isOfferer);
    setTimeout(() => $('video').attr('controls', false), 1000);
  }, (error) => {
    $('#askTurnOnMic').hide();
    $('#micDenided').show();
    alert('Error: Cannot access microphone/camera');
  });
}

var is_rtc_ready = false;
var msg_queue = [];

function startWebRTC(isOfferer) {
  console.log('startWebRTC', isOfferer);

  // 'onicecandidate' notifies us whenever an ICE agent needs to deliver a
  // message to the other peer through the signaling server
  pc.onicecandidate = event => {
    if (event.candidate) {
      // var candidate = event.candidate.candidate;
      // if (candidate.indexOf('relay') < 0) return;
      sendMessage({
        'candidate': event.candidate
      });
    }
  };

  // listen for connection status
  pc.oniceconnectionstatechange = function (event) {
    if (pc.iceConnectionState === "failed" ||
      pc.iceConnectionState === "disconnected" ||
      pc.iceConnectionState === "closed") {
      $('#status').text('Call ended');
      stopTimer();
    }

    if (pc.iceConnectionState === "checking") {
      $('#status').text('Connecting...');
    }

    if (pc.iceConnectionState === "connected") {
      $('#status').text('Connected!');
      startTimer();
    }
  };

  // If user is offerer let the 'negotiationneeded' event create the offer
  if (isOfferer) {
    dlog('onnegotiationneeded');
    pc.onnegotiationneeded = () => {
      dlog('createOffer');
      pc.createOffer({
        iceRestart: true,
        offerToReceiveAudio: 1,
        offerToReceiveVideo: 1
      }).then(localDescCreated).catch(onError);
    }
  }

  // When a remote stream arrives display it in the #remoteVideo element
  pc.ontrack = event => {
    const remoteVid = document.getElementById('remoteVideo');
    const stream = event.streams[0];
    if (!remoteVid.srcObject || remoteVid.srcObject.id !== stream.id) {
      remoteVid.srcObject = stream;
    }
  };

  is_rtc_ready = true;

  msg_queue.reverse().forEach(onSignal);
}

function onSignal(snap) {
  const signal = snap.val();
  // Message was sent by us
  if (signal.uid === MYUID) {
    return;
  }

  // Message is handled
  snap.ref.remove();
  const message = JSON.parse(signal.message);
  console.log(message);

  if (!is_rtc_ready) {
    msg_queue.push(snap);
    return;
  }

  if (message.sdp) {
    // This is called after receiving an offer or answer from another peer
    pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
      // When receiving an offer lets answer it
      if (pc.remoteDescription.type === 'offer') {
        pc.createAnswer().then(localDescCreated).catch(onError);
      }
    }, onError);
  } else if (message.candidate) {
    // Add the new ICE candidate to our connections remote description
    pc.addIceCandidate(
      new RTCIceCandidate(message.candidate), onSuccess, onError
    );
  } else if (message.hangup) {
    hangup();
  }
}


signalRef.on('child_added', onSignal);


function localDescCreated(desc) {
  dlog('localDescCreated');
  pc.setLocalDescription(new RTCSessionDescription(desc))
    .then(function () {
      sendMessage({
        'sdp': desc
      });
    })
    .catch(onError);
}