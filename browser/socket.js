// Socket.io Logic for Client
// Best paired with Socket.io Logic for Node.js Server

// Imports and Globals
/* global socket */
import io from 'socket.io-client';
// All A-Frame components need access to the socket instance
window.socket = io.connect(window.location.origin);
import { fromJS } from 'immutable';
import store from './redux/store';
import { receiveUsers } from './redux/reducers/user-reducer';
import { putUserOnDOM, addFirstPersonProperties } from './utils';
import './aframeComponents/publish-location';
import { setupLocalMedia, disconnectUser, addPeerConn, removePeerConn, setRemoteAnswer, setIceCandidate } from './webRTC/client';

// When the socket connection with the server is established, join the Socket.io room
//   based on the URL
socket.on('connect', () => {
  console.log('You\'ve made a persistent two-way connection to the server!');
  socket.emit('joinRoom', window.location);
});

// Upon joining a Socket.io room, the server emits the 'initWebRTC' event. This event
//   listerer triggers a function that tells the clients in the same socket.io room to
//   begin advertising WebRTC availability. By using a Socket.io room for signaling
//   WebRTC p2p connections, voice should now correspond with scenes. There may still
//   be some issues around WebRTC connections persisting after moving between scenes.
// TODO: Evaluate if the partChatChannel logic is needed to clean up WebRTC p2p conns.
socket.on('initWebRTC', () => {
  console.log('After joining room, initializing webRTC');
  setupLocalMedia();
});

// After receiving the user generated by the server, placed the user's avatar on the DOM
//   and add the A-Frame components to the avatar to make it a first-person avatar:
//     --Camera to see the scene from the perspective of the avatar
//     --Controls to orient the camera and move the avatar
//     --Real-time Updates to the server on the avatar's position and orientation to
//       allow other to see the user's movements
// Once the user's avatar is setup, retrieve the other users in the scene and perform
//   an initial render
// TODO: Evaluate if this emit needs to resend the room the avatar is in or if this
//   can be inferred by the joinRoom event
socket.on('createUser', user => {
  const avatar = putUserOnDOM(user);
  addFirstPersonProperties(avatar);
  socket.emit('getOthers');
});

// After the server generates an immutable map of all users other than the client's own
//   avatar, loop through the map, and pass the users to putUserOnDOM, which checks to
//   see if the other user is in the same room, and if they are, perform the initial
//   render of the other user's avatar. Once the initial render is complete, the client
//   emits two events:
//     --haveGottenOthers: an event that bounces to the server and immediately back to
//       instruct the user's avatar to begin broadcating real-time updates to the server.
//       While this likely seems unneccesary, the intention of this ping-pong is to provide
//       a hook for the server to throttle the frequency of client updates to the server.
//     --readyToReceiveUpdates: an event that tells the server to begin sending a
//       feed of updates of the User immutable map to this client to update the DOM nodes
//       representing the other users' avatars in real-time. This only occurs after
//       the initial render of the users is complete, which should avoid potential jenk
//       when joining a room with many avatars.
// TODO: Evaluate if the 'haveGottenOthers' and 'startTick' events should be eliminated and
//   replaced with events that allow the server to broadcast throttling instructions at any
//   time and not just when a client enters a room.
socket.on('getOthersCallback', users => {
  console.log('Checking to see if anyone is here');
  Object.keys(users).forEach(user => {
    putUserOnDOM(users[user]);
  });
  socket.emit('haveGottenOthers');
  socket.emit('readyToReceiveUpdates');
});

// Once the client subscribes to updates via 'ready to receive updates' the server emits
//   the 'usersUpdated' event every time the server's immutable map of users is updated. The
//   server filters out the user's own avatar, but all other filtering
//   is currently performed on the client. The users object is reconverted into an immutable
//   object to be stored in client-side Redux. Once the user has been re-retrieved from the
//   client-side Redux store, the room name is stripped from the URL and used to perform
//   local filtering of users to only show those that are in the same room. If the user is
//   in the same room, the user's avatar is either added to the DOM (if they just joined the
//   room) or the existing DOM node of the user is updated. If the user was not in the update,
//   the client assumes that the user has left the room and deletes the avatar.
// TODO: Is immutable needed here if we are only effectively caching the last server update?
// TODO: Replace client-side filtering with server-side filtering
// TODO: Consider creating explicit remove-client events fired by the server to allow the
//   server to emit smaller payloads that only include the users that actually changed since
//   last update.
socket.on('usersUpdated', users => {
  store.dispatch(receiveUsers(fromJS(users)));
  const receivedUsers = store.getState().users;
  receivedUsers.valueSeq().forEach(user => {
    // Pull the path off the URL, stripping forward slashes
    // For example, "localhost:1337/sean" would return "sean"
    // If we are at the root path, we instead received "root"
    // These values are passed up as "scene" in the user tick and correspond to the names of react components and a-scenes
    const currentScene = window.location.pathname.replace(/\//g, '') || 'root';
    // If the user is on the current scene, add or update the user
    if (user.get('scene') === currentScene) {
      const otherAvatar = document.getElementById(user.get('id'));
      if (otherAvatar === null) {
        putUserOnDOM(user.toJS());
      } else {
        otherAvatar.setAttribute('position', `${user.get('x')} ${user.get('y')} ${user.get('z')}`);
        otherAvatar.setAttribute('rotation', `${user.get('xrot')} ${user.get('yrot')} ${user.get('zrot')}`);
      }
    } else { // If the user is not on the scene, make sure the user is not on the DOM
      const otherAvatar = document.getElementById(user.get('id'));
      if (otherAvatar) {
        otherAvatar.parentNode.removeChild(otherAvatar);
      }
    }
  });
});

// Remove a user's avatar when they disconnect from the server
socket.on('removeUser', userId => {
  console.log('Removing user.');
  const scene = document.getElementById('scene');
  const avatarToBeRemoved = document.getElementById(userId);
  scene.remove(avatarToBeRemoved); // Remove from scene
  avatarToBeRemoved.parentNode.removeChild(avatarToBeRemoved); // Remove from DOM
});

// Adds a Peer to our DoM as their own Audio Element
socket.on('addPeer', addPeerConn);

// Removes Peer from DoM after they have disconnected or switched room
socket.on('removePeer', removePeerConn);

// Replies to an offer made by a new Peer
socket.on('sessionDescription', setRemoteAnswer);

// Handles setting the ice server for an ice Candidate
socket.on('iceCandidate', setIceCandidate);

// Removes all peer connections and audio Elements from the DoM
socket.on('disconnect', disconnectUser);


export function joinRoom (room) {
  socket.join(room);
}
