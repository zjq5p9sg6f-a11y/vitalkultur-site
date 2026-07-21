/* CARLON Clinic — P2P-Transfer (WebRTC)
   Der Pferdebesitzer sendet die HRV-Aufnahme direkt an den Tierarzt — Peer-to-Peer,
   Ende-zu-Ende. Ein optionaler Signaling-Relay vermittelt nur den Verbindungsaufbau
   (SDP/ICE) — die Gesundheitsdaten laufen NIE über einen Server.
   Loopback-Modus (P2P.loopbackTest) verbindet zwei Peers lokal — für Selbsttests. */
(function () {
  const CHUNK = 16 * 1024; // 16 KB — sichere DataChannel-Chunkgröße
  const P2P = {
    RELAY: 'wss://carlon-signaling.example.workers.dev', // → eigenen Cloudflare-Worker eintragen
    ICE: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],

    _pc(onState) {
      const pc = new RTCPeerConnection({ iceServers: this.ICE });
      if (onState) pc.onconnectionstatechange = () => onState(pc.connectionState);
      return pc;
    },

    // ---- Sender: Datei über einen DataChannel verschicken ----
    _sendFileOverChannel(ch, file, onProgress) {
      return new Promise((resolve, reject) => {
        ch.binaryType = 'arraybuffer';
        ch.bufferedAmountLowThreshold = CHUNK * 8;
        const meta = { kind: 'meta', name: file.name, size: file.size, type: file.type };
        ch.send(JSON.stringify(meta));
        const reader = new FileReader();
        let offset = 0;
        const readSlice = (o) => reader.readAsArrayBuffer(file.slice(o, o + CHUNK));
        reader.onload = (e) => {
          const buf = e.target.result;
          const push = () => {
            try { ch.send(buf); } catch (err) { return reject(err); }
            offset += buf.byteLength;
            if (onProgress) onProgress(Math.min(1, offset / file.size));
            if (offset < file.size) {
              if (ch.bufferedAmount > CHUNK * 16) ch.onbufferedamountlow = () => { ch.onbufferedamountlow = null; readSlice(offset); };
              else readSlice(offset);
            } else {
              ch.send(JSON.stringify({ kind: 'done' }));
              resolve();
            }
          };
          push();
        };
        reader.onerror = () => reject(reader.error);
        readSlice(0);
      });
    },

    // ---- Empfänger: Datei über einen DataChannel entgegennehmen ----
    _receiveFileOverChannel(ch, onProgress) {
      return new Promise((resolve, reject) => {
        ch.binaryType = 'arraybuffer';
        let meta = null; const chunks = []; let received = 0;
        ch.onmessage = (e) => {
          if (typeof e.data === 'string') {
            const msg = JSON.parse(e.data);
            if (msg.kind === 'meta') { meta = msg; received = 0; chunks.length = 0; }
            else if (msg.kind === 'done') {
              const blob = new Blob(chunks, { type: (meta && meta.type) || 'application/json' });
              resolve({ name: meta ? meta.name : 'aufnahme.json', blob });
            }
            return;
          }
          chunks.push(e.data); received += e.data.byteLength;
          if (onProgress && meta) onProgress(Math.min(1, received / meta.size));
        };
        ch.onerror = (e) => reject(e);
      });
    },

    // ---- Loopback: zwei Peers in derselben Seite verbinden (Selbsttest) ----
    async loopbackTest(file, onProgress) {
      const a = this._pc(), b = this._pc();
      a.onicecandidate = (e) => e.candidate && b.addIceCandidate(e.candidate);
      b.onicecandidate = (e) => e.candidate && a.addIceCandidate(e.candidate);
      const ch = a.createDataChannel('carlon');
      const recvP = new Promise((res) => { b.ondatachannel = (e) => res(this._receiveFileOverChannel(e.channel, onProgress)); });
      const opened = new Promise((res) => { ch.onopen = res; });
      const offer = await a.createOffer(); await a.setLocalDescription(offer); await b.setRemoteDescription(offer);
      const answer = await b.createAnswer(); await b.setLocalDescription(answer); await a.setRemoteDescription(answer);
      await opened;
      const [result] = await Promise.all([recvP, this._sendFileOverChannel(ch, file)]);
      a.close(); b.close();
      return result; // {name, blob}
    },

    // ---- Signaling über Relay (WebSocket) ----
    _signal(room) {
      const ws = new WebSocket(this.RELAY.replace(/\/$/, '') + '/room/' + encodeURIComponent(room));
      const api = { ws, send: (o) => ws.readyState === 1 && ws.send(JSON.stringify(o)), on: (fn) => { ws.onmessage = (e) => fn(JSON.parse(e.data)); }, close: () => ws.close() };
      return new Promise((res, rej) => { ws.onopen = () => res(api); ws.onerror = () => rej(new Error('Signaling nicht erreichbar')); });
    },

    // Empfänger (Tierarzt): Raum öffnen, auf Sender warten, Datei empfangen
    async receive(room, { onStatus, onProgress } = {}) {
      const sig = await this._signal(room);
      const pc = this._pc((s) => onStatus && onStatus(s));
      pc.onicecandidate = (e) => e.candidate && sig.send({ type: 'ice', candidate: e.candidate });
      const filePromise = new Promise((res) => { pc.ondatachannel = (e) => res(this._receiveFileOverChannel(e.channel, onProgress)); });
      sig.on(async (msg) => {
        if (msg.type === 'offer') { await pc.setRemoteDescription(msg.sdp); const a = await pc.createAnswer(); await pc.setLocalDescription(a); sig.send({ type: 'answer', sdp: a }); }
        else if (msg.type === 'ice' && msg.candidate) { try { await pc.addIceCandidate(msg.candidate); } catch (e) {} }
      });
      onStatus && onStatus('warten');
      const file = await filePromise; sig.close();
      return file; // {name, blob}
    },

    // Sender (Besitzer): Raum betreten, Datei senden
    async send(room, file, { onStatus, onProgress } = {}) {
      const sig = await this._signal(room);
      const pc = this._pc((s) => onStatus && onStatus(s));
      pc.onicecandidate = (e) => e.candidate && sig.send({ type: 'ice', candidate: e.candidate });
      const ch = pc.createDataChannel('carlon');
      sig.on(async (msg) => {
        if (msg.type === 'answer') { await pc.setRemoteDescription(msg.sdp); }
        else if (msg.type === 'ice' && msg.candidate) { try { await pc.addIceCandidate(msg.candidate); } catch (e) {} }
      });
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer); sig.send({ type: 'offer', sdp: offer });
      await new Promise((res) => { ch.onopen = res; });
      await this._sendFileOverChannel(ch, file, onProgress);
      onStatus && onStatus('gesendet'); setTimeout(() => sig.close(), 500);
    },

    roomCode() { const s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let r = ''; const a = new Uint8Array(6); crypto.getRandomValues(a); for (let i = 0; i < 6; i++) r += s[a[i] % s.length]; return r; },
  };
  window.P2P = P2P;
})();
