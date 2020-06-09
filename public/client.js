var divSelectRoom = document.getElementById("selectRoom");
var divConsultingRoom = document.getElementById("consultingRoom");
var inputRoomNumber = document.getElementById("roomNumber");
var inputDisplayName = document.getElementById("displayName");
var btnGoRoom = document.getElementById("goRoom");
var localVideo = document.getElementById("localVideo");
var remoteVideo = document.getElementById("remoteVideo");
var callMinutes = document.getElementById("minutes");
var callSeconds = document.getElementById("seconds");
var roomNumber;
var displayName;
var localStream;
var remoteStream;
var rtcPeerConnection;
var iceServers = {
    'iceServers': [
        { 'urls': 'stun:stun.l.google.com:19302' }
    ]
}
var constraints = { audio: audioSource, video: videoSource };
var isCaller;
var micActive = true;
var videoActive = true;
var secondsCount = 0;


function toggleVideo() {
    if(localStream != null && localStream.getVideoTracks().length > 0){
        videoActive = !videoActive;
        sendMessage('toggle', ('video' + videoActive));
      localStream.getVideoTracks()[0].enabled = videoActive;
    }  
  }
  
function toggleMic() {
    if(localStream != null && localStream.getAudioTracks().length > 0){
        micActive = !micActive;
        sendMessage('toggle', ('mic' + micActive));
      localStream.getAudioTracks()[0].enabled = micActive;
    }   
}

function switchStreamData() {
    // Stop the current stream
    localStream.getTracks().forEach(function(track) {
        track.stop();
    });

    // navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
    //     replaceTracks(stream);
    // }).catch(function(error){
    //     'Somthing went wrong switching the stream';
    // })

    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        localStream = stream;
        localVideo.srcObject = stream;
        replaceTracks(stream);
        isCaller = true;
    }).catch(function (err) {
        console.log('An error ocurred when accessing media devices', err);
    });
}

function logCallDuration() {
  ++secondsCount;
  callSeconds.innerHTML = callTimer(secondsCount % 60);
  callMinutes.innerHTML = callTimer(parseInt(secondsCount / 60));
//   checkForAudio();
}

function callTimer(val) {
  var valString = val + "";
  if (valString.length < 2) {
    return "0" + valString;
  } else {
    return valString;
  }
}



var socket = io();
btnGoRoom.onclick = function () {
    if (inputRoomNumber.value === '') {
        alert("Please type a room number")
    } else {
        roomNumber = inputRoomNumber.value;
        displayName = inputDisplayName.value;
        socket.emit('create or join', roomNumber);
        socket.emit('setUsername', displayName)
        divSelectRoom.style = "display: none;";
        divConsultingRoom.style = "display: block;";
        $("#localUserName").text(displayName);
    }
    $(".novideoContainer").hide();
    $("#localUserName").removeClass("loading");
    $("#waitingMessage").text('Waiting for others to join room ' + roomNumber);
    setInterval(logCallDuration, 1000);
};

// message handlers
socket.on('created', function (room) {
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        localStream = stream;
        localVideo.srcObject = stream;
        isCaller = true;
    }).catch(function (err) {
        console.log('An error ocurred when accessing media devices', err);
    });
});

socket.on('joined', function (room) {
    socket.username = displayName;
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        localStream = stream;
        localVideo.srcObject = stream;
        socket.emit(
            'ready', 
            roomNumber,
            socket.username
        );
    }).catch(function (err) {
        console.log('An error ocurred when accessing media devices', err);
    });
});

socket.on('candidate', function (event) {
    var candidate = new RTCIceCandidate({
        sdpMLineIndex: event.label,
        candidate: event.candidate
    });
    rtcPeerConnection.addIceCandidate(candidate);
});

socket.on('ready', function () {
    if (isCaller) {
        rtcPeerConnection = new RTCPeerConnection(iceServers);
        rtcPeerConnection.onicecandidate = onIceCandidate;
        rtcPeerConnection.ontrack = onAddStream;
        rtcPeerConnection.addTrack(localStream.getTracks()[0], localStream);
        rtcPeerConnection.addTrack(localStream.getTracks()[1], localStream);
        rtcPeerConnection.createOffer()
            .then(sessionDescription => {
                rtcPeerConnection.setLocalDescription(sessionDescription);
                socket.emit('offer', {
                    type: 'offer',
                    sdp: sessionDescription,
                    room: roomNumber
                });
            })
            .catch(error => {
                console.log(error)
            })
    }
});

