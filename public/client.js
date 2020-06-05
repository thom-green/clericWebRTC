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
var constraints = { audio: true, video: true };
var isCaller;
var micActive = true;
var videoActive = true;
var secondsCount = 0;


function toggleVideo() {
    if(localStream != null && localStream.getVideoTracks().length > 0){
        videoActive = !videoActive;
  
      localStream.getVideoTracks()[0].enabled = videoActive;
    }
  
  }
  
function toggleMic() {
    if(localStream != null && localStream.getAudioTracks().length > 0){
        micActive = !micActive;
  
      localStream.getAudioTracks()[0].enabled = micActive;
    }   
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
    console.log('Setting username');
    socket.emit('setUsername', document.getElementById('name').value);
 };
 var user;
//  socket.on('userExists', function(data) {
//     document.getElementById('error-container').innerHTML = data;
//  });
 socket.on('userSet', function(data) {
    user = data.username;
    // document.body.innerHTML = '<input type = "text" id = "message">\
    // <button type = "button" name = "button" onclick = "sendMessage()">Send</button>\
    // <div id = "message-container"></div>';
 });
 function sendMessage() {
    var msg = user;
    console.log(msg);
    if(msg) {
       socket.emit('msg', {message: msg, user: user});
    }
 }
 socket.on('newmsg', function(data) {
    if(user) {
        // console.log('message is: ' + data.message + ' ,username is: ' + displayName);
        if(!data.message === displayName){
            $("#remoteUserName").text(data.message);
        }
    }
 })

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
    }
    $("#remoteUserName").show();
    $("#waitingMessage").hide();
    $("#noPartnerVideoContainer").show();
    sendMessage();
    console.log(event);
}

function onAddStream(event) {
    remoteVideo.srcObject = event.streams[0];
    remoteStream = event.stream;
}

//Check for partner video playing
function checkForAudio(){
    var video = $('remoteVideo');

    console.log(video.paused);

    // if(video.duration > 0 && !video.paused) {
    //     console.log('Remote video is playing audio');
    // }
    // else {
    //     console.log('Remote video is muted');
    // }
}