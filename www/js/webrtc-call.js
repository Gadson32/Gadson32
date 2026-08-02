// Two-party WebRTC call. Signaling (offer/answer/ICE) travels over
// SignalingClient; media flows peer-to-peer once negotiated.
window.WebRTCCall = (() => {
  let pc = null;
  let localStream = null;
  let isCaller = false;
  let onRemoteStreamCb = null;
  let onConnectionStateCb = null;

  function createPeerConnection() {
    pc = new RTCPeerConnection({ iceServers: window.APP_CONFIG.ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        window.SignalingClient.sendSignal("ice-candidate", event.candidate);
      }
    };

    pc.ontrack = (event) => {
      onRemoteStreamCb && onRemoteStreamCb(event.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      onConnectionStateCb && onConnectionStateCb(pc.connectionState);
    };

    if (localStream) {
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    }
  }

  async function init(stream, { onRemoteStream, onConnectionState } = {}) {
    localStream = stream;
    onRemoteStreamCb = onRemoteStream || null;
    onConnectionStateCb = onConnectionState || null;

    window.SignalingClient.on("message", handleSignalingMessage);
  }

  async function handleSignalingMessage(msg) {
    if (msg.type === "peer-joined") {
      // We were already in the room; we become the caller and initiate.
      isCaller = true;
      createPeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      window.SignalingClient.sendSignal("offer", offer);
      return;
    }

    if (msg.type !== "signal") return;
    const { kind, data } = msg;

    if (kind === "offer") {
      isCaller = false;
      createPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      window.SignalingClient.sendSignal("answer", answer);
    } else if (kind === "answer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data));
    } else if (kind === "ice-candidate") {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data));
      } catch (err) {
        console.warn("Failed to add ICE candidate", err);
      }
    }
  }

  function setMicEnabled(enabled) {
    if (localStream) localStream.getAudioTracks().forEach((t) => (t.enabled = enabled));
  }

  function setCameraEnabled(enabled) {
    if (localStream) localStream.getVideoTracks().forEach((t) => (t.enabled = enabled));
  }

  function teardown() {
    if (pc) {
      pc.close();
      pc = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
    }
  }

  return { init, setMicEnabled, setCameraEnabled, teardown };
})();