socket.on('offer', function (event) {
    if (!isCaller) {
        rtcPeerConnection = new RTCPeerConnection(iceServers);
        rtcPeerConnection.onicecandidate = onIceCandidate;
        rtcPeerConnection.ontrack = onAddStream;
        rtcPeerConnection.addTrack(localStream.getTracks()[0], localStream);
        rtcPeerConnection.addTrack(localStream.getTracks()[1], localStream);
        rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
        rtcPeerConnection.createAnswer()
            .then(sessionDescription => {
                rtcPeerConnection.setLocalDescription(sessionDescription);
                socket.emit('answer', {
                    type: 'answer',
                    sdp: sessionDescription,
                    room: roomNumber
                });
            })
            .catch(error => {
                console.log(error)
            })
    }
});

socket.on('answer', function (event) {
    rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
});

function setUsername() {
    socket.emit('setUsername', document.getElementById('name').value);
 };
 var user;
 socket.on('userSet', function(data) {
    user = data.username;
 });
 function sendMessage(type, content) {
    var msg = content;
    if(type = 'username') {
       socket.emit('msg', {message: msg, user: user});
    }
 }
 socket.on('newmsg', function(data) {
    if(user) {
        // console.log(data);
        if(data.user != displayName && data.message === data.user){
            $("#remoteUserName").text(data.user);
        }
        else if(data.user != displayName){
            console.log(data.message);
            displayPrompts(data.message, data.user)
        }
    }
 })


function displayPrompts(prompt, user){
    console.log(prompt);
    if(prompt === 'micfalse'){
        $("#remoteUserName").text(user + ' (not sharing audio)');
    }
    else if(prompt === 'mictrue'){
        $("#remoteUserName").text(user);
    }

    if(prompt === 'videofalse'){
        $("#remoteUserName").text(user + ' (not sharing video)');
    }
    else if(prompt === 'videotrue'){
        $("#remoteUserName").text(user);
    }
}

// handler functions
function onIceCandidate(event) {
    if (event.candidate) {
        console.log('sending ice candidate');
        socket.emit('candidate', {
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate,
            room: roomNumber
        })
        sendMessage('username', displayName);
    }
    $("#remoteUserName").show();
    $("#waitingMessage").hide();
    $("#noPartnerVideoContainer").show();
}

function onAddStream(event) {
    remoteVideo.srcObject = event.streams[0];
    remoteStream = event.stream;
}


// Source selection

const videoElement = document.getElementById('remoteVideo');
const audioInputSelect = document.querySelector('select#audioSource');
const audioOutputSelect = document.querySelector('select#audioOutput');
const videoSelect = document.querySelector('select#videoSource');
const selectors = [audioInputSelect, audioOutputSelect, videoSelect];

function gotDevices(deviceInfos) {
  // Handles being called several times to update labels. Preserve values.
  const values = selectors.map(select => select.value);
  selectors.forEach(select => {
    while (select.firstChild) {
      select.removeChild(select.firstChild);
    }
  });
  for (let i = 0; i !== deviceInfos.length; ++i) {
    const deviceInfo = deviceInfos[i];
    const option = document.createElement('option');
    option.value = deviceInfo.deviceId;
    if (deviceInfo.kind === 'audioinput') {
      option.text = deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
      audioInputSelect.appendChild(option);
    } else if (deviceInfo.kind === 'audiooutput') {
      option.text = deviceInfo.label || `speaker ${audioOutputSelect.length + 1}`;
      audioOutputSelect.appendChild(option);
    } else if (deviceInfo.kind === 'videoinput') {
      option.text = deviceInfo.label || `camera ${videoSelect.length + 1}`;
      videoSelect.appendChild(option);
    } else {
      console.log('Some other kind of source/device: ', deviceInfo);
    }
  }
  selectors.forEach((select, selectorIndex) => {
    if (Array.prototype.slice.call(select.childNodes).some(n => n.value === values[selectorIndex])) {
      select.value = values[selectorIndex];
    }
  });
}

navigator.mediaDevices.enumerateDevices().then(gotDevices);

function attachSinkId(element, sinkId){
    if(typeof element.sinkId !== 'undefined') {
        element.setSinkId(sinkId)
            .then(() => {
                console.log(`Success, audio output device attached: ${sinkId}`);
            })
    }
}

function changeAudioDestination(){
    const audioDestination = audioOutputSelect.value;
    console.log(audioDestination);
    attachSinkId(videoElement, audioDestination);
}


function switchInputs() {
  const audioSource = audioInputSelect.value;
  const videoSource = videoSelect.value;
  constraints = {
    audio: audioSource,
    video: videoSource
  };

//   navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
//         localStream = stream;
//         localVideo.srcObject = stream;
//         isCaller = true;
//     }).catch(function (err) {
//         console.log('An error ocurred when accessing media devices', err);
//     });

    switchStreamData();
}

function setAudioOutput(){
    var audioOutput = audioOutputSelect.value;
    console.log(remoteStream.sinkId);
    // console.log(audioOutput);
}

audioInputSelect.onchange = switchInputs;
audioOutputSelect.onchange = changeAudioDestination;
videoSelect.onchange = switchInputs;


