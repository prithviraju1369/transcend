/* global socket */

import AFRAME from 'aframe';

// This component fires an event on each render loop for each entity it's attached to (aka, every)

let hasGottenOthers = false;

export default AFRAME.registerComponent('publish-location', {
  tick: function () {
    socket.on('startTick', () => hasGottenOthers = true);
    if (hasGottenOthers) {
      const el = this.el;
      socket.emit('tick', { id: el.id, position: el.getAttribute('position'), rotation: el.getAttribute('rotation') });
    }
  }
});
