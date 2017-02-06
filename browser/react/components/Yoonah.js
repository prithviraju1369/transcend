import React from 'react';
import { joinChatRoom, leaveChatRoom } from '../../webRTC/client.js';
import Teleporter from './Teleporter';

export default class Yoonah extends React.Component {

  componentDidMount () {
    joinChatRoom('yoonah');
  }

  componentWillUnmount () {
    leaveChatRoom('yoonah');
  }

  render () {
    return (
      <a-entity id="room" position="0 0 0">
        <Teleporter x="-10" y="1" z="-1" color="green" href="/vr" />
        <a-entity geometry="primitive: plane; width:80; height:80;" position="2 0 -4" rotation="-90 0 0" material="color:#444444;"></a-entity>
        <a-sky src="#yoonah-background"></a-sky>
      </a-entity>
    );
  }
}